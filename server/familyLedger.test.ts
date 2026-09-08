import { beforeEach, describe, expect, it, vi } from "vitest";
import { accounts, auditEvents, debtPayments, financialEvents, fxRates, instruments, journalEntries, journalLines, positions } from "../drizzle/schema";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { postCashEvent, postDebtPayment, postTrade } from "./familyLedger";

type Row = Record<string, unknown>;

function createSelectChain(response: Row[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => response,
    then: (onfulfilled: (value: Row[]) => unknown, onrejected?: (reason: unknown) => unknown) => Promise.resolve(response).then(onfulfilled, onrejected),
  };
  return chain;
}

function createTransaction(selectResponses: Row[]) {
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  let responseIndex = 0;
  const tx: any = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => createSelectChain(selectResponses[responseIndex++] ?? [])),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserted.push({ table, values });
        if (table === accounts || table === positions) return { onDuplicateKeyUpdate: vi.fn().mockResolvedValue([]) };
        if (table === financialEvents) return Promise.resolve([{ insertId: 901 }]);
        if (table === journalEntries) return Promise.resolve([{ insertId: 902 }]);
        return Promise.resolve([]);
      },
    })),
    update: vi.fn(() => ({ set: () => ({ where: vi.fn().mockResolvedValue([]) }) })),
  };
  return { tx, inserted };
}

const familyContext: any = {
  workspace: { id: 44, baseCurrency: "EGP", name: "FAMILY" },
  profile: { id: 77 },
  membership: { role: "owner" },
};

describe("FAMILY postTrade cross-currency settlement", () => {
  beforeEach(() => getDbMock.mockReset());

  it("posts a USD purchase from an EGP account with balanced base amounts and USD cost basis", async () => {
    const egpAccount = { id: 11, workspaceId: 44, accountType: "brokerage", currency: "EGP", status: "active" };
    const usdInstrument = { id: 21, workspaceId: 44, currency: "USD" };
    const usdRate = { rate: "50.0000000000" };
    const clearing = { id: 31 };
    const { tx, inserted } = createTransaction([
      [egpAccount], [usdInstrument], [], [usdRate], [clearing], [{ balance: "20000.000000" }], [],
    ]);
    getDbMock.mockResolvedValue({ transaction: async (callback: (transaction: unknown) => unknown) => callback(tx) });

    const result = await postTrade({
      context: familyContext, actorUserId: 1, side: "buy", accountId: 11, instrumentId: 21,
      quantity: "2", unitPrice: "100", feeAmount: "10", taxAmount: "0", occurredAt: 1_700_000_000_000,
      memo: "USD asset purchase", idempotencyKey: "trade-cross-currency-0001",
    });

    expect(result).toMatchObject({ id: 901, status: "posted", duplicate: false });
    const positionInsert = inserted.find(item => item.table === positions)?.values as Row;
    expect(positionInsert).toMatchObject({ quantity: "2.00000000", averageCost: "105.00000000", costCurrency: "USD" });
    const eventInsert = inserted.find(item => item.table === financialEvents)?.values as Row;
    expect(eventInsert).toMatchObject({ currency: "USD", grossAmount: "200.000000", feeAmount: "10.000000" });
    const linesInsert = inserted.find(item => item.table === journalLines)?.values as Row[];
    expect(linesInsert).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 31, direction: "debit", currency: "USD", amount: "210.000000", fxRateToBase: "50.0000000000", baseAmount: "10500.000000" }),
      expect.objectContaining({ accountId: 11, direction: "credit", currency: "EGP", amount: "10500.000000", fxRateToBase: "1.0000000000", baseAmount: "10500.000000" }),
    ]));
    expect(inserted.some(item => item.table === auditEvents)).toBe(true);
  });

  it("rejects a cross-currency trade when the documented FX rate is unavailable", async () => {
    const egpAccount = { id: 11, workspaceId: 44, accountType: "brokerage", currency: "EGP", status: "active" };
    const usdInstrument = { id: 21, workspaceId: 44, currency: "USD" };
    const { tx } = createTransaction([[egpAccount], [usdInstrument], [], []]);
    getDbMock.mockResolvedValue({ transaction: async (callback: (transaction: unknown) => unknown) => callback(tx) });

    await expect(postTrade({
      context: familyContext, actorUserId: 1, side: "buy", accountId: 11, instrumentId: 21,
      quantity: "2", unitPrice: "100", occurredAt: 1_700_000_000_000,
      memo: null, idempotencyKey: "trade-missing-fx-rate-0002",
    })).rejects.toThrow("يلزم تسجيل سعر صرف موثق");
  });

  it("applies a scoped active percentage fee rule when no manual fee is supplied", async () => {
    const egpAccount = { id: 11, workspaceId: 44, accountType: "brokerage", currency: "EGP", status: "active" };
    const usdInstrument = { id: 21, workspaceId: 44, currency: "USD" };
    const feeRule = { id: 82, workspaceId: 44, profileId: 77, name: "وسيط", chargeType: "fee", appliesTo: "buy", calculationMethod: "percentage", value: "2.5", currency: null, status: "active" };
    const { tx, inserted } = createTransaction([[egpAccount], [usdInstrument], [feeRule], [], [], [{ rate: "50.0000000000" }], [{ id: 31 }], [{ balance: "20000.000000" }], []]);
    getDbMock.mockResolvedValue({ transaction: async (callback: (transaction: unknown) => unknown) => callback(tx) });

    await postTrade({ context: familyContext, actorUserId: 1, side: "buy", accountId: 11, instrumentId: 21, quantity: "2", unitPrice: "100", occurredAt: 1_700_000_000_000, memo: null, idempotencyKey: "trade-active-fee-rule-0003" });

    const positionInsert = inserted.find(item => item.table === positions)?.values as Row;
    const eventInsert = inserted.find(item => item.table === financialEvents)?.values as Row;
    expect(positionInsert).toMatchObject({ averageCost: "102.50000000" });
    expect(eventInsert).toMatchObject({ feeAmount: "5.000000", taxAmount: "0.000000" });
  });
});

