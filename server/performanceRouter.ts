import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { getDb } from "./db";
import { ensurePersonalFamilyContext } from "./familyAccess";
import { protectedProcedure, router } from "./_core/trpc";
import {
  accounts,
  financialEvents,
  instruments,
  journalEntries,
  journalLines,
  officialValuationSnapshots,
  positions,
  priceQuotes,
  fxRates,
} from "../drizzle/schema";
import { BENCHMARK_SYMBOLS, fetchEgxOrYahooQuote } from "./marketData";
import {
  toDec,
  safeDiv,
  calculateTwr,
  calculateMwr,
  calculateRiskMetrics,
  calculateBenchmarkComparison,
  calculateAssetClassAttribution,
  buildCapitalBridge,
  type AssetClassCategory,
  type ExternalCashFlow,
  type ValuationPoint,
  type PerformanceSummaryReport,
} from "./performanceMath";
import { getCachedReadModel } from "./readModelCache";

function notAvailable() {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "قاعدة بيانات FAMILY غير متاحة حاليًا.",
  });
}

export const performanceSummaryInputSchema = z.object({
  period: z
    .enum(["mtd", "qtd", "ytd", "1y", "3y", "5y", "inception", "custom"])
    .default("ytd"),
  customStartDate: z.number().int().positive().optional(),
  customEndDate: z.number().int().positive().optional(),
  benchmark: z.string().trim().max(32).default("SP500"),
  riskFreeRate: z.string().trim().max(16).default("0.0000"),
});

export type PerformanceSummaryInput = z.infer<typeof performanceSummaryInputSchema>;

/**
 * Derives start and end timestamps based on selected period code
 */
export function resolvePeriodDates(
  period: PerformanceSummaryInput["period"],
  customStart?: number,
  customEnd?: number,
  now = Date.now()
): { startDate: number; endDate: number } {
  const nowDate = new Date(now);
  const currentYear = nowDate.getUTCFullYear();
  const currentMonth = nowDate.getUTCMonth(); // 0-indexed

  if (period === "custom") {
    const s = customStart ?? Date.UTC(currentYear, 0, 1);
    const e = customEnd ?? now;
    return { startDate: Math.min(s, e), endDate: Math.max(s, e) };
  }

  if (period === "mtd") {
    const startOfMonth = Date.UTC(currentYear, currentMonth, 1);
    return { startDate: startOfMonth, endDate: now };
  }

  if (period === "qtd") {
    const qMonth = Math.floor(currentMonth / 3) * 3;
    const startOfQuarter = Date.UTC(currentYear, qMonth, 1);
    return { startDate: startOfQuarter, endDate: now };
  }

  if (period === "ytd") {
    const startOfYear = Date.UTC(currentYear, 0, 1);
    return { startDate: startOfYear, endDate: now };
  }

  const dayMs = 86400 * 1000;
  if (period === "1y") {
    return { startDate: now - Math.round(365.25 * dayMs), endDate: now };
  }

  if (period === "3y") {
    return { startDate: now - Math.round(3 * 365.25 * dayMs), endDate: now };
  }

  if (period === "5y") {
    return { startDate: now - Math.round(5 * 365.25 * dayMs), endDate: now };
  }

  // inception: default to 1 year ago if no records exist yet
  return { startDate: now - Math.round(365.25 * dayMs), endDate: now };
}

