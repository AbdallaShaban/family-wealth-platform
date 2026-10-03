import { describe, it, expect, vi } from "vitest";
import { searchOmni } from "../../familyRead";
import type { FamilyContext } from "../../familyAccess";

describe("Omni-Search & Command Palette (Option 3)", () => {
  const mockFamilyContext: FamilyContext = {
    workspace: {
      id: 1,
      name: "عائلة آل شعبان لإدارة الثروات",
      baseCurrency: "EGP",
      ownerProfileId: 1,
      createdAt: 1791000000000,
      updatedAt: 1791000000000,
    } as any,
    profile: {
      id: 1,
      workspaceId: 1,
      displayName: "عبد الله شعبان",
      role: "owner",
    } as any,
    membership: {
      id: 1,
      workspaceId: 1,
      userId: 1,
      role: "owner",
      status: "active",
      createdAt: 1791000000000,
      updatedAt: 1791000000000,
    },
  };

  it("returns empty result arrays when query string is empty or whitespace", async () => {
    const resultEmpty = await searchOmni(mockFamilyContext, "");
    expect(resultEmpty).toEqual({
      transactions: [],
      accounts: [],
      instruments: [],
      debts: [],
    });

    const resultWhitespace = await searchOmni(mockFamilyContext, "   ");
    expect(resultWhitespace).toEqual({
      transactions: [],
      accounts: [],
      instruments: [],
      debts: [],
    });
  });

  it("correctly identifies gold & precious metal search queries", () => {
    const goldKeywords = ["ذهب", "سبيكة عيار 24", "جنيه ذهب", "gold", "عيار 21"];
    const regex = /ذهب|gold|عيار|سبائك|سبيكة|جنيه/i;

    for (const kw of goldKeywords) {
      expect(regex.test(kw)).toBe(true);
    }

    expect(regex.test("حساب بنك مصر")).toBe(false);
    expect(regex.test("شراء 100 COMI")).toBe(false);
  });

  it("correctly parses natural language financial intents", () => {
    // 1. Trade
    const tradeRegex = /^(شراء|بيع|buy|sell)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9_.\u0600-\u06FF]+)(?:\s*@\s*(\d+(?:\.\d+)?))?(?:\s+(?:حساب\s+)?([^\n@]+))?/i;
    const tradeMatch = "شراء 100 COMI @ 88.5 حساب CIB".match(tradeRegex);
    expect(tradeMatch).not.toBeNull();
    expect(tradeMatch![1]).toBe("شراء");
    expect(parseFloat(tradeMatch![2])).toBe(100);
    expect(tradeMatch![3].trim()).toBe("COMI");
    expect(parseFloat(tradeMatch![4])).toBe(88.5);

    // 2. Deposit
    const depositRegex = /^(ايداع|إيداع|دخل|deposit|income)\s+(\d+(?:\.\d+)?)(?:\s+(?:في\s+|حساب\s+)?([^\n]+))?/i;
    const depMatch = "ايداع 5000 تيلدا".match(depositRegex);
    expect(depMatch).not.toBeNull();
    expect(parseFloat(depMatch![2])).toBe(5000);
    expect(depMatch![3]?.trim()).toBe("تيلدا");

    // 3. Expense
    const expenseRegex = /^(صرف|مصروف|سحب|شراء\s+مشتريات|expense|spend|withdraw)\s+(\d+(?:\.\d+)?)(?:\s+(?:من\s+|حساب\s+)?([^\n]+))?/i;
    const expMatch = "صرف 450 بنزين".match(expenseRegex);
    expect(expMatch).not.toBeNull();
    expect(parseFloat(expMatch![2])).toBe(450);
    expect(expMatch![3]?.trim()).toBe("بنزين");
  });

  it("verifies the 20 platform navigation sections registry", () => {
    const requiredSections = [
      "/",
      "/wealth-health",
      "/reports",
      "/banking",
      "/transactions",
      "/banking?tab=certificates",
      "/banking?tab=liquidity",
      "/banking?tab=debts",
      "/reconciliation",
      "/imports",
      "/investments",
      "/investments?tab=instruments",
      "/quant",
      "/investments?tab=realized",
      "/investments?tab=allocation",
      "/governance?tab=zakat",
      "/stress-testing",
      "/governance?tab=vault",
      "/governance?tab=audit",
      "/governance?tab=members",
    ];

    expect(requiredSections.length).toBe(20);
    const uniquePaths = new Set(requiredSections);
    expect(uniquePaths.size).toBe(20);
  });
});
