import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import type { FamilyContext } from "../familyAccess";
import { getDb } from "../db";
import { budgets, cashFlowCategories, financialEvents, journalLines } from "../../drizzle/schema";

export interface CategoryEnvelope {
  categoryId: number;
  categoryName: string;
  direction: "income" | "expense";
  isEssential: boolean;
  color: string;
  budgetedAmount: number;
  actualAmount: number;
  rolloverAmount: number;
  availableAmount: number;
  spentPercentage: number;
  varianceStatus: "under_budget" | "on_track" | "warning" | "exceeded";
}

export interface ZeroBasedBudgetOverview {
  periodKey: string;
  baseCurrency: string;
  totalIncomeActual: number;
  totalIncomePlanned: number;
  totalExpenseBudgeted: number;
  totalExpenseActual: number;
  toBeBudgeted: number; // Income - Budgeted (Actual Budget zero-based core metric)
  totalAvailableEnvelopes: number;
  categories: CategoryEnvelope[];
  overspentCategoriesCount: number;
  warningCategoriesCount: number;
  generatedAt: number;
}

/**
 * Derives previous period key (e.g., "2026-10" -> "2026-09")
 */
function getPreviousPeriodKey(periodKey: string): string {
  const [yearStr, monthStr] = periodKey.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Converts periodKey (e.g. "2026-10") to start and end UTC millisecond timestamps
 */
function getPeriodDateRange(periodKey: string): { startTs: number; endTs: number } {
  const [yearStr, monthStr] = periodKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  const startTs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  // Next month start
  const endTs = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0, 0) - 1;

  return { startTs, endTs };
}

/**
 * Service providing Zero-Based Envelope Budgeting inspired by Actual Budget.
 * Features:
 * - Envelope allocations per category
 * - "To Be Budgeted" calculation (Income - Budgeted)
 * - Transparent envelope carryover / rollover from previous month
 * - Separation of internal account transfers vs actual consumption expenses
 * - Variance reports
 * Strictly maintains read-model purity: NEVER writes journal entries or ledger mutations.
 */
