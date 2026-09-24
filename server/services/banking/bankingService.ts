import Decimal from "decimal.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import type { FamilyContext } from "../../familyAccess";
import {
  accounts,
  bankCertificates,
  creditCardInstallments,
  debts,
  financialEvents,
  financialProfiles,
  journalLines,
} from "../../../drizzle/schema";
import {
  createDebt,
  createFamilyAccount,
  postCashEvent,
  postDebtPayment,
  reconcileCashAccount,
} from "../../familyLedger";
import { listAccountSnapshots } from "../../familyRead";

export type PayoutFrequency = "monthly" | "quarterly" | "semi_annual" | "annual";

/**
 * Calculates periodic yield based on principal, annual interest rate, and payout frequency
 */
export function calculatePeriodicYield(
  principalAmount: Decimal | string | number,
  annualInterestRate: Decimal | string | number,
  frequency: PayoutFrequency = "monthly"
): {
  annualYield: Decimal;
  periodicYield: Decimal;
  periodsPerYear: number;
} {
  const principal = new Decimal(principalAmount);
  const rawRate = new Decimal(annualInterestRate);
  // Support both 0.235 (23.5%) and 23.5
  const ratePct = rawRate.gt(1) ? rawRate.div(100) : rawRate;
  const annualYield = principal.mul(ratePct);

  let periodsPerYear = 12;
  if (frequency === "quarterly") periodsPerYear = 4;
  else if (frequency === "semi_annual") periodsPerYear = 2;
  else if (frequency === "annual") periodsPerYear = 1;

  const periodicYield = annualYield.div(periodsPerYear);
  return { annualYield, periodicYield, periodsPerYear };
}

/**
 * Calculates days remaining until maturity date
 */
export function getDaysToMaturity(maturityDate: number, now = Date.now()): number {
  if (!maturityDate || maturityDate <= now) return 0;
  const msDiff = maturityDate - now;
  return Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates credit card grace period days remaining
 */
export function getCreditCardGraceDays(dueDay?: number | null, interestFreeDueDate?: number | null, now = Date.now()): number {
  if (interestFreeDueDate && interestFreeDueDate > now) {
    return Math.max(0, Math.ceil((interestFreeDueDate - now) / (1000 * 60 * 60 * 24)));
  }

  const currentDate = new Date(now);
  const targetDay = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : 25;
  const currentDay = currentDate.getDate();

  if (currentDay <= targetDay) {
    return targetDay - currentDay;
  }

  // Next month's due day
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, targetDay);
  return Math.max(0, Math.ceil((nextMonth.getTime() - now) / (1000 * 60 * 60 * 24)));
}

/**
 * 1. Bank Certificates Engine
 */
export async function listBankCertificates(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

  const rows = await db
    .select({
      id: bankCertificates.id,
      certificateName: bankCertificates.certificateName,
      bankName: bankCertificates.bankName,
      principalAmount: bankCertificates.principalAmount,
      interestRate: bankCertificates.interestRate,
      payoutFrequency: bankCertificates.payoutFrequency,
      issueDate: bankCertificates.issueDate,
      maturityDate: bankCertificates.maturityDate,
      linkedPayoutAccountId: bankCertificates.linkedPayoutAccountId,
      currency: bankCertificates.currency,
      status: bankCertificates.status,
      lastYieldCollectedAt: bankCertificates.lastYieldCollectedAt,
      createdAt: bankCertificates.createdAt,
    })
    .from(bankCertificates)
    .where(and(eq(bankCertificates.workspaceId, context.workspace.id)))
    .orderBy(desc(bankCertificates.issueDate));

  const accountsList = await listAccountSnapshots(context);
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));

  const now = Date.now();

  return rows.map((cert) => {
    const principal = new Decimal(cert.principalAmount);
    const rate = new Decimal(cert.interestRate);
    const { annualYield, periodicYield, periodsPerYear } = calculatePeriodicYield(
      principal,
      rate,
      cert.payoutFrequency as PayoutFrequency
    );
    const daysToMaturity = getDaysToMaturity(cert.maturityDate, now);
    const linkedAccount = cert.linkedPayoutAccountId ? accountMap.get(cert.linkedPayoutAccountId) : null;

    return {
      ...cert,
      principalAmount: principal.toFixed(2),
      interestRate: rate.toFixed(2),
      annualYield: annualYield.toFixed(2),
      periodicYield: periodicYield.toFixed(2),
      periodsPerYear,
      daysToMaturity,
      isMatured: daysToMaturity === 0 && cert.status === "active",
      linkedAccountName: linkedAccount?.name ?? null,
      linkedAccountCurrency: linkedAccount?.currency ?? cert.currency,
    };
  });
}

