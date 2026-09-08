import { describe, expect, it } from "vitest";
import { canDecideApproval, isApprovalExecutable, normalizedApprovalAmount, requiresApproval } from "./approvalWorkflowMath";

describe("approval workflow safeguards", () => {
  it("applies a threshold without floating point loss", () => {
    expect(requiresApproval("100.000000", "100.000000", true)).toBe(true);
    expect(requiresApproval("99.999999", "100.000000", true)).toBe(false);
    expect(requiresApproval("100.000000", "100.000000", false)).toBe(false);
  });

  it("enforces separation of duties and recent reconfirmation when required", () => {
    const nowMs = 1_000_000;
    expect(canDecideApproval({ requesterId: 1, approverId: 1, roleMatches: true, lastSignedInMs: nowMs, nowMs })).toBe(false);
    expect(canDecideApproval({ requesterId: 1, approverId: 2, roleMatches: true, lastSignedInMs: nowMs - 15 * 60 * 1000 - 1, nowMs })).toBe(false);
    expect(canDecideApproval({ requesterId: 1, approverId: 2, roleMatches: true, lastSignedInMs: nowMs - 15 * 60 * 1000 - 1, nowMs, requireReconfirmation: false })).toBe(true);
  });

  it("refuses execution of expired or non-approved requests", () => {
    expect(isApprovalExecutable({ status: "approved", expiresAt: 1001, nowMs: 1000 })).toBe(true);
    expect(isApprovalExecutable({ status: "approved", expiresAt: 1000, nowMs: 1000 })).toBe(false);
    expect(isApprovalExecutable({ status: "pending", expiresAt: null, nowMs: 1000 })).toBe(false);
  });

  it("freezes the gross amount of a trade deterministically", () => {
    expect(normalizedApprovalAmount("0", "12.5", "10.4")).toBe("130.000000");
  });
});
