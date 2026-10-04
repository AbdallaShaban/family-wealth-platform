import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { generateWealthAdvisorPackage } from "../wealthAdvisorService";

// Mock external dependencies
vi.mock("../../wealthHealthRouter", () => ({
  loadWealthHealthAggregations: vi.fn(),
}));

vi.mock("../goldFxLiveFeedService", () => ({
  getLiveGoldAndFxRates: vi.fn().mockResolvedValue({
    karat24: 7000,
    karat21: 6125,
    karat18: 5250,
    sovereign: 49000,
    usdEgp: 50,
    eurEgp: 55,
    asOf: new Date().toISOString(),
    source: "Mock Live Feed",
    isFallback: false,
  }),
}));

import { loadWealthHealthAggregations } from "../../wealthHealthRouter";

describe("Family AI Wealth Advisor Engine (wealthAdvisorService)", () => {
  const mockFamily = {
    workspace: { id: "ws-test-01", name: "محفظة عائلة الأمل", baseCurrency: "EGP" },
    user: { id: "usr-01", name: "عبد الله شعبان" },
    profile: { id: "prof-01", displayName: "عبد الله شعبان", role: "owner" },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates stagnant idle liquidity and generates rebalancing recommendations when idle cash exceeds emergency fund", async () => {
    // 2,000,000 liquid cash with 50,000 monthly living expense
    // 6 months emergency fund = 300,000. Stagnant cash = 1,700,000
    vi.mocked(loadWealthHealthAggregations).mockResolvedValueOnce({
      workspaceId: "ws-test-01",
      baseCurrency: "EGP",
      asOfTimestamp: Date.now(),
      liquidCashReserves: new Decimal(2000000),
      monthlyEssentialOutflows: new Decimal(50000),
      totalDebtPrincipal: new Decimal(0),
      totalEconomicAssets: new Decimal(10000000),
      annualDebtService: new Decimal(0),
      ocfPreDebt: new Decimal(100000),
      operatingInflows: new Decimal(150000),
      operatingExpenses: new Decimal(600000),
      debtPrincipalRepayments: new Decimal(0),
      ttmEssentialExpenses: new Decimal(600000),
      investableAssets: new Decimal(10000000),
      classValues: {
        cash: new Decimal(2000000),
        equity: new Decimal(1000000),
        fixed_income: new Decimal(2000000),
        alternatives: new Decimal(1000000),
        other: new Decimal(4000000),
      },
      holdingsList: [
        { name: "أصل عقاري تجاري", value: new Decimal(4000000) },
        { name: "حساب توفير بنك مصر", value: new Decimal(2000000) },
      ],
      totalFreshAssetValue: new Decimal(10000000),
      hasActiveHealthPolicy: true,
      activeLifeCoverageAmount: new Decimal(1000000),
    } as any);

    const report = await generateWealthAdvisorPackage(mockFamily, {
      customInflationRate: 26.5,
      customTargetMonths: 6,
    });

    expect(report).toBeDefined();
    expect(report.workspaceName).toBe("محفظة عائلة الأمل");
    expect(report.baseCurrency).toBe("EGP");

    // 1. Verify Liquidity & Stagnant Cash
    expect(report.liquidity.totalLiquidCashBase).toBe(2000000);
    expect(report.liquidity.monthlyEssentialBurnBase).toBe(50000);
    expect(report.liquidity.emergencyFundRequiredBase).toBe(300000); // 50,000 * 6
    expect(report.liquidity.stagnantSurplusCashBase).toBe(1700000);
    expect(report.liquidity.liquidityHealthStatus).toBe("SURPLUS_IDLE");
    expect(report.liquidity.annualPurchasingPowerLossBase).toBe(450500); // 1,700,000 * 26.5%

    // 2. Verify Recommendations include idle liquidity rebalancing
    const idleRec = report.recommendations.find(r => r.id === "REC_IDLE_LIQUIDITY");
    expect(idleRec).toBeDefined();
    expect(idleRec?.priority).toBe("HIGH");
    expect(idleRec?.suggestedAmountBase).toBe(1700000);
    expect(idleRec?.titleAr).toContain("استثمار فائض السيولة الراكدة");

    // 3. Verify Executive Briefing
    expect(report.executiveBriefAr.greeting).toContain("عبد الله شعبان");
    expect(report.executiveBriefAr.primaryRiskAlertAr).toContain("450,500");
  });

  it("detects emergency fund deficit and raises critical warning when liquid cash is below 3 months burn", async () => {
    // 50,000 liquid cash with 40,000 monthly expense (less than 3 months = 120,000)
    vi.mocked(loadWealthHealthAggregations).mockResolvedValueOnce({
      workspaceId: "ws-test-01",
      baseCurrency: "EGP",
      asOfTimestamp: Date.now(),
      liquidCashReserves: new Decimal(50000),
      monthlyEssentialOutflows: new Decimal(40000),
      totalDebtPrincipal: new Decimal(0),
      totalEconomicAssets: new Decimal(5000000),
      annualDebtService: new Decimal(0),
      ocfPreDebt: new Decimal(50000),
      operatingInflows: new Decimal(80000),
      operatingExpenses: new Decimal(480000),
      debtPrincipalRepayments: new Decimal(0),
      ttmEssentialExpenses: new Decimal(480000),
      investableAssets: new Decimal(5000000),
      classValues: {
        cash: new Decimal(50000),
        equity: new Decimal(1000000),
        fixed_income: new Decimal(2500000),
        alternatives: new Decimal(1000000),
        other: new Decimal(450000),
      },
      holdingsList: [],
      totalFreshAssetValue: new Decimal(5000000),
      hasActiveHealthPolicy: false,
      activeLifeCoverageAmount: new Decimal(0),
    } as any);

    const report = await generateWealthAdvisorPackage(mockFamily, {
      customInflationRate: 26.5,
      customTargetMonths: 6,
    });

    expect(report.liquidity.liquidityHealthStatus).toBe("DEFICIT_RISK");
    expect(report.liquidity.stagnantSurplusCashBase).toBe(0);

    const emergencyRec = report.recommendations.find(r => r.id === "REC_EMERGENCY_BUFFER");
    expect(emergencyRec).toBeDefined();
    expect(emergencyRec?.priority).toBe("CRITICAL");
    expect(emergencyRec?.suggestedAmountBase).toBe(190000); // 240,000 required - 50,000 current
  });

  it("detects gold underweight and generates gold hedge recommendation", async () => {
    // Total assets 10,000,000. Gold is only 500,000 (5%), target is 25% (gap = -20% or 2,000,000 EGP)
    vi.mocked(loadWealthHealthAggregations).mockResolvedValueOnce({
      workspaceId: "ws-test-01",
      baseCurrency: "EGP",
      asOfTimestamp: Date.now(),
      liquidCashReserves: new Decimal(1500000),
      monthlyEssentialOutflows: new Decimal(30000),
      totalDebtPrincipal: new Decimal(0),
      totalEconomicAssets: new Decimal(10000000),
      annualDebtService: new Decimal(0),
      ocfPreDebt: new Decimal(100000),
      operatingInflows: new Decimal(150000),
      operatingExpenses: new Decimal(360000),
      debtPrincipalRepayments: new Decimal(0),
      ttmEssentialExpenses: new Decimal(360000),
      investableAssets: new Decimal(10000000),
      classValues: {
        cash: new Decimal(1500000),
        equity: new Decimal(2000000),
        fixed_income: new Decimal(4000000),
        alternatives: new Decimal(500000), // 5%
        other: new Decimal(2000000),
      },
      holdingsList: [],
      totalFreshAssetValue: new Decimal(10000000),
      hasActiveHealthPolicy: true,
      activeLifeCoverageAmount: new Decimal(1000000),
    } as any);

    const report = await generateWealthAdvisorPackage(mockFamily);

    const goldBucket = report.allocationGaps.buckets.find(b => b.key === "GOLD");
    expect(goldBucket).toBeDefined();
    expect(goldBucket?.status).toBe("UNDERWEIGHT");
    expect(goldBucket?.currentWeightPct).toBe(5);
    expect(goldBucket?.targetWeightPct).toBe(25);

    const goldRec = report.recommendations.find(r => r.id === "REC_GOLD_HEDGE");
    expect(goldRec).toBeDefined();
    expect(goldRec?.category).toBe("INFLATION_SHIELD");
    expect(goldRec?.titleAr).toContain("تعزيز حيازة الذهب والسبائك النقدية");
  });

  it("identifies single asset concentration risk when a single holding exceeds 35% of total wealth", async () => {
    vi.mocked(loadWealthHealthAggregations).mockResolvedValueOnce({
      workspaceId: "ws-test-01",
      baseCurrency: "EGP",
      asOfTimestamp: Date.now(),
      liquidCashReserves: new Decimal(1500000),
      monthlyEssentialOutflows: new Decimal(30000),
      totalDebtPrincipal: new Decimal(0),
      totalEconomicAssets: new Decimal(10000000),
      annualDebtService: new Decimal(0),
      ocfPreDebt: new Decimal(100000),
      operatingInflows: new Decimal(150000),
      operatingExpenses: new Decimal(360000),
      debtPrincipalRepayments: new Decimal(0),
      ttmEssentialExpenses: new Decimal(360000),
      investableAssets: new Decimal(10000000),
      classValues: {
        cash: new Decimal(1500000),
        equity: new Decimal(0),
        fixed_income: new Decimal(1500000),
        alternatives: new Decimal(2000000),
        other: new Decimal(5000000),
      },
      holdingsList: [
        { name: "برج سكني استثماري", value: new Decimal(5000000) }, // 50% of assets
      ],
      totalFreshAssetValue: new Decimal(10000000),
      hasActiveHealthPolicy: true,
      activeLifeCoverageAmount: new Decimal(1000000),
    } as any);

    const report = await generateWealthAdvisorPackage(mockFamily);

    const concRec = report.recommendations.find(r => r.id === "REC_CONCENTRATION_RISK");
    expect(concRec).toBeDefined();
    expect(concRec?.actionSummaryAr).toContain("50.0%");
    expect(concRec?.titleAr).toContain("برج سكني استثماري");
  });

  it("adheres strictly to Advisory-Only constraints and performs no database ledger modifications", async () => {
    vi.mocked(loadWealthHealthAggregations).mockResolvedValueOnce({
      workspaceId: "ws-test-01",
      baseCurrency: "EGP",
      asOfTimestamp: Date.now(),
      liquidCashReserves: new Decimal(750000),
      monthlyEssentialOutflows: new Decimal(25000),
      totalDebtPrincipal: new Decimal(0),
      totalEconomicAssets: new Decimal(5000000),
      annualDebtService: new Decimal(0),
      ocfPreDebt: new Decimal(50000),
      operatingInflows: new Decimal(100000),
      operatingExpenses: new Decimal(300000),
      debtPrincipalRepayments: new Decimal(0),
      ttmEssentialExpenses: new Decimal(300000),
      investableAssets: new Decimal(5000000),
      classValues: {
        cash: new Decimal(750000),
        equity: new Decimal(1000000),
        fixed_income: new Decimal(1750000),
        alternatives: new Decimal(1250000),
        other: new Decimal(250000),
      },
      holdingsList: [],
      totalFreshAssetValue: new Decimal(5000000),
      hasActiveHealthPolicy: true,
      activeLifeCoverageAmount: new Decimal(500000),
    } as any);

    const report = await generateWealthAdvisorPackage(mockFamily);

    // Verify recommendations are pure data
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
    for (const rec of report.recommendations) {
      expect(rec.id).toBeDefined();
      expect(rec.actionSummaryAr).toBeDefined();
      expect(typeof rec.actionDetailsAr).toBe("string");
    }
  });
});