export async function createBankCertificate(args: {
  context: FamilyContext;
  actorUserId: number;
  certificateName: string;
  bankName: string;
  principalAmount: string;
  interestRate: string;
  payoutFrequency: PayoutFrequency;
  issueDate: number;
  maturityDate: number;
  linkedPayoutAccountId?: number | null;
  currency?: string;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

  const principal = new Decimal(args.principalAmount.trim());
  if (principal.lte(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "مبلغ الشهادة يجب أن يكون أكبر من صفر" });

  const rate = new Decimal(args.interestRate.trim());
  if (rate.lte(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "سعر الفائدة يجب أن يكون أكبر من صفر" });

  const now = Date.now();

  const insertResult = await db.insert(bankCertificates).values({
    workspaceId: args.context.workspace.id,
    profileId: args.context.profile.id,
    certificateName: args.certificateName.trim(),
    bankName: args.bankName.trim(),
    principalAmount: principal.toFixed(6),
    interestRate: rate.toFixed(6),
    payoutFrequency: args.payoutFrequency,
    issueDate: args.issueDate,
    maturityDate: args.maturityDate,
    linkedPayoutAccountId: args.linkedPayoutAccountId ?? null,
    currency: args.currency ?? "EGP",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return { id: Number(insertResult[0].insertId), success: true };
}

/**
 * 1-Click Yield Collection: Deposits calculated periodic yield into linked bank account as investment income
 */
export async function collectCertificateYield(args: {
  context: FamilyContext;
  actorUserId: number;
  certificateId: number;
  overrideAmount?: string | null;
  memo?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

  const [cert] = await db
    .select()
    .from(bankCertificates)
    .where(and(eq(bankCertificates.id, args.certificateId), eq(bankCertificates.workspaceId, args.context.workspace.id)))
    .limit(1);

  if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "الشهادة البنكية غير موجودة" });
  if (cert.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "الشهادة غير نشطة حالياً" });
  if (!cert.linkedPayoutAccountId) throw new TRPCError({ code: "BAD_REQUEST", message: "لم يتم تحديد حساب بنكي مرتبط لصرف العائد" });

  const { periodicYield } = calculatePeriodicYield(
    cert.principalAmount,
    cert.interestRate,
    cert.payoutFrequency as PayoutFrequency
  );

  const amountToCollect = args.overrideAmount && args.overrideAmount.trim()
    ? new Decimal(args.overrideAmount.trim())
    : periodicYield;

  if (amountToCollect.lte(0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "مبلغ العائد يجب أن يكون أكبر من صفر" });
  }

  const now = Date.now();
  const memo = args.memo?.trim() || `عائد دوري: ${cert.certificateName} (${cert.bankName})`;

  // Strict double-entry ledger posting (Debit: Bank Account, Credit: Investment Income) inside an atomic transaction
  const event = await postCashEvent({
    context: args.context,
    actorUserId: args.actorUserId,
    accountId: cert.linkedPayoutAccountId,
    eventType: "income",
    amount: amountToCollect.toFixed(6),
    currency: cert.currency,
    occurredAt: now,
    memo,
    idempotencyKey: `yield-${cert.id}-${now}`,
    source: "system_generated",
    afterPosted: async (tx) => {
      // Enforce transactional row-level lock on the certificate record
      await tx.execute(
        sql`SELECT id FROM ${bankCertificates} WHERE ${bankCertificates.id} = ${cert.id} AND ${bankCertificates.workspaceId} = ${args.context.workspace.id} FOR UPDATE`
      );
      await tx
        .update(bankCertificates)
        .set({ lastYieldCollectedAt: now, updatedAt: now })
        .where(eq(bankCertificates.id, cert.id));
    },
  });

  return {
    success: true,
    collectedAmount: amountToCollect.toFixed(2),
    currency: cert.currency,
    linkedAccountId: cert.linkedPayoutAccountId,
    eventId: event.id,
  };
}

