import { describe, expect, it } from "vitest";
import { buildOfficialSnapshotCandidate, officialStatusForQuality, qualityForAsOf, worseQuality } from "./officialValuation";

describe("official valuation snapshots", () => {
  it("classifies report quality and status without mutating ledger facts", () => {
    const now = Date.now();
    const candidate = buildOfficialSnapshotCandidate({
      workspaceId: 7,
      actorUserId: 11,
      baseCurrency: "egp",
      capturedAt: now,
      valuationAsOf: now - 60_000,
      qualities: ["current", "manual"],
      netWorthBase: "125000.00",
      liquidBalanceBase: "50000.00",
      investmentValueBase: "75000.00",
      liabilityBalanceBase: "0.00",
      unrealizedPnlBase: "2500.00",
      componentSnapshotIds: [3, 4],
      sourceSummary: { providers: { "yahoo-finance2": 1 } },
      warnings: [],
    });
    expect(candidate.status).toBe("official");
    expect(candidate.quality).toBe("manual");
    expect(candidate.baseCurrency).toBe("EGP");
    expect(candidate.componentSnapshotIds).toEqual([3, 4]);
    expect(candidate).not.toHaveProperty("journalEntryId");
    expect(candidate).not.toHaveProperty("financialEventId");
  });

  it("requires review for delayed and stale inputs", () => {
    expect(officialStatusForQuality("delayed", true)).toBe("review_required");
    expect(officialStatusForQuality("stale", true)).toBe("review_required");
    expect(officialStatusForQuality("unavailable", true)).toBe("unavailable");
    expect(worseQuality(["current", "stale", "manual"])).toBe("stale");
  });

  it("marks old, last-known, future and missing sources unsafe for official reports", () => {
    const now = Date.now();
    expect(qualityForAsOf("delayed", now - 49 * 60 * 60 * 1000, now)).toBe("stale");
    expect(qualityForAsOf("last_known", now - 60_000, now)).toBe("stale");
    expect(qualityForAsOf("delayed", now + 60_000, now)).toBe("unavailable");
    expect(qualityForAsOf(null, null, now)).toBe("unavailable");
  });

  it("does not mark an empty report as official", () => {
    const now = Date.now();
    const candidate = buildOfficialSnapshotCandidate({
      workspaceId: 7,
      actorUserId: 11,
      baseCurrency: "EGP",
      capturedAt: now,
      valuationAsOf: now,
      qualities: [],
      netWorthBase: "0.00",
      liquidBalanceBase: "0.00",
      investmentValueBase: "0.00",
      liabilityBalanceBase: "0.00",
      unrealizedPnlBase: "0.00",
      componentSnapshotIds: [],
      sourceSummary: {},
      warnings: [],
      hasValuedData: false,
    });
    expect(candidate.status).toBe("unavailable");
  });
});
