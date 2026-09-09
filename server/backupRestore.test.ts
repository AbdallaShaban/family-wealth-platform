import { describe, expect, it } from "vitest";
import {
  computePayloadSha256,
  validateWorkspaceBackup,
  WORKSPACE_TABLE_DEFINITIONS,
  WORKSPACE_TABLE_NAMES,
  type FullWorkspaceBackupEnvelope,
} from "./backupRestoreService";

describe("Disaster Recovery — Full Workspace Backup & Validation", () => {
  it("covers exactly 51 workspace-owned tables in dependency order", () => {
    expect(WORKSPACE_TABLE_DEFINITIONS.length).toBe(51);
    expect(WORKSPACE_TABLE_NAMES.length).toBe(51);

    // Verify key tables are present
    expect(WORKSPACE_TABLE_NAMES).toContain("accounts");
    expect(WORKSPACE_TABLE_NAMES).toContain("journal_entries");
    expect(WORKSPACE_TABLE_NAMES).toContain("journal_lines");
    expect(WORKSPACE_TABLE_NAMES).toContain("investment_lots");
    expect(WORKSPACE_TABLE_NAMES).toContain("corporate_actions");
    expect(WORKSPACE_TABLE_NAMES).toContain("vault_documents");
    expect(WORKSPACE_TABLE_NAMES).toContain("financial_periods");

    // Verify platform-level tables are NOT in workspace backup
    expect(WORKSPACE_TABLE_NAMES).not.toContain("users");
    expect(WORKSPACE_TABLE_NAMES).not.toContain("platform_ownership");
    expect(WORKSPACE_TABLE_NAMES).not.toContain("platform_audit_events");
    expect(WORKSPACE_TABLE_NAMES).not.toContain("platform_admin_invitations");
    expect(WORKSPACE_TABLE_NAMES).not.toContain("workspaces");
  });

  it("computes deterministic SHA-256 manifest hash", () => {
    const payloadA = {
      accounts: [{ id: 1, name: "بنك مصر" }],
      instruments: [{ id: 10, symbol: "CIB" }],
    };
    const payloadB = {
      instruments: [{ id: 10, symbol: "CIB" }],
      accounts: [{ id: 1, name: "بنك مصر" }],
    };

    const hashA = computePayloadSha256(payloadA);
    const hashB = computePayloadSha256(payloadB);

    expect(hashA).toBeDefined();
    expect(hashA.length).toBe(64);
    expect(hashA).toBe(hashB); // Deterministic key ordering
  });

  it("rejects corrupted or invalid backup envelope", () => {
    const invalidFormat = {
      format: "wrong-format",
      payload: {},
    };
    const result1 = validateWorkspaceBackup(invalidFormat);
    expect(result1.valid).toBe(false);
    expect(result1.errors.some(e => e.includes("تنسيق"))).toBe(true);

    // Empty object
    const result2 = validateWorkspaceBackup({});
    expect(result2.valid).toBe(false);
  });

  it("detects SHA-256 checksum tampering", () => {
    const emptyPayload: Record<string, any[]> = {};
    WORKSPACE_TABLE_NAMES.forEach(name => {
      emptyPayload[name] = [];
    });

    const legitimateHash = computePayloadSha256(emptyPayload);

    const validEnvelope: FullWorkspaceBackupEnvelope = {
      format: "family-full-backup-v1",
      version: "1.0",
      workspaceId: 1,
      workspaceMetadata: {
        name: "مساحة العائلة",
        baseCurrency: "EGP",
        exportedAt: 1700000000000,
        tableCount: 51,
      },
      manifest: {
        tables: {},
        totalRows: 0,
        payloadSha256: legitimateHash,
      },
      payload: emptyPayload,
    };

    // Valid envelope passes
    const validResult = validateWorkspaceBackup(validEnvelope);
    expect(validResult.valid).toBe(true);

    // Tampered envelope (modified payload without updating sha256)
    const tamperedEnvelope: FullWorkspaceBackupEnvelope = {
      ...validEnvelope,
      payload: {
        ...emptyPayload,
        accounts: [{ id: 99, name: "حساب مشبوه" }],
      },
    };

    const tamperedResult = validateWorkspaceBackup(tamperedEnvelope);
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.errors.some(e => e.includes("SHA-256"))).toBe(true);
  });
});
