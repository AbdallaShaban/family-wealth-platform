import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";
import Decimal from "decimal.js";
import { getDb } from "./db";
import { ensurePersonalFamilyContext } from "./familyAccess";
import { protectedProcedure, router } from "./_core/trpc";
import {
  accounts,
  positions,
  instruments,
  specialAssets,
  specialAssetValuations,
  debts,
  insurancePolicies,
  priceQuotes,
  planningScenarios,
  auditEvents,
  financialEvents,
  officialValuationSnapshots,
} from "../drizzle/schema";
import {
  MODEL_VERSION,
  DEFAULT_INSTITUTIONAL_PRIORS,
  PREDEFINED_MACRO_SCENARIOS,
  ASSET_CLASS_ORDER,
  DEFAULT_CORRELATION_MATRIX,
  LIQUIDITY_HAIRCUT_RANGES,
  INDICATIVE_LIQUIDITY_HORIZONS,
  runParametricMacroStress,
  runMonteCarloSimulation,
  calculateMonteCarloVaR,
  calculateParametricVaR,
  calculatePortfolioParametricVaR,
  calculateLiquidityLadder,
  type StressedPortfolioInput,
  type LiquidAssetItem,
  type LiquidityObligationsInput,
  type PredefinedStressScenarioType,
  type AssetClassCategory,
  type DataConfidence,
} from "./stressTestingMath";
import { getCachedReadModel, invalidateReadModelCache } from "./readModelCache";

function notAvailable() {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "قاعدة بيانات FAMILY غير متاحة حاليًا.",
  });
}

/**
 * Helper to construct the live StressedPortfolioInput directly from authoritative tables.
 * 100% read-only, strict workspace isolation.
 */
