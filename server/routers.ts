import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ensurePersonalFamilyContext } from "./familyAccess";
import { comparePassword, hashPassword, verifyFamilyInviteCode } from "./localAuth";
import { familyRouter } from "./familyRouter";
import { platformAdminRouter } from "./platformAdminRouter";
import { performanceRouter } from "./performanceRouter";
import { stressTestingRouter } from "./stressTestingRouter";
import { consolidationRouter } from "./consolidationRouter";
import { swingTradingRouter } from "./swingTradingRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    status: publicProcedure.query(() => {
      const googleConfigured = Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      );
      return {
        googleConfigured,
      };
    }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email("أدخل بريد إلكتروني صالح."),
          password: z.string().min(1, "أدخل كلمة المرور."),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const user = await db.getUserByEmail(normalizedEmail);

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
          });
        }

        const isValid = await comparePassword(input.password, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
          });
        }

        const signedInAt = new Date();
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: signedInAt,
        });

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || user.email || "Family Member",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
          user: {
            id: user.id,
            openId: user.openId,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        };
      }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2, "الاسم يجب أن لا يقل عن حرفين."),
          email: z.string().trim().email("أدخل بريد إلكتروني صالح."),
          password: z.string().min(8, "كلمة المرور يجب أن لا تقل عن 8 أحرف."),
          inviteCode: z.string().trim().min(1, "رمز دعوة العائلة مطلوب للتسجيل."),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!verifyFamilyInviteCode(input.inviteCode)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "رمز دعوة العائلة غير صحيح. التسجيل مقتصر على أفراد العائلة المصرح لهم.",
          });
        }

        const normalizedEmail = input.email.trim().toLowerCase();
        const existing = await db.getUserByEmail(normalizedEmail);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.",
          });
        }

        const passwordHash = await hashPassword(input.password);
        const newUser = await db.createUserWithPassword({
          email: normalizedEmail,
          passwordHash,
          name: input.name,
        });

        try {
          await ensurePersonalFamilyContext(newUser);
        } catch (err) {
          console.warn("[Auth] Workspace initialization notice:", err);
        }

        const sessionToken = await sdk.createSessionToken(newUser.openId, {
          name: newUser.name || newUser.email || "Family Member",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
          user: {
            id: newUser.id,
            openId: newUser.openId,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
          },
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  family: familyRouter,
  platformAdmin: platformAdminRouter,
  performance: performanceRouter,
  stressTesting: stressTestingRouter,
  consolidation: consolidationRouter,
  swingTrading: swingTradingRouter,
});

export type AppRouter = typeof appRouter;
