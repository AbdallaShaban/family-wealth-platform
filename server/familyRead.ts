import { and, desc, eq, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { inArray } from "drizzle-orm";
import { accounts, allocationTargets, bankCertificates, budgets, cashFlowCategories, debts, emergencyFundPlans, financialEvents, fxRates, instruments, journalEntries, journalLines, officialValuationSnapshots, positions, priceQuotes, riskProfiles, watchlistItems } from "../drizzle/schema";
import type { FamilyContext } from "./familyAccess";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { calculateEmergencyFund } from "./emergencyFundMath";
import { assetClassForInstrument, calculateAllocation } from "./allocationMath";
import { isMarketDataStale } from "./marketData";
import { getCachedReadModel } from "./readModelCache";

function unavailable() {
  return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة حاليًا." });
}

export async function listAccountSnapshots(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw unavailable();
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      accountType: accounts.accountType,
      currency: accounts.currency,
      institution: accounts.institution,
      status: accounts.status,
      balance: sql<string>`COALESCE(SUM(CASE WHEN ${journalLines.direction} = 'debit' THEN ${journalLines.amount} ELSE -${journalLines.amount} END), 0)`,
    })
    .from(accounts)
    .leftJoin(journalLines, and(eq(journalLines.accountId, accounts.id), eq(journalLines.workspaceId, context.workspace.id)))
    .where(and(eq(accounts.workspaceId, context.workspace.id), eq(accounts.isSystemAccount, "no")))
    .groupBy(accounts.id, accounts.name, accounts.accountType, accounts.currency, accounts.institution, accounts.status)
    .orderBy(accounts.name);

  const latestRate = await currentBaseRates(context);

  return rows.map(row => {
    const balance = new Decimal(row.balance);
    const rate = row.currency === context.workspace.baseCurrency ? new Decimal(1) : latestRate.get(row.currency)?.rate;
    return {
      ...row,
      balance: balance.toFixed(2),
      baseValue: rate ? balance.mul(rate).toFixed(2) : null,
      valuationStatus: row.currency === context.workspace.baseCurrency ? "base_currency" : rate ? (isMarketDataStale(latestRate.get(row.currency)?.asOf) ? "stale" : latestRate.get(row.currency)?.rateStatus) : "unvalued",
      rateAsOf: row.currency === context.workspace.baseCurrency ? null : latestRate.get(row.currency)?.asOf ?? null,
    };
  });
}

