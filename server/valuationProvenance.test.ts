import { describe, expect, it } from "vitest";
import {
  buildInstrumentSnapshot,
  buildMarketProvenance,
  isOfficialReportSafe,
  isReadOnlyValuationBoundary,
  lineageIsComplete,
  metadataHasCredentials,
  noAutomaticLedgerMutation,
  qualityFromStatus,
  snapshotsAreAppendOnly,
} from "./valuationProvenance";

describe("valuation provenance contracts", () => {
  const capturedAt = Date.now();
  const asOf = capturedAt - 60 * 60 * 1000;

  it("keeps source lineage and timestamps explicit", () => {
    const provenance = buildMarketProvenance({
      workspaceId: 7,
      provider: "yahoo-finance2",
      source: "Yahoo Finance via yahoo-finance2",
      rawSymbol: " aapl ",
      asOf,
      fetchedAt: capturedAt,
      status: "delayed",
    });
    expect(provenance.normalizedSymbol).toBe("AAPL");
    expect(provenance.status).toBe("delayed");
    expect(provenance.asOf).toBe(asOf);
    expect(provenance.fetchedAt).toBe(capturedAt);
    expect(metadataHasCredentials(provenance.metadata)).toBe(false);
  });

  it("marks aged delayed data stale and protects official reports", () => {
    const old = capturedAt - 49 * 60 * 60 * 1000;
    expect(qualityFromStatus("delayed", old, capturedAt)).toBe("stale");
    expect(isOfficialReportSafe("stale")).toBe(false);
    expect(isOfficialReportSafe("manual")).toBe(true);
  });

  it("creates a traceable instrument snapshot without ledger capability", () => {
    const snapshot = buildInstrumentSnapshot({
      workspaceId: 7,
      instrumentId: 11,
      provenanceId: 21,
      quoteId: 31,
      price: "123.45000000",
      currency: "USD",
      baseCurrency: "EGP",
      status: "delayed",
      asOf,
      capturedAt,
    });
    expect(snapshot.baseValue).toBeNull();
    expect(snapshot.quality).toBe("delayed");
    expect(snapshot.provenanceId).toBe(21);
    expect(lineageIsComplete(snapshot)).toBe(true);
    expect(isReadOnlyValuationBoundary().writesLedger).toBe(false);
  });

  it("enforces append-only and no automatic ledger mutation contracts", () => {
    expect(snapshotsAreAppendOnly()).toBe(true);
    expect(noAutomaticLedgerMutation()).toBe(true);
  });

  it("rejects a source timestamp after capture", () => {
    expect(() => buildMarketProvenance({
      workspaceId: 7,
      provider: "yahoo-finance2",
      source: "Yahoo",
      rawSymbol: "AAPL",
      asOf: capturedAt + 1,
      fetchedAt: capturedAt,
      status: "delayed",
    })).toThrow();
  });
});
