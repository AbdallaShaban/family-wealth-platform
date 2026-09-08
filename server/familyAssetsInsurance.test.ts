import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents, insurancePolicies, specialAssets } from "../drizzle/schema";

const { assertRoleMock, ensureContextMock, getDbMock } = vi.hoisted(() => ({
  assertRoleMock: vi.fn(),
  ensureContextMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./familyAccess", () => ({
  assertRole: assertRoleMock,
  ensurePersonalFamilyContext: ensureContextMock,
  listAccessibleWorkspaces: vi.fn(),
  setActiveFamilyWorkspace: vi.fn(),
}));

import { appRouter } from "./routers";

type Row = Record<string, unknown>;

function createSelectChain(response: Row[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => response,
    then: (onfulfilled: (value: Row[]) => unknown, onrejected?: (reason: unknown) => unknown) => Promise.resolve(response).then(onfulfilled, onrejected),
  };
  return chain;
}

function createDb(selectResponses: Row[]) {
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  let selectIndex = 0;
  return {
    inserted,
    db: {
      select: vi.fn(() => createSelectChain(selectResponses[selectIndex++] ?? [])),
      insert: vi.fn((table: unknown) => ({
        values: (values: unknown) => {
          inserted.push({ table, values });
          return Promise.resolve([{ insertId: 901 }]);
        },
      })),
    },
  };
}

const family = {
  workspace: { id: 44, baseCurrency: "EGP", name: "FAMILY" },
  profile: { id: 77 },
  membership: { role: "editor" },
};

const ctx: any = {
  user: { id: 1, openId: "assets-insurance-test", email: "test@example.com", name: "Test", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { headers: {} },
  res: {},
};

describe("FAMILY special assets and insurance contracts", () => {
  beforeEach(() => {
    assertRoleMock.mockReset();
    ensureContextMock.mockReset();
    getDbMock.mockReset();
    ensureContextMock.mockResolvedValue(family);
  });

  it("creates a special-asset registry record only for the current profile asset account", async () => {
    const { db, inserted } = createDb([
      [{ id: 11, workspaceId: 44, ownerProfileId: 77, accountType: "asset", status: "active", currency: "EGP" }],
      [],
    ]);
    getDbMock.mockResolvedValue(db);

    const result = await appRouter.createCaller(ctx).family.specialAssets.create({
      assetAccountId: 11,
      assetType: "gold",
      name: "سبيكة ذهب",
      quantity: "50",
      unit: "جرام",
      details: "سجل وصفي فقط",
    });

    expect(result).toEqual({ id: 901 });
    expect(assertRoleMock).toHaveBeenCalledWith(family, "editor");
    expect(inserted.find(item => item.table === specialAssets)?.values).toMatchObject({
      workspaceId: 44,
      profileId: 77,
      assetAccountId: 11,
      quantity: "50.00000000",
      status: "active",
    });
    expect(inserted.some(item => item.table === auditEvents)).toBe(true);
  });

  it("rejects an asset account that already has a private-asset record", async () => {
    const { db, inserted } = createDb([
      [{ id: 11, workspaceId: 44, ownerProfileId: 77, accountType: "asset", status: "active" }],
      [{ id: 99 }],
    ]);
    getDbMock.mockResolvedValue(db);

    await expect(appRouter.createCaller(ctx).family.specialAssets.create({
      assetAccountId: 11,
      assetType: "real_estate",
      name: "شقة",
      quantity: null,
      unit: null,
      details: null,
    })).rejects.toThrow("يرتبط حساب الأصل هذا بسجل أصل خاص بالفعل");
    expect(inserted).toHaveLength(0);
  });

  it("requires private-asset quantity and unit to be supplied together", async () => {
    await expect(appRouter.createCaller(ctx).family.specialAssets.create({
      assetAccountId: 11,
      assetType: "commodity",
      name: "سلعة",
      quantity: "3",
      unit: null,
      details: null,
    })).rejects.toThrow("أدخل كمية الأصل ووحدتها معًا");
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("rejects an insurance premium without its cadence and invalid policy dates before persistence", async () => {
    await expect(appRouter.createCaller(ctx).family.insurance.create({
      name: "تأمين صحي",
      policyType: "health",
      insurer: null,
      policyNumber: null,
      coverageAmount: null,
      currency: "EGP",
      premiumAmount: "500",
      premiumCadence: null,
      cashFlowCategoryId: null,
      startsAt: null,
      endsAt: null,
      beneficiaries: null,
      claimsNote: null,
    })).rejects.toThrow("أدخل قيمة القسط ودورية سداده معًا");

    await expect(appRouter.createCaller(ctx).family.insurance.create({
      name: "تأمين ممتلكات",
      policyType: "property",
      insurer: null,
      policyNumber: null,
      coverageAmount: null,
      currency: "EGP",
      premiumAmount: null,
      premiumCadence: null,
      cashFlowCategoryId: null,
      startsAt: 1_700_000_000_000,
      endsAt: 1_699_000_000_000,
      beneficiaries: null,
      claimsNote: null,
    })).rejects.toThrow("تاريخ انتهاء الوثيقة لا يمكن أن يسبق تاريخ بدايتها");
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("stores an insurance policy and its expense-category reference without posting a premium", async () => {
    const { db, inserted } = createDb([
      [{ id: 61, workspaceId: 44, direction: "expense", isArchived: "no" }],
    ]);
    getDbMock.mockResolvedValue(db);

    const result = await appRouter.createCaller(ctx).family.insurance.create({
      name: "تأمين صحي عائلي",
      policyType: "health",
      insurer: "شركة تأمين",
      policyNumber: "POL-123",
      coverageAmount: "1000000",
      currency: "EGP",
      premiumAmount: "1200",
      premiumCadence: "monthly",
      cashFlowCategoryId: 61,
      startsAt: 1_700_000_000_000,
      endsAt: 1_730_000_000_000,
      beneficiaries: "الأسرة",
      claimsNote: null,
    });

    expect(result).toEqual({ id: 901 });
    expect(inserted.find(item => item.table === insurancePolicies)?.values).toMatchObject({
      workspaceId: 44,
      profileId: 77,
      cashFlowCategoryId: 61,
      coverageAmount: "1000000.000000",
      premiumAmount: "1200.000000",
      premiumCadence: "monthly",
      status: "active",
    });
    expect(inserted.some(item => item.table === specialAssets)).toBe(false);
    expect(inserted.some(item => item.table === auditEvents)).toBe(true);
  });
});