export async function getDashboardSummary(context: FamilyContext) {
  const [accountSnapshots, recentEvents, portfolio] = await Promise.all([
    listAccountSnapshots(context),
    listRecentEvents(context, 12),
    listPortfolioPositions(context),
  ]);
  const valuedBalance = accountSnapshots.reduce((total, account) => total.plus(account.baseValue ?? "0"), new Decimal(0));
  const liquidBalance = accountSnapshots.filter(account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType)).reduce((total, account) => total.plus(account.baseValue ?? "0"), new Decimal(0));
  const liabilities = accountSnapshots.filter(account => ["credit", "loan"].includes(account.accountType)).reduce((total, account) => total.plus(new Decimal(account.baseValue ?? "0").abs()), new Decimal(0));
  const investmentValue = portfolio.reduce((total, position) => total.plus(position.baseMarketValue ?? "0"), new Decimal(0));
  const unrealizedPnl = portfolio.reduce((total, position) => total.plus(position.baseUnrealizedPnl ?? "0"), new Decimal(0));
  const unvaluedCurrencies = Array.from(new Set(accountSnapshots.filter(account => account.baseValue === null).map(account => account.currency)));
  const staleFxCurrencies = Array.from(new Set(accountSnapshots.filter(account => account.valuationStatus === "stale").map(account => account.currency)));
  const unvaluedInstruments = portfolio.filter(position => position.baseMarketValue === null).map(position => position.instrumentName);

  const db = await getDb();
  let bankCertificatesTotal = new Decimal(0);
  if (db) {
    try {
      const certRows = await db
        .select({ principalAmount: bankCertificates.principalAmount })
        .from(bankCertificates)
        .where(and(eq(bankCertificates.workspaceId, context.workspace.id), eq(bankCertificates.status, "active")));
      bankCertificatesTotal = certRows.reduce((sum, c) => sum.plus(new Decimal(c.principalAmount)), new Decimal(0));
    } catch {
      // Table may be empty or unmigrated in isolated mocks
    }
  }

  // Net worth: (Liquid Free Cash + T+2 Receivables + Invested Assets + Bank Certificates) - Liabilities
  // Note: (freeLiquidity + unsettledCash) equals liquidBalance.
  // valuedBalance includes liquid accounts + non-liquid asset accounts minus liability accounts.
  const currentNetWorth = valuedBalance.plus(investmentValue).plus(bankCertificatesTotal);

  // Unsettled Cash calculation (T+2 / 48h settlement window for recent equity dispositions)
  const settlementWindowMs = 2 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const unsettledSells = recentEvents.filter(
    (e) => e.eventType === "sell" && now - e.occurredAt < settlementWindowMs
  );
  const unsettledCash = unsettledSells.reduce(
    (sum, e) => sum.plus(new Decimal(e.grossAmount ?? 0)),
    new Decimal(0)
  );
  const freeLiquidity = Decimal.max(0, liquidBalance.minus(unsettledCash));

  // Prior Period Comparison for Net Worth Delta
  let netWorthDelta = {
    absolute: "0.00",
    percentage: "0.0",
    isPositive: true,
  };
  if (db) {
    const snapshots = await db
      .select({ netWorthBase: officialValuationSnapshots.netWorthBase })
      .from(officialValuationSnapshots)
      .where(eq(officialValuationSnapshots.workspaceId, context.workspace.id))
      .orderBy(desc(officialValuationSnapshots.valuationAsOf))
      .limit(2);
    if (snapshots.length >= 2 && snapshots[1].netWorthBase) {
      const prev = new Decimal(snapshots[1].netWorthBase);
      const diff = currentNetWorth.minus(prev);
      const pct = prev.gt(0) ? diff.div(prev).mul(100) : new Decimal(0);
      netWorthDelta = {
        absolute: diff.abs().toFixed(2),
        percentage: pct.abs().toFixed(1),
        isPositive: diff.gte(0),
      };
    } else if (unrealizedPnl.abs().gt(0) && currentNetWorth.gt(0)) {
      const pct = unrealizedPnl.div(currentNetWorth).mul(100);
      netWorthDelta = {
        absolute: unrealizedPnl.abs().toFixed(2),
        percentage: pct.abs().toFixed(1),
        isPositive: unrealizedPnl.gte(0),
      };
    }
  }

  return {
    workspace: { id: context.workspace.id, name: context.workspace.name, baseCurrency: context.workspace.baseCurrency },
    membershipRole: context.membership.role,
    liquidBalanceBase: liquidBalance.toFixed(2),
    freeLiquidityBase: freeLiquidity.toFixed(2),
    unsettledCashBase: unsettledCash.toFixed(2),
    liabilityBalanceBase: liabilities.toFixed(2),
    investmentValueBase: investmentValue.toFixed(2),
    bankCertificatesBase: bankCertificatesTotal.toFixed(2),
    netWorthBase: currentNetWorth.toFixed(2),
    netWorthDelta,
    unrealizedPnlBase: unrealizedPnl.toFixed(2),
    accountCount: accountSnapshots.length,
    unvaluedCurrencies,
    staleFxCurrencies,
    unvaluedInstruments,
    accounts: accountSnapshots,
    portfolio,
    recentEvents,
  };
}

export async function listRecentEvents(context: FamilyContext, limit = 25) {
  const db = await getDb();
  if (!db) throw unavailable();
  const rows = await db
    .select({
      id: financialEvents.id,
      eventType: financialEvents.eventType,
      status: financialEvents.status,
      occurredAt: financialEvents.occurredAt,
      currency: financialEvents.currency,
      grossAmount: financialEvents.grossAmount,
      feeAmount: financialEvents.feeAmount,
      taxAmount: financialEvents.taxAmount,
      quantity: financialEvents.quantity,
      unitPrice: financialEvents.unitPrice,
      memo: financialEvents.memo,
      primaryAccountId: financialEvents.primaryAccountId,
      instrumentId: financialEvents.instrumentId,
    })
    .from(financialEvents)
    .where(eq(financialEvents.workspaceId, context.workspace.id))
    .orderBy(desc(financialEvents.occurredAt), desc(financialEvents.id))
    .limit(limit);
  return rows;
}