export const performanceRouter = router({
  getPerformanceSummary: protectedProcedure
    .input(performanceSummaryInputSchema)
    .query(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      const workspaceId = family.workspace.id;
      const baseCurrency = family.workspace.baseCurrency.toUpperCase();
      const now = Date.now();

      const { startDate, endDate } = resolvePeriodDates(
        input.period,
        input.customStartDate,
        input.customEndDate,
        now
      );

      const cacheKey = `performance:${workspaceId}:${input.period}:${startDate}:${endDate}:${input.benchmark}`;

      return getCachedReadModel<PerformanceSummaryReport>(
        cacheKey,
        async () => {
          const db = await getDb();
          if (!db) throw notAvailable();

          // 1. Fetch Accounts
          const workspaceAccounts = await db
            .select()
            .from(accounts)
            .where(eq(accounts.workspaceId, workspaceId));

          const accountMap = new Map(workspaceAccounts.map((a) => [a.id, a]));
          const eligibleCashAccountIds = new Set(
            workspaceAccounts
              .filter((a) =>
                ["cash", "bank", "brokerage", "wallet"].includes(a.accountType)
              )
              .map((a) => a.id)
          );

          // 2. Fetch Journal Lines for External Cash Flows
          // External flows: Cash lines where counter-account is equity or non-investment flow
          const entryRows = await db
            .select({
              entryId: journalEntries.id,
              postedAt: journalEntries.postedAt,
              lineId: journalLines.id,
              accountId: journalLines.accountId,
              direction: journalLines.direction,
              amount: journalLines.amount,
              currency: journalLines.currency,
              baseAmount: journalLines.baseAmount,
            })
            .from(journalLines)
            .innerJoin(
              journalEntries,
              eq(journalLines.entryId, journalEntries.id)
            )
            .where(
              and(
                eq(journalLines.workspaceId, workspaceId),
                eq(journalEntries.status, "posted"),
                gte(journalEntries.postedAt, startDate),
                lte(journalEntries.postedAt, endDate)
              )
            )
            .orderBy(journalEntries.postedAt, journalLines.id);

          // Group lines by entry
          const linesByEntry = new Map<number, typeof entryRows>();
          entryRows.forEach((r) => {
            const list = linesByEntry.get(r.entryId) ?? [];
            list.push(r);
            linesByEntry.set(r.entryId, list);
          });

          const cashFlows: ExternalCashFlow[] = [];

          linesByEntry.forEach((lines) => {
            const postedAt = lines[0].postedAt;
            const cashLines = lines.filter((l) =>
              eligibleCashAccountIds.has(l.accountId)
            );
            if (cashLines.length === 0) return;

            const nonCashLines = lines.filter(
              (l) => !eligibleCashAccountIds.has(l.accountId)
            );
            // If touches ONLY cash accounts -> internal transfer (net impact = 0)
            if (nonCashLines.length === 0) return;

            for (const cl of cashLines) {
              const cashAmt = toDec(cl.baseAmount);
              const isDebit = cl.direction === "debit"; // Cash inflow if debit, outflow if credit

              for (const ncl of nonCashLines) {
                const counterAcc = accountMap.get(ncl.accountId);
                if (!counterAcc) continue;

                // If counter is clearing -> trade execution, NOT an external cash flow
                if (
                  counterAcc.accountType === "clearing" ||
                  counterAcc.name.startsWith("INVESTMENT_CLEARING")
                ) {
                  continue;
                }

                // If counter is income with DIVIDEND -> portfolio earnings, NOT external contribution
                if (
                  counterAcc.accountType === "income" &&
                  counterAcc.name.startsWith("DIVIDEND")
                ) {
                  continue;
                }

                // External Capital Additions (Inflows) / Distributions (Outflows)
                if (counterAcc.accountType === "equity") {
                  if (isDebit) {
                    cashFlows.push({
                      date: postedAt,
                      amount: cashAmt.toFixed(4),
                      direction: "inflow",
                      description: "مساهمة رأسمالية إضافية من المالك",
                    });
                  } else {
                    cashFlows.push({
                      date: postedAt,
                      amount: cashAmt.neg().toFixed(4),
                      direction: "outflow",
                      description: "سحب رأسمالي / توزيعات للمالك",
                    });
                  }
                } else if (
                  counterAcc.accountType === "income" &&
                  isDebit
                ) {
                  cashFlows.push({
                    date: postedAt,
                    amount: cashAmt.toFixed(4),
                    direction: "inflow",
                    description: "إيداع دخل تشغيلي خارجي",
                  });
                } else if (
                  counterAcc.accountType === "expense" &&
                  !isDebit
                ) {
                  cashFlows.push({
                    date: postedAt,
                    amount: cashAmt.neg().toFixed(4),
                    direction: "outflow",
                    description: "مصروفات مسحوبة من المحفظة",
                  });
                }
              }
            }
          });

          // Sort cash flows chronologically
          cashFlows.sort((a, b) => a.date - b.date);

          // 3. Portfolio Valuations at Start & End
          // Query official valuation snapshots if available
          const officialSnaps = await db
            .select()
            .from(officialValuationSnapshots)
            .where(
              and(
                eq(officialValuationSnapshots.workspaceId, workspaceId),
                gte(officialValuationSnapshots.valuationAsOf, startDate - 86400000),
                lte(officialValuationSnapshots.valuationAsOf, endDate + 86400000)
              )
            )
            .orderBy(desc(officialValuationSnapshots.valuationAsOf));

          // Also calculate current cash and positions from database
          // Cash balance at endDate
          const cashLineSums = await db
            .select({
              accountId: journalLines.accountId,
              direction: journalLines.direction,
              sumBase: sql<string>`COALESCE(SUM(${journalLines.baseAmount}), 0)`,
            })
            .from(journalLines)
            .innerJoin(
              journalEntries,
              eq(journalLines.entryId, journalEntries.id)
            )
            .where(
              and(
                eq(journalLines.workspaceId, workspaceId),
                eq(journalEntries.status, "posted"),
                lte(journalEntries.postedAt, endDate)
              )
            )
            .groupBy(journalLines.accountId, journalLines.direction);

          let currentCashTotal = new Decimal(0);
          cashLineSums.forEach((row) => {
            if (eligibleCashAccountIds.has(row.accountId)) {
              const amt = toDec(row.sumBase);
              if (row.direction === "debit") {
                currentCashTotal = currentCashTotal.plus(amt);
              } else {
                currentCashTotal = currentCashTotal.minus(amt);
              }
            }
          });

          // Securities positions at endDate
          const currentPositions = await db
            .select()
            .from(positions)
            .where(
              and(
                eq(positions.workspaceId, workspaceId),
                sql`${positions.quantity} > 0`
              )
            );

          // Latest price quotes up to endDate
          const quotes = await db
            .select()
            .from(priceQuotes)
            .where(
              and(
                eq(priceQuotes.workspaceId, workspaceId),
                lte(priceQuotes.asOf, endDate)
              )
            )
            .orderBy(desc(priceQuotes.asOf));

          const latestQuoteMap = new Map<number, Decimal>();
          quotes.forEach((q) => {
            if (!latestQuoteMap.has(q.instrumentId)) {
              latestQuoteMap.set(q.instrumentId, toDec(q.price));
            }
          });

          let currentInvestmentsTotal = new Decimal(0);
          const assetClassBalances: Record<AssetClassCategory, Decimal> = {
            cash: currentCashTotal,
            equity: new Decimal(0),
            fixed_income: new Decimal(0),
            gold_alternatives: new Decimal(0),
            other: new Decimal(0),
          };

          // Fetch instruments to map asset types
          const instRows = await db
            .select()
            .from(instruments)
            .where(eq(instruments.workspaceId, workspaceId));
          const instMap = new Map(instRows.map((i) => [i.id, i]));

          currentPositions.forEach((pos) => {
            const price = latestQuoteMap.get(pos.instrumentId) ?? toDec(pos.averageCost);
            const val = toDec(pos.quantity).mul(price);
            currentInvestmentsTotal = currentInvestmentsTotal.plus(val);

            const inst = instMap.get(pos.instrumentId);
            const assetType = inst?.assetType ?? "other";

            if (assetType === "equity" || assetType === "fund") {
              assetClassBalances.equity = assetClassBalances.equity.plus(val);
            } else if (assetType === "bond") {
              assetClassBalances.fixed_income = assetClassBalances.fixed_income.plus(val);
            } else if (assetType === "gold" || assetType === "real_estate") {
              assetClassBalances.gold_alternatives = assetClassBalances.gold_alternatives.plus(val);
            } else {
              assetClassBalances.other = assetClassBalances.other.plus(val);
            }
          });

          const totalEndVal = currentCashTotal.plus(currentInvestmentsTotal);

          // Start valuation: End valuation minus net contributions minus gain
          // Or from official snapshot near startDate
          let totalStartVal = totalEndVal;
          const startSnap = officialSnaps.find((s) => s.valuationAsOf <= startDate + 86400000);

          if (startSnap && startSnap.netWorthBase) {
            totalStartVal = toDec(startSnap.netWorthBase);
          } else {
            // Reconstruct starting capital backwards by subtracting net cash flows and trade gains
            const netFlows = cashFlows.reduce(
              (acc, f) => acc.plus(toDec(f.amount)),
              new Decimal(0)
            );
            totalStartVal = totalEndVal.minus(netFlows);
            if (totalStartVal.lt(0)) totalStartVal = new Decimal(0);
          }

          // 4. Calculate TWR
          const twrResult = calculateTwr({
            startDate,
            endDate,
            startValuation: totalStartVal,
            endValuation: totalEndVal,
            cashFlows,
          });

          // 5. Calculate MWR / IRR
          const mwrResult = calculateMwr({
            startDate,
            endDate,
            startValuation: totalStartVal,
            endValuation: totalEndVal,
            cashFlows,
          });

          // 6. Calculate Risk Metrics
          const subPeriodReturns = twrResult.subPeriods.map((sp) => ({
            date: sp.endDate,
            returnRate: sp.subPeriodReturn,
          }));

          const riskMetrics = calculateRiskMetrics({
            subPeriodReturns,
            annualizedReturn: twrResult.annualizedTwr,
            riskFreeRate: input.riskFreeRate,
            periodDays: twrResult.periodDays,
          });

          // 7. Benchmark Comparison (Strictly NO fabricated data)
          let benchmarkResult = calculateBenchmarkComparison({
            benchmarkSymbol: input.benchmark,
            portfolioReturns: subPeriodReturns,
            benchmarkQuotes: [],
            portfolioAnnualizedReturn: twrResult.annualizedTwr,
            riskFreeRate: input.riskFreeRate,
            periodDays: twrResult.periodDays,
          });

          if (input.benchmark && input.benchmark !== "NONE") {
            const bmkKey = input.benchmark.toUpperCase();
            const bmkInfo = BENCHMARK_SYMBOLS[bmkKey];
            const candidateSymbols = bmkInfo ? [bmkKey, bmkInfo.yahooSymbol] : [bmkKey];

            let [bmkInst] = await db
              .select()
              .from(instruments)
              .where(
                and(
                  eq(instruments.workspaceId, workspaceId),
                  inArray(instruments.symbol, candidateSymbols)
                )
              )
              .limit(1);

            if (!bmkInst && bmkInfo) {
              try {
                const created = await db.insert(instruments).values({
                  workspaceId,
                  name: bmkInfo.name,
                  symbol: bmkKey,
                  assetType: "fund",
                  subCategory: "مؤشر سوقي",
                  sector: "مؤشرات السوق",
                  currency: bmkInfo.currency,
                  isin: null,
                  createdAt: now,
                  updatedAt: now,
                });
                const newId = Number(created[0].insertId);
                bmkInst = { id: newId, symbol: bmkKey, currency: bmkInfo.currency, name: bmkInfo.name } as any;
              } catch {}
            }

            if (bmkInst) {
              let bmkQuotes = await db
                .select()
                .from(priceQuotes)
                .where(
                  and(
                    eq(priceQuotes.workspaceId, workspaceId),
                    eq(priceQuotes.instrumentId, bmkInst.id),
                    gte(priceQuotes.asOf, startDate),
                    lte(priceQuotes.asOf, endDate)
                  )
                )
                .orderBy(priceQuotes.asOf);

              if (bmkQuotes.length === 0) {
                try {
                  const fetched = await fetchEgxOrYahooQuote(bmkKey, bmkInst.currency);
                  await db.insert(priceQuotes).values({
                    workspaceId,
                    instrumentId: bmkInst.id,
                    price: fetched.price,
                    currency: fetched.currency,
                    source: "yahoo_finance_benchmark",
                    quoteStatus: "delayed",
                    asOf: fetched.asOf,
                    createdAt: now,
                  });
                  bmkQuotes = [{ asOf: fetched.asOf, price: fetched.price } as any];
                } catch {}
              }

              benchmarkResult = calculateBenchmarkComparison({
                benchmarkSymbol: input.benchmark,
                portfolioReturns: subPeriodReturns,
                benchmarkQuotes: bmkQuotes.map((q) => ({
                  date: q.asOf,
                  price: q.price,
                })),
                portfolioAnnualizedReturn: twrResult.annualizedTwr,
                riskFreeRate: input.riskFreeRate,
                periodDays: twrResult.periodDays,
              });
            }
          }

          // 8. Asset Class Attribution
          const startRatio = safeDiv(totalStartVal, totalEndVal, "1");
          const assetClassHoldings = (
            ["cash", "equity", "fixed_income", "gold_alternatives", "other"] as AssetClassCategory[]
          ).map((cat) => {
            const endV = assetClassBalances[cat];
            const startV = endV.mul(startRatio);
            return {
              assetClass: cat,
              startValue: startV.toFixed(2),
              endValue: endV.toFixed(2),
            };
          });

          const attribution = calculateAssetClassAttribution({
            totalReturn: twrResult.cumulativeTwr,
            assetClassHoldings,
          });

          // 9. Capital Growth Bridge
          const capitalBridge = buildCapitalBridge({
            startingCapital: totalStartVal,
            endingCapital: totalEndVal,
            cashFlows,
          });

          return {
            period: input.period,
            startDate,
            endDate,
            baseCurrency,
            twr: twrResult,
            mwr: mwrResult,
            riskMetrics,
            benchmark: benchmarkResult,
            attribution,
            capitalBridge,
            asOf: now,
          };
        },
        60_000 // 60s cache TTL
      );
    }),

  listAvailableBenchmarks: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();

    const standardSymbols = [
      "EGX30",
      "EGX33",
      "EGX70",
      "SP500",
      "MSCI_WORLD",
      "TASI",
      "GOLD_USD",
    ];
    const foundInstruments = await db
      .select({
        id: instruments.id,
        symbol: instruments.symbol,
        name: instruments.name,
      })
      .from(instruments)
      .where(eq(instruments.workspaceId, family.workspace.id));

    const symbolSet = new Set(
      foundInstruments
        .map((i) => (i.symbol ? i.symbol.toUpperCase() : ""))
        .filter((s) => s.length > 0)
    );

    return standardSymbols.map((sym) => {
      const bmk = BENCHMARK_SYMBOLS[sym];
      return {
        symbol: sym,
        name: bmk ? bmk.name : sym,
        availableInWorkspace: symbolSet.has(sym) || (bmk ? symbolSet.has(bmk.yahooSymbol) : false),
      };
    });
  }),
});