export async function getZeroBasedBudgetOverview(
  context: FamilyContext,
  periodKey: string
): Promise<ZeroBasedBudgetOverview> {
  const db = await getDb();
  const workspaceId = context.workspace.id;
  const baseCurrency = context.workspace.baseCurrency || "EGP";
  const now = Date.now();

  const prevPeriodKey = getPreviousPeriodKey(periodKey);
  const currentRange = getPeriodDateRange(periodKey);
  const prevRange = getPeriodDateRange(prevPeriodKey);

  if (!db) {
    return {
      periodKey,
      baseCurrency,
      totalIncomeActual: 0,
      totalIncomePlanned: 0,
      totalExpenseBudgeted: 0,
      totalExpenseActual: 0,
      toBeBudgeted: 0,
      totalAvailableEnvelopes: 0,
      categories: [],
      overspentCategoriesCount: 0,
      warningCategoriesCount: 0,
      generatedAt: now,
    };
  }

  // 1. Fetch Active Categories
  const categoriesList = await db
    .select({
      id: cashFlowCategories.id,
      name: cashFlowCategories.name,
      direction: cashFlowCategories.direction,
      color: cashFlowCategories.color,
      isEssential: cashFlowCategories.isEssential,
    })
    .from(cashFlowCategories)
    .where(
      and(
        eq(cashFlowCategories.workspaceId, workspaceId),
        eq(cashFlowCategories.isArchived, "no")
      )
    );

  // 2. Fetch Planned Budgets for Current and Previous Period
  const budgetRows = await db
    .select({
      categoryId: budgets.categoryId,
      periodKey: budgets.periodKey,
      plannedAmountBase: budgets.plannedAmountBase,
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.workspaceId, workspaceId),
        inArray(budgets.periodKey, [periodKey, prevPeriodKey])
      )
    );

  const currentPlannedMap = new Map<number, Decimal>();
  const prevPlannedMap = new Map<number, Decimal>();

  for (const b of budgetRows) {
    const amt = new Decimal(b.plannedAmountBase || 0);
    if (b.periodKey === periodKey) {
      currentPlannedMap.set(b.categoryId, amt);
    } else if (b.periodKey === prevPeriodKey) {
      prevPlannedMap.set(b.categoryId, amt);
    }
  }

  // 3. Fetch Actual Posted Transactions from Financial Events
  // Strictly filter eventType: exclude "transfer" and "reversal"
  const actualEvents = await db
    .select({
      categoryId: financialEvents.categoryId,
      grossAmount: financialEvents.grossAmount,
      feeAmount: financialEvents.feeAmount,
      taxAmount: financialEvents.taxAmount,
      occurredAt: financialEvents.occurredAt,
      eventType: financialEvents.eventType,
    })
    .from(financialEvents)
    .where(
      and(
        eq(financialEvents.workspaceId, workspaceId),
        eq(financialEvents.status, "posted"),
        gte(financialEvents.occurredAt, prevRange.startTs),
        lte(financialEvents.occurredAt, currentRange.endTs)
      )
    );

  const currentActualMap = new Map<number, Decimal>();
  const prevActualMap = new Map<number, Decimal>();

  let totalIncomeActualDec = new Decimal(0);

  for (const ev of actualEvents) {
    if (!ev.categoryId) continue;

    const gross = new Decimal(ev.grossAmount || 0);
    const fee = new Decimal(ev.feeAmount || 0);
    const tax = new Decimal(ev.taxAmount || 0);
    const net = gross.minus(fee).minus(tax);

    const isCurrent = ev.occurredAt >= currentRange.startTs && ev.occurredAt <= currentRange.endTs;
    const isPrev = ev.occurredAt >= prevRange.startTs && ev.occurredAt <= prevRange.endTs;

    if (ev.eventType === "income") {
      if (isCurrent) {
        totalIncomeActualDec = totalIncomeActualDec.plus(net);
      }
    }

    if (isCurrent) {
      const cur = currentActualMap.get(ev.categoryId) ?? new Decimal(0);
      currentActualMap.set(ev.categoryId, cur.plus(gross));
    } else if (isPrev) {
      const prev = prevActualMap.get(ev.categoryId) ?? new Decimal(0);
      prevActualMap.set(ev.categoryId, prev.plus(gross));
    }
  }

  // 4. Build Envelopes & Compute Rollovers
  const categoryEnvelopes: CategoryEnvelope[] = [];
  let totalExpenseBudgetedDec = new Decimal(0);
  let totalExpenseActualDec = new Decimal(0);
  let totalIncomePlannedDec = new Decimal(0);
  let totalAvailableEnvelopesDec = new Decimal(0);

  let overspentCount = 0;
  let warningCount = 0;

  for (const cat of categoriesList) {
    const planned = currentPlannedMap.get(cat.id) ?? new Decimal(0);
    const actual = currentActualMap.get(cat.id) ?? new Decimal(0);

    // Compute previous month rollover: (Prev Planned - Prev Actual)
    const prevPlanned = prevPlannedMap.get(cat.id) ?? new Decimal(0);
    const prevActual = prevActualMap.get(cat.id) ?? new Decimal(0);
    const rollover = prevPlanned.minus(prevActual);

    // Available = Planned + Rollover - Actual
    const available = planned.plus(rollover).minus(actual);

    const plannedNum = Number(planned.toFixed(2));
    const actualNum = Number(actual.toFixed(2));
    const rolloverNum = Number(rollover.toFixed(2));
    const availableNum = Number(available.toFixed(2));

    let spentPct = 0;
    if (plannedNum > 0) {
      spentPct = Number(((actualNum / plannedNum) * 100).toFixed(1));
    }

    let status: CategoryEnvelope["varianceStatus"] = "on_track";
    if (cat.direction === "expense") {
      totalExpenseBudgetedDec = totalExpenseBudgetedDec.plus(planned);
      totalExpenseActualDec = totalExpenseActualDec.plus(actual);
      totalAvailableEnvelopesDec = totalAvailableEnvelopesDec.plus(available);

      if (actualNum > plannedNum) {
        status = "exceeded";
        overspentCount++;
      } else if (spentPct >= 80) {
        status = "warning";
        warningCount++;
      } else {
        status = "on_track";
      }
    } else {
      // Income category
      totalIncomePlannedDec = totalIncomePlannedDec.plus(planned);
    }

    categoryEnvelopes.push({
      categoryId: cat.id,
      categoryName: cat.name,
      direction: cat.direction as "income" | "expense",
      isEssential: cat.isEssential === "yes",
      color: cat.color || "#4F46E5",
      budgetedAmount: plannedNum,
      actualAmount: actualNum,
      rolloverAmount: rolloverNum,
      availableAmount: availableNum,
      spentPercentage: spentPct,
      varianceStatus: status,
    });
  }

  // To Be Budgeted = Total Actual Income - Total Expense Budgeted (Zero-Based Principle)
  const toBeBudgetedDec = totalIncomeActualDec.minus(totalExpenseBudgetedDec);

  return {
    periodKey,
    baseCurrency,
    totalIncomeActual: Number(totalIncomeActualDec.toFixed(2)),
    totalIncomePlanned: Number(totalIncomePlannedDec.toFixed(2)),
    totalExpenseBudgeted: Number(totalExpenseBudgetedDec.toFixed(2)),
    totalExpenseActual: Number(totalExpenseActualDec.toFixed(2)),
    toBeBudgeted: Number(toBeBudgetedDec.toFixed(2)),
    totalAvailableEnvelopes: Number(totalAvailableEnvelopesDec.toFixed(2)),
    categories: categoryEnvelopes,
    overspentCategoriesCount: overspentCount,
    warningCategoriesCount: warningCount,
    generatedAt: now,
  };
}
