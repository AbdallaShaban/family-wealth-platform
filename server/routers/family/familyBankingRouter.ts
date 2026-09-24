import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { currency, money } from "../../schemas/familySchemas";
import {
  listBankCertificates,
  createBankCertificate,
  collectCertificateYield,
  listCreditCards,
  createCreditCard,
  createInstallmentPlan,
  payCreditCardDue,
} from "../../services/banking/bankingService";

export const familyCertificatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    return listBankCertificates(family);
  }),

  create: protectedProcedure
    .input(z.object({
      certificateName: z.string().trim().min(2).max(160),
      bankName: z.string().trim().min(2).max(160),
      principalAmount: money,
      interestRate: money,
      payoutFrequency: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).default("monthly"),
      issueDate: z.number().int().positive(),
      maturityDate: z.number().int().positive(),
      linkedPayoutAccountId: z.number().int().positive().optional().nullable(),
      currency: currency.optional().default("EGP"),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      return createBankCertificate({
        context: family,
        actorUserId: ctx.user.id,
        ...input,
      });
    }),

  collectYield: protectedProcedure
    .input(z.object({
      certificateId: z.number().int().positive(),
      overrideAmount: money.optional().nullable(),
      memo: z.string().trim().max(200).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      return collectCertificateYield({
        context: family,
        actorUserId: ctx.user.id,
        certificateId: input.certificateId,
        overrideAmount: input.overrideAmount,
        memo: input.memo,
      });
    }),
});

export const familyCreditCardsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    return listCreditCards(family);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(160),
      lender: z.string().trim().max(160).optional().nullable(),
      creditLimit: money,
      currentBalance: money.optional().nullable(),
      statementDay: z.number().int().min(1).max(31).optional().nullable(),
      dueDay: z.number().int().min(1).max(31).optional().nullable(),
      minPaymentDue: money.optional().nullable(),
      annualInterestRate: money.optional().nullable(),
      currency: currency.optional().default("EGP"),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      return createCreditCard({
        context: family,
        actorUserId: ctx.user.id,
        ...input,
      });
    }),

  createInstallment: protectedProcedure
    .input(z.object({
      debtId: z.number().int().positive(),
      merchantName: z.string().trim().min(2).max(160),
      planName: z.string().trim().min(2).max(160),
      totalAmount: money,
      tenureMonths: z.number().int().positive(),
      remainingMonths: z.number().int().positive().optional().nullable(),
      startDate: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      return createInstallmentPlan({
        context: family,
        actorUserId: ctx.user.id,
        ...input,
      });
    }),

  payDue: protectedProcedure
    .input(z.object({
      debtId: z.number().int().positive(),
      cashAccountId: z.number().int().positive(),
      amount: money,
      memo: z.string().trim().max(200).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      return payCreditCardDue({
        context: family,
        actorUserId: ctx.user.id,
        ...input,
      });
    }),
});
