import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateConsolidation, convertAmount, type FxRateResolver, type RawWorkspaceEntity } from "./consolidationMath";

describe("Multi-Workspace Consolidation Math", () => {
  const dummyFxResolver: FxRateResolver = (from, to) => {
    const key = `${from}->${to}`;
    const rates: Record<string, { rate: Decimal; source: string; asOf: number }> = {
      "USD->SAR": { rate: new Decimal("3.75"), source: "central_bank", asOf: Date.now() },
      "EGP->SAR": { rate: new Decimal("0.075"), source: "central_bank", asOf: Date.now() },
      "EUR->SAR": { rate: new Decimal("4.10"), source: "central_bank", asOf: Date.now() },
      "SAR->USD": { rate: new Decimal("1").div(new Decimal("3.75")), source: "central_bank", asOf: Date.now() },
    };
    return rates[key] ?? null;
  };

  it("translates currencies deterministically and preserves identity conversion", () => {
    const identity = convertAmount(new Decimal("100"), "SAR", "SAR", dummyFxResolver);
    expect(identity.converted.toFixed(2)).toBe("100.00");
    expect(identity.status).toBe("identity");

    const converted = convertAmount(new Decimal("1000"), "USD", "SAR", dummyFxResolver);
    expect(converted.converted.toFixed(2)).toBe("3750.00");
    expect(converted.status).toBe("authoritative");

    const missing = convertAmount(new Decimal("500"), "KWD", "SAR", dummyFxResolver);
    expect(missing.status).toBe("missing");
    expect(missing.converted.toFixed(2)).toBe("500.00"); // Preserves amount, does not zero out
  });

  it("consolidates multiple workspaces into gross net worth without modifying ledger facts", () => {
    const entity1: RawWorkspaceEntity = {
      workspaceId: 1,
      workspaceName: "المكتب العائلي الرئيسي",
      baseCurrency: "SAR",
      role: "owner",
      grossBookNetWorth: new Decimal("1000000.00"),
      economicNetWorth: new Decimal("1200000.00"),
      liquidCash: new Decimal("200000.00"),
      investmentValue: new Decimal("1000000.00"),
      assetValue: new Decimal("50000.00"),
      liabilities: new Decimal("50000.00"),
      accounts: [
        { id: 1, name: "حساب جاري", accountType: "bank", currency: "SAR", balance: new Decimal("200000.00") },
      ],
      portfolio: [
        { instrumentId: 10, instrumentName: "صندوق الراجحي", assetType: "fund", quantity: new Decimal("100"), currency: "SAR", marketValue: new Decimal("1000000.00") },
      ],
      debts: [],
      ious: [],
    };

    const entity2: RawWorkspaceEntity = {
      workspaceId: 2,
      workspaceName: "شركة قابضة تابعة",
      baseCurrency: "USD",
      role: "advisor",
      grossBookNetWorth: new Decimal("200000.00"), // 200k USD * 3.75 = 750,000 SAR
      economicNetWorth: new Decimal("200000.00"),
      liquidCash: new Decimal("50000.00"), // 50k USD * 3.75 = 187,500 SAR
      investmentValue: new Decimal("150000.00"), // 150k USD * 3.75 = 562,500 SAR
      assetValue: new Decimal("0.00"),
      liabilities: new Decimal("0.00"),
      accounts: [
        { id: 2, name: "Chase Operating", accountType: "bank", currency: "USD", balance: new Decimal("50000.00") },
      ],
      portfolio: [
        { instrumentId: 20, instrumentName: "Apple Inc.", assetType: "equity", quantity: new Decimal("500"), currency: "USD", marketValue: new Decimal("150000.00") },
      ],
      debts: [],
      ious: [],
    };

    const result = calculateConsolidation([entity1, entity2], "SAR", dummyFxResolver);

    expect(result.workspaceCount).toBe(2);
    expect(result.presentationCurrency).toBe("SAR");
    // 1,000,000 SAR + 750,000 SAR = 1,750,000 SAR
    expect(result.grossConsolidatedBookNetWorth).toBe("1750000.00");
    // 1,200,000 SAR + 750,000 SAR = 1,950,000 SAR
    expect(result.grossConsolidatedEconomicNetWorth).toBe("1950000.00");
    // Total liabilities = 50,000 SAR
    expect(result.totalConsolidatedLiabilities).toBe("50000.00");
  });

  it("enforces Inter-Entity Disclosure and strictly rejects speculative eliminations", () => {
    const entity1: RawWorkspaceEntity = {
      workspaceId: 1,
      workspaceName: "مساحة أ",
      baseCurrency: "SAR",
      role: "owner",
      grossBookNetWorth: new Decimal("500000"),
      economicNetWorth: new Decimal("500000"),
      liquidCash: new Decimal("500000"),
      investmentValue: new Decimal("0"),
      assetValue: new Decimal("0"),
      liabilities: new Decimal("0"),
      accounts: [],
      portfolio: [],
      debts: [],
      ious: [
        {
          id: 101,
          counterpartyName: "شركة الأبراج القابضة",
          direction: "receivable",
          amount: new Decimal("150000"),
          currency: "SAR",
          status: "active",
        },
      ],
    };

    const entity2: RawWorkspaceEntity = {
      workspaceId: 2,
      workspaceName: "شركة الأبراج القابضة",
      baseCurrency: "SAR",
      role: "owner",
      grossBookNetWorth: new Decimal("1000000"),
      economicNetWorth: new Decimal("1000000"),
      liquidCash: new Decimal("1000000"),
      investmentValue: new Decimal("0"),
      assetValue: new Decimal("0"),
      liabilities: new Decimal("150000"),
      accounts: [],
      portfolio: [],
      debts: [
        {
          id: 201,
          creditorName: "مساحة أ",
          liabilityAccountId: 55,
          outstandingBalance: new Decimal("150000"),
          currency: "SAR",
        },
      ],
      ious: [],
    };

    const result = calculateConsolidation([entity1, entity2], "SAR", dummyFxResolver);

    // Gross combined net worth remains unchanged (no automated elimination)
    expect(result.grossConsolidatedBookNetWorth).toBe("1500000.00");
    // Inter-entity disclosures are present
    expect(result.interEntityDisclosures.length).toBe(2);
    expect(result.interEntityDisclosures[0].eliminationStatus).toBe("DISCLOSED_NOT_ELIMINATED");
    expect(result.interEntityDisclosures[1].eliminationStatus).toBe("DISCLOSED_NOT_ELIMINATED");
    // Disclosed claims total
    expect(result.totalDisclosedInterEntityClaims).toBe("150000.00");
  });

  it("calculates consolidated asset allocation summing to 100%", () => {
    const entity: RawWorkspaceEntity = {
      workspaceId: 1,
      workspaceName: "الكيان الاستثماري",
      baseCurrency: "SAR",
      role: "owner",
      grossBookNetWorth: new Decimal("1000000"),
      economicNetWorth: new Decimal("1000000"),
      liquidCash: new Decimal("400000"),
      investmentValue: new Decimal("600000"),
      assetValue: new Decimal("0"),
      liabilities: new Decimal("0"),
      accounts: [
        { id: 1, name: "البنك الأهلي", accountType: "bank", currency: "SAR", balance: new Decimal("400000") },
      ],
      portfolio: [
        { instrumentId: 1, instrumentName: "أرامكو", assetType: "equity", quantity: new Decimal("10000"), currency: "SAR", marketValue: new Decimal("400000") },
        { instrumentId: 2, instrumentName: "سبيكة ذهب", assetType: "gold", quantity: new Decimal("500"), currency: "SAR", marketValue: new Decimal("200000") },
      ],
      debts: [],
      ious: [],
    };

    const result = calculateConsolidation([entity], "SAR", dummyFxResolver);

    const cashAlloc = result.assetAllocation.find(a => a.assetClass === "liquid_cash");
    const equityAlloc = result.assetAllocation.find(a => a.assetClass === "equities");
    const goldAlloc = result.assetAllocation.find(a => a.assetClass === "precious_metals");

    expect(cashAlloc?.weightPercentage).toBe("40.00");
    expect(equityAlloc?.weightPercentage).toBe("40.00");
    expect(goldAlloc?.weightPercentage).toBe("20.00");

    const totalWeight = result.assetAllocation.reduce((sum, item) => sum.plus(new Decimal(item.weightPercentage)), new Decimal(0));
    expect(totalWeight.toFixed(2)).toBe("100.00");
  });
});
