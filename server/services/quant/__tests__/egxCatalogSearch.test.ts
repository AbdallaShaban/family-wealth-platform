import { describe, expect, it } from "vitest";
import { normalizeArabic, resolveEgxAsset, searchEgxCatalog, EGX_MASTER_CATALOG } from "../egxCatalog";

describe("EGX Master Catalog & Arabic Search Normalization", () => {
  it("normalizes Arabic text with all Alef forms, Taa Marbouta, and Yaa", () => {
    // Alef variants
    expect(normalizeArabic("أحمد")).toBe("احمد");
    expect(normalizeArabic("إبراهيم")).toBe("ابراهيم");
    expect(normalizeArabic("آمنة")).toBe("امنه");
    expect(normalizeArabic("ٱلإسكندرية")).toBe("الاسكندريه");

    // Taa Marbouta
    expect(normalizeArabic("مطاحن ومخابز الإسكندرية")).toBe("مطاحن ومخابز الاسكندريه");

    // Yaa / Alef Maksoura
    expect(normalizeArabic("مصرى")).toBe("مصري");
    expect(normalizeArabic("على")).toBe("علي");
  });

  it("indexes Alexandria Flour Mills (AFMC) in master catalog", () => {
    const afmc = EGX_MASTER_CATALOG.find(c => c.ticker === "AFMC.CA" || c.symbol === "AFMC");
    expect(afmc).toBeDefined();
    expect(afmc?.nameAr).toContain("الإسكندرية");
    expect(afmc?.sector).toBe("الأغذية والمشروبات والزراعة");
  });

  it("resolves AFMC stock when searching 'مطاحن اسكندرية'", () => {
    const results = searchEgxCatalog("مطاحن اسكندرية");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ticker).toBe("AFMC.CA");
    expect(results[0].nameAr).toContain("الإسكندرية");
  });

  it("resolves milling sector stocks when searching 'مطاحن'", () => {
    const results = searchEgxCatalog("مطاحن");
    expect(results.length).toBeGreaterThanOrEqual(2);
    const tickers = results.map(r => r.ticker);
    expect(tickers).toContain("AFMC.CA");
  });

  it("resolves ticker symbol 'AFMC' directly", () => {
    const asset = resolveEgxAsset("AFMC");
    expect(asset).toBeDefined();
    expect(asset?.ticker).toBe("AFMC.CA");
    expect(asset?.nameAr).toContain("مطاحن");
  });
});
