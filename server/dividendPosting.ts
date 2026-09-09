import { and, asc, eq, lte, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import type { FamilyContext } from "./familyAccess";
import {
  accounts,
  auditEvents,
  financialEvents,
  financialPeriods,
  instruments,
  investmentLots,
  journalEntries,
  journalLines,
} from "../drizzle/schema";
import { assertBalanced, parseNonNegativeAmount, parsePositiveAmount, type JournalDraftLine } from "./ledgerMath";
import { invalidateReadModelCache } from "./readModelCache";

export type PostCashDividendArgs = {
  context: FamilyContext;
  actorUserId: number;
  instrumentId: number;
  cashAccountId: number;
  dividendPerShare: string;
  exDate: number;
  paymentDate: number;
  taxAmount?: string | null;
  memo?: string | null;
  idempotencyKey: string;
};

export type CashDividendResult = {
  eventId: number;
  instrumentId: number;
  symbol: string;
  totalEligibleShares: string;
  dividendPerShare: string;
  grossAmount: string;
  taxAmount: string;
  netCashAmount: string;
  currency: string;
  cashAccountId: number;
  paymentDate: number;
  duplicate?: boolean;
};

export function calculateCashDividendDistribution(params: {
  totalEligibleShares: Decimal;
  dividendPerShare: Decimal;
  taxAmount: Decimal;
}) {
  if (params.totalEligibleShares.lte(0)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "لا توجد حيازات أسهم مفتوحة مؤهلة لتوزيعات الأرباح في تاريخ الاستحقاق المحدد.",
    });
  }
  const grossAmount = params.totalEligibleShares.mul(params.dividendPerShare);
  if (params.taxAmount.gte(grossAmount)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "قيمة الضريبة المستقطعة لا يمكن أن تتجاوز أو تعادل إجمالي التوزيعات.",
    });
  }
  const netCashAmount = grossAmount.minus(params.taxAmount);
  return {
    grossAmount,
    taxAmount: params.taxAmount,
    netCashAmount,
  };
}

export function buildDividendJournalLines(params: {
  cashAccountId: number;
  dividendIncomeAccountId: number;
  withholdingTaxAccountId?: number | null;
  grossAmount: Decimal;
  taxAmount: Decimal;
  netCashAmount: Decimal;
  currency: string;
}): JournalDraftLine[] {
  const lines: JournalDraftLine[] = [
    // Line 1: Debit Cash Account for net cash received
    {
      accountId: params.cashAccountId,
      direction: "debit",
      amount: params.netCashAmount,
      currency: params.currency,
      fxRateToBase: new Decimal(1),
      baseAmount: params.netCashAmount,
    },
    // Line 2: Credit Dividend Income System Account for gross dividend
    {
      accountId: params.dividendIncomeAccountId,
      direction: "credit",
      amount: params.grossAmount,
      currency: params.currency,
      fxRateToBase: new Decimal(1),
      baseAmount: params.grossAmount,
    },
  ];

  // Line 3: If tax withheld, Debit Tax Expense Account
  if (params.taxAmount.gt(0) && params.withholdingTaxAccountId) {
    lines.push({
      accountId: params.withholdingTaxAccountId,
      direction: "debit",
      amount: params.taxAmount,
      currency: params.currency,
      fxRateToBase: new Decimal(1),
      baseAmount: params.taxAmount,
    });
  }

  // Strict Double-Entry Balance Verification
  assertBalanced(lines);
  return lines;
}

async function ensureSystemAccount(
  tx: any,
  workspaceId: number,
  currency: string,
  code: string,
  name: string,
  accountType: "equity" | "income" | "expense" | "asset" | "clearing"
) {
  const now = Date.now();
  await tx
    .insert(accounts)
    .values({
      workspaceId,
      ownerProfileId: null,
      name,
      accountCode: code,
      accountType,
      currency,
      institution: null,
      status: "active",
      isSystemAccount: "yes",
      createdAt: now,
      updatedAt: now,
    })
    .onDuplicateKeyUpdate({ set: { updatedAt: now } });

  const [account] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.workspaceId, workspaceId), eq(accounts.accountCode, code)))
    .limit(1);

  if (!account) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء حساب دفتر النظام لتوزيعات الأرباح." });
  }
  return account;
}

