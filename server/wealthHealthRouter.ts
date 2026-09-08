import { and, desc, eq, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { getDb } from "./db";
import { ensurePersonalFamilyContext, assertRole } from "./familyAccess";
import { protectedProcedure, router } from "./_core/trpc";
import {
  accounts,
  debts,
  insurancePolicies,
  retirementPlans,
  specialAssets,
  specialAssetValuations,
  positions,
  instruments,
  priceQuotes,
  fxRates,
  cashFlowCategories,
  financialEvents,
  journalEntries,
  journalLines,
} from "../drizzle/schema";
import { generateFinancialStatementsPackage } from "./financialStatementsRouter";
import { listDebtSummaries } from "./familyRead";
import {
  toDec,
  formatDec,
  calculateLiquidityScore,
  calculateDebtSustainabilityScore,
  calculateSavingsVelocityScore,
  calculatePortfolioDiversificationScore,
  calculateResilienceProtectionScore,
  calculateFiProgressScore,
  calculateWealthHealthScore,
  deriveDataConfidence,
  calculateFireHorizon,
  generateStandardFireScenarios,
  type AssetClassKey,
  type WealthHealthScorePackage,
  type FireHorizonResult,
  type FireScenarioPlan,
} from "./wealthHealthMath";
import { getCachedReadModel, invalidateReadModelCache } from "./readModelCache";

function notAvailable() {
  return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة حاليًا." });
}

export const wealthHealthScoreInputSchema = z.object({
  asOf: z.number().int().positive().max(Date.now() + 300_000).optional(),
}).optional();

export const fireStatusInputSchema = z
  .object({
    asOf: z.number().int().positive().max(Date.now() + 300_000).optional(),
    spendingMode: z.enum(["actual_ttm", "essential_ttm", "custom"]).default("actual_ttm"),
    customSpending: z.string().trim().optional(),
    customSwr: z.string().trim().optional(),
    customNominalReturn: z.string().trim().optional(),
    customInflation: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    // Rule 1: If spendingMode === 'custom', customSpending is REQUIRED, > 0, <= 10^12
    if (data.spendingMode === "custom") {
      if (!data.customSpending) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "يجب إدخال قيمة الإنفاق السنوي المخصص عند اختيار النمط المخصص.",
          path: ["customSpending"],
        });
      } else {
        try {
          const d = new Decimal(data.customSpending);
          if (!d.isFinite() || d.lte(0) || d.gt("1e12")) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "قيمة الإنفاق المخصص يجب أن تكون رقمًا موجبًا لا يتجاوز تريليون.",
              path: ["customSpending"],
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "قيمة الإنفاق المخصص غير صالحة.",
            path: ["customSpending"],
          });
        }
      }
    } else {
      // Rule 2: If spendingMode !== 'custom', customSpending must NOT be provided
      if (data.customSpending && data.customSpending.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "لا يمكن تقديم إنفاق مخصص إلا عند اختيار النمط المخصص.",
          path: ["customSpending"],
        });
      }
    }

    // Rule 3: customSwr in (0, 100]
    if (data.customSwr) {
      try {
        const d = new Decimal(data.customSwr);
        if (!d.isFinite() || d.lte(0) || d.gt(100)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "معدل السحب الآمن (SWR) يجب أن يكون بين 0% و 100%.",
            path: ["customSwr"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "معدل السحب الآمن غير صالح.",
          path: ["customSwr"],
        });
      }
    }

    // Rule 4: customNominalReturn in [-50, 100]
    if (data.customNominalReturn) {
      try {
        const d = new Decimal(data.customNominalReturn);
        if (!d.isFinite() || d.lt(-50) || d.gt(100)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "معدل العائد الاسمي يجب أن يكون بين -50% و 100%.",
            path: ["customNominalReturn"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "معدل العائد الاسمي غير صالح.",
          path: ["customNominalReturn"],
        });
      }
    }

    // Rule 5: customInflation in [-20, 100]
    if (data.customInflation) {
      try {
        const d = new Decimal(data.customInflation);
        if (!d.isFinite() || d.lt(-20) || d.gt(100)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "معدل التضخم السنوي يجب أن يكون بين -20% و 100%.",
            path: ["customInflation"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "معدل التضخم السنوي غير صالح.",
          path: ["customInflation"],
        });
      }
    }
  });