export async function getCashFlowSummary(context: FamilyContext, periodKey: string) {
  const db = await getDb();
  if (!db) throw unavailable();
  if (!/^\d{4}-\d{2}$/.test(periodKey)) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الفترة يجب أن تكون YYYY-MM." });
  const start = Date.parse(`${periodKey}-01T00:00:00.000Z`);
  const endDate = new Date(start);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const end = endDate.getTime();
  const actualRows = await db.select({
    categoryId: cashFlowCategories.id,
    categoryName: cashFlowCategories.name,
    direction: cashFlowCategories.direction,
    color: cashFlowCategories.color,
    actualAmountBase: sql<string>`COALESCE(SUM(${journalLines.baseAmount}), 0)`,
  }).from(financialEvents)
    .innerJoin(cashFlowCategories, eq(financialEvents.categoryId, cashFlowCategories.id))
    .innerJoin(journalEntries, eq(journalEntries.eventId, financialEvents.id))
    .innerJoin(journalLines, and(eq(journalLines.entryId, journalEntries.id), eq(journalLines.accountId, financialEvents.primaryAccountId!)))
    .where(and(eq(financialEvents.workspaceId, context.workspace.id), eq(financialEvents.status, "posted"), sql`${financialEvents.eventType} IN ('income', 'expense', 'debt_payment')`, sql`${financialEvents.occurredAt} >= ${start}`, sql`${financialEvents.occurredAt} < ${end}`))
    .groupBy(cashFlowCategories.id, cashFlowCategories.name, cashFlowCategories.direction, cashFlowCategories.color);
  const plannedRows = await db.select({ categoryId: budgets.categoryId, plannedAmountBase: budgets.plannedAmountBase, categoryName: cashFlowCategories.name, direction: cashFlowCategories.direction, color: cashFlowCategories.color }).from(budgets).innerJoin(cashFlowCategories, eq(budgets.categoryId, cashFlowCategories.id)).where(and(eq(budgets.workspaceId, context.workspace.id), eq(budgets.periodKey, periodKey)));
  const categoryMap = new Map(actualRows.map(row => [row.categoryId, { ...row, actualAmountBase: new Decimal(row.actualAmountBase).toFixed(2), plannedAmountBase: "0.00" }]));
  plannedRows.forEach(row => {
    const existing = categoryMap.get(row.categoryId);
    categoryMap.set(row.categoryId, existing ? { ...existing, plannedAmountBase: new Decimal(row.plannedAmountBase).toFixed(2) } : { categoryId: row.categoryId, categoryName: row.categoryName, direction: row.direction, color: row.color, actualAmountBase: "0.00", plannedAmountBase: new Decimal(row.plannedAmountBase).toFixed(2) });
  });
  const categories = Array.from(categoryMap.values()).sort((left, right) => left.direction.localeCompare(right.direction) || left.categoryName.localeCompare(right.categoryName));
  const incomeActualBase = categories.filter(row => row.direction === "income").reduce((total, row) => total.plus(row.actualAmountBase), new Decimal(0));
  const expenseActualBase = categories.filter(row => row.direction === "expense").reduce((total, row) => total.plus(row.actualAmountBase), new Decimal(0));
  const expensePlanBase = categories.filter(row => row.direction === "expense").reduce((total, row) => total.plus(row.plannedAmountBase), new Decimal(0));
  return { periodKey, baseCurrency: context.workspace.baseCurrency, incomeActualBase: incomeActualBase.toFixed(2), expenseActualBase: expenseActualBase.toFixed(2), netCashFlowBase: incomeActualBase.minus(expenseActualBase).toFixed(2), expensePlanBase: expensePlanBase.toFixed(2), categories };
}

export async function getCashFlowHistory(context: FamilyContext, months = 6) {
  const safeMonths = Math.min(Math.max(1, months), 24);
  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const periods: Array<{ year: number; month: number; periodKey: string; monthLabel: string }> = [];

  for (let i = safeMonths - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const monthLabel = `${monthNames[d.getUTCMonth()]}`;
    periods.push({ year, month, periodKey, monthLabel });
  }

  const results = await Promise.all(
    periods.map(async (p) => {
      try {
        const summary = await getCashFlowSummary(context, p.periodKey);
        return {
          month: p.monthLabel,
          periodKey: p.periodKey,
          income: Number(summary.incomeActualBase || 0),
          expense: Number(summary.expenseActualBase || 0),
          net: Number(summary.netCashFlowBase || 0),
        };
      } catch {
        return {
          month: p.monthLabel,
          periodKey: p.periodKey,
          income: 0,
          expense: 0,
          net: 0,
        };
      }
    })
  );

  return results;
}

