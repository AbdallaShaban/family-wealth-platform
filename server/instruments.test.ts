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
