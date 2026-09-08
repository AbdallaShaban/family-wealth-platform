import { describe, expect, it } from "vitest";
import { nextRecurringRunAt, recurringRunKey } from "./familyRecurring";

describe("FAMILY recurring schedule math", () => {
  it("creates a deterministic idempotency key for one scheduled occurrence", () => {
    expect(recurringRunKey(42, 1_700_000_000_000)).toBe("RECURRING_RULE:42:1700000000000");
  });

  it("clamps monthly dates at the end of shorter UTC months", () => {
    const january31 = Date.UTC(2026, 0, 31, 9, 30);
    expect(new Date(nextRecurringRunAt(january31, "monthly")).toISOString()).toBe("2026-02-28T09:30:00.000Z");
  });

  it("keeps the original UTC time while advancing weekly, quarterly, and yearly rules", () => {
    const start = Date.UTC(2024, 1, 29, 4, 15);
    expect(new Date(nextRecurringRunAt(start, "weekly")).toISOString()).toBe("2024-03-07T04:15:00.000Z");
    expect(new Date(nextRecurringRunAt(start, "quarterly")).toISOString()).toBe("2024-05-29T04:15:00.000Z");
    expect(new Date(nextRecurringRunAt(start, "yearly")).toISOString()).toBe("2025-02-28T04:15:00.000Z");
  });
});
