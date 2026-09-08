import { describe, expect, it } from "vitest";
import { deriveHistoricalExpenseForecast, projectScenario } from "./scenarioMath";

const base = { monthlyIncome: 12_000, monthlyExpense: 8_000, liquidReserve: 24_000, debtBalance: 10_000, annualReturnPercent: 6, annualInflationPercent: 4, months: 6 };

describe("projectScenario", () => {
  it("keeps an emergency projection isolated and derives the reserve gap", () => {
    const result = projectScenario({ type: "emergency", ...base, emergencyTargetMonths: 6, historicalMonthlyExpenses: [7000, 8000, 9000, 8000, 8100, 7900] });
    expect(result.model).toBe("emergency");
    expect(result.netMonthly).toBe(4000);
    expect(result.targetReserve).toBe(48_000);
    expect(result.reserveGap).toBe(24_000);
    expect(result.assumptions.some(item => item.includes("لا يُكتب أي قيد"))).toBe(true);
  });

  it("models debt payoff only when the payment exceeds interest", () => {
    const result = projectScenario({ type: "debt", ...base, debtBalance: 10_000, annualDebtRatePercent: 12, extraDebtPayment: 1000 });
    expect(result.model).toBe("debt");
    expect(result.monthsToPayoff).not.toBeNull();
    expect(result.remainingBalanceAfterHorizon).toBe(0);
  });

  it("computes retirement gap and a bounded historical forecast confidence", () => {
    const retirement = projectScenario({ type: "retirement", ...base, currentAge: 40, retirementAge: 50, retirementAssets: 100_000, monthlyRetirementContribution: 2000, retirementAnnualSpending: 96_000, historicalMonthlyExpenses: Array(12).fill(8000) });
    const forecast = deriveHistoricalExpenseForecast(Array(12).fill(8000));
    expect(retirement.model).toBe("retirement");
    expect(retirement.yearsToRetirement).toBe(10);
    expect(retirement.confidence).toBe("high");
    expect(forecast.lowerBound).toBe(8000);
    expect(forecast.upperBound).toBe(8000);
  });
});
