import { describe, expect, it } from "vitest";
import { compareExtraDebtPayment, projectDebtSchedule } from "./debtMath";

describe("FAMILY debt calculations", () => {
  it("separates monthly interest from principal and settles the exact final payment", () => {
    const schedule = projectDebtSchedule({ outstanding: "1000", annualInterestRatePercent: "12", monthlyPayment: "340", months: 12 });
    expect(schedule.rows[0]).toMatchObject({ interest: "10.000000", principal: "330.000000", closingBalance: "670.000000" });
    expect(schedule.endingBalance).toBe("0.000000");
    expect(Number(schedule.rows.at(-1)?.payment)).toBeLessThan(340);
  });

  it("surfaces a payment that does not cover interest instead of hiding a growing balance", () => {
    const schedule = projectDebtSchedule({ outstanding: "1000", annualInterestRatePercent: "24", monthlyPayment: "20", months: 2 });
    expect(schedule.negativeAmortization).toBe(true);
    expect(schedule.endingBalance).toBe("1000.000000");
  });

  it("calculates the debt-cost effect of an extra payment without implying an investment return", () => {
    const comparison = compareExtraDebtPayment({ outstanding: "1200", annualInterestRatePercent: "12", monthlyPayment: "120", extraPrincipal: "80" });
    expect(comparison.monthsSaved).toBeGreaterThan(0);
    expect(Number(comparison.interestSaved)).toBeGreaterThan(0);
  });
});
