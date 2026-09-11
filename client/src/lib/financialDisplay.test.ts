import { describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY, PRIVATE_VALUE_PLACEHOLDER, formatMoney, normalizeCurrency } from "./financialDisplay";

describe("financial display", () => {
  it("normalizes supported three-letter currency codes", () => {
    expect(normalizeCurrency(" usd ")).toBe("USD");
    expect(normalizeCurrency("egp")).toBe("EGP");
    expect(normalizeCurrency(null)).toBe(DEFAULT_CURRENCY);
    expect(normalizeCurrency("invalid")).toBe(DEFAULT_CURRENCY);
  });

  it("formats finite values with the requested currency and precision", () => {
    const value = formatMoney("1234.5", "usd", 2);
    expect(value).toBe("USD 1,234.50");
  });

  it("keeps the standard English ISO code with formatted numbers without Arabic abbreviations", () => {
    const value = formatMoney("0", "EGP", 2);
    expect(value).toBe("EGP 0.00");
    expect(value).not.toContain("ج.م");
    expect(value).not.toContain("NaN");
  });

  it("does not throw for malformed numeric input", () => {
    expect(formatMoney("not-a-number", "EGP", 0)).toBe("EGP 0");
  });

  it("keeps a stable privacy placeholder for sensitive values", () => {
    expect(PRIVATE_VALUE_PLACEHOLDER).toBe("••••••");
  });
});
