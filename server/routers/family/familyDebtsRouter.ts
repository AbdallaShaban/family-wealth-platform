import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../../_core/trpc";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { createDebt, postDebtPayment } from "../../familyLedger";
import { listDebtSummaries } from "../../familyRead";
import { compareExtraDebtPayment, projectDebtSchedule } from "../../debtMath";
import { currency, idempotencyKey, money, occurredAt } from "../../schemas/familySchemas";

export const familyDebtsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => listDebtSummaries(await ensurePersonalFamilyContext(ctx.user))),

  create: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(160),
    lender: z.string().trim().max(160).nullable(),
    debtType: z.enum(["loan", "credit_card", "mortgage", "personal", "other"]),
    originalPrincipal: money,
    currency,
    annualInterestRate: money,
    minimumPayment: money,
    paymentDay: z.number().int().min(1).max(31).nullable(),
    startDate: z.number().int().positive(),
    maturityDate: z.number().int().positive().nullable(),
    cashAccountId: z.number().int().positive().nullable(),
    cashFlowCategoryId: z.number().int().positive().nullable(),
    memo: z.string().trim().max(2000).nullable(),
    idempotencyKey,
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    return createDebt({ context: family, actorUserId: ctx.user.id, ...input });
  }),

  postPayment: protectedProcedure.input(z.object({
    debtId: z.number().int().positive(),
    cashAccountId: z.number().int().positive(),
    principalAmount: money,
    interestAmount: money.nullable(),
    feeAmount: money.nullable(),
    occurredAt,
    memo: z.string().trim().max(2000).nullable(),
    idempotencyKey,
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    return postDebtPayment({ context: family, actorUserId: ctx.user.id, ...input });
  }),

  projection: protectedProcedure.input(z.object({
    debtId: z.number().int().positive(),
    horizonMonths: z.number().int().min(1).max(600).default(120),
    extraPrincipal: money.optional(),
  })).query(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const debt = (await listDebtSummaries(family)).find(item => item.id === input.debtId);
    if (!debt) throw new TRPCError({ code: "NOT_FOUND", message: "الدين غير موجود ضمن نطاقك المالي." });
    const schedule = projectDebtSchedule({
      outstanding: debt.outstanding,
      annualInterestRatePercent: debt.annualInterestRate,
      monthlyPayment: debt.minimumPayment,
      months: input.horizonMonths,
    });
    const comparison = input.extraPrincipal ? compareExtraDebtPayment({
      outstanding: debt.outstanding,
      annualInterestRatePercent: debt.annualInterestRate,
      monthlyPayment: debt.minimumPayment,
      extraPrincipal: input.extraPrincipal,
    }) : null;
    return { debtId: debt.id, currency: debt.currency, schedule, comparison };
  }),
});
