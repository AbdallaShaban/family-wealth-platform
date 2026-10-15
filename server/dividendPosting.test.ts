import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import {
  buildDividendJournalLines,
  calculateCashDividendDistribution,
  postCashDividend,
  type PostCashDividendArgs,
} from "./dividendPosting";
import { resolveBaseFxRate } from "./familyLedger";
import { assertBalanced } from "./ledgerMath";
import {
  accounts,
  financialEvents,
  financialPeriods,
  fxRates,
  instruments,
  investmentLots,
  journalEntries,
  journalLines,
} from "../drizzle/schema";

describe("Cash Dividend Corporate Action", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("calculates gross and net cash dividends accurately without floating-point error", () => {
    const totalEligibleShares = new Decimal("1000");
    const dividendPerShare = new Decimal("2.75");
    const taxAmount = new Decimal("0");

    const result = calculateCashDividendDistribution({
      totalEligibleShares,
      dividendPerShare,
      taxAmount,
    });

    expect(result.grossAmount.toFixed(6)).toBe("2750.000000");
    expect(result.taxAmount.toFixed(6)).toBe("0.000000");
    expect(result.netCashAmount.toFixed(6)).toBe("2750.000000");
  });

  it("deducts withholding tax and guarantees net cash balance", () => {
    const totalEligibleShares = new Decimal("500.5");
    const dividendPerShare = new Decimal("1.20");
    const taxAmount = new Decimal("60.06"); // 10% tax

    const result = calculateCashDividendDistribution({
      totalEligibleShares,
      dividendPerShare,
      taxAmount,
    });

    expect(result.grossAmount.toFixed(6)).toBe("600.600000");
    expect(result.taxAmount.toFixed(6)).toBe("60.060000");
    expect(result.netCashAmount.toFixed(6)).toBe("540.540000");
    expect(result.netCashAmount.plus(result.taxAmount).toFixed(6)).toBe(result.grossAmount.toFixed(6));
  });

  it("rejects distribution when eligible shares are zero or negative", () => {
    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("0"),
        dividendPerShare: new Decimal("1.5"),
        taxAmount: new Decimal("0"),
      })
    ).toThrow();

    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("-10"),
        dividendPerShare: new Decimal("1.5"),
        taxAmount: new Decimal("0"),
      })
    ).toThrow();
  });

  it("rejects tax amount exceeding or equaling gross dividend", () => {
    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("100"),
        dividendPerShare: new Decimal("2"),
        taxAmount: new Decimal("200"),
      })
    ).toThrow("لا يمكن أن تتجاوز أو تعادل");

    expect(() =>
      calculateCashDividendDistribution({
        totalEligibleShares: new Decimal("100"),
        dividendPerShare: new Decimal("2"),
        taxAmount: new Decimal("250"),
      })
    ).toThrow("لا يمكن أن تتجاوز أو تعادل");
  });

  it("generates balanced double-entry lines for gross distribution without tax in base currency (EGP)", () => {
    const lines = buildDividendJournalLines({
      cashAccountId: 10,
      dividendIncomeAccountId: 99,
      grossAmount: new Decimal("500.00"),
      taxAmount: new Decimal("0.00"),
      netCashAmount: new Decimal("500.00"),
      currency: "EGP",
      fxRateToBase: new Decimal(1),
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].accountId).toBe(10);
    expect(lines[0].direction).toBe("debit");
    expect(lines[0].amount.toFixed(2)).toBe("500.00");
    expect(lines[0].fxRateToBase?.toFixed(2)).toBe("1.00");
    expect(lines[0].baseAmount?.toFixed(2)).toBe("500.00");

    expect(lines[1].accountId).toBe(99);
    expect(lines[1].direction).toBe("credit");
    expect(lines[1].amount.toFixed(2)).toBe("500.00");
    expect(lines[1].fxRateToBase?.toFixed(2)).toBe("1.00");
    expect(lines[1].baseAmount?.toFixed(2)).toBe("500.00");

    expect(() => assertBalanced(lines)).not.toThrow();
  });

  it("converts 100 USD dividend in EGP base currency workspace at documented rate 48.50 with accurate base amounts", () => {
    const fxRate = new Decimal("48.50");
    const lines = buildDividendJournalLines({
      cashAccountId: 10,
      dividendIncomeAccountId: 99,
      grossAmount: new Decimal("100.00"),
      taxAmount: new Decimal("0.00"),
      netCashAmount: new Decimal("100.00"),
      currency: "USD",
      fxRateToBase: fxRate,
    });

    expect(lines).toHaveLength(2);

    // Debit Cash: 100 USD -> 4,850 EGP
    const cashLine = lines[0];
    expect(cashLine.accountId).toBe(10);
    expect(cashLine.direction).toBe("debit");
    expect(cashLine.amount.toFixed(2)).toBe("100.00");
    expect(cashLine.currency).toBe("USD");
    expect(cashLine.fxRateToBase?.toFixed(2)).toBe("48.50");
    expect(cashLine.baseAmount?.toFixed(2)).toBe("4850.00");

    // Credit Income: 100 USD -> 4,850 EGP
    const incomeLine = lines[1];
    expect(incomeLine.accountId).toBe(99);
    expect(incomeLine.direction).toBe("credit");
    expect(incomeLine.amount.toFixed(2)).toBe("100.00");
    expect(incomeLine.currency).toBe("USD");
    expect(incomeLine.fxRateToBase?.toFixed(2)).toBe("48.50");
    expect(incomeLine.baseAmount?.toFixed(2)).toBe("4850.00");

    // Strictly balanced in base amount
    expect(() => assertBalanced(lines)).not.toThrow();
  });

  it("generates balanced three-line journal with withholding tax converted at 48.50", () => {
    const fxRate = new Decimal("48.50");
    const lines = buildDividendJournalLines({
      cashAccountId: 10,
      dividendIncomeAccountId: 99,
      withholdingTaxAccountId: 88,
      grossAmount: new Decimal("100.00"),
      taxAmount: new Decimal("10.00"),
      netCashAmount: new Decimal("90.00"),
      currency: "USD",
      fxRateToBase: fxRate,
    });

    expect(lines).toHaveLength(3);

    // Cash Debit: 90 USD -> 4,365.00 EGP
    const cashLine = lines.find(l => l.accountId === 10);
    expect(cashLine?.direction).toBe("debit");
    expect(cashLine?.amount.toFixed(2)).toBe("90.00");
    expect(cashLine?.baseAmount?.toFixed(2)).toBe("4365.00");

    // Tax Expense Debit: 10 USD -> 485.00 EGP
    const taxLine = lines.find(l => l.accountId === 88);
    expect(taxLine?.direction).toBe("debit");
    expect(taxLine?.amount.toFixed(2)).toBe("10.00");
    expect(taxLine?.baseAmount?.toFixed(2)).toBe("485.00");

    // Income Credit: 100 USD -> 4,850.00 EGP
    const incomeLine = lines.find(l => l.accountId === 99);
    expect(incomeLine?.direction).toBe("credit");
    expect(incomeLine?.amount.toFixed(2)).toBe("100.00");
    expect(incomeLine?.baseAmount?.toFixed(2)).toBe("4850.00");

    // Debits (4,365 + 485 = 4,850) strictly equals Credits (4,850)
    const totalDebitBase = (cashLine?.baseAmount ?? new Decimal(0)).plus(taxLine?.baseAmount ?? new Decimal(0));
    const totalCreditBase = incomeLine?.baseAmount ?? new Decimal(0);
    expect(totalDebitBase.toFixed(2)).toBe(totalCreditBase.toFixed(2));
    expect(() => assertBalanced(lines)).not.toThrow();
  });

  describe("resolveBaseFxRate logic", () => {
    it("returns 1 immediately when currency matches workspace base currency without querying fxRates", async () => {
      const mockTx: any = {
        select: vi.fn(),
      };
      const context: any = { workspace: { id: 1, baseCurrency: "EGP" } };
      const rate = await resolveBaseFxRate(mockTx, context, "EGP", Date.now());
      expect(rate.equals(1)).toBe(true);
      expect(mockTx.select).not.toHaveBeenCalled();
    });

    it("resolves direct historical FX rate asOf <= paymentDate", async () => {
      const paymentDate = 1_700_000_000_000;
      const mockTx: any = {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () => [{ rate: "48.5000000000", asOf: paymentDate - 5000 }],
              }),
            }),
          }),
        })),
      };
      const context: any = { workspace: { id: 1, baseCurrency: "EGP" } };
      const rate = await resolveBaseFxRate(mockTx, context, "USD", paymentDate);
      expect(rate.toFixed(2)).toBe("48.50");
    });

    it("resolves valid historical inverse FX rate when direct quote is absent", async () => {
      const paymentDate = 1_700_000_000_000;
      let callCount = 0;
      const mockTx: any = {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () => {
                  callCount++;
                  if (callCount === 1) {
                    // Direct quote query: none
                    return [];
                  }
                  // Inverse quote query: 1 EGP = 0.02 USD (meaning 1 USD = 50 EGP)
                  return [{ rate: "0.0200000000", asOf: paymentDate - 2000 }];
                },
              }),
            }),
          }),
        })),
      };
      const context: any = { workspace: { id: 1, baseCurrency: "EGP" } };
      const rate = await resolveBaseFxRate(mockTx, context, "USD", paymentDate);
      expect(rate.toFixed(2)).toBe("50.00");
    });

    it("ignores future inverse quote and picks the latest historical inverse quote asOf <= paymentDate", async () => {
      const paymentDate = 1_700_000_000_000;
      let callCount = 0;
      const mockTx: any = {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () => {
                  callCount++;
                  if (callCount === 1) {
                    return []; // Direct quote absent
                  }
                  // Simulating database query with lte(asOf, paymentDate) which filters out future quotes:
                  // Historical quote at paymentDate - 3000 (0.0206185567 -> 48.50 EGP/USD)
                  return [{ rate: "0.0206185567", asOf: paymentDate - 3000 }];
                },
              }),
            }),
          }),
        })),
      };
      const context: any = { workspace: { id: 1, baseCurrency: "EGP" } };
      const rate = await resolveBaseFxRate(mockTx, context, "USD", paymentDate);
      expect(rate.toFixed(2)).toBe("48.50");
    });

    it("rejects operation when inverse quote exists only in the future (after paymentDate)", async () => {
      const paymentDate = 1_700_000_000_000;
      const mockTx: any = {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () => [], // Both direct and inverse queries filter by asOf <= paymentDate and return empty
              }),
            }),
          }),
        })),
      };
      const context: any = { workspace: { id: 1, baseCurrency: "EGP" } };
      await expect(resolveBaseFxRate(mockTx, context, "USD", paymentDate)).rejects.toThrow(
        "يلزم تسجيل سعر صرف موثق من USD إلى EGP قبل نشر هذه العملية."
      );
    });

    it("rejects foreign currency distribution safely when no reliable exchange rate is found", async () => {
      const mockTx: any = {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () => [],
              }),
            }),
          }),
        })),
      };
      const context: any = { workspace: { id: 1, baseCurrency: "EGP" } };
      await expect(resolveBaseFxRate(mockTx, context, "EUR", Date.now())).rejects.toThrow(
        "يلزم تسجيل سعر صرف موثق من EUR إلى EGP قبل نشر هذه العملية."
      );
    });

    it("rejects safely without division by zero when inverse rate is non-positive", async () => {
      const paymentDate = 1_700_000_000_000;
      let callCount = 0;
      const mockTx: any = {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () => {
                  callCount++;
                  if (callCount === 1) return []; // Direct quote absent
                  return [{ rate: "0.0000000000", asOf: paymentDate - 1000 }]; // Invalid zero rate
                },
              }),
            }),
          }),
        })),
      };
      const context: any = { workspace: { id: 1, baseCurrency: "EGP" } };
      await expect(resolveBaseFxRate(mockTx, context, "USD", paymentDate)).rejects.toThrow(
        "يلزم تسجيل سعر صرف موثق من USD إلى EGP قبل نشر هذه العملية."
      );
    });
  });

  describe("postCashDividend end-to-end integration and ledger atomicity", () => {
    const baseContext: any = {
      workspace: { id: 101, baseCurrency: "EGP", name: "Family Test" },
      profile: { id: 202 },
      membership: { role: "owner" },
    };

    function setupMockTx(options: {
      currency: string;
      baseCurrency?: string;
      fxRate?: string;
      hasRate?: boolean;
    }) {
      const inserted: Array<{ table: unknown; values: unknown }> = [];
      const baseCurrency = options.baseCurrency ?? "EGP";
      const currency = options.currency;

      function getTableRows(table: any) {
        if (table === financialEvents) return []; // no duplicate
        if (table === financialPeriods) return []; // period not closed
        if (table === accounts) {
          return [{
            id: 11,
            workspaceId: 101,
            currency,
            accountType: "brokerage",
            status: "active",
            accountCode: `ACC_${currency}`,
          }];
        }
        if (table === instruments) {
          return [{
            id: 22,
            workspaceId: 101,
            currency,
            symbol: "TST",
            name: "Test Corp",
          }];
        }
        if (table === investmentLots) {
          return [{
            id: 33,
            workspaceId: 101,
            instrumentId: 22,
            remainingQuantity: "100.00000000",
            acquiredAt: 1_000,
            status: "open",
          }];
        }
        if (table === fxRates) {
          if (options.hasRate === false) return [];
          return [{
            id: 44,
            workspaceId: 101,
            fromCurrency: currency,
            toCurrency: baseCurrency,
            rate: options.fxRate ?? "48.5000000000",
            asOf: 2_000,
          }];
        }
        return [];
      }

      const tx: any = {
        execute: vi.fn().mockResolvedValue([]),
        select: vi.fn(() => ({
          from: (table: any) => {
            const rows = getTableRows(table);
            const chain: any = {
              where: () => chain,
              orderBy: () => chain,
              limit: async () => rows,
              then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
            };
            return chain;
          },
        })),
        insert: vi.fn((table: any) => ({
          values: (values: any) => {
            inserted.push({ table, values });
            return {
              onDuplicateKeyUpdate: () => Promise.resolve([]),
              then: (resolve: any) => {
                if (table === financialEvents) return Promise.resolve([{ insertId: 501 }]).then(resolve);
                if (table === journalEntries) return Promise.resolve([{ insertId: 601 }]).then(resolve);
                return Promise.resolve([]).then(resolve);
              },
            };
          },
        })),
      };

      return { tx, inserted };
    }

    it("posts cash dividend in base currency (EGP) with rate 1 and baseAmount equal to amount", async () => {
      const { tx, inserted } = setupMockTx({ currency: "EGP" });
      getDbMock.mockResolvedValue({
        transaction: async (cb: any) => cb(tx),
      });

      const args: PostCashDividendArgs = {
        context: baseContext,
        actorUserId: 1,
        instrumentId: 22,
        cashAccountId: 11,
        dividendPerShare: "1.00",
        exDate: 5_000,
        paymentDate: 6_000,
        idempotencyKey: "test-egp-idempotency-key-01",
      };

      const result = await postCashDividend(args);

      expect(result.grossAmount).toBe("100.000000");
      expect(result.fxRateToBase).toBe("1.0000000000");
      expect(result.baseGrossAmount).toBe("100.000000");

      const postedLinesInsert = inserted.find(i => i.table === journalLines);
      expect(postedLinesInsert).toBeDefined();
      const lines = postedLinesInsert?.values as any[];
      expect(lines).toHaveLength(2);
      expect(lines[0].currency).toBe("EGP");
      expect(lines[0].fxRateToBase).toBe("1.0000000000");
      expect(lines[0].baseAmount).toBe("100.000000");
      expect(lines[1].fxRateToBase).toBe("1.0000000000");
      expect(lines[1].baseAmount).toBe("100.000000");
    });

    it("posts 100 USD cash dividend with rate 48.50 converting baseAmount to 4850 EGP", async () => {
      const { tx, inserted } = setupMockTx({ currency: "USD", fxRate: "48.5000000000" });
      getDbMock.mockResolvedValue({
        transaction: async (cb: any) => cb(tx),
      });

      const args: PostCashDividendArgs = {
        context: baseContext,
        actorUserId: 1,
        instrumentId: 22,
        cashAccountId: 11,
        dividendPerShare: "1.00",
        exDate: 5_000,
        paymentDate: 6_000,
        idempotencyKey: "test-usd-idempotency-key-02",
      };

      const result = await postCashDividend(args);

      expect(result.currency).toBe("USD");
      expect(result.grossAmount).toBe("100.000000");
      expect(result.fxRateToBase).toBe("48.5000000000");
      expect(result.baseGrossAmount).toBe("4850.000000");

      const postedLinesInsert = inserted.find(i => i.table === journalLines);
      const lines = postedLinesInsert?.values as any[];
      expect(lines).toHaveLength(2);

      // Debit Cash Line
      const cashLine = lines[0];
      expect(cashLine.direction).toBe("debit");
      expect(cashLine.amount).toBe("100.000000");
      expect(cashLine.currency).toBe("USD");
      expect(cashLine.fxRateToBase).toBe("48.5000000000");
      expect(cashLine.baseAmount).toBe("4850.000000");

      // Credit Income Line
      const incomeLine = lines[1];
      expect(incomeLine.direction).toBe("credit");
      expect(incomeLine.amount).toBe("100.000000");
      expect(incomeLine.currency).toBe("USD");
      expect(incomeLine.fxRateToBase).toBe("48.5000000000");
      expect(incomeLine.baseAmount).toBe("4850.000000");
    });

    it("posts 100 USD cash dividend with 10 USD withholding tax at 48.50 with balanced 3 lines", async () => {
      const { tx, inserted } = setupMockTx({ currency: "USD", fxRate: "48.5000000000" });
      getDbMock.mockResolvedValue({
        transaction: async (cb: any) => cb(tx),
      });

      const args: PostCashDividendArgs = {
        context: baseContext,
        actorUserId: 1,
        instrumentId: 22,
        cashAccountId: 11,
        dividendPerShare: "1.00",
        taxAmount: "10.00",
        exDate: 5_000,
        paymentDate: 6_000,
        idempotencyKey: "test-usd-tax-idempotency-key-03",
      };

      const result = await postCashDividend(args);

      expect(result.grossAmount).toBe("100.000000");
      expect(result.taxAmount).toBe("10.000000");
      expect(result.netCashAmount).toBe("90.000000");
      expect(result.fxRateToBase).toBe("48.5000000000");
      expect(result.baseGrossAmount).toBe("4850.000000");
      expect(result.baseNetCashAmount).toBe("4365.000000");

      const postedLinesInsert = inserted.find(i => i.table === journalLines);
      const lines = postedLinesInsert?.values as any[];
      expect(lines).toHaveLength(3);

      const cashDebit = lines.find(l => l.direction === "debit" && l.amount === "90.000000");
      expect(cashDebit.fxRateToBase).toBe("48.5000000000");
      expect(cashDebit.baseAmount).toBe("4365.000000");

      const taxDebit = lines.find(l => l.direction === "debit" && l.amount === "10.000000");
      expect(taxDebit.fxRateToBase).toBe("48.5000000000");
      expect(taxDebit.baseAmount).toBe("485.000000");

      const incomeCredit = lines.find(l => l.direction === "credit");
      expect(incomeCredit.amount).toBe("100.000000");
      expect(incomeCredit.fxRateToBase).toBe("48.5000000000");
      expect(incomeCredit.baseAmount).toBe("4850.000000");

      // Balance check: 4,365 + 485 = 4,850
      const totalDebit = new Decimal(cashDebit.baseAmount).plus(taxDebit.baseAmount);
      expect(totalDebit.toFixed(6)).toBe(incomeCredit.baseAmount);
    });

    it("rejects posting without creating any journal lines or financial events when exchange rate is missing", async () => {
      const { tx, inserted } = setupMockTx({ currency: "USD", hasRate: false });
      getDbMock.mockResolvedValue({
        transaction: async (cb: any) => cb(tx),
      });

      const args: PostCashDividendArgs = {
        context: baseContext,
        actorUserId: 1,
        instrumentId: 22,
        cashAccountId: 11,
        dividendPerShare: "1.00",
        exDate: 5_000,
        paymentDate: 6_000,
        idempotencyKey: "test-missing-fx-key-04",
      };

      await expect(postCashDividend(args)).rejects.toThrow(
        "يلزم تسجيل سعر صرف موثق من USD إلى EGP قبل نشر هذه العملية."
      );

      // Verify that no ledger entries, lines, or events were inserted
      expect(inserted.some(i => i.table === financialEvents)).toBe(false);
      expect(inserted.some(i => i.table === journalEntries)).toBe(false);
      expect(inserted.some(i => i.table === journalLines)).toBe(false);
    });
  });
});
