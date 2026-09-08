import { describe, expect, it } from "vitest";
import {
  FAMILY_CAPABILITIES,
  FINANCIAL_DATA_CLASSES,
  NON_LEDGER_PRODUCERS,
  canProducerWriteLedger,
  isLedgerTruth,
  isNonLedger,
  roleHasCapability,
} from "../shared/domainContracts";

describe("Phase 1 domain contracts", () => {
  it("defines the ledger and projection boundaries", () => {
    expect(FINANCIAL_DATA_CLASSES).toEqual([
      "ledger_fact",
      "derived_projection",
      "external_market_data",
      "valuation_snapshot",
      "operational_metadata",
    ]);
    expect(isLedgerTruth("ledger_fact")).toBe(true);
    expect(isLedgerTruth("external_market_data")).toBe(false);
    expect(isNonLedger("derived_projection")).toBe(true);
    expect(isNonLedger("ledger_fact")).toBe(false);
  });

  it("prevents all non-ledger producers from writing financial entries", () => {
    for (const producer of NON_LEDGER_PRODUCERS) {
      expect(canProducerWriteLedger(producer)).toBe(false);
    }
  });

  it("keeps role capabilities explicit and least-privilege by default", () => {
    expect(FAMILY_CAPABILITIES).toContain("post_ledger");
    expect(roleHasCapability("owner", "post_ledger")).toBe(true);
    expect(roleHasCapability("advisor", "post_ledger")).toBe(false);
    expect(roleHasCapability("editor", "approve_financial_action")).toBe(false);
    expect(roleHasCapability("viewer", "view_sensitive_values")).toBe(false);
    expect(roleHasCapability("viewer", "view_workspace")).toBe(true);
  });

  it("does not grant market, AI, scenarios, or notifications a financial capability", () => {
    const restrictedProducers = ["market_refresh", "market_signal", "scenario_projection", "ai_advisor", "notification_delivery"] as const;
    restrictedProducers.forEach(producer => expect(canProducerWriteLedger(producer)).toBe(false));
  });
});
