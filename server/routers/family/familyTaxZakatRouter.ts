import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { getDashboardSummary } from "../../familyRead";
import { parsePositiveAmount } from "../../ledgerMath";
import { suggestTradeCharges } from "../../chargeMath";
import { calculateZakat } from "../../zakatMath";
import {
  auditEvents,
  feeTaxRules,
  financialEvents,
  zakatAssessments,
} from "../../../drizzle/schema";
import { currency, money, notAvailable, occurredAt } from "../../schemas/familySchemas";

export const familyFeeTaxRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    return db.select().from(feeTaxRules).where(and(eq(feeTaxRules.workspaceId, family.workspace.id), eq(feeTaxRules.profileId, family.profile.id))).orderBy(desc(feeTaxRules.updatedAt));
  }),

  preview: protectedProcedure.input(z.object({
    side: z.enum(["buy", "sell"]),
    grossAmount: money,
    currency,
  })).query(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const rules = await db.select({
      name: feeTaxRules.name,
      chargeType: feeTaxRules.chargeType,
      appliesTo: feeTaxRules.appliesTo,
      calculationMethod: feeTaxRules.calculationMethod,
      value: feeTaxRules.value,
      currency: feeTaxRules.currency,
    }).from(feeTaxRules).where(and(eq(feeTaxRules.workspaceId, family.workspace.id), eq(feeTaxRules.profileId, family.profile.id), eq(feeTaxRules.status, "active")));
    return suggestTradeCharges({ side: input.side, grossAmount: parsePositiveAmount(input.grossAmount, "قيمة الصفقة").toFixed(8), currency: input.currency, rules });
  }),

  create: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(160),
    chargeType: z.enum(["fee", "tax"]),
    appliesTo: z.enum(["buy", "sell", "both"]),
    calculationMethod: z.enum(["flat", "percentage"]),
    value: money,
    currency: currency.optional().nullable(),
    jurisdictionNote: z.string().trim().max(4000).nullable(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const value = parsePositiveAmount(input.value, "قيمة القاعدة");
    if (input.calculationMethod === "percentage" && value.gt(100)) throw new TRPCError({ code: "BAD_REQUEST", message: "النسبة المئوية لا يمكن أن تتجاوز 100%." });
    if (input.calculationMethod === "flat" && !input.currency) throw new TRPCError({ code: "BAD_REQUEST", message: "القاعدة الثابتة تتطلب عملة صريحة." });
    if (input.calculationMethod === "percentage" && input.currency) throw new TRPCError({ code: "BAD_REQUEST", message: "القاعدة النسبية لا تتطلب عملة." });
    const db = await getDb();
    if (!db) throw notAvailable();
    const now = Date.now();
    const result = await db.insert(feeTaxRules).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      name: input.name,
      chargeType: input.chargeType,
      appliesTo: input.appliesTo,
      calculationMethod: input.calculationMethod,
      value: value.toFixed(8),
      currency: input.currency?.toUpperCase() ?? null,
      jurisdictionNote: input.jurisdictionNote,
      status: "active",
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(result[0].insertId);
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "fee_tax_rule.created",
      targetType: "fee_tax_rule",
      targetId: String(id),
      beforeState: null,
      afterState: { ...input, value: value.toFixed(8) },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id };
  }),

  archive: protectedProcedure.input(z.object({
    ruleId: z.number().int().positive(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [rule] = await db.select().from(feeTaxRules).where(and(eq(feeTaxRules.id, input.ruleId), eq(feeTaxRules.workspaceId, family.workspace.id), eq(feeTaxRules.profileId, family.profile.id))).limit(1);
    if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "القاعدة غير موجودة ضمن نطاقك المالي." });
    const now = Date.now();
    await db.update(feeTaxRules).set({ status: "archived", updatedAt: now }).where(eq(feeTaxRules.id, rule.id));
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "fee_tax_rule.archived",
      targetType: "fee_tax_rule",
      targetId: String(rule.id),
      beforeState: { status: rule.status },
      afterState: { status: "archived" },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id: rule.id };
  }),
});