async function currentBaseRates(context: FamilyContext) {
  return getCachedReadModel(`fx:${context.workspace.id}:${context.workspace.baseCurrency}`, async () => {
    const db = await getDb();
    if (!db) throw unavailable();
    const rows = await db.select().from(fxRates).where(and(eq(fxRates.workspaceId, context.workspace.id), eq(fxRates.toCurrency, context.workspace.baseCurrency))).orderBy(desc(fxRates.asOf));
    const latest = new Map<string, typeof rows[number]>();
    rows.forEach(row => { if (!latest.has(row.fromCurrency)) latest.set(row.fromCurrency, row); });
    return latest;
  }, 5_000);
}

export async function listDebtSummaries(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw unavailable();
  const rows = await db.select({
    id: debts.id,
    name: debts.name,
    lender: debts.lender,
    debtType: debts.debtType,
    currency: debts.currency,
    originalPrincipal: debts.originalPrincipal,
    annualInterestRate: debts.annualInterestRate,
    minimumPayment: debts.minimumPayment,
    paymentDay: debts.paymentDay,
    startDate: debts.startDate,
    maturityDate: debts.maturityDate,
    status: debts.status,
    liabilityAccountId: debts.liabilityAccountId,
    liabilityAccountName: accounts.name,
    signedBalance: sql<string>`COALESCE(SUM(CASE WHEN ${journalLines.direction} = 'debit' THEN ${journalLines.amount} ELSE -${journalLines.amount} END), 0)`,
  }).from(debts)
    .innerJoin(accounts, eq(debts.liabilityAccountId, accounts.id))
    .leftJoin(journalLines, and(eq(journalLines.workspaceId, context.workspace.id), eq(journalLines.accountId, debts.liabilityAccountId)))
    .where(and(eq(debts.workspaceId, context.workspace.id), eq(debts.profileId, context.profile.id)))
    .groupBy(debts.id, debts.name, debts.lender, debts.debtType, debts.currency, debts.originalPrincipal, debts.annualInterestRate, debts.minimumPayment, debts.paymentDay, debts.startDate, debts.maturityDate, debts.status, debts.liabilityAccountId, accounts.name)
    .orderBy(debts.status, debts.maturityDate);
  const rates = await currentBaseRates(context);
  return rows.map(row => {
    const outstanding = Decimal.max(new Decimal(row.signedBalance).negated(), 0);
    const rate = row.currency === context.workspace.baseCurrency ? new Decimal(1) : rates.get(row.currency)?.rate;
    return { ...row, outstanding: outstanding.toFixed(6), baseOutstanding: rate ? outstanding.mul(rate).toFixed(6) : null, baseMinimumPayment: rate ? new Decimal(row.minimumPayment).mul(rate).toFixed(6) : null, valuationStatus: row.currency === context.workspace.baseCurrency ? "base_currency" : rate ? rates.get(row.currency)?.rateStatus : "unvalued" };
  });
}

