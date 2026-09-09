import { describe, expect, it, vi, beforeEach } from "vitest";
import * as storageModule from "./storage";
import * as dbModule from "./db";
import * as finRouter from "./financialStatementsRouter";
import { archivePeriodClosureDossier } from "./periodArchivalService";

function createMockQuery(result: any[] = []) {
  const p = Promise.resolve(result) as any;
  p.where = vi.fn(() => createMockQuery(result));
  p.orderBy = vi.fn(() => createMockQuery(result));
  p.limit = vi.fn(() => createMockQuery(result));
  p.innerJoin = vi.fn(() => createMockQuery(result));
  return p;
}

describe("Period Closure Vault Archival — Atomicity & Compensating Cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret-vault-key-32-chars-long!";
  });

  const mockCtx = {
    workspace: { id: 1, name: "Family Office", baseCurrency: "USD" },
    profile: { id: 10, workspaceId: 1, fullName: "Principal", baseCurrency: "USD" },
    membership: { id: 100, workspaceId: 1, userId: 5, role: "owner" as const, status: "active" as const, createdAt: 0, updatedAt: 0 },
  };

  it("compensating cleanup deletes staged S3 object when DB transaction fails", async () => {
    const stagedKey = "vault/1/periods/staging-2026-06-abc1234567890def.json";
    const storagePutSpy = vi.spyOn(storageModule, "storagePut").mockResolvedValue({
      key: stagedKey,
      url: `https://storage.test/${stagedKey}`,
    });
    const storageDeleteSpy = vi.spyOn(storageModule, "storageDelete").mockResolvedValue(true);

    vi.spyOn(finRouter, "generateFinancialStatementsPackage").mockResolvedValue({
      bookBalanceSheet: {
        asOf: "2026-06-30",
        asOfTimestamp: 1700000000,
        baseCurrency: "USD",
        assets: { totalBookAssets: "1000000" },
        liabilities: { totalBookLiabilities: "200000" },
        equity: { totalBookEquity: "800000" },
        equationCheck: { assetsEqualsLiabilitiesPlusEquity: true, imbalanceBase: "0" },
      },
      incomeStatement: {},
      equityChangesStatement: {},
      cashFlowStatement: {},
      economicNetWorthBridge: {},
      reconciliationAudit: {},
      metadata: { asOf: "2026-06-30" },
    } as any);

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => createMockQuery([])),
      })),
      transaction: vi.fn().mockRejectedValue(new Error("Database connection dropped during period close")),
    };

    vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb as any);

    await expect(
      archivePeriodClosureDossier({
        context: mockCtx as any,
        actorUserId: 5,
        periodKey: "2026-06",
      })
    ).rejects.toThrow("فشل تثبيت إغلاق الفترة في قاعدة البيانات");

    // Verify storagePut was called for staging
    expect(storagePutSpy).toHaveBeenCalledTimes(1);

    // Verify compensating cleanup storageDelete was called with the exact staged key!
    expect(storageDeleteSpy).toHaveBeenCalledTimes(1);
    expect(storageDeleteSpy).toHaveBeenCalledWith(stagedKey);
  });

  it("successful archival does NOT trigger compensating delete and returns documentId", async () => {
    const stagedKey = "vault/1/periods/staging-2026-07-feedface12345678.json";
    const storagePutSpy = vi.spyOn(storageModule, "storagePut").mockResolvedValue({
      key: stagedKey,
      url: `https://storage.test/${stagedKey}`,
    });
    const storageDeleteSpy = vi.spyOn(storageModule, "storageDelete").mockResolvedValue(true);

    vi.spyOn(finRouter, "generateFinancialStatementsPackage").mockResolvedValue({
      bookBalanceSheet: {
        asOf: "2026-07-31",
        asOfTimestamp: 1700000000,
        baseCurrency: "USD",
        assets: { totalBookAssets: "2000000" },
        liabilities: { totalBookLiabilities: "400000" },
        equity: { totalBookEquity: "1600000" },
        equationCheck: { assetsEqualsLiabilitiesPlusEquity: true, imbalanceBase: "0" },
      },
      incomeStatement: {},
      equityChangesStatement: {},
      cashFlowStatement: {},
      economicNetWorthBridge: {},
      reconciliationAudit: {},
      metadata: { asOf: "2026-07-31" },
    } as any);

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => createMockQuery([])),
      })),
      transaction: vi.fn(async (callback: any) => {
        const dummyTx = {
          insert: vi.fn(() => ({
            values: vi.fn(() => {
              const res = Promise.resolve([{ insertId: 42 }]) as any;
              res.onDuplicateKeyUpdate = vi.fn(() => Promise.resolve([{ insertId: 42 }]));
              return res;
            }),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => Promise.resolve()),
            })),
          })),
        };
        return await callback(dummyTx);
      }),
    };

    vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb as any);

    const result = await archivePeriodClosureDossier({
      context: mockCtx as any,
      actorUserId: 5,
      periodKey: "2026-07",
    });

    expect(result.archived).toBe(true);
    expect(result.documentId).toBe(42);
    expect(result.periodKey).toBe("2026-07");
    expect(result.sha256).toBeDefined();
    expect(result.sha256).toHaveLength(64);

    // Staging put called once
    expect(storagePutSpy).toHaveBeenCalledTimes(1);

    // Compensating deletion should NOT be called on success
    expect(storageDeleteSpy).not.toHaveBeenCalled();
  });
});