/**
 * 2. Credit Card & 0% Installments Engine
 */
export async function listCreditCards(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

  // Debts with debtType = 'credit_card'
  const rows = await db
    .select({
      id: debts.id,
      name: debts.name,
      lender: debts.lender,
      debtType: debts.debtType,
      creditLimit: debts.creditLimit,
      billingCycleDay: debts.billingCycleDay,
      gracePeriodDays: debts.gracePeriodDays,
      interestFreeDueDate: debts.interestFreeDueDate,
      originalPrincipal: debts.originalPrincipal,
      currency: debts.currency,
      annualInterestRate: debts.annualInterestRate,
      minimumPayment: debts.minimumPayment,
      paymentDay: debts.paymentDay,
      startDate: debts.startDate,
      maturityDate: debts.maturityDate,
      status: debts.status,
      liabilityAccountId: debts.liabilityAccountId,
      liabilityAccountName: accounts.name,
      signedBalance: sql<string>`COALESCE(SUM(CASE WHEN ${journalLines.direction} = 'debit' THEN ${journalLines.amount} ELSE -${journalLines.amount} END), 0)`,
    })
    .from(debts)
    .innerJoin(accounts, eq(debts.liabilityAccountId, accounts.id))
    .leftJoin(
      journalLines,
      and(eq(journalLines.workspaceId, context.workspace.id), eq(journalLines.accountId, debts.liabilityAccountId))
    )
    .where(and(eq(debts.workspaceId, context.workspace.id), eq(debts.debtType, "credit_card")))
    .groupBy(
      debts.id,
      debts.name,
      debts.lender,
      debts.debtType,
      debts.creditLimit,
      debts.billingCycleDay,
      debts.gracePeriodDays,
      debts.interestFreeDueDate,
      debts.originalPrincipal,
      debts.currency,
      debts.annualInterestRate,
      debts.minimumPayment,
      debts.paymentDay,
      debts.startDate,
      debts.maturityDate,
      debts.status,
      debts.liabilityAccountId,
      accounts.name
    )
    .orderBy(desc(debts.createdAt));

  // Also query active 0% installment plans
  const installmentRows = await db
    .select()
    .from(creditCardInstallments)
    .where(and(eq(creditCardInstallments.workspaceId, context.workspace.id), eq(creditCardInstallments.status, "active")));

  const installmentsByDebtId = new Map<number, typeof installmentRows>();
  for (const inst of installmentRows) {
    const list = installmentsByDebtId.get(inst.debtId) || [];
    list.push(inst);
    installmentsByDebtId.set(inst.debtId, list);
  }

  const now = Date.now();

  return rows.map((card) => {
    // Current outstanding balance (credit card debt) is the liability account negative balance or originalPrincipal if newly setup
    const ledgerDebt = new Decimal(card.signedBalance).negated();
    const currentBalance = ledgerDebt.gt(0)
      ? ledgerDebt
      : new Decimal(card.originalPrincipal || 0);

    const creditLimit = new Decimal(card.creditLimit || 50000);
    const availableLimit = Decimal.max(0, creditLimit.minus(currentBalance));
    const utilizationRate = creditLimit.gt(0)
      ? currentBalance.div(creditLimit).mul(100).toNumber()
      : 0;

    const graceDaysRemaining = getCreditCardGraceDays(
      card.paymentDay,
      card.interestFreeDueDate,
      now
    );

    const activeInstallments = installmentsByDebtId.get(card.id) || [];
    const monthlyInstallmentsTotal = activeInstallments.reduce(
      (sum, inst) => sum.plus(new Decimal(inst.monthlyAmount)),
      new Decimal(0)
    );

    return {
      ...card,
      creditLimit: creditLimit.toFixed(2),
      currentBalance: currentBalance.toFixed(2),
      availableLimit: availableLimit.toFixed(2),
      utilizationRate: Math.min(100, Math.round(utilizationRate * 10) / 10),
      isOverCeiling: utilizationRate > 30, // 30% credit utilization ceiling warning
      statementDay: card.billingCycleDay || 1,
      dueDay: card.paymentDay || 25,
      minPaymentDue: new Decimal(card.minimumPayment || 0).toFixed(2),
      graceDaysRemaining,
      activeInstallments: activeInstallments.map((inst) => ({
        id: inst.id,
        merchantName: inst.merchantName,
        planName: inst.planName,
        totalAmount: new Decimal(inst.totalAmount).toFixed(2),
        monthlyAmount: new Decimal(inst.monthlyAmount).toFixed(2),
        tenureMonths: inst.tenureMonths,
        remainingMonths: inst.remainingMonths,
        startDate: inst.startDate,
      })),
      monthlyInstallmentsTotal: monthlyInstallmentsTotal.toFixed(2),
    };
  });
}