describe("FAMILY categorized cash flow", () => {
  beforeEach(() => getDbMock.mockReset());

  it("posts an expense with its workspace category in the financial event and balanced journal", async () => {
    const cashAccount = { id: 11, workspaceId: 44, accountType: "bank", currency: "EGP", status: "active" };
    const category = { id: 61, workspaceId: 44, direction: "expense", isArchived: "no" };
    const expenseAccount = { id: 71 };
    const { tx, inserted } = createTransaction([[cashAccount], [category], [{ balance: "1000.000000" }], [expenseAccount], []]);
    getDbMock.mockResolvedValue({ transaction: async (callback: (transaction: unknown) => unknown) => callback(tx) });

    const result = await postCashEvent({ context: familyContext, actorUserId: 1, eventType: "expense", accountId: 11, amount: "250", currency: "EGP", categoryId: 61, occurredAt: 1_700_000_000_000, memo: "Household expense", idempotencyKey: "categorized-expense-0001" });

    expect(result).toMatchObject({ id: 901, status: "posted", duplicate: false });
    const eventInsert = inserted.find(item => item.table === financialEvents)?.values as Row;
    expect(eventInsert).toMatchObject({ eventType: "expense", categoryId: 61, source: "manual", currency: "EGP", grossAmount: "250.000000" });
    const linesInsert = inserted.find(item => item.table === journalLines)?.values as Row[];
    expect(linesInsert).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 11, direction: "credit", amount: "250.000000", baseAmount: "250.000000" }),
      expect.objectContaining({ accountId: 71, direction: "debit", amount: "250.000000", baseAmount: "250.000000" }),
    ]));
  });
});

describe("FAMILY debt repayment ledger", () => {
  beforeEach(() => getDbMock.mockReset());

  it("posts principal, interest, and fees as a balanced repayment without reducing principal by the non-principal cost", async () => {
    const cashAccount = { id: 11, workspaceId: 44, accountType: "bank", currency: "EGP", status: "active" };
    const liabilityAccount = { id: 21, workspaceId: 44, accountType: "loan", currency: "EGP", status: "active" };
    const debt = { id: 51, workspaceId: 44, liabilityAccountId: 21, currency: "EGP", cashFlowCategoryId: 61, status: "active" };
    const interestExpense = { id: 71 };
    const feeExpense = { id: 72 };
    const { tx, inserted } = createTransaction([
      [], [debt], [cashAccount], [liabilityAccount], [{ balance: "-1000.000000" }], [{ balance: "2000.000000" }], [interestExpense], [feeExpense], [],
    ]);
    getDbMock.mockResolvedValue({ transaction: async (callback: (transaction: unknown) => unknown) => callback(tx) });

    const result = await postDebtPayment({ context: familyContext, actorUserId: 1, debtId: 51, cashAccountId: 11, principalAmount: "200", interestAmount: "30", feeAmount: "2", occurredAt: 1_700_000_000_000, memo: "Loan installment", idempotencyKey: "debt-payment-0001" });

    expect(result).toMatchObject({ id: 901, status: "posted", duplicate: false });
    const event = inserted.find(item => item.table === financialEvents)?.values as Row;
    expect(event).toMatchObject({ eventType: "debt_payment", grossAmount: "232.000000", feeAmount: "2.000000", categoryId: 61 });
    const lines = inserted.find(item => item.table === journalLines)?.values as Row[];
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 21, direction: "debit", amount: "200.000000" }),
      expect.objectContaining({ accountId: 11, direction: "credit", amount: "232.000000" }),
      expect.objectContaining({ accountId: 71, direction: "debit", amount: "30.000000" }),
      expect.objectContaining({ accountId: 72, direction: "debit", amount: "2.000000" }),
    ]));
    const payment = inserted.find(item => item.table === debtPayments)?.values as Row;
    expect(payment).toMatchObject({ debtId: 51, financialEventId: 901, principalAmount: "200.000000", interestAmount: "30.000000", feeAmount: "2.000000" });
  });
});
