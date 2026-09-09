import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computePayloadSha256,
  validateWorkspaceBackup,
  restoreFullWorkspaceBackup,
  WORKSPACE_TABLE_NAMES,
  type FullWorkspaceBackupEnvelope,
} from "./backupRestoreService";
import * as dbModule from "./db";

describe("Disaster Recovery Integration — Secondary Foreign Key Remapping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("remaps all secondary financialEvents FKs and cashFlowCategoryId during restore", async () => {
    const rawPayload: Record<string, any[]> = {};
    WORKSPACE_TABLE_NAMES.forEach((name) => {
      rawPayload[name] = [];
    });

    // Populate payload with entity relationships
    rawPayload.financial_profiles = [{ id: 1, fullName: "Al-Family Principal" }];
    rawPayload.cash_flow_categories = [{ id: 20, name: "Insurance Outflow", direction: "outflow" }];
    rawPayload.accounts = [{ id: 5, name: "Al-Rajhi Operating", accountType: "bank", currency: "SAR" }];
    rawPayload.approval_policies = [{ id: 30, name: "Major Expenditure Policy" }];
    rawPayload.debts = [{ id: 40, profileId: 1, name: "Corporate Facility" }];
    rawPayload.insurance_policies = [{ id: 50, profileId: 1, cashFlowCategoryId: 20, policyName: "Executive Life" }];
    rawPayload.bank_statement_imports = [{ id: 60, accountId: 5, filename: "statement.csv" }];

    // The key financial event with old ID 100
    rawPayload.financial_events = [
      {
        id: 100,
        status: "posted",
        eventType: "expense",
        primaryAccountId: 5,
        grossAmount: "50000",
        currency: "SAR",
        idempotencyKey: "evt-old-100",
      },
    ];

    // Dependent records referencing financialEvents.id = 100
    rawPayload.debt_payments = [
      { id: 201, debtId: 40, financialEventId: 100, amount: "10000" },
    ];
    rawPayload.insurance_premium_payments = [
      { id: 202, policyId: 50, financialEventId: 100, amount: "5000" },
    ];
    rawPayload.insurance_claims = [
      { id: 203, policyId: 50, claimAmount: "25000", receivedEventId: 100 },
    ];
    rawPayload.personal_ious = [
      { id: 204, profileId: 1, amount: "15000", settlementEventId: 100 },
    ];
    rawPayload.zakat_assessments = [
      { id: 205, profileId: 1, eligibleBase: "500000", nisabBase: "25000", zakatDueBase: "12500", paymentEventId: 100 },
    ];
    rawPayload.approval_requests = [
      { id: 206, policyId: 30, title: "Expenditure", executedEventId: 100 },
    ];
    rawPayload.bank_statement_rows = [
      { id: 207, importId: 60, amount: "50000", matchedEventId: 100 },
    ];
    rawPayload.lot_transfers = [
      { id: 208, sourceLotId: 1, destinationLotId: 2, quantity: "10", transferEventId: 100 },
    ];

    const payloadSha256 = computePayloadSha256(rawPayload);

    const backupEnvelope: FullWorkspaceBackupEnvelope = {
      format: "family-full-backup-v1",
      version: "1.0",
      workspaceId: 10,
      workspaceMetadata: {
        name: "Al-Family Holding",
        baseCurrency: "SAR",
        exportedAt: 1700000000000,
        tableCount: 51,
      },
      manifest: {
        tables: {
          financial_profiles: 1,
          cash_flow_categories: 1,
          financial_events: 1,
          debt_payments: 1,
          insurance_policies: 1,
          insurance_premium_payments: 1,
          insurance_claims: 1,
          personal_ious: 1,
          zakat_assessments: 1,
          approval_requests: 1,
          bank_statement_rows: 1,
          lot_transfers: 1,
        },
        totalRows: 12,
        payloadSha256,
      },
      payload: rawPayload,
    };

    const validation = validateWorkspaceBackup(backupEnvelope);
    expect(validation.valid).toBe(true);

    // Track rows inserted during mock restore transaction
    const insertedRecords: Record<string, any[]> = {};
    let nextId = 1000;
    let assignedFinancialEventId = 0;
    let assignedCashFlowCategoryId = 0;

    const mockTx = {
      insert: vi.fn((tableDef: any) => ({
        values: vi.fn(async (vals: any) => {
          const tableName = tableDef[Symbol.for("drizzle:Name")] || tableDef._?.name || "unknown";
          const assignedId = nextId++;

          if (tableName === "financial_events") {
            assignedFinancialEventId = assignedId;
          } else if (tableName === "cash_flow_categories") {
            assignedCashFlowCategoryId = assignedId;
          }

          insertedRecords[tableName] = insertedRecords[tableName] || [];
          insertedRecords[tableName].push({ ...vals, id: assignedId });
          return [{ insertId: assignedId }];
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: 99, name: "Al-Family Holding" }])),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    };

    const mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
    };

    vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb as any);

    const result = await restoreFullWorkspaceBackup({
      backup: backupEnvelope,
      actorUserId: 1,
      mode: "clone",
      newWorkspaceName: "Al-Family Holding (Restored)",
    });

    expect(result.workspaceId).toBeDefined();
    expect(assignedFinancialEventId).toBeGreaterThan(0);
    expect(assignedCashFlowCategoryId).toBeGreaterThan(0);

    // Verify all inserted dependent records have remapped FKs to assignedFinancialEventId
    const debtPayments = insertedRecords["debt_payments"];
    expect(debtPayments).toBeDefined();
    expect(debtPayments[0].financialEventId).toBe(assignedFinancialEventId);

    const insurancePolicies = insertedRecords["insurance_policies"];
    expect(insurancePolicies).toBeDefined();
    expect(insurancePolicies[0].cashFlowCategoryId).toBe(assignedCashFlowCategoryId);

    const insurancePremiumPayments = insertedRecords["insurance_premium_payments"];
    expect(insurancePremiumPayments).toBeDefined();
    expect(insurancePremiumPayments[0].financialEventId).toBe(assignedFinancialEventId);

    const insuranceClaims = insertedRecords["insurance_claims"];
    expect(insuranceClaims).toBeDefined();
    expect(insuranceClaims[0].receivedEventId).toBe(assignedFinancialEventId);

    const personalIous = insertedRecords["personal_ious"];
    expect(personalIous).toBeDefined();
    expect(personalIous[0].settlementEventId).toBe(assignedFinancialEventId);

    const zakatAssessments = insertedRecords["zakat_assessments"];
    expect(zakatAssessments).toBeDefined();
    expect(zakatAssessments[0].paymentEventId).toBe(assignedFinancialEventId);

    const approvalRequests = insertedRecords["approval_requests"];
    expect(approvalRequests).toBeDefined();
    expect(approvalRequests[0].executedEventId).toBe(assignedFinancialEventId);

    const bankStatementRows = insertedRecords["bank_statement_rows"];
    expect(bankStatementRows).toBeDefined();
    expect(bankStatementRows[0].matchedEventId).toBe(assignedFinancialEventId);

    const lotTransfers = insertedRecords["lot_transfers"];
    expect(lotTransfers).toBeDefined();
    expect(lotTransfers[0].transferEventId).toBe(assignedFinancialEventId);
  });

  it("remaps special_asset_valuations foreign keys (assetId, financialEventId, profileId) and preserves null financialEventId", async () => {
    const rawPayload: Record<string, any[]> = {};
    WORKSPACE_TABLE_NAMES.forEach((name) => {
      rawPayload[name] = [];
    });

    rawPayload.financial_profiles = [{ id: 1, fullName: "Al-Family Principal" }];
    rawPayload.special_assets = [{ id: 70, name: "Luxury Estate", assetType: "real_estate" }];
    rawPayload.financial_events = [
      {
        id: 100,
        status: "posted",
        eventType: "expense",
        currency: "SAR",
        grossAmount: "100000",
      },
    ];

    rawPayload.special_asset_valuations = [
      {
        id: 301,
        assetId: 70,
        financialEventId: 100,
        profileId: 1,
        valuationMethod: "appraisal",
        value: "25000000.000000",
        currency: "SAR",
        asOf: 1700000000000,
        quality: "fresh",
        source: "Certified Appraiser",
        createdByUserId: 1,
        createdAt: 1700000000000,
      },
      {
        id: 302,
        assetId: 70,
        financialEventId: null,
        profileId: 1,
        valuationMethod: "manual",
        value: "26000000.000000",
        currency: "SAR",
        asOf: 1700100000000,
        quality: "fresh",
        source: "Owner Estimate",
        createdByUserId: 1,
        createdAt: 1700100000000,
      },
    ];

    const payloadSha256 = computePayloadSha256(rawPayload);

    const backupEnvelope: FullWorkspaceBackupEnvelope = {
      format: "family-full-backup-v1",
      version: "1.0",
      workspaceId: 10,
      workspaceMetadata: {
        name: "Al-Family Holding",
        baseCurrency: "SAR",
        exportedAt: 1700000000000,
        tableCount: 51,
      },
      manifest: {
        tables: {
          financial_profiles: 1,
          special_assets: 1,
          financial_events: 1,
          special_asset_valuations: 2,
        },
        totalRows: 5,
        payloadSha256,
      },
      payload: rawPayload,
    };

    const insertedRecords: Record<string, any[]> = {};
    let nextId = 5000;
    let assignedProfileId = 0;
    let assignedSpecialAssetId = 0;
    let assignedFinancialEventId = 0;

    const mockTx = {
      insert: vi.fn((tableDef: any) => ({
        values: vi.fn(async (vals: any) => {
          const tableName = tableDef[Symbol.for("drizzle:Name")] || tableDef._?.name || "unknown";
          const assignedId = nextId++;

          if (tableName === "financial_profiles") {
            assignedProfileId = assignedId;
          } else if (tableName === "special_assets") {
            assignedSpecialAssetId = assignedId;
          } else if (tableName === "financial_events") {
            assignedFinancialEventId = assignedId;
          }

          insertedRecords[tableName] = insertedRecords[tableName] || [];
          insertedRecords[tableName].push({ ...vals, id: assignedId });
          return [{ insertId: assignedId }];
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: 99, name: "Al-Family Holding" }])),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    };

    const mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
    };

    vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb as any);

    const result = await restoreFullWorkspaceBackup({
      backup: backupEnvelope,
      actorUserId: 1,
      mode: "clone",
      newWorkspaceName: "Al-Family Holding (Clone)",
    });

    expect(result.workspaceId).toBeDefined();
    expect(assignedProfileId).toBeGreaterThan(0);
    expect(assignedSpecialAssetId).toBeGreaterThan(0);
    expect(assignedFinancialEventId).toBeGreaterThan(0);

    const valuations = insertedRecords["special_asset_valuations"];
    expect(valuations).toBeDefined();
    expect(valuations).toHaveLength(2);

    // Row 1: All 3 IDs remapped to new restored workspace IDs
    expect(valuations[0].assetId).toBe(assignedSpecialAssetId);
    expect(valuations[0].profileId).toBe(assignedProfileId);
    expect(valuations[0].financialEventId).toBe(assignedFinancialEventId);

    // Row 2: assetId and profileId remapped, financialEventId remains null
    expect(valuations[1].assetId).toBe(assignedSpecialAssetId);
    expect(valuations[1].profileId).toBe(assignedProfileId);
    expect(valuations[1].financialEventId).toBeNull();
  });
});
