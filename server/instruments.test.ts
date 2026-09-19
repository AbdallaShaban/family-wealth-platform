import { describe, expect, it } from "vitest";

function normalizeAssetType(val: unknown): "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other" {
  if (typeof val !== "string") return "other";
  const cleaned = val.trim().toLowerCase();
  if (["equity", "fund", "bond", "gold", "real_estate", "cash_equivalent", "other"].includes(cleaned)) {
    return cleaned as "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other";
  }
  if (["stock", "stocks", "shares", "سهم", "أسهم", "سهم مدرج"].includes(cleaned)) return "equity";
  if (["funds", "etf", "mutual_fund", "صندوق", "صناديق", "صندوق استثمار"].includes(cleaned)) return "fund";
  if (["bonds", "sukuk", "treasury", "سند", "سندات", "صكوك", "أذون"].includes(cleaned)) return "bond";
  if (["bullion", "metals", "ذهب", "معادن", "ذهب عيني"].includes(cleaned)) return "gold";
  if (["realestate", "property", "reit", "عقار", "عقارات", "أصول عقارية"].includes(cleaned)) return "real_estate";
  if (["cash", "money_market", "نقد", "كاش", "ما يعادل النقد", "سيولة"].includes(cleaned)) return "cash_equivalent";
  return "other";
}

describe("Instrument Classification & Normalization", () => {
  it("correctly maps Arabic asset category labels to canonical enums", () => {
    expect(normalizeAssetType("سهم")).toBe("equity");
    expect(normalizeAssetType("أسهم")).toBe("equity");
    expect(normalizeAssetType("صندوق")).toBe("fund");
    expect(normalizeAssetType("صندوق استثمار")).toBe("fund");
    expect(normalizeAssetType("ذهب")).toBe("gold");
    expect(normalizeAssetType("ذهب عيني")).toBe("gold");
    expect(normalizeAssetType("عقار")).toBe("real_estate");
    expect(normalizeAssetType("سندات")).toBe("bond");
    expect(normalizeAssetType("ما يعادل النقد")).toBe("cash_equivalent");
    expect(normalizeAssetType("أخرى")).toBe("other");
  });

  it("correctly normalizes English variants and uppercase terms", () => {
    expect(normalizeAssetType("STOCK")).toBe("equity");
    expect(normalizeAssetType("FUND")).toBe("fund");
    expect(normalizeAssetType("BOND")).toBe("bond");
    expect(normalizeAssetType("GOLD")).toBe("gold");
    expect(normalizeAssetType("REAL_ESTATE")).toBe("real_estate");
    expect(normalizeAssetType("CASH_EQUIVALENT")).toBe("cash_equivalent");
    expect(normalizeAssetType("OTHER")).toBe("other");
  });

  it("safely falls back to other on unrecognized categories", () => {
    expect(normalizeAssetType("crypto_token")).toBe("other");
    expect(normalizeAssetType("")).toBe("other");
    expect(normalizeAssetType(null)).toBe("other");
  });
});

describe("Instrument CRUD Safety & Validation Rules", () => {
  it("trims and normalizes ticker symbols properly", () => {
    const formatSymbol = (sym?: string | null) => (sym ? sym.trim().toUpperCase() : null);
    expect(formatSymbol(" adib ")).toBe("ADIB");
    expect(formatSymbol("tmgh")).toBe("TMGH");
    expect(formatSymbol("")).toBe(null);
    expect(formatSymbol(null)).toBe(null);
  });

  it("evaluates safe deletion constraints", () => {
    const canSafelyDelete = (activePositionsCount: number, lotsCount: number, eventsCount: number) => {
      if (activePositionsCount > 0) return { allowed: false, reason: "active_positions" };
      if (lotsCount > 0) return { allowed: false, reason: "fifo_lots" };
      if (eventsCount > 0) return { allowed: false, reason: "financial_events" };
      return { allowed: true, reason: null };
    };

    expect(canSafelyDelete(1, 0, 0)).toEqual({ allowed: false, reason: "active_positions" });
    expect(canSafelyDelete(0, 2, 0)).toEqual({ allowed: false, reason: "fifo_lots" });
    expect(canSafelyDelete(0, 0, 5)).toEqual({ allowed: false, reason: "financial_events" });
    expect(canSafelyDelete(0, 0, 0)).toEqual({ allowed: true, reason: null });
  });

  it("verifies double-entry ledger reversal balancing", () => {
    // A reversal journal entry must invert original debits and credits exactly
    const originalLines = [
      { accountId: 101, debit: "5000.00", credit: "0.00" },
      { accountId: 201, debit: "0.00", credit: "5000.00" },
    ];

    const reversalLines = originalLines.map(line => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
    }));

    const sumDebit = reversalLines.reduce((acc, l) => acc + parseFloat(l.debit), 0);
    const sumCredit = reversalLines.reduce((acc, l) => acc + parseFloat(l.credit), 0);

    expect(sumDebit).toBe(sumCredit);
    expect(sumDebit).toBe(5000);
    expect(reversalLines[0].credit).toBe("5000.00");
    expect(reversalLines[1].debit).toBe("5000.00");
  });
});