export async function getEmergencyFundSummary(context: FamilyContext, now = Date.now()) {
  const db = await getDb();
  if (!db) throw unavailable();
  const [plan] = await db.select().from(emergencyFundPlans).where(and(eq(emergencyFundPlans.workspaceId, context.workspace.id), eq(emergencyFundPlans.profileId, context.profile.id))).limit(1);
  const lookbackMonths = plan?.lookbackMonths ?? 3;
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - lookbackMonths);
  const startAt = start.getTime();
  const liquidRows = await db.select({ currency: accounts.currency, balance: sql<string>`COALESCE(SUM(CASE WHEN ${journalLines.direction} = 'debit' THEN ${journalLines.amount} ELSE -${journalLines.amount} END), 0)` })
    .from(accounts)
    .leftJoin(journalLines, and(eq(journalLines.workspaceId, context.workspace.id), eq(journalLines.accountId, accounts.id)))
    .where(and(eq(accounts.workspaceId, context.workspace.id), eq(accounts.ownerProfileId, context.profile.id), eq(accounts.isSystemAccount, "no"), sql`${accounts.accountType} IN ('cash', 'bank', 'wallet', 'brokerage')`))
    .groupBy(accounts.currency);
  const essentialRows = await db.select({ actualAmountBase: sql<string>`COALESCE(SUM(${journalLines.baseAmount}), 0)` })
    .from(financialEvents)
    .innerJoin(cashFlowCategories, eq(financialEvents.categoryId, cashFlowCategories.id))
    .innerJoin(journalEntries, eq(journalEntries.eventId, financialEvents.id))
    .innerJoin(journalLines, and(eq(journalLines.entryId, journalEntries.id), eq(journalLines.accountId, financialEvents.primaryAccountId!)))
    .where(and(eq(financialEvents.workspaceId, context.workspace.id), eq(financialEvents.profileId, context.profile.id), eq(financialEvents.status, "posted"), eq(financialEvents.eventType, "expense"), eq(cashFlowCategories.isEssential, "yes"), sql`${financialEvents.occurredAt} >= ${startAt}`, sql`${financialEvents.occurredAt} < ${now}`));
  const debtRows = await listDebtSummaries(context);
  const rates = await currentBaseRates(context);
  const unvaluedCurrencies: string[] = [];
  const liquidReserveBase = liquidRows.reduce((total, row) => {
    const rate = row.currency === context.workspace.baseCurrency ? new Decimal(1) : rates.get(row.currency)?.rate;
    if (!rate) { unvaluedCurrencies.push(row.currency); return total; }
    return total.plus(new Decimal(row.balance).mul(rate));
  }, new Decimal(0));
  const output = calculateEmergencyFund({ liquidReserveBase, essentialExpenseMonthlyBase: new Decimal(essentialRows[0]?.actualAmountBase ?? "0").div(lookbackMonths), debtMinimumPaymentBase: debtRows.reduce((total, debt) => total.plus(debt.baseMinimumPayment ?? "0"), new Decimal(0)), targetMonths: plan?.targetMonths, targetDate: plan?.targetDate, now });
  return { baseCurrency: context.workspace.baseCurrency, plan: plan ? { targetMonths: plan.targetMonths, lookbackMonths: plan.lookbackMonths, targetDate: plan.targetDate } : null, ...output, unvaluedCurrencies: Array.from(new Set(unvaluedCurrencies)) };
}

export async function getRiskAllocationSummary(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw unavailable();
  const [accountSnapshots, portfolio, profileRows, targets] = await Promise.all([
    listAccountSnapshots(context),
    listPortfolioPositions(context),
    db.select().from(riskProfiles).where(and(eq(riskProfiles.workspaceId, context.workspace.id), eq(riskProfiles.profileId, context.profile.id))).limit(1),
    db.select().from(allocationTargets).where(and(eq(allocationTargets.workspaceId, context.workspace.id), eq(allocationTargets.profileId, context.profile.id))),
  ]);
  const amounts: Partial<Record<"cash" | "equity" | "fixed_income" | "alternatives" | "other", Decimal>> = {};
  accountSnapshots.filter(account => ["cash", "bank", "wallet", "brokerage"].includes(account.accountType) && account.baseValue !== null && new Decimal(account.baseValue).gt(0)).forEach(account => { amounts.cash = (amounts.cash ?? new Decimal(0)).plus(account.baseValue!); });
  portfolio.filter(position => position.baseMarketValue !== null && new Decimal(position.baseMarketValue).gt(0)).forEach(position => {
    const assetClass = assetClassForInstrument(position.assetType);
    amounts[assetClass] = (amounts[assetClass] ?? new Decimal(0)).plus(position.baseMarketValue!);
  });
  const allocation = calculateAllocation({ actualAmounts: amounts, targets });
  return {
    baseCurrency: context.workspace.baseCurrency,
    riskProfile: profileRows[0] ?? null,
    allocation,
    unvaluedCurrencies: Array.from(new Set(accountSnapshots.filter(account => account.baseValue === null && ["cash", "bank", "wallet", "brokerage"].includes(account.accountType)).map(account => account.currency))),
    unvaluedInstruments: portfolio.filter(position => position.baseMarketValue === null).map(position => position.instrumentName),
  };
}

