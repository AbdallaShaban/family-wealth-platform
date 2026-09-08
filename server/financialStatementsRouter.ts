import { and, desc, eq, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { getDb } from "./db";
import { ensurePersonalFamilyContext, assertRole } from "./familyAccess";
import { protectedProcedure, router } from "./_core/trpc";
import {
  accounts,
  journalEntries,
  journalLines,
  investmentLots,
  lotMatches,
  specialAssets,
  specialAssetValuations,
  priceQuotes,
  fxRates,
  auditEvents,
} from "../drizzle/schema";
import {
  validateAndResolveDateContract,
  calculateBookBalanceSheet,
  calculateIncomeStatement,
  calculateStatementOfChangesInEquity,
  calculateStatementOfCashFlows,
  calculateEconomicNetWorthBridge,
  verifyAccountingInvariants,
  exportFinancialStatementsJson,
  exportFinancialStatementsCsv,
  toDec,
  formatDec,
  safeDiv,
  type AccountRow,
  type JournalLineRow,
  type InvestmentLotRow,
  type LotMatchRow,
  type SpecialAssetRow,
  type PriceQuoteMap,
  type FxRateMap,
  type FinancialStatementsPackage,
} from "./financialStatementsMath";

function notAvailable() {
  return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة حاليًا." });
}

export const financialStatementsInputSchema = z
  .object({
    asOf: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    periodKey: z.string().trim().optional(),
    compareWithPrior: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    try {
      validateAndResolveDateContract(data);
    } catch (err: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err.message || "معايير التاريخ غير صالحة.",
      });
    }
  });

export const exportFinancialStatementsInputSchema = z
  .object({
    format: z.enum(["json", "csv"]),
    asOf: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    periodKey: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    try {
      validateAndResolveDateContract(data);
    } catch (err: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err.message || "معايير التاريخ غير صالحة.",
      });
    }
  });

/**
 * Core data fetcher and statement generator function
 */
