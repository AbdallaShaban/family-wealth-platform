import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { parse as parseCookie } from "cookie";
import { protectedProcedure, router } from "../../_core/trpc";
import { ENV } from "../../_core/env";
import { createHeartbeatJob, updateHeartbeatJob } from "../../_core/heartbeat";
import { COOKIE_NAME } from "../../../shared/const";
import { getDb } from "../../db";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { getCashFlowHistory, getCashFlowSummary, getEmergencyFundSummary } from "../../familyRead";
import { parsePositiveAmount } from "../../ledgerMath";
import { requiresApproval } from "../../approvalWorkflowMath";
import { invalidateReadModelCache } from "../../readModelCache";
import {
  accounts,
  approvalPolicies,
  approvalRequests,
  auditEvents,
  budgets,
  cashFlowCategories,
  financialPeriods,
  recurringRules,
} from "../../../drizzle/schema";
import { currency, money, notAvailable } from "../../schemas/familySchemas";

function heartbeatSessionToken(request: { headers: { cookie?: string; authorization?: string } }) {
  const cookieToken = parseCookie(request.headers.cookie ?? "")[COOKIE_NAME];
  const bearerToken = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : undefined;
  const sessionToken = cookieToken || bearerToken;
  if (!sessionToken && ENV.forgeApiUrl) throw new TRPCError({ code: "UNAUTHORIZED", message: "يلزم تسجيل دخول نشط لإنشاء أو تعديل جدول المعاملة المتكررة." });
  return sessionToken || "self-hosted-session";
}

function dailyCronAt(instant: number) {
  const date = new Date(instant);
  return `0 ${date.getUTCMinutes()} ${date.getUTCHours()} * * *`;
}