export async function listPortfolioPositions(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw unavailable();
  const rows = await db
    .select({
      id: positions.id,
      accountId: positions.accountId,
      quantity: positions.quantity,
      averageCost: positions.averageCost,
      costCurrency: positions.costCurrency,
      instrumentId: instruments.id,
      instrumentName: instruments.name,
      symbol: instruments.symbol,
      assetType: instruments.assetType,
      currency: instruments.currency,
    })
    .from(positions)
    .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
    .where(eq(positions.workspaceId, context.workspace.id));
  const quotes = await db.select().from(priceQuotes).where(eq(priceQuotes.workspaceId, context.workspace.id)).orderBy(desc(priceQuotes.asOf));
  const latestQuote = new Map<number, typeof quotes[number]>();
  quotes.forEach(quote => { if (!latestQuote.has(quote.instrumentId)) latestQuote.set(quote.instrumentId, quote); });
  const rates = await db.select().from(fxRates).where(and(eq(fxRates.workspaceId, context.workspace.id), eq(fxRates.toCurrency, context.workspace.baseCurrency))).orderBy(desc(fxRates.asOf));
  const latestRate = new Map<string, typeof rates[number]>();
  rates.forEach(rate => { if (!latestRate.has(rate.fromCurrency)) latestRate.set(rate.fromCurrency, rate); });
  return rows.map(row => {
    const quote = latestQuote.get(row.instrumentId);
    const quantity = new Decimal(row.quantity);
    const costBasis = quantity.mul(row.averageCost);
    const marketValue = quote ? quantity.mul(quote.price) : null;
    const rate = row.currency === context.workspace.baseCurrency ? new Decimal(1) : latestRate.get(row.currency)?.rate;
    return {
      ...row,
      quantity: quantity.toFixed(8),
      averageCost: new Decimal(row.averageCost).toFixed(8),
      costBasis: costBasis.toFixed(2),
      marketPrice: quote?.price ?? null,
      marketValue: marketValue ? marketValue.toFixed(2) : null,
      unrealizedPnl: marketValue ? marketValue.minus(costBasis).toFixed(2) : null,
      baseMarketValue: marketValue && rate ? marketValue.mul(rate).toFixed(2) : null,
      baseUnrealizedPnl: marketValue && rate ? marketValue.minus(costBasis).mul(rate).toFixed(2) : null,
      quoteStatus: quote?.quoteStatus ?? "unavailable",
      quoteAsOf: quote?.asOf ?? null,
      fxRateStatus: row.currency === context.workspace.baseCurrency ? "base_currency" : rate ? latestRate.get(row.currency)?.rateStatus : "unvalued",
    };
  });
}

export function classifyMarketOverviewOwnership(owned: boolean, watching: boolean) {
  if (owned && watching) return "owned_and_watching" as const;
  if (owned) return "owned" as const;
  return "watching" as const;
}

export function marketOverviewQuoteStatus(quote: { quoteStatus: string; asOf: number } | undefined) {
  if (!quote) return "unavailable" as const;
  return isMarketDataStale(quote.asOf) ? "stale" as const : quote.quoteStatus;
}

/**
 * Public-market data only for the dashboard. Position quantities, costs and
 * valuations intentionally stay out of this payload so privacy mode does not
 * need to conceal the requested price-monitoring view.
 */
export async function getDashboardMarketOverview(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw unavailable();
  const [ownedRows, watchRows, quoteRows] = await Promise.all([
    db.select({ instrumentId: positions.instrumentId, quantity: positions.quantity }).from(positions).where(eq(positions.workspaceId, context.workspace.id)),
    db.select({ instrumentId: watchlistItems.instrumentId }).from(watchlistItems).where(and(eq(watchlistItems.workspaceId, context.workspace.id), eq(watchlistItems.profileId, context.profile.id), eq(watchlistItems.status, "active"))),
    db.select().from(priceQuotes).where(eq(priceQuotes.workspaceId, context.workspace.id)).orderBy(desc(priceQuotes.asOf)),
  ]);
  const ownedIds = new Set(ownedRows.filter(row => new Decimal(row.quantity).gt(0)).map(row => row.instrumentId));
  const watchIds = new Set(watchRows.map(row => row.instrumentId));
  const monitoredIds = Array.from(new Set(Array.from(ownedIds).concat(Array.from(watchIds))));
  if (!monitoredIds.length) return { generatedAt: Date.now(), staleAfterHours: 48, entries: [] };
  const instrumentRows = await db.select({ id: instruments.id, name: instruments.name, symbol: instruments.symbol, assetType: instruments.assetType, currency: instruments.currency }).from(instruments).where(and(eq(instruments.workspaceId, context.workspace.id), inArray(instruments.id, monitoredIds)));
  const latestQuote = new Map<number, typeof quoteRows[number]>();
  quoteRows.forEach(quote => { if (!latestQuote.has(quote.instrumentId)) latestQuote.set(quote.instrumentId, quote); });
  const entries = instrumentRows.map(instrument => {
    const quote = latestQuote.get(instrument.id);
    const ownership = classifyMarketOverviewOwnership(ownedIds.has(instrument.id), watchIds.has(instrument.id));
    return {
      instrumentId: instrument.id,
      name: instrument.name,
      symbol: instrument.symbol,
      assetType: instrument.assetType,
      currency: instrument.currency,
      ownership,
      price: quote?.price ?? null,
      source: quote?.source ?? null,
      quoteStatus: marketOverviewQuoteStatus(quote),
      asOf: quote?.asOf ?? null,
    };
  });
  return { generatedAt: Date.now(), staleAfterHours: 48, entries: entries.sort((left, right) => left.name.localeCompare(right.name, "ar")) };
}

