import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { postCashEvent, postTrade, postTransfer, reverseFinancialEvent } from "../../familyLedger";
import { listRecentEvents } from "../../familyRead";
import { parsePositiveAmount } from "../../ledgerMath";
import { isApprovalExecutable, requiresApproval, type ApprovalActionType } from "../../approvalWorkflowMath";
import {
  approvalPolicies,
  approvalRequests,
  auditEvents,
  financialEvents,
  instruments,
} from "../../../drizzle/schema";
import {
  currency,
  idempotencyKey,
  money,
  notAvailable,
  occurredAt,
  parseTradeTimestamp,
} from "../../schemas/familySchemas";

export async function createFrozenApprovalRequest(args: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  workspaceId: number;
  actorUserId: number;
  actionType: ApprovalActionType;
  amount: string;
  currency: string;
  payload: Record<string, unknown>;
}) {
  const normalizedCurrency = args.currency.toUpperCase();
  const amount = parsePositiveAmount(args.amount);
  const policies = await args.db.select().from(approvalPolicies).where(and(eq(approvalPolicies.workspaceId, args.workspaceId), eq(approvalPolicies.actionType, args.actionType), eq(approvalPolicies.status, "active")));
  const policy = policies
    .filter(item => requiresApproval(amount.toFixed(6), item.thresholdAmount, item.currency === normalizedCurrency))
    .sort((a, b) => new Decimal(a.thresholdAmount).cmp(b.thresholdAmount))[0];
  if (!policy) return null;
  const idempotency = typeof args.payload.idempotencyKey === "string" ? args.payload.idempotencyKey : null;
  if (idempotency) {
    const [existing] = await args.db.select({ id: approvalRequests.id }).from(approvalRequests).where(and(
      eq(approvalRequests.workspaceId, args.workspaceId),
      eq(approvalRequests.actionType, args.actionType),
      sql`JSON_UNQUOTE(JSON_EXTRACT(${approvalRequests.actionPayload}, '$.idempotencyKey')) = ${idempotency}`,
    )).limit(1);
    if (existing) return { id: existing.id, duplicate: true };
  }
  const now = Date.now();
  const inserted = await args.db.insert(approvalRequests).values({
    workspaceId: args.workspaceId,
    policyId: policy.id,
    requestedByUserId: args.actorUserId,
    actionType: args.actionType,
    actionPayload: { ...args.payload, currency: normalizedCurrency },
    amount: amount.toFixed(6),
    currency: normalizedCurrency,
    status: "pending",
    requiredApproverRole: policy.approverRole,
    expiresAt: now + 7 * 86_400_000,
    executedEventId: null,
    createdAt: now,
    updatedAt: now,
  });
  const id = Number(inserted[0].insertId);
  await args.db.insert(auditEvents).values({
    workspaceId: args.workspaceId,
    actorUserId: args.actorUserId,
    action: "approval_request.created",
    targetType: "approval_request",
    targetId: String(id),
    beforeState: null,
    afterState: { policyId: policy.id, actionType: args.actionType, amount: amount.toFixed(6), currency: normalizedCurrency },
    requestId: crypto.randomUUID(),
    occurredAt: now,
  });
  return { id, duplicate: false };
}