export const familyCashFlowRouter = router({
  categories: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const activeCategories = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.isArchived, "no"))).orderBy(cashFlowCategories.direction, cashFlowCategories.name);
    return activeCategories.map(category => ({ ...category, isArchived: false as const }));
  }),

  summary: protectedProcedure.input(z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => getCashFlowSummary(await ensurePersonalFamilyContext(ctx.user), input.periodKey)),

  history: protectedProcedure.input(z.object({ months: z.number().int().min(1).max(24).optional() }).optional()).query(async ({ ctx, input }) => getCashFlowHistory(await ensurePersonalFamilyContext(ctx.user), input?.months ?? 6)),

  runway: protectedProcedure.query(async ({ ctx }) => getEmergencyFundSummary(await ensurePersonalFamilyContext(ctx.user))),

  createCategory: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(120),
    direction: z.enum(["income", "expense"]),
    color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    isEssential: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const now = Date.now();
    const result = await db.insert(cashFlowCategories).values({
      workspaceId: family.workspace.id,
      name: input.name,
      direction: input.direction,
      color: input.color ?? null,
      isEssential: input.isEssential ? "yes" : "no",
      isArchived: "no",
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(result[0].insertId);
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "cash_flow_category.created",
      targetType: "cash_flow_category",
      targetId: String(id),
      beforeState: null,
      afterState: input,
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id };
  }),

  updateCategory: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(2).max(120).optional(),
    color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    isEssential: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [existing] = await db
      .select()
      .from(cashFlowCategories)
      .where(and(eq(cashFlowCategories.id, input.id), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.isArchived, "no")))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "التصنيف المالي غير موجود أو مؤرشف." });
    const nextName = input.name ? input.name.trim() : existing.name;
    const nextColor = input.color !== undefined ? input.color : existing.color;
    const nextEssential = input.isEssential !== undefined ? (input.isEssential ? "yes" : "no") : existing.isEssential;
    const now = Date.now();
    await db.update(cashFlowCategories).set({
      name: nextName,
      color: nextColor,
      isEssential: nextEssential,
      updatedAt: now,
    }).where(eq(cashFlowCategories.id, existing.id));
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "cash_flow_category.updated",
      targetType: "cash_flow_category",
      targetId: String(existing.id),
      beforeState: { name: existing.name, color: existing.color, isEssential: existing.isEssential },
      afterState: { name: nextName, color: nextColor, isEssential: nextEssential },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id: existing.id, name: nextName, color: nextColor, isEssential: nextEssential === "yes" };
  }),

  deleteCategory: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [existing] = await db
      .select()
      .from(cashFlowCategories)
      .where(and(eq(cashFlowCategories.id, input.id), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.isArchived, "no")))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "التصنيف المالي غير موجود أو مؤرشف مسبقًا." });
    const now = Date.now();
    await db.update(cashFlowCategories).set({
      isArchived: "yes",
      updatedAt: now,
    }).where(eq(cashFlowCategories.id, existing.id));
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "cash_flow_category.archived",
      targetType: "cash_flow_category",
      targetId: String(existing.id),
      beforeState: { name: existing.name, direction: existing.direction },
      afterState: { isArchived: "yes" },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { success: true, id: existing.id };
  }),

  setEssential: protectedProcedure.input(z.object({ categoryId: z.number().int().positive(), isEssential: z.boolean() })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "owner");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [category] = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.id, input.categoryId), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.direction, "expense"), eq(cashFlowCategories.isArchived, "no"))).limit(1);
    if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "فئة المصروف النشطة غير موجودة ضمن مساحة FAMILY الحالية." });
    const now = Date.now();
    await db.update(cashFlowCategories).set({ isEssential: input.isEssential ? "yes" : "no", updatedAt: now }).where(eq(cashFlowCategories.id, category.id));
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "cash_flow_category.essential_updated",
      targetType: "cash_flow_category",
      targetId: String(category.id),
      beforeState: { isEssential: category.isEssential },
      afterState: { isEssential: input.isEssential ? "yes" : "no" },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id: category.id, isEssential: input.isEssential };
  }),

  budgets: protectedProcedure.input(z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    return db.select({
      id: budgets.id,
      periodKey: budgets.periodKey,
      plannedAmountBase: budgets.plannedAmountBase,
      categoryId: cashFlowCategories.id,
      categoryName: cashFlowCategories.name,
      direction: cashFlowCategories.direction,
      color: cashFlowCategories.color,
    }).from(budgets)
      .innerJoin(cashFlowCategories, eq(budgets.categoryId, cashFlowCategories.id))
      .where(and(eq(budgets.workspaceId, family.workspace.id), eq(budgets.periodKey, input.periodKey)))
      .orderBy(cashFlowCategories.direction, cashFlowCategories.name);
  }),

  upsertBudget: protectedProcedure.input(z.object({
    categoryId: z.number().int().positive(),
    periodKey: z.string().regex(/^\d{4}-\d{2}$/),
    plannedAmountBase: money,
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [category] = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.id, input.categoryId), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.isArchived, "no"))).limit(1);
    if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "فئة الميزانية غير موجودة ضمن نطاقك." });
    const amount = parsePositiveAmount(input.plannedAmountBase, "قيمة الميزانية");
    const [closedPeriod] = await db.select({ id: financialPeriods.id }).from(financialPeriods).where(and(eq(financialPeriods.workspaceId, family.workspace.id), eq(financialPeriods.periodKey, input.periodKey), eq(financialPeriods.status, "closed"))).limit(1);
    if (closedPeriod) {
      const [existingBudget] = await db.select({ plannedAmountBase: budgets.plannedAmountBase }).from(budgets).where(and(eq(budgets.workspaceId, family.workspace.id), eq(budgets.categoryId, category.id), eq(budgets.periodKey, input.periodKey))).limit(1);
      const now = Date.now();
      const settlementKey = `budget-adjustment:${family.workspace.id}:${category.id}:${input.periodKey}:${amount.toFixed(6)}`;
      const [existingRequest] = await db.select({ id: approvalRequests.id }).from(approvalRequests).where(and(
        eq(approvalRequests.workspaceId, family.workspace.id),
        eq(approvalRequests.actionType, "budget_adjustment"),
        eq(approvalRequests.status, "pending"),
        sql`JSON_UNQUOTE(JSON_EXTRACT(${approvalRequests.actionPayload}, '$.idempotencyKey')) = ${settlementKey}`,
      )).limit(1);
      if (existingRequest) return { approvalRequired: true as const, approvalRequestId: existingRequest.id, duplicate: true };
      const policies = await db.select().from(approvalPolicies).where(and(eq(approvalPolicies.workspaceId, family.workspace.id), eq(approvalPolicies.actionType, "budget_adjustment"), eq(approvalPolicies.status, "active")));
      const policy = policies.filter(item => requiresApproval(amount.toFixed(6), item.thresholdAmount, item.currency === family.workspace.baseCurrency)).sort((left, right) => new Decimal(left.thresholdAmount).cmp(right.thresholdAmount))[0];
      const inserted = await db.insert(approvalRequests).values({
        workspaceId: family.workspace.id,
        policyId: policy?.id ?? null,
        requestedByUserId: ctx.user.id,
        actionType: "budget_adjustment",
        actionPayload: {
          operation: "closed_period_budget_settlement",
          categoryId: category.id,
          periodKey: input.periodKey,
          proposedAmountBase: amount.toFixed(6),
          previousAmountBase: existingBudget?.plannedAmountBase ?? null,
          idempotencyKey: settlementKey,
        },
        amount: amount.toFixed(6),
        currency: family.workspace.baseCurrency,
        status: "pending",
        requiredApproverRole: policy?.approverRole ?? "advisor",
        expiresAt: now + 7 * 86_400_000,
        executedEventId: null,
        createdAt: now,
        updatedAt: now,
      });
      const requestId = Number(inserted[0].insertId);
      await db.insert(auditEvents).values({
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        action: "budget.adjustment_requested",
        targetType: "budget",
        targetId: `${category.id}:${input.periodKey}`,
        beforeState: { plannedAmountBase: existingBudget?.plannedAmountBase ?? null },
        afterState: { proposedAmountBase: amount.toFixed(6), approvalRequestId: requestId },
        requestId: crypto.randomUUID(),
        occurredAt: now,
      });
      return { approvalRequired: true as const, approvalRequestId: requestId, duplicate: false };
    }
    const now = Date.now();
    await db.insert(budgets).values({
      workspaceId: family.workspace.id,
      categoryId: category.id,
      periodKey: input.periodKey,
      plannedAmountBase: amount.toFixed(6),
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    }).onDuplicateKeyUpdate({ set: { plannedAmountBase: amount.toFixed(6), createdByUserId: ctx.user.id, updatedAt: now } });
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "budget.upserted",
      targetType: "budget",
      targetId: `${category.id}:${input.periodKey}`,
      beforeState: null,
      afterState: { categoryId: category.id, periodKey: input.periodKey, plannedAmountBase: amount.toFixed(6) },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
    return { approvalRequired: false as const, categoryId: category.id, periodKey: input.periodKey };
  }),

  deleteBudget: protectedProcedure.input(z.object({
    id: z.number().int().positive(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [existing] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, input.id), eq(budgets.workspaceId, family.workspace.id)))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "الميزانية غير موجودة." });
    await db.delete(budgets).where(eq(budgets.id, existing.id));
    invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
    return { success: true, id: existing.id };
  }),

  templates: protectedProcedure.query(async () => [] as Array<{ id: number; name: string; horizonMonths: string; startsPeriodKey: string; spendingLimitBase: string | null; status: string; createdAt: number; updatedAt: number }>),

  recurring: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      return db.select({
        id: recurringRules.id,
        accountId: recurringRules.accountId,
        accountName: accounts.name,
        categoryId: recurringRules.categoryId,
        categoryName: cashFlowCategories.name,
        eventType: recurringRules.eventType,
        amount: recurringRules.amount,
        currency: recurringRules.currency,
        cadence: recurringRules.cadence,
        nextRunAt: recurringRules.nextRunAt,
        endsAt: recurringRules.endsAt,
        status: recurringRules.status,
        memo: recurringRules.memo,
        createdAt: recurringRules.createdAt,
      }).from(recurringRules)
        .innerJoin(accounts, eq(recurringRules.accountId, accounts.id))
        .innerJoin(cashFlowCategories, eq(recurringRules.categoryId, cashFlowCategories.id))
        .where(eq(recurringRules.workspaceId, family.workspace.id))
        .orderBy(desc(recurringRules.createdAt));
    }),

    create: protectedProcedure.input(z.object({
      accountId: z.number().int().positive(),
      categoryId: z.number().int().positive(),
      eventType: z.enum(["income", "expense"]),
      amount: money,
      currency,
      cadence: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
      nextRunAt: z.number().int().positive(),
      endsAt: z.number().int().positive().nullable(),
      memo: z.string().trim().max(2000).nullable(),
    })).mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const amount = parsePositiveAmount(input.amount, "مبلغ المعاملة المتكررة");
      if (input.endsAt !== null && input.endsAt <= input.nextRunAt) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء القاعدة يجب أن يكون بعد أول تشغيل." });
      const [account] = await db.select({ id: accounts.id, currency: accounts.currency }).from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.workspaceId, family.workspace.id), eq(accounts.status, "active"))).limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب المالي غير موجود أو مؤرشف." });
      if (account.currency !== input.currency.toUpperCase()) throw new TRPCError({ code: "BAD_REQUEST", message: "عملة المعاملة المتكررة يجب أن تطابق عملة الحساب." });
      const [category] = await db.select({ id: cashFlowCategories.id, direction: cashFlowCategories.direction }).from(cashFlowCategories).where(and(eq(cashFlowCategories.id, input.categoryId), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.isArchived, "no"))).limit(1);
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "تصنيف التدفق غير موجود أو مؤرشف." });
      if (category.direction !== input.eventType) throw new TRPCError({ code: "BAD_REQUEST", message: "نوع العملية يجب أن يتطابق مع اتجاه التصنيف المالي." });
      const now = Date.now();
      const insertion = await db.insert(recurringRules).values({
        workspaceId: family.workspace.id,
        profileId: family.profile.id,
        accountId: account.id,
        categoryId: category.id,
        eventType: input.eventType,
        amount: amount.toFixed(6),
        currency: input.currency.toUpperCase(),
        cadence: input.cadence,
        nextRunAt: input.nextRunAt,
        endsAt: input.endsAt,
        status: "paused",
        memo: input.memo,
        scheduleCronTaskUid: null,
        createdByUserId: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      });
      const ruleId = Number(insertion[0].insertId);
      try {
        let taskUid = `local-rule-${family.workspace.id}-${ruleId}`;
        let nextExecutionAt: string | null = new Date(input.nextRunAt).toISOString();
        if (ENV.forgeApiUrl && ENV.forgeApiKey) {
          try {
            const job = await createHeartbeatJob({ name: `family-recurring-${family.workspace.id}-${ruleId}`, cron: dailyCronAt(input.nextRunAt), path: "/api/scheduled/recurring", payload: {}, description: `FAMILY recurring rule ${ruleId}` }, heartbeatSessionToken(ctx.req));
            taskUid = job.taskUid;
            nextExecutionAt = job.nextExecutionAt ?? nextExecutionAt;
          } catch (jobErr) {
            console.warn("[Heartbeat] External job scheduling skipped, using self-hosted rule:", jobErr);
          }
        }
        await db.update(recurringRules).set({ status: "active", scheduleCronTaskUid: taskUid, updatedAt: Date.now() }).where(eq(recurringRules.id, ruleId));
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "recurring_rule.created", targetType: "recurring_rule", targetId: String(ruleId), beforeState: null, afterState: { ...input, amount: amount.toFixed(6), scheduleCronTaskUid: taskUid }, requestId: crypto.randomUUID(), occurredAt: Date.now() });
        return { id: ruleId, nextExecutionAt };
      } catch (error) {
        await db.delete(recurringRules).where(eq(recurringRules.id, ruleId));
        throw error;
      }
    }),

    pause: protectedProcedure.input(z.object({ ruleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [rule] = await db.select().from(recurringRules).where(and(eq(recurringRules.id, input.ruleId), eq(recurringRules.workspaceId, family.workspace.id))).limit(1);
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "القاعدة المتكررة غير موجودة ضمن مساحة FAMILY الحالية." });
      if (rule.status !== "active" || !rule.scheduleCronTaskUid) throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد قاعدة نشطة يمكن إيقافها." });
      if (ENV.forgeApiUrl && ENV.forgeApiKey && !rule.scheduleCronTaskUid.startsWith("local-rule-")) {
        try {
          await updateHeartbeatJob(rule.scheduleCronTaskUid, { enable: false }, heartbeatSessionToken(ctx.req));
        } catch (jobErr) {
          console.warn("[Heartbeat] External job pause skipped:", jobErr);
        }
      }
      await db.update(recurringRules).set({ status: "paused", updatedAt: Date.now() }).where(eq(recurringRules.id, rule.id));
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "recurring_rule.paused", targetType: "recurring_rule", targetId: String(rule.id), beforeState: { status: "active" }, afterState: { status: "paused" }, requestId: crypto.randomUUID(), occurredAt: Date.now() });
      return { id: rule.id, status: "paused" as const };
    }),

    resume: protectedProcedure.input(z.object({ ruleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [rule] = await db.select().from(recurringRules).where(and(eq(recurringRules.id, input.ruleId), eq(recurringRules.workspaceId, family.workspace.id))).limit(1);
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "القاعدة المتكررة غير موجودة ضمن مساحة FAMILY الحالية." });
      if (rule.status !== "paused" || !rule.scheduleCronTaskUid) throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد قاعدة موقوفة يمكن استئنافها." });
      if (rule.endsAt !== null && rule.nextRunAt > rule.endsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "انتهت مدة هذه القاعدة ولا يمكن استئنافها." });
      if (ENV.forgeApiUrl && ENV.forgeApiKey && !rule.scheduleCronTaskUid.startsWith("local-rule-")) {
        try {
          await updateHeartbeatJob(rule.scheduleCronTaskUid, { enable: true }, heartbeatSessionToken(ctx.req));
        } catch (jobErr) {
          console.warn("[Heartbeat] External job resume skipped:", jobErr);
        }
      }
      await db.update(recurringRules).set({ status: "active", updatedAt: Date.now() }).where(eq(recurringRules.id, rule.id));
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "recurring_rule.resumed", targetType: "recurring_rule", targetId: String(rule.id), beforeState: { status: "paused" }, afterState: { status: "active" }, requestId: crypto.randomUUID(), occurredAt: Date.now() });
      return { id: rule.id, status: "active" as const };
    }),
  }),
});
