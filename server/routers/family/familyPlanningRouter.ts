import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import {
  getCashFlowSummary,
  getDashboardSummary,
  getEmergencyFundSummary,
  getRiskAllocationSummary,
  listDebtSummaries,
  listPortfolioPositions,
} from "../../familyRead";
import { parseNonNegativeAmount, parsePositiveAmount } from "../../ledgerMath";
import { projectFinancialGoal, projectRetirementPlan } from "../../planningMath";
import { validateAllocationTargets, type AllocationClass } from "../../allocationMath";
import { projectScenario } from "../../scenarioMath";
import { buildMarketSignals } from "../../investmentSignals";
import {
  allocationTargets,
  approvalRequests,
  auditEvents,
  emergencyFundPlans,
  financialGoals,
  planningScenarios,
  retirementPlans,
  riskProfiles,
} from "../../../drizzle/schema";
import { money, notAvailable } from "../../schemas/familySchemas";

export const familyEmergencyFundRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => getEmergencyFundSummary(await ensurePersonalFamilyContext(ctx.user))),

  upsertPlan: protectedProcedure.input(z.object({
    targetMonths: money,
    lookbackMonths: z.number().int().min(1).max(24),
    targetDate: z.number().int().positive().nullable(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const targetMonths = parsePositiveAmount(input.targetMonths, "عدد أشهر الهدف");
    if (targetMonths.gt(60)) throw new TRPCError({ code: "BAD_REQUEST", message: "عدد أشهر هدف الاحتياطي يجب ألا يتجاوز 60." });
    const now = Date.now();
    await db.insert(emergencyFundPlans).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      targetMonths: targetMonths.toFixed(2),
      lookbackMonths: input.lookbackMonths,
      targetDate: input.targetDate,
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        targetMonths: targetMonths.toFixed(2),
        lookbackMonths: input.lookbackMonths,
        targetDate: input.targetDate,
        createdByUserId: ctx.user.id,
        updatedAt: now,
      },
    });
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "emergency_fund_plan.upserted",
      targetType: "emergency_fund_plan",
      targetId: String(family.profile.id),
      beforeState: null,
      afterState: { targetMonths: targetMonths.toFixed(2), lookbackMonths: input.lookbackMonths, targetDate: input.targetDate },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { profileId: family.profile.id };
  }),
});

export const familyGoalsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const [summary, db] = await Promise.all([getDashboardSummary(family), getDb()]);
    if (!db) throw notAvailable();
    const rows = await db.select().from(financialGoals).where(eq(financialGoals.workspaceId, family.workspace.id)).orderBy(desc(financialGoals.createdAt));
    const metrics = { net_worth: summary.netWorthBase, liquid_assets: summary.liquidBalanceBase, investments: summary.investmentValueBase };
    return rows.map(goal => {
      const currentAmount = metrics[goal.metric];
      const target = Number(goal.targetAmount);
      const current = Number(currentAmount);
      const projection = projectFinancialGoal({
        currentAmount,
        targetAmount: goal.targetAmount,
        monthlyContribution: goal.monthlyContribution,
        annualReturnPercent: goal.assumedAnnualReturn,
        annualInflationPercent: goal.assumedAnnualInflation,
        targetDate: goal.targetDate,
        now: Date.now(),
      });
      return {
        ...goal,
        currentAmount,
        progressPercent: target > 0 ? Math.min(Math.round((current / target) * 10_000) / 100, 100) : 0,
        projection,
      };
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(160),
      goalType: z.enum(["emergency_fund", "retirement", "education", "legacy", "custom"]),
      metric: z.enum(["net_worth", "liquid_assets", "investments"]),
      targetAmount: money,
      targetDate: z.number().int().positive().optional().nullable(),
      priority: z.number().int().min(1).max(5).default(3),
      fundingSource: z.enum(["cash_flow", "savings", "investments", "mixed", "other"]).default("cash_flow"),
      monthlyContribution: money.default("0"),
      assumedAnnualReturn: money.default("0"),
      assumedAnnualInflation: money.default("0"),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const targetAmount = parsePositiveAmount(input.targetAmount, "قيمة الهدف");
      const monthlyContribution = parseNonNegativeAmount(input.monthlyContribution, "المساهمة الشهرية");
      const assumedAnnualReturn = parseNonNegativeAmount(input.assumedAnnualReturn, "العائد المفترض");
      const assumedAnnualInflation = parseNonNegativeAmount(input.assumedAnnualInflation, "التضخم المفترض");
      if (assumedAnnualReturn.gt(1000) || assumedAnnualInflation.gt(1000)) throw new TRPCError({ code: "BAD_REQUEST", message: "افتراض العائد أو التضخم غير منطقي." });
      const db = await getDb();
      if (!db) throw notAvailable();
      const now = Date.now();
      const result = await db.insert(financialGoals).values({
        workspaceId: family.workspace.id,
        profileId: family.profile.id,
        name: input.name,
        goalType: input.goalType,
        metric: input.metric,
        targetAmount: targetAmount.toFixed(6),
        currency: family.workspace.baseCurrency,
        targetDate: input.targetDate ?? null,
        priority: input.priority,
        fundingSource: input.fundingSource,
        monthlyContribution: monthlyContribution.toFixed(6),
        assumedAnnualReturn: assumedAnnualReturn.toFixed(6),
        assumedAnnualInflation: assumedAnnualInflation.toFixed(6),
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const id = Number(result[0].insertId);
      await db.insert(auditEvents).values({
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        action: "financial_goal.created",
        targetType: "financial_goal",
        targetId: String(id),
        beforeState: null,
        afterState: {
          name: input.name,
          goalType: input.goalType,
          metric: input.metric,
          targetAmount: targetAmount.toFixed(6),
          currency: family.workspace.baseCurrency,
          priority: input.priority,
          fundingSource: input.fundingSource,
          monthlyContribution: monthlyContribution.toFixed(6),
          assumedAnnualReturn: assumedAnnualReturn.toFixed(6),
          assumedAnnualInflation: assumedAnnualInflation.toFixed(6),
        },
        requestId: crypto.randomUUID(),
        occurredAt: now,
      });
      return { id };
    }),
});