export const familyLedgerRouter = router({
  recent: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
    .query(async ({ ctx, input }) => listRecentEvents(await ensurePersonalFamilyContext(ctx.user), input?.limit ?? 50)),

  deleteTransaction: protectedProcedure
    .input(z.object({
      id: z.number().int().positive("معرف العملية مطلوب"),
      reason: z.string().trim().max(500).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      return reverseFinancialEvent({
        context: family,
        actorUserId: ctx.user.id,
        eventId: input.id,
        reason: input.reason ?? null,
      });
    }),

  updateTransaction: protectedProcedure
    .input(z.object({
      id: z.number().int().positive("معرف العملية مطلوب"),
      accountId: z.number().int().positive().optional(),
      quantity: money,
      unitPrice: money,
      feeAmount: money.optional().nullable(),
      taxAmount: money.optional().nullable(),
      occurredAt: occurredAt.optional(),
      date: z.string().or(z.date()).optional().nullable(),
      memo: z.string().trim().max(2000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();

      const [origEvent] = await db
        .select()
        .from(financialEvents)
        .where(and(
          eq(financialEvents.id, input.id),
          eq(financialEvents.workspaceId, family.workspace.id),
          eq(financialEvents.status, "posted"),
        ))
        .limit(1);

      if (!origEvent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "العملية غير موجودة أو تم إلغاؤها مسبقًا.",
        });
      }

      if (!["buy", "sell"].includes(origEvent.eventType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "تعديل الصفقات متاح لعمليات الشراء والبيع الاستثمارية فقط.",
        });
      }

      const targetAccountId = input.accountId ?? origEvent.primaryAccountId;
      if (!targetAccountId || !origEvent.instrumentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "بيانات الحساب أو الأداة المالية غير مكتملة في العملية الأصلية.",
        });
      }

      await reverseFinancialEvent({
        context: family,
        actorUserId: ctx.user.id,
        eventId: input.id,
        reason: `تعديل واستبدال الصفقة #${input.id}`,
      });

      const resolvedOccurredAt = parseTradeTimestamp({ date: input.date, occurredAt: input.occurredAt ?? origEvent.occurredAt });
      const newEvent = await postTrade({
        context: family,
        actorUserId: ctx.user.id,
        side: origEvent.eventType as "buy" | "sell",
        accountId: targetAccountId,
        instrumentId: origEvent.instrumentId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        feeAmount: input.feeAmount,
        taxAmount: input.taxAmount,
        occurredAt: resolvedOccurredAt,
        memo: input.memo !== undefined ? input.memo : origEvent.memo,
        idempotencyKey: `mod-${input.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      return { success: true, originalId: input.id, newEvent };
    }),

  updateCashTransaction: protectedProcedure
    .input(z.object({
      id: z.number().int().positive("معرف العملية مطلوب"),
      accountId: z.number().int().positive().optional(),
      amount: money,
      occurredAt,
      categoryId: z.number().int().positive().optional().nullable(),
      memo: z.string().trim().max(2000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();

      const [origEvent] = await db
        .select()
        .from(financialEvents)
        .where(and(
          eq(financialEvents.id, input.id),
          eq(financialEvents.workspaceId, family.workspace.id),
          eq(financialEvents.status, "posted"),
        ))
        .limit(1);

      if (!origEvent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "العملية النقدية غير موجودة أو تم إلغاؤها مسبقًا.",
        });
      }

      if (!["income", "expense", "deposit", "withdrawal"].includes(origEvent.eventType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "هذا الإجراء مخصص للمعاملات النقدية (دخل، مصروف، إيداع، سحب).",
        });
      }

      const targetAccountId = input.accountId ?? origEvent.primaryAccountId;
      if (!targetAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "الحساب المالي مطلوب.",
        });
      }

      await reverseFinancialEvent({
        context: family,
        actorUserId: ctx.user.id,
        eventId: input.id,
        reason: `تعديل واستبدال المعاملة النقدية #${input.id}`,
      });

      const replacement = await postCashEvent({
        context: family,
        actorUserId: ctx.user.id,
        eventType: origEvent.eventType as "income" | "expense" | "deposit" | "withdrawal",
        accountId: targetAccountId,
        amount: input.amount,
        currency: origEvent.currency,
        occurredAt: input.occurredAt,
        categoryId: input.categoryId !== undefined ? input.categoryId : origEvent.categoryId,
        memo: input.memo !== undefined ? input.memo : origEvent.memo,
        idempotencyKey: `mod-cash-${input.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      return { success: true, originalId: input.id, replacement };
    }),

  postCash: protectedProcedure
    .input(z.object({
      eventType: z.enum(["opening_balance", "deposit", "withdrawal", "income", "expense"]),
      accountId: z.number().int().positive(),
      amount: money,
      currency,
      occurredAt,
      categoryId: z.number().int().positive().optional().nullable(),
      memo: z.string().trim().max(2_000).optional().nullable(),
      idempotencyKey,
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const normalizedCurrency = input.currency.toUpperCase();
      const amount = parsePositiveAmount(input.amount);
      const policies = await db.select().from(approvalPolicies).where(and(eq(approvalPolicies.workspaceId, family.workspace.id), eq(approvalPolicies.actionType, "cash_event"), eq(approvalPolicies.status, "active")));
      const policy = policies.filter(item => item.currency === normalizedCurrency).sort((a, b) => new Decimal(a.thresholdAmount).cmp(b.thresholdAmount)).find(item => amount.gte(new Decimal(item.thresholdAmount)));
      if (policy) {
        const now = Date.now();
        const inserted = await db.insert(approvalRequests).values({
          workspaceId: family.workspace.id,
          policyId: policy.id,
          requestedByUserId: ctx.user.id,
          actionType: "cash_event",
          actionPayload: { ...input, currency: normalizedCurrency },
          amount: amount.toFixed(6),
          currency: normalizedCurrency,
          status: "pending",
          requiredApproverRole: policy.approverRole,
          expiresAt: now + 7 * 86400000,
          executedEventId: null,
          createdAt: now,
          updatedAt: now,
        });
        const requestId = Number(inserted[0].insertId);
        await db.insert(auditEvents).values({
          workspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          action: "approval_request.created",
          targetType: "approval_request",
          targetId: String(requestId),
          beforeState: null,
          afterState: { policyId: policy.id, amount: amount.toFixed(6), currency: normalizedCurrency },
          requestId: crypto.randomUUID(),
          occurredAt: now,
        });
        return { approvalRequired: true as const, approvalRequestId: requestId };
      }
      const event = await postCashEvent({ context: family, actorUserId: ctx.user.id, ...input, currency: normalizedCurrency });
      return { approvalRequired: false as const, event };
    }),

  executeApprovedCash: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.actionType, "cash_event"), eq(approvalRequests.status, "approved"))).limit(1);
    if (!request) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد طلب اعتماد نقدي موافق عليه وقابل للتنفيذ." });
    const payload = request.actionPayload as Record<string, unknown>;
    const eventType = payload.eventType;
    const accountId = payload.accountId;
    const amount = payload.amount;
    const currencyValue = payload.currency;
    const occurred = payload.occurredAt;
    const key = payload.idempotencyKey;
    if (!(["opening_balance", "deposit", "withdrawal", "income", "expense"].includes(String(eventType)) && Number.isInteger(accountId) && typeof amount === "string" && typeof currencyValue === "string" && Number.isInteger(occurred) && typeof key === "string")) throw new TRPCError({ code: "BAD_REQUEST", message: "البيانات المجمدة في طلب الاعتماد غير صالحة." });
    const event = await postCashEvent({ context: family, actorUserId: ctx.user.id, eventType: eventType as "opening_balance" | "deposit" | "withdrawal" | "income" | "expense", accountId: accountId as number, amount, currency: currencyValue, occurredAt: occurred as number, categoryId: typeof payload.categoryId === "number" ? payload.categoryId : null, memo: typeof payload.memo === "string" ? payload.memo : null, idempotencyKey: key });
    await db.update(approvalRequests).set({ status: "executed", executedEventId: event.id, updatedAt: Date.now() }).where(eq(approvalRequests.id, request.id));
    return { eventId: event.id };
  }),

  executeApprovedTransfer: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.actionType, "transfer"))).limit(1);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "طلب التحويل غير موجود ضمن مساحة FAMILY الحالية." });
    const now = Date.now();
    if (!isApprovalExecutable({ status: request.status, expiresAt: request.expiresAt, nowMs: now })) {
      if (request.status === "approved" && request.expiresAt !== null && request.expiresAt <= now) await db.update(approvalRequests).set({ status: "expired", updatedAt: now }).where(eq(approvalRequests.id, request.id));
      throw new TRPCError({ code: "BAD_REQUEST", message: "طلب التحويل غير موافق عليه أو انتهت صلاحيته أو تم تنفيذه سابقًا." });
    }
    const payload = request.actionPayload as Record<string, unknown>;
    if (!(Number.isInteger(payload.fromAccountId) && Number.isInteger(payload.toAccountId) && typeof payload.amount === "string" && typeof payload.currency === "string" && Number.isInteger(payload.occurredAt) && typeof payload.idempotencyKey === "string")) throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات التحويل المجمدة في طلب الاعتماد غير صالحة." });
    const event = await postTransfer({ context: family, actorUserId: ctx.user.id, fromAccountId: payload.fromAccountId as number, toAccountId: payload.toAccountId as number, amount: payload.amount, currency: payload.currency, occurredAt: payload.occurredAt as number, memo: typeof payload.memo === "string" ? payload.memo : null, idempotencyKey: payload.idempotencyKey });
    await db.update(approvalRequests).set({ status: "executed", executedEventId: event.id, updatedAt: Date.now() }).where(and(eq(approvalRequests.id, request.id), eq(approvalRequests.status, "approved")));
    return { eventId: event.id, duplicate: event.duplicate };
  }),

  executeApprovedTrade: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.actionType, "trade"))).limit(1);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "طلب التداول غير موجود ضمن مساحة FAMILY الحالية." });
    const now = Date.now();
    if (!isApprovalExecutable({ status: request.status, expiresAt: request.expiresAt, nowMs: now })) {
      if (request.status === "approved" && request.expiresAt !== null && request.expiresAt <= now) await db.update(approvalRequests).set({ status: "expired", updatedAt: now }).where(eq(approvalRequests.id, request.id));
      throw new TRPCError({ code: "BAD_REQUEST", message: "طلب التداول غير موافق عليه أو انتهت صلاحيته أو تم تنفيذه سابقًا." });
    }
    const payload = request.actionPayload as Record<string, unknown>;
    if (!(["buy", "sell"].includes(String(payload.side)) && Number.isInteger(payload.accountId) && Number.isInteger(payload.instrumentId) && typeof payload.quantity === "string" && typeof payload.unitPrice === "string" && Number.isInteger(payload.occurredAt) && typeof payload.idempotencyKey === "string")) throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات التداول المجمدة في طلب الاعتماد غير صالحة." });
    const event = await postTrade({ context: family, actorUserId: ctx.user.id, side: payload.side as "buy" | "sell", accountId: payload.accountId as number, instrumentId: payload.instrumentId as number, quantity: payload.quantity, unitPrice: payload.unitPrice, feeAmount: typeof payload.feeAmount === "string" ? payload.feeAmount : null, taxAmount: typeof payload.taxAmount === "string" ? payload.taxAmount : null, feeRuleId: Number.isInteger(payload.feeRuleId) ? payload.feeRuleId as number : null, taxRuleId: Number.isInteger(payload.taxRuleId) ? payload.taxRuleId as number : null, occurredAt: payload.occurredAt as number, memo: typeof payload.memo === "string" ? payload.memo : null, idempotencyKey: payload.idempotencyKey });
    await db.update(approvalRequests).set({ status: "executed", executedEventId: event.id, updatedAt: Date.now() }).where(and(eq(approvalRequests.id, request.id), eq(approvalRequests.status, "approved")));
    return { eventId: event.id, duplicate: event.duplicate };
  }),

  transfer: protectedProcedure
    .input(z.object({
      fromAccountId: z.number().int().positive(),
      toAccountId: z.number().int().positive(),
      amount: money,
      currency,
      occurredAt,
      memo: z.string().trim().max(2_000).optional().nullable(),
      idempotencyKey,
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const normalizedCurrency = input.currency.toUpperCase();
      const frozen = await createFrozenApprovalRequest({
        db,
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        actionType: "transfer",
        amount: input.amount,
        currency: normalizedCurrency,
        payload: { ...input, currency: normalizedCurrency },
      });
      if (frozen) return { approvalRequired: true as const, approvalRequestId: frozen.id, duplicate: frozen.duplicate };
      const event = await postTransfer({ context: family, actorUserId: ctx.user.id, ...input, currency: normalizedCurrency });
      return { approvalRequired: false as const, event };
    }),

  trade: protectedProcedure
    .input(z.object({
      side: z.enum(["buy", "sell"]),
      accountId: z.number().int().positive(),
      instrumentId: z.number().int().positive(),
      quantity: money,
      unitPrice: money,
      feeAmount: money.optional().nullable(),
      taxAmount: money.optional().nullable(),
      feeRuleId: z.number().int().positive().optional().nullable(),
      taxRuleId: z.number().int().positive().optional().nullable(),
      occurredAt: occurredAt.optional(),
      date: z.string().or(z.date()).optional().nullable(),
      memo: z.string().trim().max(2_000).optional().nullable(),
      idempotencyKey,
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [instrument] = await db.select({ id: instruments.id, currency: instruments.currency }).from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id))).limit(1);
      if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن مساحة FAMILY الحالية." });
      const resolvedOccurredAt = parseTradeTimestamp(input);
      const grossAmount = parsePositiveAmount(input.quantity, "الكمية").mul(parsePositiveAmount(input.unitPrice, "سعر الوحدة"));
      const frozen = await createFrozenApprovalRequest({
        db,
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        actionType: "trade",
        amount: grossAmount.toFixed(6),
        currency: instrument.currency,
        payload: { ...input, occurredAt: resolvedOccurredAt, currency: instrument.currency, grossAmount: grossAmount.toFixed(6) },
      });
      if (frozen) return { approvalRequired: true as const, approvalRequestId: frozen.id, duplicate: frozen.duplicate };
      const event = await postTrade({ context: family, actorUserId: ctx.user.id, ...input, occurredAt: resolvedOccurredAt });
      return { approvalRequired: false as const, event };
    }),

  recordTrade: protectedProcedure
    .input(z.object({
      side: z.enum(["buy", "sell"]),
      accountId: z.number().int().positive(),
      instrumentId: z.number().int().positive(),
      quantity: money,
      unitPrice: money,
      feeAmount: money.optional().nullable(),
      taxAmount: money.optional().nullable(),
      feeRuleId: z.number().int().positive().optional().nullable(),
      taxRuleId: z.number().int().positive().optional().nullable(),
      occurredAt: occurredAt.optional(),
      date: z.string().or(z.date()).optional().nullable(),
      memo: z.string().trim().max(2_000).optional().nullable(),
      idempotencyKey,
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [instrument] = await db.select({ id: instruments.id, currency: instruments.currency }).from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id))).limit(1);
      if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن مساحة FAMILY الحالية." });
      const resolvedOccurredAt = parseTradeTimestamp(input);
      const grossAmount = parsePositiveAmount(input.quantity, "الكمية").mul(parsePositiveAmount(input.unitPrice, "سعر الوحدة"));
      const frozen = await createFrozenApprovalRequest({
        db,
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        actionType: "trade",
        amount: grossAmount.toFixed(6),
        currency: instrument.currency,
        payload: { ...input, occurredAt: resolvedOccurredAt, currency: instrument.currency, grossAmount: grossAmount.toFixed(6) },
      });
      if (frozen) return { approvalRequired: true as const, approvalRequestId: frozen.id, duplicate: frozen.duplicate };
      const event = await postTrade({ context: family, actorUserId: ctx.user.id, ...input, occurredAt: resolvedOccurredAt });
      return { approvalRequired: false as const, event };
    }),

  postDividend: protectedProcedure
    .input(z.object({
      accountId: z.number().int().positive(),
      instrumentId: z.number().int().positive(),
      amount: money,
      currency,
      occurredAt,
      memo: z.string().trim().max(2_000).optional().nullable(),
      idempotencyKey,
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [instrument] = await db
        .select({ id: instruments.id, name: instruments.name, symbol: instruments.symbol, currency: instruments.currency })
        .from(instruments)
        .where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id)))
        .limit(1);
      if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن مساحة FAMILY." });
      const dividendMemo = input.memo || `توزيع أرباح نقدية: ${instrument.name} (${instrument.symbol || ""})`;
      const event = await postCashEvent({
        context: family,
        actorUserId: ctx.user.id,
        eventType: "income",
        accountId: input.accountId,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        occurredAt: input.occurredAt,
        memo: dividendMemo,
        idempotencyKey: input.idempotencyKey,
      });
      return { eventId: event.id };
    }),
});
