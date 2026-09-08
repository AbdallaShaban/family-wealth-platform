import { describe, expect, it } from "vitest";
import { calculateEmergencyFund, calendarMonthsUntil } from "./emergencyFundMath";

describe("FAMILY emergency fund calculations", () => {
  it("includes essential expenses and minimum debt obligations in required coverage", () => {
    const output = calculateEmergencyFund({ liquidReserveBase: "10000", essentialExpenseMonthlyBase: "2500", debtMinimumPaymentBase: "500", targetMonths: "3", now: Date.UTC(2026, 0, 10) });
    expect(output).toMatchObject({ requiredMonthlyBase: "3000.000000", coverageMonths: "3.33", targetReserveBase: "9000.000000", fundingGapBase: "0.000000" });
    expect(output.recommendation.status).toBe("funded");
  });

  it("uses a calendar-month count to calculate required contribution through the target date", () => {
    const now = Date.UTC(2026, 0, 15, 12);
    const target = Date.UTC(2026, 3, 15, 12);
    expect(calendarMonthsUntil(now, target)).toBe(3);
    const output = calculateEmergencyFund({ liquidReserveBase: "1000", essentialExpenseMonthlyBase: "1000", debtMinimumPaymentBase: "0", targetMonths: "6", targetDate: target, now });
    expect(output).toMatchObject({ fundingGapBase: "5000.000000", monthsToTarget: 3, monthlyContributionNeededBase: "1666.666667" });
    expect(output.recommendation.status).toBe("funding_gap");
  });

  it("does not fabricate a target or monthly contribution before the user saves a plan", () => {
    const output = calculateEmergencyFund({ liquidReserveBase: "500", essentialExpenseMonthlyBase: "0", debtMinimumPaymentBase: "0", now: Date.UTC(2026, 0, 1) });
    expect(output.targetReserveBase).toBeNull();
    expect(output.monthlyContributionNeededBase).toBeNull();
    expect(output.coverageMonths).toBeNull();
    expect(output.recommendation.status).toBe("plan_needed");
  });
});