export const saveAssumptionsInputSchema = z.object({
  retirementAge: z.number().int().min(18).max(100),
  safeWithdrawalRate: z.string().trim(),
  assumedAnnualReturn: z.string().trim(),
  assumedAnnualInflation: z.string().trim(),
});

/**
 * Core Data Loader: Computes all necessary aggregations for Wealth Health & FIRE
 */
async function loadWealthHealthAggregations(
  family: Awaited<ReturnType<typeof ensurePersonalFamilyContext>>,
  asOfTimestamp: number
) {
  const db = await getDb();
  if (!db) throw notAvailable();

  const workspaceId = family.workspace.id;
  const baseCurrency = family.workspace.baseCurrency;
  const asOfDate = new Date(asOfTimestamp);

  // 1-year lookback for TTM
  const oneYearAgo = new Date(asOfTimestamp - 365 * 24 * 3600 * 1000);
  const asOfIso = asOfDate.toISOString().slice(0, 10);
  const startIso = oneYearAgo.toISOString().slice(0, 10);

  // 1. Authoritative Financial Statements Package for TTM
  const pkg = await generateFinancialStatementsPackage(family, {
    asOf: asOfIso,
    startDate: startIso,
    endDate: asOfIso,
  });

  // Balance sheet figures
  const totalBookAssets = toDec(pkg.bookBalanceSheet.assets.totalBookAssets);
  const totalDebtPrincipal = toDec(pkg.bookBalanceSheet.liabilities.totalBookLiabilities);
  const economicNetWorth = toDec(pkg.economicNetWorthBridge.economicNetWorth);
  const totalEconomicAssets = economicNetWorth.plus(totalDebtPrincipal);
  const liquidCashReserves = toDec(pkg.bookBalanceSheet.assets.cashAndEquivalents.totalBase);

  // Cash flow figures
  const operatingInflows = toDec(pkg.cashFlowStatement.operatingActivities.operatingReceipts).plus(
    toDec(pkg.cashFlowStatement.operatingActivities.dividendReceipts)
  );
  const operatingExpenses = toDec(pkg.cashFlowStatement.operatingActivities.operatingPayments)
    .plus(toDec(pkg.cashFlowStatement.operatingActivities.tradingFeesAndTaxes))
    .plus(toDec(pkg.cashFlowStatement.operatingActivities.interestPayments));
  const debtPrincipalRepayments = toDec(pkg.cashFlowStatement.financingActivities.debtPrincipalRepayments);
  const interestPayments = toDec(pkg.cashFlowStatement.operatingActivities.interestPayments);

  // 2. Fetch Debts and Contractual Debt Service
  const debtSummaries = await listDebtSummaries(family);
  let annualDebtService = new Decimal(0);
  let monthlyDebtMinimumTotal = new Decimal(0);

  for (const d of debtSummaries) {
    if (d.status === "active") {
      const minPay = toDec(d.baseMinimumPayment ?? "0");
      monthlyDebtMinimumTotal = monthlyDebtMinimumTotal.plus(minPay);
      annualDebtService = annualDebtService.plus(minPay.times(12));
    }
  }

  // 3. TTM Essential Expenses Query
  const essentialExpenseRows = await db
    .select({
      actualAmountBase: sql<string>`COALESCE(SUM(${journalLines.baseAmount}), 0)`,
    })
    .from(financialEvents)
    .innerJoin(cashFlowCategories, eq(financialEvents.categoryId, cashFlowCategories.id))
    .innerJoin(journalEntries, eq(journalEntries.eventId, financialEvents.id))
    .innerJoin(
      journalLines,
      and(
        eq(journalLines.entryId, journalEntries.id),
        eq(journalLines.accountId, financialEvents.primaryAccountId!)
      )
    )
    .where(
      and(
        eq(financialEvents.workspaceId, workspaceId),
        eq(financialEvents.status, "posted"),
        eq(financialEvents.eventType, "expense"),
        eq(cashFlowCategories.isEssential, "yes"),
        sql`${financialEvents.occurredAt} >= ${oneYearAgo.getTime()}`,
        sql`${financialEvents.occurredAt} <= ${asOfTimestamp}`
      )
    );

  const rawEssentialBase = toDec(essentialExpenseRows[0]?.actualAmountBase ?? "0");
  // If essential expenses are tagged in cash flow categories, use them;
  // otherwise fallback to 70% of total operating expenses as a conservative baseline
  const ttmEssentialExpenses = rawEssentialBase.gt(0)
    ? rawEssentialBase
    : operatingExpenses.times("0.70");

  const monthlyEssentialExpenses = ttmEssentialExpenses.div(12);
  const monthlyEssentialOutflows = monthlyEssentialExpenses.plus(monthlyDebtMinimumTotal);

  // Operating cash flow pre-debt service = I_op - (E_op non-debt expenses)
  const ocfPreDebt = operatingInflows.minus(operatingExpenses.minus(interestPayments));

  // 4. Asset Holdings & Diversification / Investable Assets
  // Query securities positions
  const rawPositions = await db
    .select({
      id: positions.id,
      quantity: positions.quantity,
      averageCost: positions.averageCost,
      assetType: instruments.assetType,
      instrumentName: instruments.name,
      currency: instruments.currency,
      instrumentId: instruments.id,
    })
    .from(positions)
    .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
    .where(eq(positions.workspaceId, workspaceId));

  const [rawQuotes, rawFxRates] = await Promise.all([
    db
      .select()
      .from(priceQuotes)
      .where(eq(priceQuotes.workspaceId, workspaceId))
      .orderBy(desc(priceQuotes.asOf)),
    db
      .select()
      .from(fxRates)
      .where(
        and(
          eq(fxRates.workspaceId, workspaceId),
          eq(fxRates.toCurrency, baseCurrency)
        )
      )
      .orderBy(desc(fxRates.asOf)),
  ]);

  const latestQuoteMap = new Map<number, (typeof rawQuotes)[0]>();
  for (const q of rawQuotes) {
    if (!latestQuoteMap.has(q.instrumentId) && q.asOf <= asOfTimestamp) {
      latestQuoteMap.set(q.instrumentId, q);
    }
  }

  const latestFxMap = new Map<string, (typeof rawFxRates)[0]>();
  for (const f of rawFxRates) {
    if (!latestFxMap.has(f.fromCurrency) && f.asOf <= asOfTimestamp) {
      latestFxMap.set(f.fromCurrency, f);
    }
  }

  const holdingsList: Array<{ name: string; value: Decimal }> = [];
  let securitiesMarketValueBase = new Decimal(0);
  let securitiesFreshValueBase = new Decimal(0);
  let equityValueBase = new Decimal(0);
  let fixedIncomeValueBase = new Decimal(0);

  const oneDayAgo = asOfTimestamp - 24 * 3600 * 1000;

  for (const p of rawPositions) {
    const quote = latestQuoteMap.get(p.instrumentId);
    const qty = toDec(p.quantity);
    if (qty.lte(0)) continue;

    const price = quote ? toDec(quote.price) : toDec(p.averageCost);
    const posValLocal = qty.times(price);

    const fxRate = p.currency === baseCurrency ? new Decimal(1) : latestFxMap.get(p.currency) ? toDec(latestFxMap.get(p.currency)!.rate) : new Decimal(1);
    const posValBase = posValLocal.times(fxRate);

    securitiesMarketValueBase = securitiesMarketValueBase.plus(posValBase);
    holdingsList.push({ name: p.instrumentName, value: posValBase });

    // Asset classification
    if (p.assetType === "bond") {
      fixedIncomeValueBase = fixedIncomeValueBase.plus(posValBase);
    } else {
      equityValueBase = equityValueBase.plus(posValBase);
    }

    // Freshness policy for securities: fresh if quote <= 24 hours old
    if (quote && quote.asOf >= oneDayAgo) {
      securitiesFreshValueBase = securitiesFreshValueBase.plus(posValBase);
    }
  }

  // Query special assets (Gold, Real Estate, Vehicles, etc.)
  const [rawSpecialAssets, rawValuations] = await Promise.all([
    db.select().from(specialAssets).where(eq(specialAssets.workspaceId, workspaceId)),
    db
      .select()
      .from(specialAssetValuations)
      .where(eq(specialAssetValuations.workspaceId, workspaceId))
      .orderBy(desc(specialAssetValuations.asOf)),
  ]);

  const latestValuationByAsset = new Map<number, (typeof rawValuations)[0]>();
  for (const v of rawValuations) {
    if (!latestValuationByAsset.has(v.assetId) && v.asOf <= asOfTimestamp) {
      latestValuationByAsset.set(v.assetId, v);
    }
  }

  let goldValueBase = new Decimal(0);
  let realEstateValueBase = new Decimal(0);
  let otherAssetsValueBase = new Decimal(0);
  let specialAssetsFreshValueBase = new Decimal(0);

  const fortyEightHoursAgo = asOfTimestamp - 48 * 3600 * 1000;
  const ninetyDaysAgo = asOfTimestamp - 90 * 24 * 3600 * 1000;
  const oneYearAgoTimestamp = asOfTimestamp - 365 * 24 * 3600 * 1000;

  for (const s of rawSpecialAssets) {
    const val = latestValuationByAsset.get(s.id);
    const localVal = val ? toDec(val.value) : toDec(s.acquisitionCost ?? "0");
    const curr = val?.currency ?? s.acquisitionCurrency ?? baseCurrency;
    const fx = curr === baseCurrency ? new Decimal(1) : latestFxMap.get(curr) ? toDec(latestFxMap.get(curr)!.rate) : new Decimal(1);
    const assetValBase = localVal.times(fx);

    holdingsList.push({ name: s.name, value: assetValBase });

    if (s.assetType === "gold") {
      goldValueBase = goldValueBase.plus(assetValBase);
      // Gold freshness: <= 48 hours
      if (val && val.asOf >= fortyEightHoursAgo) {
        specialAssetsFreshValueBase = specialAssetsFreshValueBase.plus(assetValBase);
      }
    } else if (s.assetType === "real_estate") {
      realEstateValueBase = realEstateValueBase.plus(assetValBase);
      // Real Estate freshness: <= 365 days
      if (val && val.asOf >= oneYearAgoTimestamp) {
        specialAssetsFreshValueBase = specialAssetsFreshValueBase.plus(assetValBase);
      }
    } else {
      otherAssetsValueBase = otherAssetsValueBase.plus(assetValBase);
      // Manual / Other freshness: <= 90 days
      if (val && val.asOf >= ninetyDaysAgo) {
        specialAssetsFreshValueBase = specialAssetsFreshValueBase.plus(assetValBase);
      }
    }
  }

  // Cash holding
  holdingsList.push({ name: "الاحتياطي النقدي والحسابات البنكية", value: liquidCashReserves });
  // Cash is always fresh
  const cashFreshValueBase = liquidCashReserves;

  // Total fresh asset value
  const totalFreshAssetValue = cashFreshValueBase
    .plus(securitiesFreshValueBase)
    .plus(specialAssetsFreshValueBase);

  // Authoritative Investable Assets A_inv:
  // Liquid cash + Securities + Physical Gold
  // Primary Residence and Vehicles are EXCLUDED
  const investableAssets = liquidCashReserves
    .plus(securitiesMarketValueBase)
    .plus(goldValueBase);

  // 5. Insurance Policies
  const rawPolicies = await db
    .select()
    .from(insurancePolicies)
    .where(and(eq(insurancePolicies.workspaceId, workspaceId), eq(insurancePolicies.status, "active")));

  let hasActiveHealthPolicy = false;
  let activeLifeCoverageAmount = new Decimal(0);
  let hasActivePropertyOrMotorPolicy = false;

  for (const pol of rawPolicies) {
    if (pol.policyType === "health") {
      hasActiveHealthPolicy = true;
    } else if (pol.policyType === "life") {
      const cov = toDec(pol.coverageAmount ?? "0");
      const fx = pol.currency === baseCurrency ? new Decimal(1) : latestFxMap.get(pol.currency) ? toDec(latestFxMap.get(pol.currency)!.rate) : new Decimal(1);
      activeLifeCoverageAmount = activeLifeCoverageAmount.plus(cov.times(fx));
    } else if (pol.policyType === "property" || pol.policyType === "motor") {
      hasActivePropertyOrMotorPolicy = true;
    }
  }

  const hasPhysicalRealEstateOrMotor = rawSpecialAssets.some(
    s => s.assetType === "real_estate" || s.assetType === "other"
  );

  // 6. Data History & Completeness for Confidence Rating
  const earliestEntry = await db
    .select({ postedAt: journalEntries.postedAt })
    .from(journalEntries)
    .where(and(eq(journalEntries.workspaceId, workspaceId), eq(journalEntries.status, "posted")))
    .orderBy(journalEntries.postedAt)
    .limit(1);

  let historyMonths = 12;
  if (earliestEntry.length > 0 && earliestEntry[0].postedAt) {
    const diffMs = asOfTimestamp - earliestEntry[0].postedAt;
    historyMonths = Math.max(1, Math.floor(diffMs / (30.4375 * 24 * 3600 * 1000)));
  }

  const allAccounts = await db.select().from(accounts).where(eq(accounts.workspaceId, workspaceId));
  const totalAccounts = allAccounts.length;
  const reconciledAccounts = allAccounts.filter(a => a.isSystemAccount === "no").length;

  return {
    workspaceId,
    baseCurrency,
    asOfTimestamp,
    liquidCashReserves,
    monthlyEssentialOutflows,
    totalDebtPrincipal,
    totalEconomicAssets,
    annualDebtService,
    ocfPreDebt,
    operatingInflows,
    operatingExpenses,
    debtPrincipalRepayments,
    ttmEssentialExpenses,
    investableAssets,
    classValues: {
      cash: liquidCashReserves,
      equity: equityValueBase,
      fixed_income: fixedIncomeValueBase,
      alternatives: goldValueBase.plus(realEstateValueBase),
      other: otherAssetsValueBase,
    },
    holdingsList,
    totalFreshAssetValue,
    hasActiveHealthPolicy,
    activeLifeCoverageAmount,
    hasPhysicalRealEstateOrMotor,
    hasActivePropertyOrMotorPolicy,
    historyMonths,
    totalAccounts,
    reconciledAccounts,
    unvaluedForeignCurrenciesCount: 0,
  };
}