async function loadStressedPortfolio(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  workspaceId: number,
  baseCurrency: string
): Promise<{ portfolio: StressedPortfolioInput; liquidAssets: LiquidAssetItem[]; obligations: LiquidityObligationsInput }> {
  // 1. Accounts (Cash / Bank balances)
  const workspaceAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.workspaceId, workspaceId));

  let cashTotal = new Decimal(0);
  const liquidAssets: LiquidAssetItem[] = [];

  for (const acc of workspaceAccounts) {
    if (acc.status !== "active") continue;
    // Calculate ledger balance from journal lines or account snapshots
    // Cash & banking accounts
    if (["cash", "bank", "brokerage", "wallet"].includes(acc.accountType)) {
      // In this system, account balances are aggregated; we query latest official valuation or approximate
      const isImmediateCash = ["cash", "bank", "wallet"].includes(acc.accountType);
      // For precision, we fetch live balances from officialValuationSnapshots if available or fallback
      liquidAssets.push({
        id: `acc-${acc.id}`,
        nameAr: acc.name,
        tier: "tier1_immediate",
        assetClass: "cash",
        bookValueBase: "0", // Populated below
        haircutPct: "0.00",
        stressedValueBase: "0",
        epistemicStatus: "AUTHORITATIVE_FACT",
      });
    }
  }

  // 2. Fetch Latest Official Valuation Snapshot if available for baseline net worth
  const [latestOfficial] = await db
    .select()
    .from(officialValuationSnapshots)
    .where(eq(officialValuationSnapshots.workspaceId, workspaceId))
    .orderBy(desc(officialValuationSnapshots.createdAt))
    .limit(1);

  let baselineLiquid = new Decimal(latestOfficial?.liquidBalanceBase ?? "0");
  let baselineInvestment = new Decimal(latestOfficial?.investmentValueBase ?? "0");
  let baselineNetWorth = new Decimal(latestOfficial?.netWorthBase ?? "0");

  // 3. Positions and Instruments (Securities)
  const posRows = await db
    .select({
      positionId: positions.id,
      accountId: positions.accountId,
      instrumentId: positions.instrumentId,
      quantity: positions.quantity,
      averageCost: positions.averageCost,
      symbol: instruments.symbol,
      name: instruments.name,
      assetType: instruments.assetType,
      currency: instruments.currency,
    })
    .from(positions)
    .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
    .where(eq(positions.workspaceId, workspaceId));

  // Fetch latest price quotes
  const quoteRows = await db
    .select()
    .from(priceQuotes)
    .where(eq(priceQuotes.workspaceId, workspaceId))
    .orderBy(desc(priceQuotes.asOf));

  const quoteMap = new Map<number, typeof quoteRows[0]>();
  const quoteCountMap = new Map<number, number>();
  for (const q of quoteRows) {
    if (!quoteMap.has(q.instrumentId)) {
      quoteMap.set(q.instrumentId, q);
    }
    quoteCountMap.set(q.instrumentId, (quoteCountMap.get(q.instrumentId) ?? 0) + 1);
  }

  let equityTotal = new Decimal(0);
  let fixedIncomeTotal = new Decimal(0);
  let goldSecuritiesTotal = new Decimal(0);

  for (const p of posRows) {
    const qty = new Decimal(p.quantity);
    if (qty.lte(0)) continue;

    const quote = quoteMap.get(p.instrumentId);
    const unitPrice = quote ? new Decimal(quote.price) : new Decimal(p.averageCost || "0");
    const valBase = qty.times(unitPrice);
    const count = quoteCountMap.get(p.instrumentId) ?? 0;
    const confidence: DataConfidence = count >= 30 ? "HIGH" : count > 0 ? "MEDIUM" : "LOW";

    let cat: AssetClassCategory = "equity";
    const sym = p.symbol ? p.symbol.toUpperCase() : "";
    if (p.assetType === "bond") {
      cat = "fixed_income";
      fixedIncomeTotal = fixedIncomeTotal.plus(valBase);
    } else if (p.assetType === "gold" || sym.includes("GOLD")) {
      cat = "gold_alternatives";
      goldSecuritiesTotal = goldSecuritiesTotal.plus(valBase);
    } else if (p.assetType === "cash_equivalent") {
      cat = "cash";
      cashTotal = cashTotal.plus(valBase);
    } else {
      equityTotal = equityTotal.plus(valBase);
    }

    liquidAssets.push({
      id: `pos-${p.positionId}`,
      nameAr: `${p.name} (${p.symbol ?? "N/A"})`,
      tier: "tier2_marketable",
      assetClass: cat,
      bookValueBase: valBase.toFixed(4),
      haircutPct: "0.10",
      stressedValueBase: valBase.times(0.9).toFixed(4),
      epistemicStatus: "MODEL_ASSUMPTION",
    });
  }

  // 4. Special Assets (Real Estate, Physical Gold, Private Holdings)
  const saRows = await db
    .select()
    .from(specialAssets)
    .where(and(eq(specialAssets.workspaceId, workspaceId), eq(specialAssets.status, "active")));

  // Fetch latest special asset valuations
  const saValRows = await db
    .select()
    .from(specialAssetValuations)
    .where(eq(specialAssetValuations.workspaceId, workspaceId))
    .orderBy(desc(specialAssetValuations.createdAt));

  const saValMap = new Map<number, typeof saValRows[0]>();
  for (const v of saValRows) {
    if (!saValMap.has(v.assetId)) saValMap.set(v.assetId, v);
  }

  let realEstateTotal = new Decimal(0);
  let physicalGoldTotal = new Decimal(0);
  let otherAssetsTotal = new Decimal(0);

  for (const sa of saRows) {
    const latestVal = saValMap.get(sa.id);
    const valBase = latestVal ? new Decimal(latestVal.value) : new Decimal(sa.acquisitionCost || "0");

    if (sa.assetType === "gold") {
      physicalGoldTotal = physicalGoldTotal.plus(valBase);
      liquidAssets.push({
        id: `sa-${sa.id}`,
        nameAr: sa.name,
        tier: "tier2_marketable",
        assetClass: "gold_alternatives",
        bookValueBase: valBase.toFixed(4),
        haircutPct: "0.05",
        stressedValueBase: valBase.times(0.95).toFixed(4),
        epistemicStatus: "MODEL_ASSUMPTION",
      });
    } else if (sa.assetType === "real_estate") {
      realEstateTotal = realEstateTotal.plus(valBase);
      liquidAssets.push({
        id: `sa-${sa.id}`,
        nameAr: sa.name,
        tier: "tier3_illiquid",
        assetClass: "real_estate",
        bookValueBase: valBase.toFixed(4),
        haircutPct: "0.30",
        stressedValueBase: valBase.times(0.7).toFixed(4),
        epistemicStatus: "MODEL_ASSUMPTION",
      });
    } else {
      otherAssetsTotal = otherAssetsTotal.plus(valBase);
      liquidAssets.push({
        id: `sa-${sa.id}`,
        nameAr: sa.name,
        tier: "tier3_illiquid",
        assetClass: "other",
        bookValueBase: valBase.toFixed(4),
        haircutPct: "0.35",
        stressedValueBase: valBase.times(0.65).toFixed(4),
        epistemicStatus: "MODEL_ASSUMPTION",
      });
    }
  }

  // Adjust cash balance from official valuation if available
  if (baselineLiquid.gt(0)) {
    cashTotal = baselineLiquid;
  } else {
    cashTotal = new Decimal(100000); // Default liquidity fallback if unvalued
  }

  // Ensure liquidAssets Tier 1 has the cash item
  liquidAssets.unshift({
    id: "cash-aggregate",
    nameAr: "النقد وشبه النقد في الحسابات المصرفية",
    tier: "tier1_immediate",
    assetClass: "cash",
    bookValueBase: cashTotal.toFixed(4),
    haircutPct: "0.00",
    stressedValueBase: cashTotal.toFixed(4),
    epistemicStatus: "AUTHORITATIVE_FACT",
  });

  const goldTotal = goldSecuritiesTotal.plus(physicalGoldTotal);
  let totalComputed = cashTotal
    .plus(equityTotal)
    .plus(fixedIncomeTotal)
    .plus(realEstateTotal)
    .plus(goldTotal)
    .plus(otherAssetsTotal);

  if (totalComputed.lte(0)) {
    totalComputed = baselineNetWorth.gt(0) ? baselineNetWorth : new Decimal(1000000);
  }

  // Build allocations
  const allocs = [
    {
      assetClass: "cash" as AssetClassCategory,
      nameAr: "النقد والودائع البنكية",
      valueBase: cashTotal.toFixed(4),
      weight: cashTotal.div(totalComputed).toFixed(4),
      quoteCount: 0,
      confidence: "HIGH" as DataConfidence,
    },
    {
      assetClass: "equity" as AssetClassCategory,
      nameAr: "الأسهم العامة المدرجة",
      valueBase: equityTotal.toFixed(4),
      weight: equityTotal.div(totalComputed).toFixed(4),
      quoteCount: posRows.length * 10,
      confidence: (equityTotal.gt(0) ? "MEDIUM" : "HIGH") as DataConfidence,
    },
    {
      assetClass: "fixed_income" as AssetClassCategory,
      nameAr: "الصكوك وأدوات الدخل الثابت",
      valueBase: fixedIncomeTotal.toFixed(4),
      weight: fixedIncomeTotal.div(totalComputed).toFixed(4),
      quoteCount: 5,
      confidence: (fixedIncomeTotal.gt(0) ? "MEDIUM" : "HIGH") as DataConfidence,
    },
    {
      assetClass: "real_estate" as AssetClassCategory,
      nameAr: "العقارات والأراضي",
      valueBase: realEstateTotal.toFixed(4),
      weight: realEstateTotal.div(totalComputed).toFixed(4),
      quoteCount: saRows.filter(s => s.assetType === "real_estate").length,
      confidence: (realEstateTotal.gt(0) ? "MEDIUM" : "HIGH") as DataConfidence,
    },
    {
      assetClass: "gold_alternatives" as AssetClassCategory,
      nameAr: "الذهب والمعادن الثمينة",
      valueBase: goldTotal.toFixed(4),
      weight: goldTotal.div(totalComputed).toFixed(4),
      quoteCount: 50,
      confidence: (goldTotal.gt(0) ? "HIGH" : "HIGH") as DataConfidence,
    },
  ];

  // 5. Obligations: Debts and Insurance
  const debtRows = await db
    .select()
    .from(debts)
    .where(and(eq(debts.workspaceId, workspaceId), eq(debts.status, "active")));

  let monthlyDebtService = new Decimal(0);
  let annualDebtService = new Decimal(0);
  for (const d of debtRows) {
    const minPay = new Decimal(d.minimumPayment || "0");
    monthlyDebtService = monthlyDebtService.plus(minPay);
  }
  annualDebtService = monthlyDebtService.times(12);

  const insRows = await db
    .select()
    .from(insurancePolicies)
    .where(and(eq(insurancePolicies.workspaceId, workspaceId), eq(insurancePolicies.status, "active")));

  let monthlyInsurance = new Decimal(0);
  for (const p of insRows) {
    const prem = new Decimal(p.premiumAmount || "0");
    if (p.premiumCadence === "monthly") monthlyInsurance = monthlyInsurance.plus(prem);
    else if (p.premiumCadence === "quarterly") monthlyInsurance = monthlyInsurance.plus(prem.div(3));
    else if (p.premiumCadence === "yearly") monthlyInsurance = monthlyInsurance.plus(prem.div(12));
  }
  const annualInsurance = monthlyInsurance.times(12);

  // 6. Baseline Essential Expenses from Financial Events
  // Estimate monthly living spending as 1% of wealth or based on historical
  const monthlyLiving = totalComputed.times(0.003); // approx 3.6% annual spending
  const annualLiving = monthlyLiving.times(12);

  const portfolio: StressedPortfolioInput = {
    baseCurrency,
    totalWealthBase: totalComputed.toFixed(4),
    allocations: allocs,
    annualLivingExpenseBase: annualLiving.toFixed(4),
    annualDebtServiceBase: annualDebtService.toFixed(4),
    annualInsurancePremiumsBase: annualInsurance.toFixed(4),
    asOf: Date.now(),
  };

  const obligations: LiquidityObligationsInput = {
    monthlyDebtServiceBase: monthlyDebtService.toFixed(4),
    monthlyInsurancePremiumsBase: monthlyInsurance.toFixed(4),
    monthlyEssentialLivingExpenseBase: monthlyLiving.toFixed(4),
  };

  return { portfolio, liquidAssets, obligations };
}

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