export const familyRetirementRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const [plan] = await db.select().from(retirementPlans).where(and(eq(retirementPlans.workspaceId, family.workspace.id), eq(retirementPlans.profileId, family.profile.id))).limit(1);
    return plan ?? null;
  }),

  upsert: protectedProcedure.input(z.object({
    currentAge: z.number().int().min(0).max(99),
    retirementAge: z.number().int().min(1).max(100),
    currentRetirementAssets: money,
    monthlyContribution: money,
    annualSpending: money,
    safeWithdrawalRate: money,
    assumedAnnualReturn: money,
    assumedAnnualInflation: money,
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    if (input.retirementAge <= input.currentAge) throw new TRPCError({ code: "BAD_REQUEST", message: "عمر التقاعد يجب أن يكون أكبر من العمر الحالي." });
    const currentRetirementAssets = parseNonNegativeAmount(input.currentRetirementAssets, "أصول التقاعد الحالية");
    const monthlyContribution = parseNonNegativeAmount(input.monthlyContribution, "المساهمة الشهرية");
    const annualSpending = parsePositiveAmount(input.annualSpending, "الإنفاق السنوي");
    const safeWithdrawalRate = parsePositiveAmount(input.safeWithdrawalRate, "معدل السحب");
    const assumedAnnualReturn = parseNonNegativeAmount(input.assumedAnnualReturn, "العائد المفترض");
    const assumedAnnualInflation = parseNonNegativeAmount(input.assumedAnnualInflation, "التضخم المفترض");
    if (safeWithdrawalRate.gt(100) || assumedAnnualReturn.gt(1000) || assumedAnnualInflation.gt(1000)) throw new TRPCError({ code: "BAD_REQUEST", message: "أحد الافتراضات المدخلة غير منطقي." });
    const db = await getDb();
    if (!db) throw notAvailable();
    const now = Date.now();
    const values = {
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      currentAge: input.currentAge,
      retirementAge: input.retirementAge,
      currentRetirementAssets: currentRetirementAssets.toFixed(6),
      monthlyContribution: monthlyContribution.toFixed(6),
      annualSpending: annualSpending.toFixed(6),
      safeWithdrawalRate: safeWithdrawalRate.toFixed(6),
      assumedAnnualReturn: assumedAnnualReturn.toFixed(6),
      assumedAnnualInflation: assumedAnnualInflation.toFixed(6),
      currency: family.workspace.baseCurrency,
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(retirementPlans).values(values).onDuplicateKeyUpdate({
      set: {
        currentAge: values.currentAge,
        retirementAge: values.retirementAge,
        currentRetirementAssets: values.currentRetirementAssets,
        monthlyContribution: values.monthlyContribution,
        annualSpending: values.annualSpending,
        safeWithdrawalRate: values.safeWithdrawalRate,
        assumedAnnualReturn: values.assumedAnnualReturn,
        assumedAnnualInflation: values.assumedAnnualInflation,
        currency: values.currency,
        createdByUserId: ctx.user.id,
        updatedAt: now,
      },
    });
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "retirement_plan.upserted",
      targetType: "retirement_plan",
      targetId: String(family.profile.id),
      beforeState: null,
      afterState: values,
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { profileId: family.profile.id };
  }),

  projection: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const [plan] = await db.select().from(retirementPlans).where(and(eq(retirementPlans.workspaceId, family.workspace.id), eq(retirementPlans.profileId, family.profile.id))).limit(1);
    if (!plan) return null;
    return {
      plan,
      projection: projectRetirementPlan({
        currentAge: plan.currentAge,
        retirementAge: plan.retirementAge,
        currentAssets: plan.currentRetirementAssets,
        monthlyContribution: plan.monthlyContribution,
        annualSpending: plan.annualSpending,
        safeWithdrawalRatePercent: plan.safeWithdrawalRate,
        annualReturnPercent: plan.assumedAnnualReturn,
        annualInflationPercent: plan.assumedAnnualInflation,
      }),
    };
  }),
});

