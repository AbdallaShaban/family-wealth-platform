import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as familyAccess from "./familyAccess";
import { hashPassword } from "./localAuth";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createTestContext(): {
  ctx: TrpcContext;
  cookiesSet: CookieCall[];
  cookiesCleared: CookieCall[];
} {
  const cookiesSet: CookieCall[] = [];
  const cookiesCleared: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookiesSet.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cookiesCleared.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookiesSet, cookiesCleared };
}

describe("auth.login and auth.register TRPC Procedures", () => {
  describe("auth.status", () => {
    it("reports googleConfigured based on environment credentials", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const status = await caller.auth.status();
      expect(status).toHaveProperty("googleConfigured");
      expect(typeof status.googleConfigured).toBe("boolean");
    });
  });

  describe("auth.register with Family Invite Code", () => {
    it("rejects registration when family invite code is wrong", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.register({
          name: "عضو العائلة",
          email: "member@example.com",
          password: "SecurePassword123!",
          inviteCode: "WRONG-INVITE-CODE",
        })
      ).rejects.toThrow("رمز دعوة العائلة غير صحيح");
    });

    it("rejects registration when email already exists", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getUserByEmail").mockResolvedValueOnce({
        id: 10,
        openId: "local|existing",
        email: "existing@example.com",
        name: "Existing Member",
        passwordHash: "$2b$12$somehash",
        loginMethod: "local",
        role: "user",
        activeWorkspaceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      await expect(
        caller.auth.register({
          name: "عضو مكرر",
          email: "existing@example.com",
          password: "SecurePassword123!",
          inviteCode: "FAMILY-WEALTH-SECRET-2026",
        })
      ).rejects.toThrow("مسجل بالفعل");
    });

    it("registers user, initializes workspace, and sets session cookie with valid invite code", async () => {
      const { ctx, cookiesSet } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getUserByEmail").mockResolvedValueOnce(undefined);
      vi.spyOn(db, "createUserWithPassword").mockResolvedValueOnce({
        id: 99,
        openId: "local|fresh-user-id",
        email: "newmember@example.com",
        name: "عضو جديد",
        passwordHash: "$2b$12$hashedPassword",
        loginMethod: "local",
        role: "user",
        activeWorkspaceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      vi.spyOn(familyAccess, "ensurePersonalFamilyContext").mockResolvedValueOnce({
        workspace: { id: 1 } as any,
        profile: {} as any,
        membership: { role: "owner" } as any,
      });

      const res = await caller.auth.register({
        name: "عضو جديد",
        email: "newmember@example.com",
        password: "ValidPassword123!",
        inviteCode: "FAMILY-WEALTH-SECRET-2026",
      });

      expect(res.success).toBe(true);
      expect(res.user.email).toBe("newmember@example.com");
      expect(cookiesSet.length).toBeGreaterThan(0);
      expect(cookiesSet[0]?.name).toBe(COOKIE_NAME);
      expect(cookiesSet[0]?.options).toMatchObject({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });
    });
  });

  describe("auth.login with bcrypt", () => {
    it("rejects login when user does not exist", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getUserByEmail").mockResolvedValueOnce(undefined);

      await expect(
        caller.auth.login({
          email: "unknown@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    });

    it("rejects login when user has no passwordHash", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getUserByEmail").mockResolvedValueOnce({
        id: 1,
        openId: "google|12345",
        email: "oauthonly@example.com",
        name: "OAuth User",
        passwordHash: null,
        loginMethod: "google",
        role: "user",
        activeWorkspaceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      await expect(
        caller.auth.login({
          email: "oauthonly@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    });

    it("rejects login when password does not match hash", async () => {
      const { ctx } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const realHash = await hashPassword("RightPassword123!");

      vi.spyOn(db, "getUserByEmail").mockResolvedValueOnce({
        id: 1,
        openId: "local|user1",
        email: "user@example.com",
        name: "User One",
        passwordHash: realHash,
        loginMethod: "local",
        role: "user",
        activeWorkspaceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      await expect(
        caller.auth.login({
          email: "user@example.com",
          password: "WrongPassword!",
        })
      ).rejects.toThrow("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    });

    it("logs in successfully and sets session cookie when credentials match", async () => {
      const { ctx, cookiesSet } = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const realHash = await hashPassword("CorrectSecret123!");

      vi.spyOn(db, "getUserByEmail").mockResolvedValueOnce({
        id: 5,
        openId: "local|validuser",
        email: "valid@example.com",
        name: "طارق الرشيد",
        passwordHash: realHash,
        loginMethod: "local",
        role: "admin",
        activeWorkspaceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });

      vi.spyOn(db, "upsertUser").mockResolvedValueOnce();

      const result = await caller.auth.login({
        email: "valid@example.com",
        password: "CorrectSecret123!",
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe("valid@example.com");
      expect(result.user.name).toBe("طارق الرشيد");
      expect(cookiesSet).toHaveLength(1);
      expect(cookiesSet[0]?.name).toBe(COOKIE_NAME);
      expect(cookiesSet[0]?.options).toMatchObject({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });
    });
  });
});
