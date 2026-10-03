import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../../_core/trpc";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import {
  loadTelegramConfig,
  saveTelegramConfig,
  sendTestAlert,
  runAllAlertChecks,
  checkWeeklySummaryAlert,
} from "../../services/telegramAlertService";

export const familyTelegramRouter = router({
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const config = loadTelegramConfig();

    // Mask bot token for security (only show first 6 and last 4 characters)
    let maskedToken = "";
    if (config.botToken) {
      if (config.botToken.length > 12) {
        maskedToken = `${config.botToken.slice(0, 6)}••••••••${config.botToken.slice(-4)}`;
      } else {
        maskedToken = "••••••••••••";
      }
    }

    return {
      isConfigured: Boolean(config.botToken && config.chatId),
      botTokenMasked: maskedToken,
      chatId: config.chatId,
      enabled: config.enabled,
      enableCertificates: config.enableCertificates,
      enableGoldMovements: config.enableGoldMovements,
      enableZakatHawl: config.enableZakatHawl,
      enableWeeklySummary: config.enableWeeklySummary,
      goldMovementThresholdPct: config.goldMovementThresholdPct,
      lastCheckedAt: config.lastCheckedAt || null,
      lastDispatchedAt: config.lastDispatchedAt || null,
      lastTestSentAt: config.lastTestSentAt || null,
    };
  }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        botToken: z.string().trim().optional(),
        chatId: z.string().trim().optional(),
        enabled: z.boolean().optional(),
        enableCertificates: z.boolean().optional(),
        enableGoldMovements: z.boolean().optional(),
        enableZakatHawl: z.boolean().optional(),
        enableWeeklySummary: z.boolean().optional(),
        goldMovementThresholdPct: z.number().min(0.5).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");

      const updates: Record<string, any> = {};

      // Only update botToken if it doesn't contain mask dots
      if (input.botToken && !input.botToken.includes("•")) {
        updates.botToken = input.botToken;
      }
      if (input.chatId !== undefined) updates.chatId = input.chatId;
      if (input.enabled !== undefined) updates.enabled = input.enabled;
      if (input.enableCertificates !== undefined) updates.enableCertificates = input.enableCertificates;
      if (input.enableGoldMovements !== undefined) updates.enableGoldMovements = input.enableGoldMovements;
      if (input.enableZakatHawl !== undefined) updates.enableZakatHawl = input.enableZakatHawl;
      if (input.enableWeeklySummary !== undefined) updates.enableWeeklySummary = input.enableWeeklySummary;
      if (input.goldMovementThresholdPct !== undefined) updates.goldMovementThresholdPct = input.goldMovementThresholdPct;

      const updated = saveTelegramConfig(updates);
      return {
        success: true,
        isConfigured: Boolean(updated.botToken && updated.chatId),
      };
    }),

  sendTestAlert: protectedProcedure
    .input(
      z
        .object({
          botToken: z.string().trim().optional(),
          chatId: z.string().trim().optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");

      const token = input?.botToken && !input.botToken.includes("•") ? input.botToken : undefined;
      const chat = input?.chatId;

      const result = await sendTestAlert(token, chat);
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "تعذر إرسال التنبيه التجريبي عبر تيليجرام. يرجى التحقق من صحة Bot Token و Chat ID.",
        });
      }

      return {
        success: true,
        messageId: result.messageId,
      };
    }),

  runChecks: protectedProcedure.mutation(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    return runAllAlertChecks(family);
  }),

  sendWeeklySummaryNow: protectedProcedure.mutation(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const result = await checkWeeklySummaryAlert(family, true);
    return {
      success: result.length > 0,
      details: result,
    };
  }),
});