// ============================================================================
// TRPC ROUTER IMPLEMENTATION
// ============================================================================

export const wealthHealthRouter = router({
  /**
   * Procedure 1: getScoreCard
   * Computes the full 6-dimension score card with explainable drivers and confidence rating.
   */
  getScoreCard: protectedProcedure
    .input(wealthHealthScoreInputSchema)
    .query(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      const asOf = input?.asOf ?? Date.now();
      const cacheKey = `wealth-health:score:${family.workspace.id}:${Math.floor(asOf / 60_000)}`;

      return getCachedReadModel(
        cacheKey,
        async () => {
          const data = await loadWealthHealthAggregations(family, asOf);

          // Dimension 1: Liquidity (20%)
          const d1 = calculateLiquidityScore(
            data.liquidCashReserves,
            data.monthlyEssentialOutflows
          );

          // Dimension 2: Debt Sustainability (20%)
          const d2 = calculateDebtSustainabilityScore(
            data.totalDebtPrincipal,
            data.totalEconomicAssets,
            data.annualDebtService,
            data.ocfPreDebt
          );

          // Dimension 3: Savings Velocity (20%)
          const d3 = calculateSavingsVelocityScore(
            data.operatingInflows,
            data.operatingExpenses,
            data.debtPrincipalRepayments
          );

          // Dimension 4: Diversification (15%)
          const d4 = calculatePortfolioDiversificationScore(
            data.classValues,
            data.holdingsList
          );

          // Dimension 5: Resilience & Protection (10%)
          const d5 = calculateResilienceProtectionScore({
            totalEconomicAssets: data.totalEconomicAssets,
            freshAssetValue: data.totalFreshAssetValue,
            hasActiveHealthPolicy: data.hasActiveHealthPolicy,
            activeLifeCoverageAmount: data.activeLifeCoverageAmount,
            totalDebtPrincipal: data.totalDebtPrincipal,
            hasPhysicalRealEstateOrMotor: data.hasPhysicalRealEstateOrMotor,
            hasActivePropertyOrMotorPolicy: data.hasActivePropertyOrMotorPolicy,
          });

          // Dimension 6: FI Progress (15%)
          const d6 = calculateFiProgressScore(
            data.investableAssets,
            data.operatingExpenses, // Actual TTM living expenses
            "0.04"
          );

          // Confidence Index
          const confidence = deriveDataConfidence({
            historyMonths: data.historyMonths,
            totalAccounts: data.totalAccounts,
            reconciledOrActiveAccounts: data.reconciledAccounts,
            totalExpenseVolume: data.operatingExpenses,
            categorizedExpenseVolume: data.operatingExpenses,
            freshAssetValue: data.totalFreshAssetValue,
            totalEconomicAssets: data.totalEconomicAssets,
            unvaluedForeignCurrenciesCount: data.unvaluedForeignCurrenciesCount,
          });

          // Overall Package
          const scorePackage = calculateWealthHealthScore(
            d1,
            d2,
            d3,
            d4,
            d5,
            d6,
            confidence,
            asOf
          );

          return {
            baseCurrency: data.baseCurrency,
            totalScore: scorePackage.totalScore.toFixed(1),
            ratingTier: scorePackage.ratingTier,
            ratingTierLabelAr: scorePackage.ratingTierLabelAr,
            asOf: scorePackage.asOf,
            dimensions: {
              liquidity: {
                score: d1.score.toFixed(1),
                runwayMonths: d1.runwayMonths.toFixed(1),
                liquidReservesBase: formatDec(d1.liquidReserves, 2),
                monthlyEssentialOutflowsBase: formatDec(d1.monthlyEssentialOutflows, 2),
                status: d1.status,
                driverAr: d1.driverAr,
              },
              debtSustainability: {
                score: d2.score.toFixed(1),
                leverageScore: d2.leverageScore.toFixed(1),
                dscrScore: d2.dscrScore.toFixed(1),
                leverageRatio: d2.leverageRatio.times(100).toFixed(1),
                dscr: d2.dscr.toFixed(2),
                totalDebtBase: formatDec(d2.totalDebtPrincipal, 2),
                totalEconomicAssetsBase: formatDec(d2.totalEconomicAssets, 2),
                annualDebtServiceBase: formatDec(d2.annualDebtService, 2),
                status: d2.status,
                driverAr: d2.driverAr,
              },
              savingsVelocity: {
                score: d3.score.toFixed(1),
                operatingSavingsRate: d3.operatingSavingsRate.times(100).toFixed(1),
                netWealthAccumulationBase: formatDec(d3.netWealthAccumulation, 2),
                monthlyFiContributionBase: formatDec(d3.monthlyFiContribution, 2),
                operatingInflowsBase: formatDec(d3.operatingInflows, 2),
                operatingExpensesBase: formatDec(d3.operatingExpenses, 2),
                debtPrincipalRepaymentsBase: formatDec(d3.debtPrincipalRepayments, 2),
                status: d3.status,
                driverAr: d3.driverAr,
              },
              diversification: {
                score: d4.score.toFixed(1),
                hhi: d4.hhi.toFixed(3),
                topHoldingWeight: d4.topHoldingWeight.times(100).toFixed(1),
                topHoldingName: d4.topHoldingName,
                assetClassWeights: {
                  cash: d4.assetClassWeights.cash.times(100).toFixed(1),
                  equity: d4.assetClassWeights.equity.times(100).toFixed(1),
                  fixed_income: d4.assetClassWeights.fixed_income.times(100).toFixed(1),
                  alternatives: d4.assetClassWeights.alternatives.times(100).toFixed(1),
                  other: d4.assetClassWeights.other.times(100).toFixed(1),
                },
                status: d4.status,
                driverAr: d4.driverAr,
              },
              resilienceProtection: {
                score: d5.score.toFixed(1),
                subScore5A: d5.subScore5A.toFixed(1),
                subScore5B: d5.subScore5B.toFixed(1),
                freshRatio: d5.freshRatio.times(100).toFixed(1),
                totalEconomicAssetsBase: formatDec(d5.totalEconomicAssets, 2),
                freshAssetValueBase: formatDec(d5.freshAssetValue, 2),
                healthPoints: d5.healthPoints.toFixed(0),
                lifePoints: d5.lifePoints.toFixed(0),
                propertyPoints: d5.propertyPoints.toFixed(0),
                status: d5.status,
                driverAr: d5.driverAr,
              },
              fiProgress: {
                score: d6.score.toFixed(1),
                fiProgressRatio: d6.fiProgressRatio.times(100).toFixed(1),
                investableAssetsBase: formatDec(d6.investableAssets, 2),
                kFiBaselineBase: formatDec(d6.kFiBaseline, 2),
                actualAnnualSpendingBase: formatDec(d6.actualAnnualSpending, 2),
                baselineSwr: d6.baselineSwr.times(100).toFixed(2),
                status: d6.status,
                driverAr: d6.driverAr,
              },
            },
            confidence: {
              level: confidence.level,
              completenessPercent: confidence.completenessPercent.times(100).toFixed(0),
              historyMonths: confidence.historyMonths,
              freshnessRatio: confidence.freshnessRatio.times(100).toFixed(0),
              warningsAr: confidence.warningsAr,
            },
          };
        },
        60_000
      );
    }),

  /**
   * Procedure 2: getFireStatus
   * Deterministic FI/FIRE Horizon Engine with scenario comparison.
   */
  getFireStatus: protectedProcedure
    .input(fireStatusInputSchema)
    .query(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      const asOf = input?.asOf ?? Date.now();
      const db = await getDb();
      if (!db) throw notAvailable();

      const data = await loadWealthHealthAggregations(family, asOf);

      // Fetch saved assumptions from retirement_plans table if available
      const savedPlan = await db
        .select()
        .from(retirementPlans)
        .where(
          and(
            eq(retirementPlans.workspaceId, family.workspace.id),
            eq(retirementPlans.profileId, family.profile.id)
          )
        )
        .limit(1);

      const defaultSwr = savedPlan[0]?.safeWithdrawalRate
        ? toDec(savedPlan[0].safeWithdrawalRate).div(100).toString()
        : "0.04";
      const defaultNominal = savedPlan[0]?.assumedAnnualReturn
        ? toDec(savedPlan[0].assumedAnnualReturn).div(100).toString()
        : "0.07";
      const defaultInflation = savedPlan[0]?.assumedAnnualInflation
        ? toDec(savedPlan[0].assumedAnnualInflation).div(100).toString()
        : "0.03";

      // Resolve parameters: custom overrides vs defaults
      const swr = input.customSwr
        ? toDec(input.customSwr).div(100)
        : toDec(defaultSwr);
      const nominalReturn = input.customNominalReturn
        ? toDec(input.customNominalReturn).div(100)
        : toDec(defaultNominal);
      const inflation = input.customInflation
        ? toDec(input.customInflation).div(100)
        : toDec(defaultInflation);

      // Determine annual spending based on mode
      let annualSpending: Decimal;
      if (input.spendingMode === "essential_ttm") {
        annualSpending = data.ttmEssentialExpenses;
      } else if (input.spendingMode === "custom") {
        annualSpending = toDec(input.customSpending!);
      } else {
        annualSpending = data.operatingExpenses;
      }

      // Authoritative monthly FI contribution C = (I_op - E_op - P_debt) / 12
      const monthlyContribution = data.operatingInflows
        .minus(data.operatingExpenses)
        .minus(data.debtPrincipalRepayments)
        .div(12);

      // Compute primary FIRE horizon result
      const horizonResult = calculateFireHorizon({
        investableAssets: data.investableAssets,
        annualSpending,
        swr,
        nominalReturn,
        inflation,
        monthlyContribution,
        asOfDate: new Date(asOf),
      });

      // Compute 3 standard scenarios
      const standardScenarios = generateStandardFireScenarios({
        investableAssets: data.investableAssets,
        ttmActualLivingExpenses: data.operatingExpenses,
        ttmEssentialLivingExpenses: data.ttmEssentialExpenses,
        monthlyContribution,
        asOfDate: new Date(asOf),
      });

      const formatScenarioPlan = (sc: FireScenarioPlan) => ({
        name: sc.name,
        nameLabelAr: sc.nameLabelAr,
        nominalReturnPercent: sc.nominalReturn.times(100).toFixed(2),
        inflationPercent: sc.inflation.times(100).toFixed(2),
        realReturnPercent: sc.realReturn.times(100).toFixed(2),
        swrPercent: sc.swr.times(100).toFixed(2),
        annualSpendingBase: formatDec(sc.annualSpending, 2),
        targetCorpusBase: formatDec(sc.horizonResult.targetCorpus, 2),
        horizonMonths: sc.horizonResult.horizonMonths,
        horizonYears: sc.horizonResult.horizonYears ? sc.horizonResult.horizonYears.toFixed(1) : null,
        projectedDate: sc.horizonResult.projectedDate,
        status: sc.horizonResult.status,
        statusLabelAr: sc.horizonResult.statusLabelAr,
        isReachable: sc.horizonResult.isReachable,
      });

      return {
        baseCurrency: data.baseCurrency,
        asOf,
        spendingMode: input.spendingMode,
        annualSpendingBase: formatDec(annualSpending, 2),
        investableAssetsBase: formatDec(data.investableAssets, 2),
        targetCorpusBase: formatDec(horizonResult.targetCorpus, 2),
        gapCorpusBase: formatDec(horizonResult.gapCorpus, 2),
        progressPercent: horizonResult.targetCorpus.gt(0)
          ? data.investableAssets.div(horizonResult.targetCorpus).times(100).toFixed(1)
          : "100.0",
        monthlyContributionBase: formatDec(monthlyContribution, 2),
        assumptions: {
          nominalReturnPercent: nominalReturn.times(100).toFixed(2),
          inflationPercent: inflation.times(100).toFixed(2),
          realReturnPercent: horizonResult.realReturn.times(100).toFixed(2),
          monthlyRealRatePercent: horizonResult.monthlyRealRate.times(100).toFixed(4),
          swrPercent: swr.times(100).toFixed(2),
        },
        primaryHorizon: {
          status: horizonResult.status,
          statusLabelAr: horizonResult.statusLabelAr,
          isReachable: horizonResult.isReachable,
          horizonMonths: horizonResult.horizonMonths,
          horizonYears: horizonResult.horizonYears ? horizonResult.horizonYears.toFixed(1) : null,
          projectedDate: horizonResult.projectedDate,
          verifiedExact: horizonResult.verifiedExact,
        },
        scenarios: {
          conservative: formatScenarioPlan(standardScenarios.conservative),
          base: formatScenarioPlan(standardScenarios.base),
          optimistic: formatScenarioPlan(standardScenarios.optimistic),
        },
      };
    }),

  /**
   * Procedure 3: saveAssumptions
   * Persists planning assumptions in the existing retirement_plans table.
   */
  saveAssumptions: protectedProcedure
    .input(saveAssumptionsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");

      const db = await getDb();
      if (!db) throw notAvailable();

      const workspaceId = family.workspace.id;
      const profileId = family.profile.id;

      // Validate Decimal inputs
      const swr = toDec(input.safeWithdrawalRate);
      const ret = toDec(input.assumedAnnualReturn);
      const inf = toDec(input.assumedAnnualInflation);

      if (swr.lte(0) || swr.gt(100)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "معدل السحب الآمن يجب أن يكون بين 0% و 100%." });
      }
      if (ret.lt(-50) || ret.gt(100)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "معدل العائد الاسمي يجب أن يكون بين -50% و 100%." });
      }
      if (inf.lt(-20) || inf.gt(100)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "معدل التضخم السنوي يجب أن يكون بين -20% و 100%." });
      }

      // Check existing retirement_plans record
      const existing = await db
        .select()
        .from(retirementPlans)
        .where(
          and(
            eq(retirementPlans.workspaceId, workspaceId),
            eq(retirementPlans.profileId, profileId)
          )
        )
        .limit(1);

      const now = Date.now();

      if (existing.length > 0) {
        await db
          .update(retirementPlans)
          .set({
            retirementAge: input.retirementAge,
            safeWithdrawalRate: swr.toFixed(6),
            assumedAnnualReturn: ret.toFixed(6),
            assumedAnnualInflation: inf.toFixed(6),
            updatedAt: now,
          })
          .where(eq(retirementPlans.id, existing[0].id));
      } else {
        await db.insert(retirementPlans).values({
          workspaceId,
          profileId,
          currentAge: 35,
          retirementAge: input.retirementAge,
          currentRetirementAssets: "0.000000",
          monthlyContribution: "0.000000",
          annualSpending: "0.000000",
          safeWithdrawalRate: swr.toFixed(6),
          assumedAnnualReturn: ret.toFixed(6),
          assumedAnnualInflation: inf.toFixed(6),
          currency: family.workspace.baseCurrency,
          createdByUserId: ctx.user.id,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Invalidate read cache
      invalidateReadModelCache(`wealth-health:score:${workspaceId}`);

      return { success: true, message: "تم حفظ افتراضات التخطيط المالي بنجاح." };
    }),
});