export const familyRiskRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => getRiskAllocationSummary(await ensurePersonalFamilyContext(ctx.user))),

  upsertProfile: protectedProcedure.input(z.object({
    riskLevel: z.enum(["conservative", "moderate", "growth", "aggressive"]),
    questionnaireScore: z.number().int().min(0).max(100).nullable(),
    rationale: z.string().trim().max(2000).nullable(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const now = Date.now();
    await db.insert(riskProfiles).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      riskLevel: input.riskLevel,
      questionnaireScore: input.questionnaireScore,
      rationale: input.rationale,
      completedAt: now,
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        riskLevel: input.riskLevel,
        questionnaireScore: input.questionnaireScore,
        rationale: input.rationale,
        completedAt: now,
        createdByUserId: ctx.user.id,
        updatedAt: now,
      },
    });
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "risk_profile.upserted",
      targetType: "risk_profile",
      targetId: String(family.profile.id),
      beforeState: null,
      afterState: input,
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { profileId: family.profile.id };
  }),

  upsertAllocationTargets: protectedProcedure.input(z.object({
    targets: z.array(z.object({
      assetClass: z.enum(["cash", "equity", "fixed_income", "alternatives", "other"]),
      targetPercent: money,
      driftThresholdPercent: money,
    })).length(5),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const parsedTargets = input.targets.map(target => ({
      assetClass: target.assetClass as AllocationClass,
      targetPercent: parseNonNegativeAmount(target.targetPercent, "نسبة التخصيص"),
      driftThresholdPercent: parseNonNegativeAmount(target.driftThresholdPercent, "حد الانحراف"),
    }));
    try {
      validateAllocationTargets(parsedTargets);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تخصيص غير صالح." });
    }
    const db = await getDb();
    if (!db) throw notAvailable();
    const now = Date.now();
    for (const target of parsedTargets) {
      await db.insert(allocationTargets).values({
        workspaceId: family.workspace.id,
        profileId: family.profile.id,
        assetClass: target.assetClass,
        targetPercent: target.targetPercent.toFixed(4),
        driftThresholdPercent: target.driftThresholdPercent.toFixed(4),
        createdByUserId: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      }).onDuplicateKeyUpdate({
        set: {
          targetPercent: target.targetPercent.toFixed(4),
          driftThresholdPercent: target.driftThresholdPercent.toFixed(4),
          createdByUserId: ctx.user.id,
          updatedAt: now,
        },
      });
    }
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "allocation_targets.upserted",
      targetType: "allocation_target",
      targetId: String(family.profile.id),
      beforeState: null,
      afterState: parsedTargets.map(target => ({ assetClass: target.assetClass, targetPercent: target.targetPercent.toFixed(4), driftThresholdPercent: target.driftThresholdPercent.toFixed(4) })),
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { profileId: family.profile.id };
  }),
});

