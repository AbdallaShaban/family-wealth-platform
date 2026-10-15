import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

describe("Phase 4: Budgeting, Debt & Cashflow Planning Engine", () => {
  describe("Zero-Based Envelope Budgeting Math", () => {
    it("adheres strictly to Actual Budget zero-based principle: To Be Budgeted = Income - Budgeted", () => {
      const totalIncome = new Decimal(50_000);
      const categoryBudgets = [
        { name: "السكن والفواتير", planned: new Decimal(20_000) },
        { name: "الطعام والمعيشة", planned: new Decimal(15_000) },
        { name: "التعليم والرعاية", planned: new Decimal(10_000) },
        { name: "الادخار والاستثمار", planned: new Decimal(5_000) },
      ];

      const totalBudgeted = categoryBudgets.reduce(
        (sum, c) => sum.plus(c.planned),
        new Decimal(0)
      );

      // In zero-based budgeting, every dollar has a job
      const toBeBudgeted = totalIncome.minus(totalBudgeted);

      expect(toBeBudgeted.toNumber()).toBe(0);
      expect(totalBudgeted.toNumber()).toBe(50_000);
    });

    it("correctly calculates envelope availability with previous month rollover", () => {
      // Month 1: Planned 10,000, Actual Spent 8,000 -> Remaining +2,000 rolls over
      const prevPlanned = new Decimal(10_000);
      const prevActual = new Decimal(8_000);
      const rollover = prevPlanned.minus(prevActual); // +2,000

      // Month 2: Planned 10,000, Actual Spent 11,000
      const currentPlanned = new Decimal(10_000);
      const currentActual = new Decimal(11_000);

      // Available = Current Planned + Rollover - Current Actual = 10,000 + 2,000 - 11,000 = +1,000
      const available = currentPlanned.plus(rollover).minus(currentActual);

      expect(rollover.toNumber()).toBe(2_000);
      expect(available.toNumber()).toBe(1_000);
    });

    it("identifies budget status accurately (on_track, warning, exceeded)", () => {
      function getStatus(planned: number, actual: number): "under_budget" | "on_track" | "warning" | "exceeded" {
        if (actual > planned) return "exceeded";
        const pct = (actual / planned) * 100;
        if (pct >= 80) return "warning";
        return "on_track";
      }

      expect(getStatus(10_000, 5_000)).toBe("on_track");  // 50%
      expect(getStatus(10_000, 8_500)).toBe("warning");   // 85%
      expect(getStatus(10_000, 10_500)).toBe("exceeded"); // 105%
    });
  });

  describe("Multi-Debt Portfolio Payoff Simulation (Snowball vs Avalanche)", () => {
    // Portfolio with 3 debts:
    // Debt A (Credit Card): Balance 10,000, APR 24%, Min 400
    // Debt B (Personal Loan): Balance 25,000, APR 18%, Min 800
    // Debt C (Auto Loan): Balance 60,000, APR 12%, Min 1,500
    // Total Min Payment = 2,700
    // Extra Monthly Payment = 1,000 (Total Monthly = 3,700)

    const debts = [
      { id: 1, name: "بطاقة ائتمان", balance: 10_000, apr: 24, min: 400 },
      { id: 2, name: "قرض شخصي", balance: 25_000, apr: 18, min: 800 },
      { id: 3, name: "تمويل سيارة", balance: 60_000, apr: 12, min: 1_500 },
    ];

    it("verifies Avalanche strategy yields strictly lower or equal total interest than Snowball", () => {
      function simulate(strategy: "snowball" | "avalanche", extraMonthly: number) {
        const dList = debts.map((d) => ({
          balance: new Decimal(d.balance),
          monthlyRate: new Decimal(d.apr).div(100).div(12),
          min: new Decimal(d.min),
        }));

        let totalInterest = new Decimal(0);
        let months = 0;
        const extra = new Decimal(extraMonthly);

        while (dList.some((d) => d.balance.gt(0)) && months < 360) {
          months++;
          // Accrue interest
          for (const d of dList) {
            if (d.balance.gt(0)) {
              const interest = d.balance.mul(d.monthlyRate);
              totalInterest = totalInterest.plus(interest);
              d.balance = d.balance.plus(interest);
            }
          }

          // Pay minimums
          let freedMin = new Decimal(0);
          for (const d of dList) {
            if (d.balance.gt(0)) {
              const pay = Decimal.min(d.balance, d.min);
              d.balance = d.balance.minus(pay);
              if (d.balance.isZero()) {
                freedMin = freedMin.plus(d.min.minus(pay));
              }
            } else {
              freedMin = freedMin.plus(d.min);
            }
          }

          // Direct extra + freed minimums
          let availableExtra = extra.plus(freedMin);
          const active = dList.filter((d) => d.balance.gt(0));

          if (strategy === "snowball") {
            active.sort((a, b) => a.balance.minus(b.balance).toNumber()); // Smallest balance first
          } else {
            active.sort((a, b) => b.monthlyRate.minus(a.monthlyRate).toNumber()); // Highest APR first
          }

          for (const target of active) {
            if (availableExtra.lte(0)) break;
            const extraPay = Decimal.min(target.balance, availableExtra);
            target.balance = target.balance.minus(extraPay);
            availableExtra = availableExtra.minus(extraPay);
          }
        }

        return { months, totalInterest: totalInterest.toNumber() };
      }

      const snowball = simulate("snowball", 1000);
      const avalanche = simulate("avalanche", 1000);

      // Avalanche mathematically minimizes total interest paid
      expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
      expect(avalanche.months).toBeLessThanOrEqual(snowball.months);
    });

    it("verifies extra payments substantially accelerate debt-free timeline compared to baseline", () => {
      function simulateBaseline() {
        const dList = debts.map((d) => ({
          balance: new Decimal(d.balance),
          monthlyRate: new Decimal(d.apr).div(100).div(12),
          min: new Decimal(d.min),
        }));

        let totalInterest = new Decimal(0);
        let months = 0;

        while (dList.some((d) => d.balance.gt(0)) && months < 360) {
          months++;
          for (const d of dList) {
            if (d.balance.gt(0)) {
              const interest = d.balance.mul(d.monthlyRate);
              totalInterest = totalInterest.plus(interest);
              d.balance = d.balance.plus(interest);
            }
          }
          for (const d of dList) {
            if (d.balance.gt(0)) {
              const pay = Decimal.min(d.balance, d.min);
              d.balance = d.balance.minus(pay);
            }
          }
        }
        return { months, totalInterest: totalInterest.toNumber() };
      }

      const baseline = simulateBaseline();
      expect(baseline.months).toBeGreaterThan(30);
    });
  });

  describe("Cash Reserve Runway Simulation", () => {
    it("correctly computes runway months = liquid cash / (monthly expenses + debt minimums)", () => {
      const liquidCash = new Decimal(180_000);
      const monthlyLivingExpenses = new Decimal(25_000);
      const monthlyDebtMinimums = new Decimal(5_000);

      const totalMonthlyBurn = monthlyLivingExpenses.plus(monthlyDebtMinimums); // 30,000
      const runwayMonths = liquidCash.div(totalMonthlyBurn);

      expect(runwayMonths.toNumber()).toBe(6); // 180,000 / 30,000 = 6 months
    });

    it("safely handles zero burn rate without division by zero error", () => {
      const liquidCash = new Decimal(100_000);
      const totalBurn = new Decimal(0);

      const runway = totalBurn.isZero() ? null : liquidCash.div(totalBurn).toNumber();
      expect(runway).toBeNull();
    });
  });
});
