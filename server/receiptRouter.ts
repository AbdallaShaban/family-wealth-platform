import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { assertRole, ensurePersonalFamilyContext } from "./familyAccess";
import {
  analyzeReceiptImage,
  checkReceiptDuplicate,
} from "./services/receiptOcrService";
import { postCashEvent } from "./familyLedger";

export const receiptRouter = router({
  /**
   * Parse clipboard/dropped receipt image and extract structured financial fields
   */
  parseReceiptImage: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string().optional(),
        rawTextFallback: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);

      if (!input.imageBase64 && !input.rawTextFallback) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "يرجى تزويد صورة الإيصال أو النص المستخرج للمطابقة.",
        });
      }

      const result = await analyzeReceiptImage({
        workspaceId: family.workspace.id,
        imageBase64: input.imageBase64,
        rawTextFallback: input.rawTextFallback,
      });

      return result;
    }),

  /**
   * Fast check if a transaction reference already exists in the family ledger
   */
  checkDuplicateReference: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      return await checkReceiptDuplicate(family.workspace.id, input.reference);
    }),

  /**
   * Advisory-First: Post approved receipt to the ledger with full audit trail and double-entry balance
   */
  postApprovedReceipt: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        amount: z.string().min(1),
        currency: z.string().default("EGP"),
        direction: z.enum(["expense", "income", "transfer"]),
        occurredAt: z.number().int().positive(),
        categoryId: z.number().int().positive().optional().nullable(),
        memo: z.string().max(2000).optional().nullable(),
        reference: z.string().max(160).optional().nullable(),
        idempotencyKey: z.string().max(160),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");

      // Verify that reference is not already posted
      if (input.reference) {
        const dupCheck = await checkReceiptDuplicate(family.workspace.id, input.reference);
        if (dupCheck.isDuplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `الرقم المرجعي (${input.reference}) مقيد مسبقاً في الدفاتر برقم قيد #${dupCheck.existingEvent?.id}. لمنع التكرار المحاسبي، لا يمكن تكرار القيد.`,
          });
        }
      }

      // Map direction to cash event type
      const eventType =
        input.direction === "income"
          ? input.categoryId
            ? "income"
            : "deposit"
          : input.categoryId
          ? "expense"
          : "withdrawal";

      const event = await postCashEvent({
        context: family,
        actorUserId: ctx.user.id,
        eventType,
        accountId: input.accountId,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        occurredAt: input.occurredAt,
        categoryId: input.categoryId ?? null,
        memo: input.memo || null,
        idempotencyKey: input.idempotencyKey,
        source: "imported",
        externalRef: input.reference || null,
      });

      return {
        success: true,
        eventId: event.id,
      };
    }),
});
