import Decimal from "decimal.js";

export type ReconciliationDirection = "debit" | "credit";
export type ReconciliationStatus = "healthy" | "attention";

export type ReconciliationEntry = {
  id: number;
  eventId: number | null;
  status: string;
  reversalOfEntryId?: number | null;
};

export type ReconciliationLine = {
  id: number;
  entryId: number;
  accountId: number;
  direction: ReconciliationDirection;
  amount: string;
  baseAmount?: string | null;
  currency: string;
};

export type ReconciliationEvent = {
  id: number;
  status: string;
  journalEntryId?: number | null;
  primaryAccountId?: number | null;
  instrumentId?: number | null;
  eventType: string;
  categoryId?: number | null;
  currency?: string | null;
  quantity?: string | null;
  unitPrice?: string | null;
  grossAmount?: string | null;
  feeAmount?: string | null;
  taxAmount?: string | null;
  idempotencyKey?: string | null;
  occurredAt?: number | null;
};

export type ReconciliationCorporateAction = {
  instrumentId: number;
  actionType: string;
  ratio: string;
  effectiveAt: number;
};

export type ReconciliationFxRate = { fromCurrency: string; toCurrency: string; rate: string; asOf?: number | null; rateStatus?: string | null };

export type ReconciliationPosition = {
  accountId: number;
  instrumentId: number;
  quantity: string;
  averageCost: string;
};

export type ReconciliationAccountBalance = {
  accountId: number;
  debitBase: string;
  creditBase: string;
  signedBalanceBase: string;
};

export type ReconciliationPositionResult = {
  accountId: number;
  instrumentId: number;
  rebuiltQuantity: string;
  persistedQuantity: string | null;
  rebuiltCost: string;
  persistedAverageCost: string | null;
  realizedPnlBase: string;
  status: "matched" | "mismatch" | "not_rebuildable";
};

export type ReconciliationReport = {
  status: ReconciliationStatus;
  generatedAt: number;
  counts: {
    postedEntries: number;
    postedEvents: number;
    postedLines: number;
    accounts: number;
    persistedPositions: number;
    unbalancedEntries: number;
    orphanLines: number;
    eventsWithoutEntry: number;
    duplicateIdempotencyKeys: number;
    invalidReversals: number;
    currencyAnomalies: number;
    doubleCountingLinks: number;
    fxAnomalies: number;
    positionMismatches: number;
  };
  trialBalance: {
    totalDebitBase: string;
    totalCreditBase: string;
    differenceBase: string;
  };
  accountBalances: ReconciliationAccountBalance[];
  unbalancedEntries: Array<{ entryId: number; eventId: number | null; debitBase: string; creditBase: string; differenceBase: string }>;
  orphanLines: number[];
  eventsWithoutEntry: number[];
  duplicateIdempotencyKeys: string[];
  invalidReversals: number[];
  currencyAnomalies: string[];
  doubleCountingLinks: string[];
  fxAnomalies: string[];
  positions: ReconciliationPositionResult[];
  cashFlowCoverage: {
    cashFlowEvents: number;
    linkedPostedEvents: number;
    unlinkedCashFlowEvents: number[];
    ledgerTotalsByType: Array<{ eventType: string; eventCount: number; ledgerBase: string }>;
    ledgerTotalsByCategory: Array<{ categoryId: number | null; eventCount: number; ledgerBase: string }>;
    ledgerAmountMismatches: number[];
    categoryMismatches: Array<{ categoryId: number | null; ledgerBase: string; currentBase: string; differenceBase: string }>;
  };
  notes: string[];
};

const EPSILON = new Decimal("0.000001");
const CASH_FLOW_TYPES = new Set(["income", "expense", "debt_payment"]);
const TRADE_TYPES = new Set(["buy", "sell"]);

function decimal(value: string | number | null | undefined) {
  return new Decimal(value ?? "0");
}

function isZero(value: Decimal) {
  return value.abs().lte(EPSILON);
}

function signedLineAmount(line: ReconciliationLine) {
  const amount = decimal(line.baseAmount ?? line.amount);
  return line.direction === "debit" ? amount : amount.negated();
}

function tradeGross(event: ReconciliationEvent) {
  if (event.grossAmount) return decimal(event.grossAmount);
  return decimal(event.quantity).mul(decimal(event.unitPrice));
}

