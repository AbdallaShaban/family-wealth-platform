import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { familyTelegramRouter } from "./familyTelegramRouter";
import { saveTelegramConfig, loadTelegramConfig } from "../../services/telegramAlertService";

const {
  resolveFamilyContextForWorkspaceMock,
  ensurePersonalFamilyContextMock,
  assertRoleMock,
} = vi.hoisted(() => ({
  resolveFamilyContextForWorkspaceMock: vi.fn(),
  ensurePersonalFamilyContextMock: vi.fn(),
  assertRoleMock: vi.fn(),
}));

vi.mock("../../familyAccess", () => ({
  resolveFamilyContextForWorkspace: resolveFamilyContextForWorkspaceMock,
  ensurePersonalFamilyContext: ensurePersonalFamilyContextMock,
  assertRole: assertRoleMock,
}));

vi.mock("../../services/telegramAlertService", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    sendTestAlert: vi.fn(async (context, token, chat) => {
      return { success: true, messageId: 777 };
    }),
    runAllAlertChecks: vi.fn(async (context) => {
      return { sentCount: 1, alerts: ["Test alert"], errors: [] };
    }),
    checkWeeklySummaryAlert: vi.fn(async (context, force) => {
      return ["Weekly summary test"];
    }),
  };
});

describe("familyTelegramRouter — Multi-Tenant Isolation & Authorization Hardening", () => {
  const userA = { id: 1, name: "Owner A", role: "user" } as any;
  const userB = { id: 2, name: "Viewer B", role: "user" } as any;

  const contextA = {
    workspace: { id: 101, name: "Family Workspace A" },
    membership: { role: "owner", status: "active", userId: 1, workspaceId: 101 },
    profile: { id: 1 },
  } as any;

  const contextViewer = {
    workspace: { id: 101, name: "Family Workspace A" },
    membership: { role: "viewer", status: "active", userId: 2, workspaceId: 101 },
    profile: { id: 2 },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("masks bot token in getConfig output so raw secrets are never returned to client", async () => {
    // Setup workspace 101 config with raw token
    saveTelegramConfig(101, {
      botToken: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
      chatId: "987654321",
      enabled: true,
    });

    resolveFamilyContextForWorkspaceMock.mockResolvedValueOnce(contextA);

    const caller = familyTelegramRouter.createCaller({ user: userA } as any);
    const result = await caller.getConfig();

    expect(result.workspaceId).toBe(101);
    expect(result.isConfigured).toBe(true);
    expect(result.chatId).toBe("987654321");
    // Token must be masked: only first 6 and last 4 characters
    expect(result.botTokenMasked).toBe("123456••••••••wxyz");
    expect((result as any).botToken).toBeUndefined();
  });

  it("blocks unauthorized user with role 'viewer' from updating telegram config", async () => {
    resolveFamilyContextForWorkspaceMock.mockImplementationOnce(() => {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "لا تملك الصلاحية المطلوبة لهذه العملية.",
      });
    });

    const caller = familyTelegramRouter.createCaller({ user: userB } as any);

    await expect(
      caller.updateConfig({
        enabled: false,
      })
    ).rejects.toThrowError(TRPCError);
  });

  it("prevents cross-workspace tampering when an attacker passes a foreign workspaceId", async () => {
    // User A attempts to tamper with Workspace 202 (which belongs to Tenant B)
    resolveFamilyContextForWorkspaceMock.mockImplementationOnce(
      (user, requestedWsId) => {
        if (requestedWsId === 202) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "لا تملك صلاحية الوصول إلى مساحة العمل المحددة.",
          });
        }
        return Promise.resolve(contextA);
      }
    );

    const caller = familyTelegramRouter.createCaller({ user: userA } as any);

    await expect(
      caller.updateConfig({
        workspaceId: 202,
        chatId: "hacked-chat-id",
      })
    ).rejects.toThrowError("لا تملك صلاحية الوصول إلى مساحة العمل المحددة.");
  });

  it("preserves saved botToken when updateConfig is submitted without new token or with masked dots", async () => {
    // Establish saved secret token in workspace 101
    saveTelegramConfig(101, {
      botToken: "original-secret-token-777",
      chatId: "original-chat-101",
      enabled: true,
    });

    resolveFamilyContextForWorkspaceMock.mockResolvedValue(contextA);

    const caller = familyTelegramRouter.createCaller({ user: userA } as any);

    // Call update with masked token representation from UI
    await caller.updateConfig({
      botToken: "orig••••••••-777",
      goldMovementThresholdPct: 3.5,
    });

    const loaded = loadTelegramConfig(101);
    expect(loaded.botToken).toBe("original-secret-token-777");
    expect(loaded.goldMovementThresholdPct).toBe(3.5);
  });

  it("scopes sendTestAlert, runChecks, and sendWeeklySummaryNow strictly to the authenticated workspace", async () => {
    resolveFamilyContextForWorkspaceMock.mockResolvedValue(contextA);

    const caller = familyTelegramRouter.createCaller({ user: userA } as any);

    const testRes = await caller.sendTestAlert({});
    expect(testRes.success).toBe(true);
    expect(testRes.workspaceId).toBe(101);

    const checkRes = await caller.runChecks();
    expect(checkRes.sentCount).toBe(1);

    const weeklyRes = await caller.sendWeeklySummaryNow();
    expect(weeklyRes.success).toBe(true);
    expect(weeklyRes.workspaceId).toBe(101);
  });
});