export const familyPlanningSubRouter = router({
  scenarios: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    return db.select().from(planningScenarios).where(and(eq(planningScenarios.workspaceId, family.workspace.id), eq(planningScenarios.status, "active"))).orderBy(planningScenarios.updatedAt);
  }),

  createScenario: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(160),
    scenarioType: z.enum(["debt", "retirement", "emergency", "cash_flow"]),
    monthlyIncome: z.number().min(0),
    monthlyExpense: z.number().min(0),
    liquidReserve: z.number().min(0),
    debtBalance: z.number().min(0),
    annualReturnPercent: z.number().min(-50).max(100),
    annualInflationPercent: z.number().min(-20).max(100),
    months: z.number().int().min(1).max(120),
    annualDebtRatePercent: z.number().min(0).max(100).optional(),
    extraDebtPayment: z.number().min(0).optional(),
    retirementAssets: z.number().min(0).optional(),
    monthlyRetirementContribution: z.number().min(0).optional(),
    retirementAge: z.number().int().min(0).max(120).optional(),
    currentAge: z.number().int().min(0).max(120).optional(),
    retirementAnnualSpending: z.number().min(0).optional(),
    emergencyTargetMonths: z.number().int().min(1).max(24).optional(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const nowDate = new Date();
    const historicalPeriodKeys = Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - 1 - offset, 1));
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    });
    const histories = await Promise.all(historicalPeriodKeys.map(periodKey => getCashFlowSummary(family, periodKey)));
    const historicalMonthlyExpenses = histories.map(item => Number(item.expenseActualBase)).filter(value => Number.isFinite(value) && value >= 0);
    const result = projectScenario({ type: input.scenarioType, ...input, historicalMonthlyExpenses });
    const now = Date.now();
    const assumptions = { ...input, historicalExpenseBasis: { periodKeys: historicalPeriodKeys, sampleMonths: historicalMonthlyExpenses.length, baseCurrency: family.workspace.baseCurrency } };
    const inserted = await db.insert(planningScenarios).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      name: input.name,
      scenarioType: input.scenarioType,
      assumptions,
      result,
      confidence: result.confidence,
      status: "active",
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });
    return { id: Number(inserted[0].insertId), result };
  }),

  marketSignals: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const positions = await listPortfolioPositions(family);
    return buildMarketSignals(positions.map(position => ({
      instrumentId: position.instrumentId,
      instrumentName: position.instrumentName,
      symbol: position.symbol,
      currency: position.currency,
      averageCost: position.averageCost,
      marketPrice: position.marketPrice,
      quoteAsOf: position.quoteAsOf,
      quoteStatus: position.quoteStatus,
    })));
  }),

  decisionCenter: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const date = new Date();
    const currentPeriodKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const [summary, debtItems, pending, cashFlow] = await Promise.all([
      getDashboardSummary(family),
      listDebtSummaries(family),
      db.select({
        id: approvalRequests.id,
        amount: approvalRequests.amount,
        currency: approvalRequests.currency,
        actionType: approvalRequests.actionType,
      }).from(approvalRequests).where(and(eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.status, "pending"))).orderBy(approvalRequests.createdAt),
      getCashFlowSummary(family, currentPeriodKey),
    ]);
    const currency = family.workspace.baseCurrency;
    const signals: Array<{ id: string; impact: number; tone: string; title: string; detail: string; amount: string | null; currency: string | null; actionPath: string }> = [];
    const liquid = new Decimal(summary.liquidBalanceBase || 0);
    const liabilities = new Decimal(summary.liabilityBalanceBase || 0);
    const plannedExpense = new Decimal(cashFlow.expensePlanBase || 0);
    const actualExpense = new Decimal(cashFlow.expenseActualBase || 0);
    if (liquid.lte(0)) signals.push({ id: "liquidity", impact: 100, tone: "danger", title: "سيولة تشغيلية منخفضة", detail: "راجع الحسابات النقدية وخطة الاحتياطي قبل إنشاء التزام جديد.", amount: liquid.toFixed(6), currency, actionPath: "/emergency-fund" });
    if (liabilities.gt(liquid) && liabilities.gt(0)) signals.push({ id: "debt", impact: 85, tone: "warning", title: "الالتزامات تتجاوز السيولة", amount: liabilities.toFixed(6), detail: `${debtItems.filter(item => item.status === "active").length} التزامات نشطة تحتاج مراجعة تدفق السداد.`, currency, actionPath: "/debts" });
    if (plannedExpense.gt(0) && actualExpense.gt(plannedExpense)) {
      const variance = actualExpense.minus(plannedExpense);
      const overspendPercent = variance.div(plannedExpense).mul(100);
      signals.push({ id: `budget-${currentPeriodKey}`, impact: Math.min(95, 72 + Number(overspendPercent)), tone: "warning", title: "انحراف في ميزانية المصروفات", detail: `تجاوزت المصروفات الفعلية خطة ${currentPeriodKey} بمقدار ${variance.toFixed(2)} من عملة الأساس.`, amount: variance.toFixed(6), currency, actionPath: "/cash-flow" });
    }
    for (const item of pending) signals.push({ id: `approval-${item.id}`, impact: 70 + Math.min(20, Number(item.amount || 0) / 100000), tone: "warning", title: "اعتماد عائلي مطلوب", detail: `${item.actionType} بانتظار قرار معتمد`, amount: item.amount, currency: item.currency, actionPath: "/approvals" });
    return signals.sort((a, b) => b.impact - a.impact).slice(0, 3).map((signal, index) => ({ ...signal, priority: index + 1 }));
  }),
});
