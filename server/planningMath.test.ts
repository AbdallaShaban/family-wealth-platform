import { describe, expect, it } from "vitest";
import { projectFinancialGoal, projectRetirementPlan } from "./planningMath";

describe("FAMILY deterministic planning", () => {
  it("projects a dated goal using its disclosed return, inflation, and monthly contribution", () => {
    const output = projectFinancialGoal({ currentAmount: "1000", targetAmount: "2000", monthlyContribution: "100", annualReturnPercent: "12", annualInflationPercent: "0", now: Date.UTC(2026, 0, 1), targetDate: Date.UTC(2027, 0, 1) });
    expect(output).toMatchObject({ monthsToTarget: 12, inflationAdjustedTargetAmount: "2000.000000" });
    expect(Number(output.projectedAmount)).toBeGreaterThan(2200);
    expect(Number(output.requiredMonthlyContribution)).toBeGreaterThan(0);
  });

  it("does not pretend to calculate required contribution where no target date exists", () => {
    const output = projectFinancialGoal({ currentAmount: "500", targetAmount: "1000", monthlyContribution: "0", annualReturnPercent: "0", annualInflationPercent: "0", now: Date.UTC(2026, 0, 1) });
    expect(output.monthsToTarget).toBeNull();
    expect(output.requiredMonthlyContribution).toBeNull();
  });

  it("calculates a transparent retirement and FI gap without a probability claim", () => {
    const output = projectRetirementPlan({ currentAge: 30, retirementAge: 40, currentAssets: "100000", monthlyContribution: "1000", annualSpending: "60000", safeWithdrawalRatePercent: "4", annualReturnPercent: "6", annualInflationPercent: "2" });
    expect(output.yearsToRetirement).toBe(10);
    expect(Number(output.financialIndependenceTarget)).toBeGreaterThan(1_500_000);
    expect(Number(output.gapToFinancialIndependence)).toBeGreaterThanOrEqual(0);
  });
});
