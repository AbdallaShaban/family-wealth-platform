import { describe, expect, it } from "vitest";
import { createBackupEnvelope } from "./backupSnapshot";

describe("backup envelope", () => {
  it("creates a versioned, workspace-scoped backup envelope", () => {
    expect(createBackupEnvelope(8, { accounts: [] }, 1_800_000_000_000)).toEqual({ format: "family-backup-v1", workspaceId: 8, createdAt: 1_800_000_000_000, payload: { accounts: [] } });
  });
});