export async function generateFinancialStatementsPackage(
  family: Awaited<ReturnType<typeof ensurePersonalFamilyContext>>,
  input: z.infer<typeof financialStatementsInputSchema>
): Promise<FinancialStatementsPackage & { snapshotComparison?: any }> {
  const db = await getDb();
  if (!db) throw notAvailable();

  const workspaceId = family.workspace.id;
  const baseCurrency = family.workspace.baseCurrency;
  const resolved = validateAndResolveDateContract(input);

  const asOfTimestamp = resolved.asOfDate.getTime();
  const startTimestamp = resolved.startDate.getTime();
  const endTimestamp = resolved.endDate.getTime();

  // 1. Fetch Accounts
  const rawAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.workspaceId, workspaceId));

  const accountRows: AccountRow[] = rawAccounts.map((a: any) => ({
    id: a.id,
    workspaceId: a.workspaceId,
    name: a.name,
    accountCode: a.accountCode,
    accountType: a.accountType,
    currency: a.currency,
    isSystemAccount: a.isSystemAccount,
    ownerProfileId: a.ownerProfileId,
  }));

  // 2. Fetch Posted Journal Entries & Lines up to max(asOfTimestamp, endTimestamp)
  const queryCutoff = Math.max(asOfTimestamp, endTimestamp);
  const rawLines = await db
    .select({
      id: journalLines.id,
      entryId: journalLines.entryId,
      accountId: journalLines.accountId,
      direction: journalLines.direction,
      amount: journalLines.amount,
      currency: journalLines.currency,
      fxRateToBase: journalLines.fxRateToBase,
      baseAmount: journalLines.baseAmount,
      postedAt: journalEntries.postedAt,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.workspaceId, workspaceId),
        eq(journalEntries.status, "posted"),
        lte(journalEntries.postedAt, queryCutoff)
      )
    )
    .orderBy(journalEntries.postedAt, journalLines.id);

  const journalLineRows: JournalLineRow[] = rawLines.map((l: any) => ({
    id: l.id,
    entryId: l.entryId,
    accountId: l.accountId,
    direction: l.direction,
    amount: l.amount,
    currency: l.currency,
    fxRateToBase: l.fxRateToBase,
    baseAmount: l.baseAmount,
    postedAt: l.postedAt,
  }));

  // 3. Fetch Investment Lots & Matches
  const [rawLots, rawMatches] = await Promise.all([
    db
      .select()
      .from(investmentLots)
      .where(eq(investmentLots.workspaceId, workspaceId)),
    db
      .select()
      .from(lotMatches)
      .where(eq(lotMatches.workspaceId, workspaceId)),
  ]);

  const lotRows: InvestmentLotRow[] = rawLots.map((l: any) => ({
    id: l.id,
    accountId: l.accountId,
    instrumentId: l.instrumentId,
    acquiredAt: l.acquiredAt,
    originalQuantity: l.originalQuantity,
    remainingQuantity: l.remainingQuantity,
    unitCost: l.unitCost,
    totalCost: l.totalCost,
    costCurrency: l.costCurrency,
    status: l.status,
  }));

  const matchRows: LotMatchRow[] = rawMatches.map((m: any) => ({
    id: m.id,
    sellEventId: m.sellEventId,
    lotId: m.lotId,
    quantity: m.quantity,
    costBasis: m.costBasis,
    grossProceeds: m.grossProceeds,
    allocatedFee: m.allocatedFee,
    allocatedTax: m.allocatedTax,
    realizedPnl: m.realizedPnl,
    currency: m.currency,
    matchedAt: m.matchedAt,
  }));

  // 4. Fetch Special Assets & Latest Appraisals
  const [rawSpecialAssets, rawValuations] = await Promise.all([
    db
      .select()
      .from(specialAssets)
      .where(eq(specialAssets.workspaceId, workspaceId)),
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

  const specialAssetRows: SpecialAssetRow[] = rawSpecialAssets.map((s: any) => {
    const val = latestValuationByAsset.get(s.id);
    return {
      id: s.id,
      assetAccountId: s.assetAccountId,
      assetType: s.assetType,
      name: s.name,
      quantity: s.quantity,
      unit: s.unit,
      acquisitionCost: s.acquisitionCost,
      acquisitionCurrency: s.acquisitionCurrency,
      latestAppraisalValue: val?.value ?? s.acquisitionCost,
      latestAppraisalCurrency: val?.currency ?? s.acquisitionCurrency,
      valuationMethod: val?.valuationMethod ?? s.valuationMethod,
    };
  });

  // 5. Fetch Price Quotes & FX Rates
  const [rawQuotes, rawFxRates] = await Promise.all([
    db
      .select()
      .from(priceQuotes)
      .where(eq(priceQuotes.workspaceId, workspaceId))
      .orderBy(desc(priceQuotes.asOf)),
    db
      .select()
      .from(fxRates)
      .where(eq(fxRates.workspaceId, workspaceId))
      .orderBy(desc(fxRates.asOf)),
  ]);

  const quotesMap: PriceQuoteMap = {};
  for (const q of rawQuotes) {
    if (!quotesMap[q.instrumentId] && q.asOf <= asOfTimestamp) {
      quotesMap[q.instrumentId] = {
        price: q.price,
        currency: q.currency,
      };
    }
  }

  const fxMap: FxRateMap = { [baseCurrency]: "1" };
  const trackedCurrencies = new Set<string>([baseCurrency]);
  for (const r of rawFxRates) {
    if (r.asOf <= asOfTimestamp) {
      if (r.toCurrency === baseCurrency && !fxMap[r.fromCurrency]) {
        fxMap[r.fromCurrency] = r.rate;
        trackedCurrencies.add(r.fromCurrency);
      } else if (r.fromCurrency === baseCurrency && !fxMap[r.toCurrency]) {
        const invRate = safeDiv(new Decimal(1), toDec(r.rate), "1");
        fxMap[r.toCurrency] = invRate.toString();
        trackedCurrencies.add(r.toCurrency);
      }
    }
  }

  // 6. Compute Statements
  const bookBalanceSheet = calculateBookBalanceSheet({
    asOfTimestamp,
    baseCurrency,
    accounts: accountRows,
    journalLines: journalLineRows,
    specialAssets: specialAssetRows,
  });

  const openingBalanceSheet = calculateBookBalanceSheet({
    asOfTimestamp: startTimestamp,
    baseCurrency,
    accounts: accountRows,
    journalLines: journalLineRows,
    specialAssets: specialAssetRows,
  });

  const incomeStatement = calculateIncomeStatement({
    startTimestamp,
    endTimestamp,
    baseCurrency,
    accounts: accountRows,
    journalLines: journalLineRows,
  });

  const equityChangesStatement = calculateStatementOfChangesInEquity({
    startTimestamp,
    endTimestamp,
    baseCurrency,
    openingBookEquity: toDec(openingBalanceSheet.equity.totalBookEquity),
    closingBookEquity: toDec(bookBalanceSheet.equity.totalBookEquity),
    netOperatingIncome: toDec(incomeStatement.netOperatingIncome),
    accounts: accountRows,
    journalLines: journalLineRows,
  });

  const cashFlowStatement = calculateStatementOfCashFlows({
    startTimestamp,
    endTimestamp,
    baseCurrency,
    accounts: accountRows,
    journalLines: journalLineRows,
    fxRatesStart: fxMap,
    fxRatesEnd: fxMap,
  });

  const economicNetWorthBridge = calculateEconomicNetWorthBridge({
    asOfTimestamp,
    baseCurrency,
    bookBalanceSheet,
    activeLots: lotRows,
    lotMatches: matchRows,
    specialAssets: specialAssetRows,
    quotes: quotesMap,
    fxRates: fxMap,
  });

  const reconciliationAudit = verifyAccountingInvariants({
    bookBalanceSheet,
    incomeStatement,
    cashFlowStatement,
    bridge: economicNetWorthBridge,
    journalLines: journalLineRows,
    lotMatches: matchRows,
    currencies: Array.from(trackedCurrencies),
  });

  const resultPackage: FinancialStatementsPackage = {
    metadata: {
      workspaceId,
      baseCurrency,
      generatedAt: Date.now(),
      mode: resolved.mode,
      asOf: resolved.asOfDate.toISOString(),
      startDate: resolved.startDate.toISOString(),
      endDate: resolved.endDate.toISOString(),
      periodKey: resolved.periodKey,
    },
    bookBalanceSheet,
    incomeStatement,
    equityChangesStatement,
    cashFlowStatement,
    economicNetWorthBridge,
    reconciliationAudit,
  };

  // 7. Optional Prior Period Snapshot Comparison
  if (input.compareWithPrior) {
    const periodDuration = endTimestamp - startTimestamp;
    const priorEnd = startTimestamp - 1;
    const priorStart = priorEnd - periodDuration;

    const priorBS = calculateBookBalanceSheet({
      asOfTimestamp: priorEnd,
      baseCurrency,
      accounts: accountRows,
      journalLines: journalLineRows,
      specialAssets: specialAssetRows,
    });

    const priorIncome = calculateIncomeStatement({
      startTimestamp: priorStart,
      endTimestamp: priorEnd,
      baseCurrency,
      accounts: accountRows,
      journalLines: journalLineRows,
    });

    const priorBridge = calculateEconomicNetWorthBridge({
      asOfTimestamp: priorEnd,
      baseCurrency,
      bookBalanceSheet: priorBS,
      activeLots: lotRows,
      lotMatches: matchRows,
      specialAssets: specialAssetRows,
      quotes: quotesMap,
      fxRates: fxMap,
    });

    const calcDelta = (currentVal: string, priorVal: string) => {
      const cur = toDec(currentVal);
      const pri = toDec(priorVal);
      const delta = cur.minus(pri);
      const pct = pri.isZero() ? "0.00" : delta.div(pri.abs()).mul(100).toFixed(2);
      return {
        current: formatDec(cur),
        prior: formatDec(pri),
        absoluteDelta: formatDec(delta),
        percentageChange: pct,
      };
    };

    const snapshotComparison = {
      priorPeriod: {
        startDate: new Date(priorStart).toISOString(),
        endDate: new Date(priorEnd).toISOString(),
      },
      metrics: {
        economicNetWorth: calcDelta(economicNetWorthBridge.economicNetWorth, priorBridge.economicNetWorth),
        totalBookAssets: calcDelta(bookBalanceSheet.assets.totalBookAssets, priorBS.assets.totalBookAssets),
        totalBookEquity: calcDelta(bookBalanceSheet.equity.totalBookEquity, priorBS.equity.totalBookEquity),
        netOperatingIncome: calcDelta(incomeStatement.netOperatingIncome, priorIncome.netOperatingIncome),
        cashAndEquivalents: calcDelta(bookBalanceSheet.assets.cashAndEquivalents.totalBase, priorBS.assets.cashAndEquivalents.totalBase),
      },
    };

    return { ...resultPackage, snapshotComparison };
  }

  return resultPackage;
}

export const financialStatementsRouter = router({
  financialStatements: protectedProcedure
    .input(financialStatementsInputSchema)
    .query(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      return generateFinancialStatementsPackage(family, input);
    }),

  export: protectedProcedure
    .input(exportFinancialStatementsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "advisor");
      const db = await getDb();
      if (!db) throw notAvailable();

      const pkg = await generateFinancialStatementsPackage(family, input);
      const dateStr = new Date(pkg.metadata.generatedAt).toISOString().slice(0, 10);

      // Audit log the financial statements export
      await db.insert(auditEvents).values({
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        action: "financial_statements.exported",
        targetType: "financial_statements",
        targetId: String(pkg.metadata.generatedAt),
        beforeState: null,
        afterState: {
          format: input.format,
          mode: pkg.metadata.mode,
          asOf: pkg.metadata.asOf,
          periodKey: pkg.metadata.periodKey,
        },
        requestId: crypto.randomUUID(),
        occurredAt: pkg.metadata.generatedAt,
      });

      if (input.format === "json") {
        return {
          filename: `family-financial-statements-${dateStr}.json`,
          contentType: "application/json",
          content: exportFinancialStatementsJson(pkg),
        };
      }

      return {
        filename: `family-financial-statements-${dateStr}.csv`,
        contentType: "text/csv;charset=utf-8",
        content: exportFinancialStatementsCsv(pkg),
      };
    }),
});
