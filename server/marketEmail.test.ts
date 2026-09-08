import { describe, expect, it } from "vitest";
import { createMarketSignalFingerprint, shouldSendMarketReview } from "./marketEmail";

describe("market email delivery policy", () => {
  it("is stable regardless of the order in which the same review signals are read", () => {
    const first = createMarketSignalFingerprint([{ id: "dip-17", kind: "accumulate_review" }, { id: "stale-4", kind: "stale_quote" }]);
    const second = createMarketSignalFingerprint([{ id: "stale-4", kind: "stale_quote" }, { id: "dip-17", kind: "accumulate_review" }]);
    expect(first).toBe(second);
  });

  it("requires explicit opt-in, a configured SMTP transport and a nonempty review set", () => {
    expect(shouldSendMarketReview({ enabled: false, configured: true, signalCount: 1, now: 1 })).toMatchObject({ send: false, reason: "disabled" });
    expect(shouldSendMarketReview({ enabled: true, configured: false, signalCount: 1, now: 1 })).toMatchObject({ send: false, reason: "not_configured" });
    expect(shouldSendMarketReview({ enabled: true, configured: true, signalCount: 0, now: 1 })).toMatchObject({ send: false, reason: "no_signals" });
  });

  it("prevents duplicate sends during Heartbeat retry and delays retry after a delivery failure", () => {
    expect(shouldSendMarketReview({ enabled: true, configured: true, signalCount: 1, existingStatus: "sent", lastAttemptAt: 1, now: 2 })).toMatchObject({ send: false, reason: "already_claimed" });
    expect(shouldSendMarketReview({ enabled: true, configured: true, signalCount: 1, existingStatus: "pending", lastAttemptAt: 1, now: 2 })).toMatchObject({ send: false, reason: "already_claimed" });
    expect(shouldSendMarketReview({ enabled: true, configured: true, signalCount: 1, existingStatus: "failed", lastAttemptAt: 1, now: 2 })).toMatchObject({ send: false, reason: "cooldown" });
    expect(shouldSendMarketReview({ enabled: true, configured: true, signalCount: 1, existingStatus: "failed", lastAttemptAt: 1, now: 3_600_001 })).toMatchObject({ send: true, reason: "ready" });
  });
});