export async function postCashDividend(args: PostCashDividendArgs): Promise<CashDividendResult> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة." });

  const dividendPerShare = parsePositiveAmount(args.dividendPerShare, "عائد السهم الواحد");
  const taxAmount = parseNonNegativeAmount(args.taxAmount ?? "0", "ضريبة الاستقطاع");
  const idempotencyKey = args.idempotencyKey?.trim();

  if (!idempotencyKey || idempotencyKey.length < 16) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "مفتاح فرادة العملية (Idempotency Key) غير صالح." });
  }

  if (args.exDate > args.paymentDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ الاستحقاق (Ex-Date) لا يمكن أن يكون بعد تاريخ الصرف (Payment Date)." });
  }

  const workspaceId = args.context.workspace.id;

  return db.transaction(async tx => {
    // 1. Idempotency check
    const [existing] = await tx
      .select({
        id: financialEvents.id,
        grossAmount: financialEvents.grossAmount,
        taxAmount: financialEvents.taxAmount,
        currency: financialEvents.currency,
      })
      .from(financialEvents)
      .where(and(eq(financialEvents.workspaceId, workspaceId), eq(financialEvents.idempotencyKey, idempotencyKey)))
      .limit(1);

    if (existing) {
      const [instrument] = await tx.select().from(instruments).where(eq(instruments.id, args.instrumentId)).limit(1);
      return {
        eventId: existing.id,
        instrumentId: args.instrumentId,
        symbol: instrument?.symbol || "",
        totalEligibleShares: "0",
        dividendPerShare: dividendPerShare.toFixed(8),
        grossAmount: existing.grossAmount,
        taxAmount: existing.taxAmount,
        netCashAmount: new Decimal(existing.grossAmount).minus(existing.taxAmount).toFixed(6),
        currency: existing.currency,
        cashAccountId: args.cashAccountId,
        paymentDate: args.paymentDate,
        duplicate: true,
      };
    }

    // 2. Closed-period check
    const paymentDateObj = new Date(args.paymentDate);
    const periodKey = `${paymentDateObj.getUTCFullYear()}-${String(paymentDateObj.getUTCMonth() + 1).padStart(2, "0")}`;
    const [closedPeriod] = await tx
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(and(eq(financialPeriods.workspaceId, workspaceId), eq(financialPeriods.periodKey, periodKey), eq(financialPeriods.status, "closed")))
      .limit(1);

    if (closedPeriod) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `الفترة المالية المقابلة لتاريخ الصرف (${periodKey}) مغلقة ومحمية من أي قيد جديد.`,
      });
    }

    // 3. Lock cash account and instrument
    await tx.execute(sql`SELECT id FROM ${accounts} WHERE ${accounts.id} = ${args.cashAccountId} AND ${accounts.workspaceId} = ${workspaceId} FOR UPDATE`);
    const [cashAccount] = await tx.select().from(accounts).where(and(eq(accounts.id, args.cashAccountId), eq(accounts.workspaceId, workspaceId))).limit(1);
    if (!cashAccount || cashAccount.status !== "active") {
      throw new TRPCError({ code: "NOT_FOUND", message: "حساب استلام التوزيعات النقدية غير موجود أو مؤرشف." });
    }

    if (!["cash", "bank", "brokerage", "wallet"].includes(cashAccount.accountType)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "حساب استلام التوزيعات يجب أن يكون حسابًا نقديًا أو مصرفيًا أو حساب وساطة." });
    }

    await tx.execute(sql`SELECT id FROM ${instruments} WHERE ${instruments.id} = ${args.instrumentId} AND ${instruments.workspaceId} = ${workspaceId} FOR UPDATE`);
    const [instrument] = await tx.select().from(instruments).where(and(eq(instruments.id, args.instrumentId), eq(instruments.workspaceId, workspaceId))).limit(1);
    if (!instrument) {
      throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن مساحة العمل." });
    }

    if (cashAccount.currency !== instrument.currency) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `عملة حساب النقد (${cashAccount.currency}) يجب أن تطابق عملة توزيعات الأداة (${instrument.currency}).`,
      });
    }

    // 4. Derive eligible active lots on or before exDate
    const openLots = await tx
      .select()
      .from(investmentLots)
      .where(
        and(
          eq(investmentLots.workspaceId, workspaceId),
          eq(investmentLots.instrumentId, instrument.id),
          lte(investmentLots.acquiredAt, args.exDate),
          eq(investmentLots.status, "open")
        )
      )
      .orderBy(asc(investmentLots.acquiredAt), asc(investmentLots.id));

    const totalEligibleShares = openLots.reduce((sum, lot) => sum.plus(new Decimal(lot.remainingQuantity)), new Decimal(0));

    if (totalEligibleShares.lte(0)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `لا توجد حيازات أسهم مفتوحة مؤهلة لتوزيعات الأرباح في تاريخ الاستحقاق المحدد (${new Date(args.exDate).toLocaleDateString("ar-EG")}).`,
      });
    }

    // 5. Compute gross, tax, and net amounts
    const { grossAmount, taxAmount: effectiveTaxAmount, netCashAmount } = calculateCashDividendDistribution({
      totalEligibleShares,
      dividendPerShare,
      taxAmount,
    });

    // 6. Ensure system accounts
    const currency = instrument.currency;
    const dividendIncomeAccount = await ensureSystemAccount(
      tx,
      workspaceId,
      currency,
      `DIVIDEND_INCOME:${currency}`,
      `إيرادات توزيعات الأرباح (${currency})`,
      "income"
    );

    let withholdingTaxAccount: typeof accounts.$inferSelect | null = null;
    if (effectiveTaxAmount.gt(0)) {
      withholdingTaxAccount = await ensureSystemAccount(
        tx,
        workspaceId,
        currency,
        `WITHHOLDING_TAX_EXPENSE:${currency}`,
        `مصروف ضريبة استقطاع الأرباح (${currency})`,
        "expense"
      );
    }

    // 7. Double-entry draft lines
    const draftLines = buildDividendJournalLines({
      cashAccountId: cashAccount.id,
      dividendIncomeAccountId: dividendIncomeAccount.id,
      withholdingTaxAccountId: withholdingTaxAccount?.id,
      grossAmount,
      taxAmount: effectiveTaxAmount,
      netCashAmount,
      currency,
    });

    // 8. Create posted financial event
    const now = Date.now();
    const insertResult = await tx.insert(financialEvents).values({
      workspaceId,
      profileId: args.context.profile.id,
      primaryAccountId: cashAccount.id,
      counterAccountId: null,
      instrumentId: instrument.id,
      categoryId: null,
      eventType: "dividend",
      status: "posted",
      occurredAt: args.paymentDate,
      currency,
      grossAmount: grossAmount.toFixed(6),
      feeAmount: "0.000000",
      taxAmount: effectiveTaxAmount.toFixed(6),
      quantity: totalEligibleShares.toFixed(8),
      unitPrice: dividendPerShare.toFixed(8),
      externalRef: null,
      idempotencyKey,
      source: "manual",
      memo: args.memo?.trim() || `توزيعات أرباح نقدية: ${instrument.symbol || instrument.name} بواقع ${dividendPerShare.toFixed(4)} للسهم عن ${totalEligibleShares.toFixed(2)} سهم`,
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const eventId = Number(insertResult[0].insertId);

    // 9. Post journal entry
    const entryResult = await tx.insert(journalEntries).values({
      workspaceId,
      eventId,
      status: "posted",
      postedAt: args.paymentDate,
      reversalOfEntryId: null,
      createdAt: now,
    });
    const entryId = Number(entryResult[0].insertId);

    // 10. Post journal lines
    await tx.insert(journalLines).values(
      draftLines.map((line, index) => ({
        workspaceId,
        entryId,
        accountId: line.accountId,
        lineNumber: index + 1,
        direction: line.direction,
        amount: line.amount.toFixed(6),
        currency: line.currency ?? currency,
        fxRateToBase: (line.fxRateToBase ?? new Decimal(1)).toFixed(10),
        baseAmount: (line.baseAmount ?? line.amount).toFixed(6),
        memo: line.direction === "debit" && line.accountId === cashAccount.id ? "استلام صافي التوزيعات" : "استحقاق توزيعات الأرباح",
        createdAt: now,
      }))
    );

    // 11. Audit event
    await tx.insert(auditEvents).values({
      workspaceId,
      actorUserId: args.actorUserId,
      action: "corporate_action.cash_dividend",
      targetType: "financial_event",
      targetId: String(eventId),
      beforeState: null,
      afterState: {
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        cashAccountId: cashAccount.id,
        totalEligibleShares: totalEligibleShares.toFixed(8),
        dividendPerShare: dividendPerShare.toFixed(8),
        grossAmount: grossAmount.toFixed(6),
        taxAmount: effectiveTaxAmount.toFixed(6),
        netCashAmount: netCashAmount.toFixed(6),
        currency,
        paymentDate: args.paymentDate,
        exDate: args.exDate,
      },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });

    // Invalidate caches
    invalidateReadModelCache(`wealth-health:score:${workspaceId}`);
    invalidateReadModelCache(`stress-testing:${workspaceId}:`);
    invalidateReadModelCache(`consolidation:`);

    return {
      eventId,
      instrumentId: instrument.id,
      symbol: instrument.symbol || "",
      totalEligibleShares: totalEligibleShares.toFixed(8),
      dividendPerShare: dividendPerShare.toFixed(8),
      grossAmount: grossAmount.toFixed(6),
      taxAmount: effectiveTaxAmount.toFixed(6),
      netCashAmount: netCashAmount.toFixed(6),
      currency,
      cashAccountId: cashAccount.id,
      paymentDate: args.paymentDate,
    };
  });
}