/**
 * Returns operational quality metadata for market data only. It intentionally
 * excludes prices, balances, quantities and valuation amounts so it can be
 * shown even when privacy mode hides financial values.
 */
export async function getMarketDataQuality(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw unavailable();
  const [instrumentRows, accountRows, quoteRows, rateRows] = await Promise.all([
    db.select({ id: instruments.id, name: instruments.name, symbol: instruments.symbol, assetType: instruments.assetType, currency: instruments.currency }).from(instruments).where(eq(instruments.workspaceId, context.workspace.id)),
    db.select({ currency: accounts.currency }).from(accounts).where(and(eq(accounts.workspaceId, context.workspace.id), eq(accounts.isSystemAccount, "no"))),
    db.select().from(priceQuotes).where(eq(priceQuotes.workspaceId, context.workspace.id)).orderBy(desc(priceQuotes.asOf)),
    db.select().from(fxRates).where(and(eq(fxRates.workspaceId, context.workspace.id), eq(fxRates.toCurrency, context.workspace.baseCurrency))).orderBy(desc(fxRates.asOf)),
  ]);
  const latestQuote = new Map<number, typeof quoteRows[number]>();
  quoteRows.forEach(quote => { if (!latestQuote.has(quote.instrumentId)) latestQuote.set(quote.instrumentId, quote); });
  const latestRate = new Map<string, typeof rateRows[number]>();
  rateRows.forEach(rate => { if (!latestRate.has(rate.fromCurrency)) latestRate.set(rate.fromCurrency, rate); });
  const monitoredInstruments = instrumentRows.filter(item => ["equity", "fund", "gold"].includes(item.assetType) && Boolean(item.symbol));
  const instrumentStatus = monitoredInstruments.map(item => {
    const quote = latestQuote.get(item.id);
    const stale = quote ? isMarketDataStale(quote.asOf) : false;
    return { id: item.id, name: item.name, symbol: item.symbol, assetType: item.assetType, source: quote?.source ?? null, quoteStatus: quote ? (stale ? "stale" : quote.quoteStatus) : "unavailable", asOf: quote?.asOf ?? null };
  });
  const requiredCurrencies = Array.from(new Set([...accountRows.map(item => item.currency), ...instrumentRows.map(item => item.currency)])).filter(currency => currency !== context.workspace.baseCurrency);
  const fxStatus = requiredCurrencies.map(currency => {
    const rate = latestRate.get(currency);
    const stale = rate ? isMarketDataStale(rate.asOf) : false;
    return { currency, source: rate?.source ?? null, rateStatus: rate ? (stale ? "stale" : rate.rateStatus) : "unavailable", asOf: rate?.asOf ?? null };
  });
  const hasIssue = (status: string) => status === "stale" || status === "unavailable";
  return {
    staleAfterHours: 48,
    generatedAt: Date.now(),
    instruments: {
      monitored: monitoredInstruments.length,
      covered: instrumentStatus.filter(item => !hasIssue(item.quoteStatus)).length,
      stale: instrumentStatus.filter(item => item.quoteStatus === "stale").length,
      missing: instrumentStatus.filter(item => item.quoteStatus === "unavailable").length,
      delayed: instrumentStatus.filter(item => item.quoteStatus === "delayed").length,
      entries: instrumentStatus,
    },
    fx: {
      required: requiredCurrencies.length,
      covered: fxStatus.filter(item => !hasIssue(item.rateStatus)).length,
      stale: fxStatus.filter(item => item.rateStatus === "stale").length,
      missing: fxStatus.filter(item => item.rateStatus === "unavailable").length,
      entries: fxStatus,
    },
  };
}