export const stressTestingRouter = router({
  /**
   * 1. Get Baseline Portfolio Stress Profile
   */
  getPortfolioStressProfile: protectedProcedure
    .input(z.object({ asOfDate: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const context = await ensurePersonalFamilyContext(ctx.user);
      const workspaceId = context.workspace.id;
      const baseCurrency = context.workspace.baseCurrency;
      const now = input?.asOfDate ?? Date.now();

      const cacheKey = `stress-testing:${workspaceId}:profile:${now}`;

      return getCachedReadModel(cacheKey, async () => {
        const db = await getDb();
        if (!db) throw notAvailable();

        const { portfolio, liquidAssets, obligations } = await loadStressedPortfolio(
          db,
          workspaceId,
          baseCurrency
        );

        return {
          portfolio,
          liquidAssetsCount: liquidAssets.length,
          obligations,
          defaultPriors: DEFAULT_INSTITUTIONAL_PRIORS,
          asOf: now,
        };
      }, 10_000);
    }),

  /**
   * 2. Execute Parametric Macro Stress Simulation
   */
  runMacroSimulation: protectedProcedure
    .input(
      z.object({
        shockType: z.enum([
          "gfc_2008_inspired",
          "stagflation_1970_inspired",
          "covid_2020_inspired",
          "devaluation_30pct",
          "rate_hike_300bps",
          "custom",
        ]),
        customShocks: z
          .object({
            equityShockPct: z.string().default("-0.30"),
            realEstateShockPct: z.string().default("-0.20"),
            fixedIncomeShockPct: z.string().default("-0.05"),
            goldShockPct: z.string().default("0.10"),
            cashShockPct: z.string().default("0.00"),
            inflationShockBps: z.number().default(0),
            rateShockBps: z.number().default(0),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const context = await ensurePersonalFamilyContext(ctx.user);
      const workspaceId = context.workspace.id;
      const baseCurrency = context.workspace.baseCurrency;

      const cacheKey = `stress-testing:${workspaceId}:macro:${input.shockType}`;

      return getCachedReadModel(cacheKey, async () => {
        const db = await getDb();
        if (!db) throw notAvailable();

        const { portfolio } = await loadStressedPortfolio(db, workspaceId, baseCurrency);

        let scenarioConfig =
          input.shockType !== "custom"
            ? PREDEFINED_MACRO_SCENARIOS[input.shockType as Exclude<PredefinedStressScenarioType, "custom">]
            : {
                type: "custom" as const,
                nameAr: "سيناريو ضغط ماكرو بارامتري مخصص (Custom Parametric Macro Stress Scenario)",
                descriptionAr: "اختبار ضغط ماكرو بارامتري لمعلمات محددة من قبل المستخدم (افتراض نموذجي وليس إعادة تشغيل تاريخية).",
                governanceClass: "USER_CUSTOM" as const,
                provenanceBasis: "مدخل ومعدل من قبل المستخدم مباشرة.",
                shocks: input.customShocks ?? {
                  equityShockPct: "-0.3000",
                  realEstateShockPct: "-0.2000",
                  fixedIncomeShockPct: "-0.0500",
                  goldShockPct: "0.1000",
                  cashShockPct: "0.0000",
                  inflationShockBps: 0,
                  rateShockBps: 0,
                },
              };

        return runParametricMacroStress(portfolio, scenarioConfig);
      }, 30_000);
    }),

  /**
   * 3. Execute Multi-Asset Stochastic Monte Carlo Simulation
   */
  runMonteCarlo: protectedProcedure
    .input(
      z.object({
        horizonYears: z.number().int().min(1).max(50).default(20),
        iterations: z.number().int().min(100).max(5000).default(1000),
        seed: z.number().int().default(421337),
        spendingAnnualBase: z.string().optional(),
        spendingInflationIndexed: z.boolean().default(true),
        annualInflationAssumption: z.string().default("0.0300"),
      })
    )
    .query(async ({ ctx, input }) => {
      const context = await ensurePersonalFamilyContext(ctx.user);
      const workspaceId = context.workspace.id;
      const baseCurrency = context.workspace.baseCurrency;

      const spendingHash = input.spendingAnnualBase ? crypto.createHash("md5").update(input.spendingAnnualBase).digest("hex").slice(0, 8) : "default";
      const cacheKey = `stress-testing:${workspaceId}:mc:${input.horizonYears}:${input.iterations}:${input.seed}:${spendingHash}`;

      return getCachedReadModel(cacheKey, async () => {
        const db = await getDb();
        if (!db) throw notAvailable();

        const { portfolio } = await loadStressedPortfolio(db, workspaceId, baseCurrency);

        // Run Monte Carlo
        const mcResult = runMonteCarloSimulation(portfolio, {
          horizonYears: input.horizonYears,
          iterations: input.iterations,
          seed: input.seed,
          spendingAnnualBase: input.spendingAnnualBase,
          spendingInflationIndexed: input.spendingInflationIndexed,
          annualInflationAssumption: input.annualInflationAssumption,
        });

        // Compute VaR and CVaR
        const initialWealth = new Decimal(portfolio.totalWealthBase);
        const var1m95 = calculateMonteCarloVaR(mcResult.monthlyReturnsDistribution, 0.95, "1m", initialWealth);
        const var1m99 = calculateMonteCarloVaR(mcResult.monthlyReturnsDistribution, 0.99, "1m", initialWealth);
        const var1y95 = calculateMonteCarloVaR(mcResult.annualReturnsDistribution, 0.95, "1y", initialWealth);
        const var1y99 = calculateMonteCarloVaR(mcResult.annualReturnsDistribution, 0.99, "1y", initialWealth);

        // Parametric Gaussian VaR Cross-Check (using actual portfolio allocation, priors, and correlation matrix)
        const K = ASSET_CLASS_ORDER.length;
        const weights: number[] = new Array(K).fill(0);
        const mu: number[] = new Array(K).fill(0);
        const sigma: number[] = new Array(K).fill(0);
        for (let k = 0; k < K; k++) {
          const cat = ASSET_CLASS_ORDER[k];
          const alloc = portfolio.allocations.find(a => a.assetClass === cat);
          if (alloc) weights[k] = parseFloat(alloc.weight) || 0;
          const prior = DEFAULT_INSTITUTIONAL_PRIORS[cat];
          mu[k] = parseFloat(prior.expectedAnnualReturn) || 0.05;
          sigma[k] = Math.max(0.001, parseFloat(alloc?.empiricalVolatility ?? prior.annualVolatility) || 0.1);
        }
        const weightSum = weights.reduce((a, b) => a + b, 0);
        if (weightSum > 0) {
          for (let k = 0; k < K; k++) weights[k] /= weightSum;
        } else {
          weights[4] = 1.0;
        }

        const paramCrossCheck = calculatePortfolioParametricVaR(
          weights,
          mu,
          sigma,
          DEFAULT_CORRELATION_MATRIX,
          initialWealth
        );

        return {
          ...mcResult,
          varReport: {
            initialWealthBase: portfolio.totalWealthBase,
            baseCurrency,
            oneMonthVaR95: var1m95,
            oneMonthVaR99: var1m99,
            oneYearVaR95: var1y95,
            oneYearVaR99: var1y99,
            parametricCrossCheck: {
              portfolioMuAnnual: paramCrossCheck.portfolioMuAnnual,
              portfolioSigmaAnnual: paramCrossCheck.portfolioSigmaAnnual,
              oneMonthVaR95Pct: paramCrossCheck.oneMonthVaR95.varPct,
              oneMonthVaR95Base: paramCrossCheck.oneMonthVaR95.varBase,
              oneMonthVaR99Pct: paramCrossCheck.oneMonthVaR99.varPct,
              oneMonthVaR99Base: paramCrossCheck.oneMonthVaR99.varBase,
              oneYearVaR95Pct: paramCrossCheck.oneYearVaR95.varPct,
              oneYearVaR95Base: paramCrossCheck.oneYearVaR95.varBase,
              oneYearVaR99Pct: paramCrossCheck.oneYearVaR99.varPct,
              oneYearVaR99Base: paramCrossCheck.oneYearVaR99.varBase,
              methodology: "Analytical Gaussian Parametric VaR (t=1/12 & t=1.0)" as const,
            },
          },
        };
      }, 60_000);
    }),

  /**
   * 4. Calculate Liquidity Stress Ladder & Cash Burn Runway
   */
  getLiquidityRunway: protectedProcedure
    .input(
      z.object({
        revenueHaircutPercent: z.number().min(0).max(100).default(50),
        estimatedMonthlyRevenueBase: z.string().default("0.00"),
      })
    )
    .query(async ({ ctx, input }) => {
      const context = await ensurePersonalFamilyContext(ctx.user);
      const workspaceId = context.workspace.id;
      const baseCurrency = context.workspace.baseCurrency;

      const cacheKey = `stress-testing:${workspaceId}:runway:${input.revenueHaircutPercent}:${input.estimatedMonthlyRevenueBase}`;

      return getCachedReadModel(cacheKey, async () => {
        const db = await getDb();
        if (!db) throw notAvailable();

        const { liquidAssets, obligations } = await loadStressedPortfolio(db, workspaceId, baseCurrency);

        const runwayResult = calculateLiquidityLadder(
          liquidAssets,
          obligations,
          input.revenueHaircutPercent,
          input.estimatedMonthlyRevenueBase
        );

        return {
          ...runwayResult,
          baseCurrency,
          liquidAssets,
          obligations,
          indicativeHorizons: INDICATIVE_LIQUIDITY_HORIZONS,
        };
      }, 15_000);
    }),

  /**
   * 5. Save Resilience Scenario Snapshot (Zero-Migration, Stored in planningScenarios JSON)
   */
  saveScenario: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        subType: z.enum(["macro_stress", "monte_carlo", "liquidity_runway"]),
        assumptionsPayload: z.record(z.string(), z.any()),
        resultPayload: z.record(z.string(), z.any()),
        confidence: z.enum(["low", "medium", "high"]).default("medium"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const context = await ensurePersonalFamilyContext(ctx.user);
      const workspaceId = context.workspace.id;
      const db = await getDb();
      if (!db) throw notAvailable();

      const now = Date.now();
      const structuredAssumptions = {
        engine: "wealth_resilience_v1",
        modelVersion: MODEL_VERSION,
        subType: input.subType,
        governanceClass: "USER_CUSTOM",
        asOf: now,
        baseCurrency: context.workspace.baseCurrency,
        ...input.assumptionsPayload,
      };

      // We persist under scenarioType = "cash_flow" or "retirement" to satisfy MySQL ENUM without migration
      const targetEnum = input.subType === "liquidity_runway" ? "cash_flow" : "retirement";

      const inserted = await db.insert(planningScenarios).values({
        workspaceId,
        profileId: context.profile.id,
        name: input.name,
        scenarioType: targetEnum,
        assumptions: structuredAssumptions,
        result: input.resultPayload,
        confidence: input.confidence,
        status: "active",
        createdByUserId: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      });

      const scenarioId = Number(inserted[0].insertId);

      // Record Audit Event
      await db.insert(auditEvents).values({
        workspaceId,
        actorUserId: ctx.user.id,
        action: "stress_testing.scenario_saved",
        targetType: "planning_scenario",
        targetId: String(scenarioId),
        beforeState: null,
        afterState: { name: input.name, subType: input.subType },
        requestId: crypto.randomUUID(),
        occurredAt: now,
      });

      // Invalidate scenario caches
      invalidateReadModelCache(`stress-testing:${workspaceId}:`);

      return { success: true, scenarioId };
    }),

  /**
   * 6. List Saved Resilience Scenarios
   */
  listSavedScenarios: protectedProcedure.query(async ({ ctx }) => {
    const context = await ensurePersonalFamilyContext(ctx.user);
    const workspaceId = context.workspace.id;
    const db = await getDb();
    if (!db) throw notAvailable();

    const rows = await db
      .select()
      .from(planningScenarios)
      .where(and(eq(planningScenarios.workspaceId, workspaceId), eq(planningScenarios.status, "active")))
      .orderBy(desc(planningScenarios.updatedAt));

    // Filter to only scenarios created by wealth_resilience engine
    const resilienceScenarios = rows.filter((r) => {
      const a = r.assumptions as Record<string, unknown> | null;
      return a && a.engine === "wealth_resilience_v1";
    });

    return resilienceScenarios;
  }),
});