export async function createCreditCard(args: {
  context: FamilyContext;
  actorUserId: number;
  name: string;
  lender?: string | null;
  creditLimit: string;
  currentBalance?: string | null;
  statementDay?: number | null;
  dueDay?: number | null;
  minPaymentDue?: string | null;
  annualInterestRate?: string | null;
  currency?: string;
}) {
  const creditLimit = new Decimal(args.creditLimit.trim());
  const initialBalance = new Decimal(args.currentBalance?.trim() || 0);
  const minPayment = new Decimal(args.minPaymentDue?.trim() || initialBalance.mul(0.05).toFixed(2));
  const curr = args.currency || "EGP";

  return createDebt({
    context: args.context,
    actorUserId: args.actorUserId,
    name: args.name.trim(),
    lender: args.lender?.trim() || null,
    debtType: "credit_card",
    originalPrincipal: initialBalance.toFixed(6),
    currency: curr,
    annualInterestRate: args.annualInterestRate?.trim() || "0",
    minimumPayment: minPayment.toFixed(6),
    paymentDay: args.dueDay ?? 25,
    startDate: Date.now(),
    maturityDate: null,
    creditLimit: creditLimit.toFixed(6),
    billingCycleDay: args.statementDay ?? 1,
    gracePeriodDays: 55,
    memo: `كارت مشتريات: ${args.name.trim()}`,
    idempotencyKey: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  });
}

export async function createInstallmentPlan(args: {
  context: FamilyContext;
  actorUserId: number;
  debtId: number;
  merchantName: string;
  planName: string;
  totalAmount: string;
  tenureMonths: number;
  remainingMonths?: number | null;
  startDate?: number;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });

  const total = new Decimal(args.totalAmount.trim());
  if (total.lte(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "إجمالي قيمة التقسيط يجب أن يكون أكبر من صفر" });
  if (args.tenureMonths <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "عدد أشهر التقسيط يجب أن يكون أكبر من صفر" });

  const monthlyAmount = total.div(args.tenureMonths);
  const remaining = args.remainingMonths ?? args.tenureMonths;
  const now = Date.now();

  const insertResult = await db.insert(creditCardInstallments).values({
    workspaceId: args.context.workspace.id,
    debtId: args.debtId,
    merchantName: args.merchantName.trim(),
    planName: args.planName.trim(),
    totalAmount: total.toFixed(6),
    monthlyAmount: monthlyAmount.toFixed(6),
    tenureMonths: args.tenureMonths,
    remainingMonths: remaining,
    startDate: args.startDate ?? now,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return { id: Number(insertResult[0].insertId), monthlyAmount: monthlyAmount.toFixed(2), success: true };
}

/**
 * 1-Click Credit Card Settlement: Clears dues directly from a liquid cash account
 */
export async function payCreditCardDue(args: {
  context: FamilyContext;
  actorUserId: number;
  debtId: number;
  cashAccountId: number;
  amount: string;
  memo?: string | null;
}) {
  const now = Date.now();
  return postDebtPayment({
    context: args.context,
    actorUserId: args.actorUserId,
    debtId: args.debtId,
    cashAccountId: args.cashAccountId,
    principalAmount: args.amount,
    interestAmount: "0",
    feeAmount: "0",
    occurredAt: now,
    memo: args.memo?.trim() || "سداد مستحقات كارت المشتريات",
    idempotencyKey: `cc-pay-${args.debtId}-${now}`,
  });
}