export const familyZakatRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    return db.select().from(zakatAssessments).where(and(eq(zakatAssessments.workspaceId, family.workspace.id), eq(zakatAssessments.profileId, family.profile.id))).orderBy(desc(zakatAssessments.assessedAt));
  }),

  calculate: protectedProcedure.input(z.object({
    haulStartedAt: occurredAt,
    goldPricePerGramBase: money,
    goldNisabGrams: money.optional(),
    annualRatePercent: money.optional(),
    calendarType: z.enum(["hijri", "gregorian"]).optional(),
    eligibleAdjustmentBase: z.string().trim().regex(/^-?\d+(\.\d+)?$/).optional(),
    haulCompleted: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const summary = await getDashboardSummary(family);
    const baseEligible = new Decimal(summary.liquidBalanceBase).plus(summary.investmentValueBase);
    const adjustment = new Decimal(input.eligibleAdjustmentBase ?? "0");
    const eligibleBase = Decimal.max(0, baseEligible.plus(adjustment));
    const result = calculateZakat({
      eligibleBase: eligibleBase.toFixed(6),
      goldPricePerGramBase: input.goldPricePerGramBase,
      goldNisabGrams: input.goldNisabGrams,
      annualRatePercent: input.annualRatePercent,
      calendarType: input.calendarType,
      haulCompleted: input.haulCompleted,
    });
    const now = Date.now();
    const inserted = await db.insert(zakatAssessments).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      haulStartedAt: input.haulStartedAt,
      assessedAt: now,
      goldNisabGrams: result.goldNisabGrams,
      goldPricePerGramBase: result.goldPricePerGramBase,
      eligibleBase: result.eligibleBase,
      nisabBase: result.nisabBase,
      zakatDueBase: result.zakatDueBase,
      currency: family.workspace.baseCurrency,
      methodology: {
        baseEligible: baseEligible.toFixed(6),
        adjustment: adjustment.toFixed(6),
        annualRatePercent: result.annualRatePercent,
        calendarType: result.calendarType,
        haulCompleted: result.haulCompleted,
        disclosure: result.disclosure,
      },
      paymentEventId: null,
      status: "calculated",
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(inserted[0].insertId);
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "zakat.calculated",
      targetType: "zakat_assessment",
      targetId: String(id),
      beforeState: null,
      afterState: { eligibleBase: result.eligibleBase, nisabBase: result.nisabBase, zakatDueBase: result.zakatDueBase, currency: family.workspace.baseCurrency },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id, ...result, currency: family.workspace.baseCurrency };
  }),

  markPaid: protectedProcedure.input(z.object({
    assessmentId: z.number().int().positive(),
    financialEventId: z.number().int().positive(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [assessment] = await db.select().from(zakatAssessments).where(and(eq(zakatAssessments.id, input.assessmentId), eq(zakatAssessments.workspaceId, family.workspace.id), eq(zakatAssessments.profileId, family.profile.id), eq(zakatAssessments.status, "calculated"))).limit(1);
    if (!assessment) throw new TRPCError({ code: "NOT_FOUND", message: "تقييم الزكاة القابل للدفع غير موجود ضمن نطاقك." });
    const [event] = await db.select({ id: financialEvents.id, eventType: financialEvents.eventType, currency: financialEvents.currency, grossAmount: financialEvents.grossAmount, status: financialEvents.status }).from(financialEvents).where(and(eq(financialEvents.id, input.financialEventId), eq(financialEvents.workspaceId, family.workspace.id), eq(financialEvents.profileId, family.profile.id), eq(financialEvents.status, "posted"))).limit(1);
    if (!event || event.eventType !== "expense" || event.currency !== assessment.currency || new Decimal(event.grossAmount).lt(assessment.zakatDueBase)) throw new TRPCError({ code: "BAD_REQUEST", message: "اربط التقييم بمصروف دفتر منشور بعملة وقيمة متوافقتين." });
    const now = Date.now();
    await db.transaction(async tx => {
      await tx.update(zakatAssessments).set({ status: "paid", paymentEventId: event.id, updatedAt: now }).where(eq(zakatAssessments.id, assessment.id));
      await tx.insert(auditEvents).values({
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        action: "zakat.marked_paid",
        targetType: "zakat_assessment",
        targetId: String(assessment.id),
        beforeState: { status: "calculated", paymentEventId: null },
        afterState: { status: "paid", paymentEventId: event.id },
        requestId: crypto.randomUUID(),
        occurredAt: now,
      });
    });
    return { id: assessment.id, paymentEventId: event.id };
  }),
});
