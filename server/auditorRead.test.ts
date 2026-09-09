import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as auditorTokenModule from "./auditorTokenService";
import * as dbModule from "./db";
import * as finRouter from "./financialStatementsRouter";
import {
  workspaces,
  financialProfiles,
  auditEvents,
  zakatAssessments,
  investmentLots,
  lotMatches,
  instruments,
} from "../drizzle/schema";

function createMockQuery(result: any[] = []) {
  const p = Promise.resolve(result) as any;
  p.where = vi.fn(() => createMockQuery(result));
  p.orderBy = vi.fn(() => createMockQuery(result));
  p.limit = vi.fn(() => createMockQuery(result));
  p.innerJoin = vi.fn(() => createMockQuery(result));
  p.groupBy = vi.fn(() => createMockQuery(result));
  return p;
}

describe("Auditor Portal Read APIs — Token Scope & Access Enforcement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AUDITOR_PORTAL_JWT_SECRET = "auditor-portal-secret-32-chars-long!";
  });

  const caller = appRouter.createCaller({} as any);

  const mockWorkspace = { id: 101, name: "Family Holding", baseCurrency: "SAR" };
  const mockProfile = { id: 201, workspaceId: 101, fullName: "Principal Owner", baseCurrency: "SAR" };
  const mockAssessments = [
    { id: 1, workspaceId: 101, eligibleBase: "1000000", nisabBase: "25000", zakatDueBase: "25000", status: "calculated", assessedAt: 1700000000000, createdAt: 1700000000000 },
  ];
  const mockLots = [
    { id: 1, workspaceId: 101, instrumentId: 50, originalQuantity: "100", remainingQuantity: "100", unitCost: "50", status: "open", acquiredAt: 1700000000000 },
  ];

  function setupMockDb() {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => {
          if (table === workspaces) return createMockQuery([mockWorkspace]);
          if (table === financialProfiles) return createMockQuery([mockProfile]);
          if (table === auditEvents) return createMockQuery([]); // Not revoked!
          if (table === zakatAssessments) return createMockQuery(mockAssessments);
          if (table === investmentLots) return createMockQuery(mockLots);
          if (table === instruments) return createMockQuery([{ id: 50, symbol: "2222.SR", name: "Aramco", assetType: "stock" }]);
          if (table === lotMatches) return createMockQuery([]);
          return createMockQuery([]);
        }),
      })),
    };
    vi.spyOn(dbModule, "getDb").mockResolvedValue(mockDb as any);
    return mockDb;
  }

  it("getAuditorFinancialStatements allows token with financial_statements scope and blocks unauthorized scope", async () => {
    setupMockDb();

    const validStatementsToken = auditorTokenModule.signAuditorToken({
      tokenId: "aud_fin_01",
      workspaceId: 101,
      label: "Quarterly Audit",
      targetAuditor: "KPMG Auditor",
      purpose: "Q1 Financial Statements Review",
      allowedScopes: ["financial_statements"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    const zakatOnlyToken = auditorTokenModule.signAuditorToken({
      tokenId: "aud_zak_01",
      workspaceId: 101,
      label: "Zakat Audit",
      targetAuditor: "Shariah Auditor",
      purpose: "Zakat Compliance",
      allowedScopes: ["zakat"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    vi.spyOn(finRouter, "generateFinancialStatementsPackage").mockResolvedValue({
      bookBalanceSheet: {
        asOf: "2026-03-31",
        baseCurrency: "SAR",
        assets: { totalBookAssets: "5000000" },
        liabilities: { totalBookLiabilities: "1000000" },
        equity: { totalBookEquity: "4000000" },
        equationCheck: { assetsEqualsLiabilitiesPlusEquity: true, imbalanceBase: "0" },
      },
      metadata: { asOf: "2026-03-31" },
    } as any);

    const recordSpy = vi.spyOn(auditorTokenModule, "recordAuditorAccessEvent").mockResolvedValue();

    // 1. Success with financial_statements scope
    const res = await caller.family.auditor.getAuditorFinancialStatements({
      token: validStatementsToken,
      asOf: "2026-03-31",
    });
    expect(res.workspace.id).toBe(101);
    expect(res.statements.bookBalanceSheet.assets.totalBookAssets).toBe("5000000");
    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 101,
        tokenId: "aud_fin_01",
        targetAuditor: "KPMG Auditor",
      })
    );

    // 2. FORBIDDEN when calling with zakat-only token
    await expect(
      caller.family.auditor.getAuditorFinancialStatements({
        token: zakatOnlyToken,
      })
    ).rejects.toThrow("رمز الوصول لا يملك صلاحية النطاق المطلوب (financial_statements)");
  });

  it("getAuditorReconciliation enforces reconciliation scope", async () => {
    setupMockDb();

    const reconToken = auditorTokenModule.signAuditorToken({
      tokenId: "aud_recon_01",
      workspaceId: 101,
      label: "Ledger Reconciliation",
      targetAuditor: "Audit Firm",
      purpose: "Reconciliation",
      allowedScopes: ["reconciliation"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    vi.spyOn(auditorTokenModule, "recordAuditorAccessEvent").mockResolvedValue();

    const res = await caller.family.auditor.getAuditorReconciliation({
      token: reconToken,
    });
    expect(res.workspace.id).toBe(101);
    expect(res.report).toBeDefined();
    expect(res.report.trialBalance).toBeDefined();

    // Expired token should be rejected
    const expiredToken = auditorTokenModule.signAuditorToken({
      tokenId: "aud_expired",
      workspaceId: 101,
      label: "Expired",
      targetAuditor: "Auditor",
      purpose: "Test",
      allowedScopes: ["reconciliation"],
      issuedAt: Date.now() - 7200000,
      expiresAt: Date.now() - 3600000,
    });

    await expect(
      caller.family.auditor.getAuditorReconciliation({
        token: expiredToken,
      })
    ).rejects.toThrow("رمز الوصول منتهي الصلاحية");
  });

  it("getAuditorZakat enforces zakat scope and filters assessments", async () => {
    setupMockDb();

    const zakatToken = auditorTokenModule.signAuditorToken({
      tokenId: "aud_zakat_01",
      workspaceId: 101,
      label: "Zakat Audit",
      targetAuditor: "Zakat Auditor",
      purpose: "Zakat Review",
      allowedScopes: ["zakat"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    vi.spyOn(auditorTokenModule, "recordAuditorAccessEvent").mockResolvedValue();

    const res = await caller.family.auditor.getAuditorZakat({
      token: zakatToken,
      status: "calculated",
    });
    expect(res.workspace.id).toBe(101);
    expect(res.assessments).toHaveLength(1);
    expect(res.assessments[0].zakatDueBase).toBe("25000");

    // Blocked if scope missing
    const reconOnlyToken = auditorTokenModule.signAuditorToken({
      tokenId: "aud_recon_only",
      workspaceId: 101,
      label: "Recon Only",
      targetAuditor: "Auditor",
      purpose: "Recon",
      allowedScopes: ["reconciliation"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    await expect(
      caller.family.auditor.getAuditorZakat({
        token: reconOnlyToken,
      })
    ).rejects.toThrow("رمز الوصول لا يملك صلاحية النطاق المطلوب (zakat)");
  });

  it("getAuditorLotAccounting enforces lot_accounting scope and returns FIFO lots", async () => {
    setupMockDb();

    const lotToken = auditorTokenModule.signAuditorToken({
      tokenId: "aud_lot_01",
      workspaceId: 101,
      label: "Lots Audit",
      targetAuditor: "Tax Auditor",
      purpose: "FIFO Lots Review",
      allowedScopes: ["lot_accounting"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    vi.spyOn(auditorTokenModule, "recordAuditorAccessEvent").mockResolvedValue();

    const res = await caller.family.auditor.getAuditorLotAccounting({
      token: lotToken,
      instrumentId: 50,
    });
    expect(res.workspace.id).toBe(101);
    expect(res.lots).toHaveLength(1);
    expect(res.lots[0].remainingQuantity).toBe("100");

    // Tampered token fails
    const tampered = lotToken + "tampered";
    await expect(
      caller.family.auditor.getAuditorLotAccounting({
        token: tampered,
      })
    ).rejects.toThrow("توقيع الرمز غير صالح");
  });
});