function tradeCost(event: ReconciliationEvent) {
  return tradeGross(event).plus(decimal(event.feeAmount)).plus(decimal(event.taxAmount));
}

export function buildReconciliationReport(input: {
  baseCurrency?: string;
  fxRates?: ReconciliationFxRate[];
  expectedCashFlowByCategory?: Array<{ categoryId: number | null; actualAmountBase: string }>;
  corporateActions?: ReconciliationCorporateAction[];
  entries: ReconciliationEntry[];
  lines: ReconciliationLine[];
  events: ReconciliationEvent[];
  positions: ReconciliationPosition[];
  generatedAt?: number;
}): ReconciliationReport {
  const postedEntries = input.entries.filter(entry => entry.status === "posted");
  const baseCurrency = input.baseCurrency?.toUpperCase();
  const fxCurrencies = new Set((input.fxRates ?? []).filter(rate => !baseCurrency || rate.toCurrency.toUpperCase() === baseCurrency).map(rate => rate.fromCurrency.toUpperCase()));
  const fxAnomalies: string[] = [];
  if (baseCurrency) {
    for (const line of input.lines) if (line.currency !== baseCurrency && !fxCurrencies.has(line.currency.toUpperCase()) && line.baseAmount != null) fxAnomalies.push(`line:${line.id}:missing_fx_rate`);
    for (const event of input.events) if (event.currency && event.currency.toUpperCase() !== baseCurrency && !fxCurrencies.has(event.currency.toUpperCase())) fxAnomalies.push(`event:${event.id}:missing_fx_rate`);
  }
  const postedEntryIds = new Set(postedEntries.map(entry => entry.id));
  const postedEvents = input.events.filter(event => event.status === "posted");
  const postedLines = input.lines.filter(line => postedEntryIds.has(line.entryId));
  const currencyAnomalies: string[] = [];
  for (const line of input.lines) {
    if (!/^[A-Z]{3}$/.test(line.currency)) currencyAnomalies.push(`line:${line.id}:invalid_currency`);
    if (line.baseAmount != null) {
      try { if (!decimal(line.baseAmount).isFinite() || decimal(line.baseAmount).isNegative()) currencyAnomalies.push(`line:${line.id}:invalid_base_amount`); } catch { currencyAnomalies.push(`line:${line.id}:invalid_base_amount`); }
    } else if (baseCurrency && line.currency !== baseCurrency) currencyAnomalies.push(`line:${line.id}:missing_base_amount`);
  }
  const entryTotals = new Map<number, { debit: Decimal; credit: Decimal; eventId: number | null }>();
  const accountTotals = new Map<number, { debit: Decimal; credit: Decimal }>();
  const orphanLines: number[] = [];

  for (const line of input.lines) {
    if (!postedEntryIds.has(line.entryId)) {
      if (input.entries.every(entry => entry.id !== line.entryId)) orphanLines.push(line.id);
      continue;
    }
    const entry = entryTotals.get(line.entryId) ?? { debit: new Decimal(0), credit: new Decimal(0), eventId: postedEntries.find(item => item.id === line.entryId)?.eventId ?? null };
    const account = accountTotals.get(line.accountId) ?? { debit: new Decimal(0), credit: new Decimal(0) };
    const amount = decimal(line.baseAmount ?? line.amount);
    if (line.direction === "debit") {
      entry.debit = entry.debit.plus(amount);
      account.debit = account.debit.plus(amount);
    } else {
      entry.credit = entry.credit.plus(amount);
      account.credit = account.credit.plus(amount);
    }
    entryTotals.set(line.entryId, entry);
    accountTotals.set(line.accountId, account);
  }

  const unbalancedEntries = postedEntries.filter(entry => {
    const totals = entryTotals.get(entry.id) ?? { debit: new Decimal(0), credit: new Decimal(0), eventId: entry.eventId };
    return !isZero(totals.debit.minus(totals.credit));
  }).map(entry => {
    const totals = entryTotals.get(entry.id) ?? { debit: new Decimal(0), credit: new Decimal(0), eventId: entry.eventId };
    return { entryId: entry.id, eventId: entry.eventId, debitBase: totals.debit.toFixed(6), creditBase: totals.credit.toFixed(6), differenceBase: totals.debit.minus(totals.credit).toFixed(6) };
  });

  const entryById = new Map(postedEntries.map(entry => [entry.id, entry]));
  const eventIdCounts = new Map<number, number>();
  postedEvents.forEach(event => eventIdCounts.set(event.id, (eventIdCounts.get(event.id) ?? 0) + 1));
  const duplicateEventIds = Array.from(eventIdCounts.entries()).filter(([, count]) => count > 1).map(([id]) => `event:${id}`);
  const entryEventCounts = new Map<number, number>();
  postedEntries.forEach(entry => { if (entry.eventId != null) entryEventCounts.set(entry.eventId, (entryEventCounts.get(entry.eventId) ?? 0) + 1); });
  const duplicateEventLinks = Array.from(entryEventCounts.entries()).filter(([, count]) => count > 1).map(([id]) => `event:${id}:multiple_entries`);
  const duplicateLineIds = new Set(input.lines.map(line => line.id)).size === input.lines.length ? [] : ["line:duplicate_id"];
  const doubleCountingLinks = duplicateEventIds.concat(duplicateEventLinks, duplicateLineIds);
  const reversalTargets = new Map<number, number>();
  const invalidReversals: number[] = [];
  for (const entry of postedEntries) {
    if (entry.reversalOfEntryId == null) continue;
    const target = entryById.get(entry.reversalOfEntryId);
    const targetCount = (reversalTargets.get(entry.reversalOfEntryId) ?? 0) + 1;
    reversalTargets.set(entry.reversalOfEntryId, targetCount);
    if (!target || target.id === entry.id) invalidReversals.push(entry.id);
  }
  reversalTargets.forEach((count, targetId) => { if (count > 1) invalidReversals.push(targetId); });
  const eventsWithoutEntry = postedEvents.filter(event => {
    if (event.journalEntryId != null) return !entryById.has(event.journalEntryId);
    return !postedEntries.some(entry => entry.eventId === event.id);
  }).map(event => event.id);

  const idempotencyCounts = new Map<string, number>();
  for (const event of postedEvents) if (event.idempotencyKey) idempotencyCounts.set(event.idempotencyKey, (idempotencyCounts.get(event.idempotencyKey) ?? 0) + 1);
  const duplicateIdempotencyKeys = Array.from(idempotencyCounts.entries()).filter(([, count]) => count > 1).map(([key]) => key);

  type TimelineItem =
    | { kind: "trade"; timestamp: number; order: number; event: ReconciliationEvent }
    | { kind: "split"; timestamp: number; order: number; action: ReconciliationCorporateAction };

  const timeline: TimelineItem[] = [];
  let seq = 0;
  for (const event of postedEvents) {
    if (!TRADE_TYPES.has(event.eventType) || event.instrumentId == null || event.primaryAccountId == null || !event.quantity) continue;
    timeline.push({ kind: "trade", timestamp: event.occurredAt ?? event.id, order: seq++, event });
  }
  for (const action of input.corporateActions ?? []) {
    if (action.actionType === "stock_split" && Number(action.ratio) > 0) {
      timeline.push({ kind: "split", timestamp: action.effectiveAt, order: seq++, action });
    }
  }
  timeline.sort((a, b) => (a.timestamp !== b.timestamp ? a.timestamp - b.timestamp : a.order - b.order));

  const rebuilt = new Map<string, { accountId: number; instrumentId: number; quantity: Decimal; cost: Decimal; realized: Decimal }>();
  for (const item of timeline) {
    if (item.kind === "trade") {
      const event = item.event;
      const quantity = decimal(event.quantity);
      const key = `${event.primaryAccountId}:${event.instrumentId}`;
      const current = rebuilt.get(key) ?? { accountId: event.primaryAccountId!, instrumentId: event.instrumentId!, quantity: new Decimal(0), cost: new Decimal(0), realized: new Decimal(0) };
      if (event.eventType === "buy") {
        current.quantity = current.quantity.plus(quantity);
        current.cost = current.cost.plus(tradeCost(event));
      } else {
        const average = current.quantity.isZero() ? new Decimal(0) : current.cost.div(current.quantity);
        current.realized = current.realized.plus(tradeGross(event).minus(average.mul(quantity)).minus(decimal(event.feeAmount)).minus(decimal(event.taxAmount)));
        current.quantity = current.quantity.minus(quantity);
        current.cost = current.cost.minus(average.mul(quantity));
      }
      rebuilt.set(key, current);
    } else {
      const ratio = new Decimal(item.action.ratio);
      for (const [key, current] of Array.from(rebuilt.entries())) {
        if (current.instrumentId === item.action.instrumentId) {
          current.quantity = current.quantity.mul(ratio);
          // cost basis remains invariant, average cost automatically divided by ratio
          rebuilt.set(key, current);
        }
      }
    }
  }

  const persisted = new Map(input.positions.map(position => [`${position.accountId}:${position.instrumentId}`, position]));
  const positionKeys = new Set(Array.from(rebuilt.keys()).concat(Array.from(persisted.keys())));
  const positions: ReconciliationPositionResult[] = Array.from(positionKeys).sort().map(key => {
    const rebuiltPosition = rebuilt.get(key);
    const persistedPosition = persisted.get(key);
    if (!rebuiltPosition) return { accountId: persistedPosition!.accountId, instrumentId: persistedPosition!.instrumentId, rebuiltQuantity: "0.000000", persistedQuantity: persistedPosition!.quantity, rebuiltCost: "0.000000", persistedAverageCost: persistedPosition!.averageCost, realizedPnlBase: "0.000000", status: "not_rebuildable" };
    const rebuiltAverageCost = rebuiltPosition.quantity.isZero() ? new Decimal(0) : rebuiltPosition.cost.div(rebuiltPosition.quantity);
    const quantityMatches = persistedPosition ? isZero(rebuiltPosition.quantity.minus(decimal(persistedPosition.quantity))) : false;
    const costMatches = persistedPosition ? isZero(rebuiltAverageCost.minus(decimal(persistedPosition.averageCost))) : false;
    return { accountId: rebuiltPosition.accountId, instrumentId: rebuiltPosition.instrumentId, rebuiltQuantity: rebuiltPosition.quantity.toFixed(6), persistedQuantity: persistedPosition?.quantity ?? null, rebuiltCost: rebuiltAverageCost.toFixed(6), persistedAverageCost: persistedPosition?.averageCost ?? null, realizedPnlBase: rebuiltPosition.realized.toFixed(6), status: persistedPosition && quantityMatches && costMatches ? "matched" : "mismatch" };
  });

  const accountBalances = Array.from(accountTotals.entries()).sort(([left], [right]) => left - right).map(([accountId, totals]) => ({ accountId, debitBase: totals.debit.toFixed(6), creditBase: totals.credit.toFixed(6), signedBalanceBase: totals.debit.minus(totals.credit).toFixed(6) }));
  const totalDebit = postedLines.filter(line => line.direction === "debit").reduce((sum, line) => sum.plus(line.baseAmount ?? line.amount), new Decimal(0));
  const totalCredit = postedLines.filter(line => line.direction === "credit").reduce((sum, line) => sum.plus(line.baseAmount ?? line.amount), new Decimal(0));
  const cashFlowEvents = postedEvents.filter(event => CASH_FLOW_TYPES.has(event.eventType));
  const linkedCashFlowEvents = cashFlowEvents.filter(event => !eventsWithoutEntry.includes(event.id));
  const cashFlowMismatches: number[] = [];
  const cashFlowTotals = new Map<string, { count: number; amount: Decimal }>();
  const cashFlowCategoryTotals = new Map<number | null, { count: number; amount: Decimal }>();
  for (const event of cashFlowEvents) {
    const entry = postedEntries.find(candidate => candidate.eventId === event.id);
    const ledgerLines = entry ? postedLines.filter(line => line.entryId === entry.id && (event.primaryAccountId == null || line.accountId === event.primaryAccountId)) : [];
    if (!ledgerLines.length) { cashFlowMismatches.push(event.id); continue; }
    const amount = ledgerLines.reduce((total, line) => total.plus(decimal(line.baseAmount ?? line.amount)), new Decimal(0));
    const category = cashFlowCategoryTotals.get(event.categoryId ?? null) ?? { count: 0, amount: new Decimal(0) };
    cashFlowCategoryTotals.set(event.categoryId ?? null, { count: category.count + 1, amount: category.amount.plus(amount) });
    const current = cashFlowTotals.get(event.eventType) ?? { count: 0, amount: new Decimal(0) };
    cashFlowTotals.set(event.eventType, { count: current.count + 1, amount: current.amount.plus(amount) });
  }
  const ledgerTotalsByType = Array.from(cashFlowTotals.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([eventType, value]) => ({ eventType, eventCount: value.count, ledgerBase: value.amount.toFixed(6) }));
  const ledgerTotalsByCategory = Array.from(cashFlowCategoryTotals.entries()).sort(([left], [right]) => String(left).localeCompare(String(right))).map(([categoryId, value]) => ({ categoryId, eventCount: value.count, ledgerBase: value.amount.toFixed(6) }));
  const expectedCategories = new Map((input.expectedCashFlowByCategory ?? []).map(row => [row.categoryId, decimal(row.actualAmountBase)]));
  const categoryMismatches = input.expectedCashFlowByCategory ? Array.from(new Set(Array.from(cashFlowCategoryTotals.keys()).concat(Array.from(expectedCategories.keys())))).map(categoryId => { const ledgerBase = cashFlowCategoryTotals.get(categoryId)?.amount ?? new Decimal(0); const currentBase = expectedCategories.get(categoryId) ?? new Decimal(0); return { categoryId, ledgerBase: ledgerBase.toFixed(6), currentBase: currentBase.toFixed(6), differenceBase: ledgerBase.minus(currentBase).toFixed(6) }; }).filter(row => !isZero(decimal(row.differenceBase))) : [];
  const positionMismatches = positions.filter(position => position.status === "mismatch" || position.status === "not_rebuildable").length;
  const issueCount = unbalancedEntries.length + orphanLines.length + eventsWithoutEntry.length + duplicateIdempotencyKeys.length + invalidReversals.length + currencyAnomalies.length + doubleCountingLinks.length + fxAnomalies.length + cashFlowMismatches.length + categoryMismatches.length + positionMismatches;

  return {
    status: issueCount === 0 ? "healthy" : "attention",
    generatedAt: input.generatedAt ?? Date.now(),
    counts: { postedEntries: postedEntries.length, postedEvents: postedEvents.length, postedLines: postedLines.length, accounts: accountBalances.length, persistedPositions: input.positions.length, unbalancedEntries: unbalancedEntries.length, orphanLines: orphanLines.length, eventsWithoutEntry: eventsWithoutEntry.length, duplicateIdempotencyKeys: duplicateIdempotencyKeys.length, invalidReversals: invalidReversals.length, currencyAnomalies: currencyAnomalies.length, doubleCountingLinks: doubleCountingLinks.length, fxAnomalies: fxAnomalies.length, positionMismatches },
    trialBalance: { totalDebitBase: totalDebit.toFixed(6), totalCreditBase: totalCredit.toFixed(6), differenceBase: totalDebit.minus(totalCredit).toFixed(6) },
    accountBalances,
    unbalancedEntries,
    orphanLines,
    eventsWithoutEntry,
    duplicateIdempotencyKeys, invalidReversals: Array.from(new Set(invalidReversals)), currencyAnomalies, doubleCountingLinks, fxAnomalies, positions, cashFlowCoverage: { cashFlowEvents: cashFlowEvents.length, linkedPostedEvents: linkedCashFlowEvents.length, unlinkedCashFlowEvents: cashFlowEvents.filter(event => eventsWithoutEntry.includes(event.id)).map(event => event.id), ledgerTotalsByType, ledgerTotalsByCategory, ledgerAmountMismatches: cashFlowMismatches, categoryMismatches },
    notes: ["هذا التقرير قراءة تشخيصية غير مدمرة ولا ينشئ قيودًا أو يعدّل أرصدة.", "تُعاد الحيازات القابلة لإعادة البناء من أحداث buy/sell المنشورة فقط؛ العمليات التي لا تحمل بيانات تداول كافية تُعلّم not_rebuildable.", "لا تُستخدم الأسعار الخارجية في trial balance، وتبقى التقييمات السوقية خارج مصدر الحقيقة الدفتري."],
  };
}
