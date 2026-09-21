import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { protectedProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { listAccountSnapshots } from "../../familyRead";
import { postCashEvent, revalueAssetAccount } from "../../familyLedger";
import { parsePositiveAmount } from "../../ledgerMath";
import { fetchYahooQuote } from "../../marketData";
import { suggestGoldRevaluation } from "../../goldQuoteMath";
import { invalidateReadModelCache } from "../../readModelCache";
import {
  accounts,
  auditEvents,
  cashFlowCategories,
  financialEvents,
  insuranceClaims,
  insurancePolicies,
  insurancePremiumPayments,
  specialAssets,
  specialAssetValuations,
} from "../../../drizzle/schema";
import { currency, idempotencyKey, money, notAvailable, occurredAt } from "../../schemas/familySchemas";

export const familySpecialAssetsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const [rows, snapshots, valuations] = await Promise.all([
      db.select({
        id: specialAssets.id,
        assetType: specialAssets.assetType,
        name: specialAssets.name,
        quantity: specialAssets.quantity,
        unit: specialAssets.unit,
        ownershipType: specialAssets.ownershipType,
        ownershipShare: specialAssets.ownershipShare,
        acquisitionDate: specialAssets.acquisitionDate,
        acquisitionCost: specialAssets.acquisitionCost,
        acquisitionCurrency: specialAssets.acquisitionCurrency,
        location: specialAssets.location,
        marketSymbol: specialAssets.marketSymbol,
        purity: specialAssets.purity,
        valuationMethod: specialAssets.valuationMethod,
        valuationSource: specialAssets.valuationSource,
        valuationAsOf: specialAssets.valuationAsOf,
        valuationStatus: specialAssets.valuationStatus,
        valuationNote: specialAssets.valuationNote,
        details: specialAssets.details,
        status: specialAssets.status,
        accountId: accounts.id,
        accountName: accounts.name,
        currency: accounts.currency,
      }).from(specialAssets)
        .leftJoin(accounts, eq(specialAssets.assetAccountId, accounts.id))
        .where(and(eq(specialAssets.workspaceId, family.workspace.id), eq(specialAssets.profileId, family.profile.id)))
        .orderBy(desc(specialAssets.updatedAt)),
      listAccountSnapshots(family),
      db.select().from(specialAssetValuations)
        .where(and(eq(specialAssetValuations.workspaceId, family.workspace.id), eq(specialAssetValuations.profileId, family.profile.id)))
        .orderBy(desc(specialAssetValuations.asOf), desc(specialAssetValuations.id)),
    ]);
    const snapshotByAccountId = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));
    const latestValuationByAssetId = new Map<number, typeof valuations[number]>();
    valuations.forEach(valuation => {
      if (!latestValuationByAssetId.has(valuation.assetId)) latestValuationByAssetId.set(valuation.assetId, valuation);
    });
    return rows.map(row => {
      const snapshot = row.accountId ? snapshotByAccountId.get(row.accountId) : undefined;
      const latestValuation = latestValuationByAssetId.get(row.id) ?? null;
      return {
        ...row,
        accountId: row.accountId ?? 0,
        accountName: row.accountName ?? "حساب غير مقيد",
        currency: row.currency ?? "EGP",
        balance: snapshot?.balance ?? "0.00",
        baseValue: snapshot?.baseValue ?? null,
        ledgerValuationStatus: snapshot?.valuationStatus ?? "unvalued",
        rateAsOf: snapshot?.rateAsOf ?? null,
        latestValuation,
      };
    });
  }),

  create: protectedProcedure.input(z.object({
    assetAccountId: z.number().int().positive(),
    assetType: z.enum(["real_estate", "gold", "commodity", "other"]),
    name: z.string().trim().min(2).max(200),
    quantity: money.optional().nullable(),
    unit: z.string().trim().max(48).nullable(),
    ownershipType: z.enum(["sole", "joint", "usufruct", "other"]).default("sole"),
    ownershipShare: money.default("100"),
    acquisitionDate: occurredAt.optional().nullable(),
    acquisitionCost: money.optional().nullable(),
    acquisitionCurrency: currency.optional().nullable(),
    location: z.string().trim().max(255).nullable().optional(),
    marketSymbol: z.string().trim().max(48).nullable().optional(),
    purity: money.optional().nullable(),
    valuationMethod: z.enum(["ledger_balance", "market_quote", "manual", "appraisal"]).default("ledger_balance"),
    valuationSource: z.string().trim().max(255).nullable().optional(),
    valuationAsOf: occurredAt.optional().nullable(),
    valuationNote: z.string().trim().max(4000).nullable().optional(),
    details: z.string().trim().max(4000).nullable(),
  })).mutation(async ({ ctx, input }) => {
    const hasQuantity = Boolean(input.quantity?.trim());
    const hasUnit = Boolean(input.unit?.trim());
    if (hasQuantity !== hasUnit) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل كمية الأصل ووحدتها معًا." });
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [account] = await db.select().from(accounts).where(and(
      eq(accounts.id, input.assetAccountId),
      eq(accounts.workspaceId, family.workspace.id),
      eq(accounts.ownerProfileId, family.profile.id),
      eq(accounts.accountType, "asset"),
      eq(accounts.status, "active"),
    )).limit(1);
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "اختر حساب أصل نشطًا ومملوكًا لك ضمن FAMILY." });
    const [existing] = await db.select({ id: specialAssets.id }).from(specialAssets).where(and(
      eq(specialAssets.workspaceId, family.workspace.id),
      eq(specialAssets.profileId, family.profile.id),
      eq(specialAssets.assetAccountId, account.id),
    )).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "يرتبط حساب الأصل هذا بسجل أصل خاص بالفعل." });
    const quantity = input.quantity?.trim() ? parsePositiveAmount(input.quantity, "كمية الأصل") : null;
    const ownershipShare = parsePositiveAmount(input.ownershipShare, "نسبة الملكية");
    if (ownershipShare.gt(100)) throw new TRPCError({ code: "BAD_REQUEST", message: "نسبة الملكية يجب أن تكون بين 0 و100." });
    const acquisitionCost = input.acquisitionCost?.trim() ? parsePositiveAmount(input.acquisitionCost, "تكلفة الاقتناء") : null;
    const purity = input.purity?.trim() ? parsePositiveAmount(input.purity, "نقاوة الذهب") : null;
    if (purity && purity.gt(100)) throw new TRPCError({ code: "BAD_REQUEST", message: "نقاوة الذهب يجب ألا تتجاوز 100%." });
    if (input.assetType === "gold" && purity && purity.gt(0) && purity.lte(1)) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل نقاوة الذهب كنسبة مئوية مثل 99.9." });
    if (input.assetType === "gold" && input.valuationMethod === "market_quote" && !input.marketSymbol) throw new TRPCError({ code: "BAD_REQUEST", message: "تقييم الذهب بسعر سوق يتطلب رمزًا مثل GC=F." });
    const now = Date.now();
    const result = await db.insert(specialAssets).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      assetAccountId: account.id,
      assetType: input.assetType,
      name: input.name,
      quantity: quantity?.toFixed(8) ?? null,
      unit: input.unit,
      ownershipType: input.ownershipType,
      ownershipShare: ownershipShare.toFixed(5),
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: acquisitionCost?.toFixed(6) ?? null,
      acquisitionCurrency: input.acquisitionCurrency?.toUpperCase() ?? null,
      location: input.location,
      marketSymbol: input.marketSymbol?.toUpperCase() ?? null,
      purity: purity?.toFixed(6) ?? null,
      valuationMethod: input.valuationMethod,
      valuationSource: input.valuationSource,
      valuationAsOf: input.valuationAsOf,
      valuationStatus: input.valuationMethod === "ledger_balance" ? "unvalued" : "review_required",
      valuationNote: input.valuationNote,
      details: input.details,
      status: "active",
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(result[0].insertId);
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "special_asset.created",
      targetType: "special_asset",
      targetId: String(id),
      beforeState: null,
      afterState: { ...input, quantity: quantity?.toFixed(8) ?? null },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id };
  }),

  suggestYahooGoldValue: protectedProcedure.input(z.object({
    assetId: z.number().int().positive(),
    symbol: z.string().trim().min(1).max(48).default("GC=F"),
  })).query(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const [asset] = await db.select().from(specialAssets)
      .innerJoin(accounts, eq(specialAssets.assetAccountId, accounts.id))
      .where(and(
        eq(specialAssets.id, input.assetId),
        eq(specialAssets.workspaceId, family.workspace.id),
        eq(specialAssets.profileId, family.profile.id),
        eq(specialAssets.assetType, "gold"),
        eq(specialAssets.status, "active"),
      )).limit(1);
    if (!asset || !asset.special_assets.quantity || !asset.special_assets.unit) throw new TRPCError({ code: "NOT_FOUND", message: "يلزم أصل ذهب نشط مع كمية ووحدة مسجلتين داخل نطاقك." });
    const quote = await fetchYahooQuote(input.symbol);
    if (quote.currency !== asset.accounts.currency) throw new TRPCError({ code: "BAD_GATEWAY", message: "عملة سعر Yahoo لا تطابق عملة حساب أصل الذهب؛ راجع الرمز أو استخدم إعادة التقييم اليدوية." });
    let suggestion;
    try {
      suggestion = suggestGoldRevaluation({ quantity: asset.special_assets.quantity, unit: asset.special_assets.unit, quotePerTroyOunce: quote.price });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر احتساب اقتراح الذهب." });
    }
    return {
      assetId: asset.special_assets.id,
      symbol: input.symbol.toUpperCase(),
      source: quote.source,
      quoteStatus: quote.quoteStatus,
      asOf: quote.asOf,
      currency: quote.currency,
      ...suggestion,
    };
  }),

  recordYahooGoldValuation: protectedProcedure.input(z.object({
    assetId: z.number().int().positive(),
    symbol: z.string().trim().min(1).max(48).default("GC=F"),
    note: z.string().trim().max(4000).nullable(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "advisor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [asset] = await db.select().from(specialAssets)
      .innerJoin(accounts, eq(specialAssets.assetAccountId, accounts.id))
      .where(and(
        eq(specialAssets.id, input.assetId),
        eq(specialAssets.workspaceId, family.workspace.id),
        eq(specialAssets.profileId, family.profile.id),
        eq(specialAssets.assetType, "gold"),
        eq(specialAssets.status, "active"),
      )).limit(1);
    if (!asset || !asset.special_assets.quantity || !asset.special_assets.unit) throw new TRPCError({ code: "NOT_FOUND", message: "يلزم أصل ذهب نشط مع كمية ووحدة قبل حفظ تقييم السوق." });
    const quote = await fetchYahooQuote(input.symbol);
    if (quote.currency !== asset.accounts.currency) throw new TRPCError({ code: "BAD_GATEWAY", message: "عملة سعر Yahoo لا تطابق عملة حساب أصل الذهب." });
    let suggestion;
    try {
      suggestion = suggestGoldRevaluation({ quantity: asset.special_assets.quantity, unit: asset.special_assets.unit, quotePerTroyOunce: quote.price });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر احتساب تقييم الذهب." });
    }
    const now = Date.now();
    const quality = quote.quoteStatus === "delayed" ? "delayed" : "review_required";
    const result = await db.transaction(async tx => {
      const inserted = await tx.insert(specialAssetValuations).values({
        workspaceId: family.workspace.id,
        profileId: family.profile.id,
        assetId: asset.special_assets.id,
        financialEventId: null,
        valuationMethod: "market_quote",
        value: suggestion.suggestedTargetValue,
        currency: quote.currency,
        marketSymbol: input.symbol.toUpperCase(),
        source: quote.source,
        quoteValue: quote.price,
        quoteCurrency: quote.currency,
        asOf: quote.asOf,
        quality,
        note: input.note,
        createdByUserId: ctx.user.id,
        createdAt: now,
      });
      await tx.update(specialAssets).set({
        marketSymbol: input.symbol.toUpperCase(),
        valuationMethod: "market_quote",
        valuationSource: quote.source,
        valuationAsOf: quote.asOf,
        valuationStatus: quality === "delayed" ? "review_required" : "current",
        valuationNote: input.note,
        updatedAt: now,
      }).where(eq(specialAssets.id, asset.special_assets.id));
      await tx.insert(auditEvents).values({
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        action: "special_asset.market_valuation_recorded",
        targetType: "special_asset",
        targetId: String(asset.special_assets.id),
        beforeState: { valuationAsOf: asset.special_assets.valuationAsOf, valuationStatus: asset.special_assets.valuationStatus },
        afterState: { valuationAsOf: quote.asOf, valuationStatus: quality === "delayed" ? "review_required" : "current", value: suggestion.suggestedTargetValue, source: quote.source, symbol: input.symbol.toUpperCase() },
        requestId: crypto.randomUUID(),
        occurredAt: now,
      });
      return { id: Number(inserted[0].insertId) };
    });
    invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
    invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
    return {
      ...result,
      assetId: asset.special_assets.id,
      symbol: input.symbol.toUpperCase(),
      source: quote.source,
      quoteStatus: quote.quoteStatus,
      asOf: quote.asOf,
      currency: quote.currency,
      ...suggestion,
    };
  }),

  revalue: protectedProcedure.input(z.object({
    assetId: z.number().int().positive(),
    targetValue: money,
    occurredAt,
    memo: z.string().trim().max(2000).nullable(),
    idempotencyKey,
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "advisor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [asset] = await db.select().from(specialAssets)
      .innerJoin(accounts, eq(specialAssets.assetAccountId, accounts.id))
      .where(and(
        eq(specialAssets.id, input.assetId),
        eq(specialAssets.workspaceId, family.workspace.id),
        eq(specialAssets.profileId, family.profile.id),
        eq(specialAssets.status, "active"),
      )).limit(1);
    if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الأصل الخاص النشط غير موجود ضمن نطاقك المالي." });
    const result = await revalueAssetAccount({
      context: family,
      actorUserId: ctx.user.id,
      accountId: asset.special_assets.assetAccountId,
      targetValue: input.targetValue,
      currency: asset.accounts.currency,
      occurredAt: input.occurredAt,
      memo: input.memo,
      idempotencyKey: input.idempotencyKey,
    });
    if (!result.duplicate) {
      await db.insert(auditEvents).values({
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        action: "special_asset.revalued",
        targetType: "special_asset",
        targetId: String(asset.special_assets.id),
        beforeState: { value: result.priorValue },
        afterState: { targetValue: result.targetValue, direction: result.direction, financialEventId: result.id },
        requestId: crypto.randomUUID(),
        occurredAt: input.occurredAt,
      });
    }
    return result;
  }),
});

export const familyInsuranceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    const [policies, payments, claims] = await Promise.all([
      db.select().from(insurancePolicies).where(and(eq(insurancePolicies.workspaceId, family.workspace.id), eq(insurancePolicies.profileId, family.profile.id))).orderBy(desc(insurancePolicies.updatedAt)),
      db.select().from(insurancePremiumPayments).where(and(eq(insurancePremiumPayments.workspaceId, family.workspace.id), eq(insurancePremiumPayments.profileId, family.profile.id))).orderBy(desc(insurancePremiumPayments.occurredAt)),
      db.select().from(insuranceClaims).where(and(eq(insuranceClaims.workspaceId, family.workspace.id), eq(insuranceClaims.profileId, family.profile.id))).orderBy(desc(insuranceClaims.submittedAt)),
    ]);
    const latestPaymentByPolicyId = new Map<number, typeof payments[number]>();
    payments.forEach(payment => {
      if (!latestPaymentByPolicyId.has(payment.policyId)) latestPaymentByPolicyId.set(payment.policyId, payment);
    });
    const claimsByPolicyId = new Map<number, typeof claims>();
    claims.forEach(claim => {
      const list = claimsByPolicyId.get(claim.policyId) ?? [];
      list.push(claim);
      claimsByPolicyId.set(claim.policyId, list);
    });
    return policies.map(policy => {
      const policyClaims = claimsByPolicyId.get(policy.id) ?? [];
      return {
        ...policy,
        latestPremiumPayment: latestPaymentByPolicyId.get(policy.id) ?? null,
        claimSummary: {
          total: policyClaims.length,
          submitted: policyClaims.filter(claim => claim.status === "submitted").length,
          paid: policyClaims.filter(claim => claim.status === "paid").length,
          claimedAmount: policyClaims.reduce((sum, claim) => sum.plus(claim.claimedAmount), new Decimal(0)).toFixed(6),
          receivedAmount: policyClaims.reduce((sum, claim) => sum.plus(claim.receivedAmount ?? 0), new Decimal(0)).toFixed(6),
        },
      };
    });
  }),

  create: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(200),
    policyType: z.enum(["health", "life", "property", "motor", "other"]),
    insurer: z.string().trim().max(160).nullable(),
    policyNumber: z.string().trim().max(160).nullable(),
    coverageAmount: money.optional().nullable(),
    currency,
    premiumAmount: money.optional().nullable(),
    premiumCadence: z.enum(["monthly", "quarterly", "yearly", "other"]).nullable(),
    cashFlowCategoryId: z.number().int().positive().nullable(),
    startsAt: occurredAt.optional().nullable(),
    endsAt: occurredAt.optional().nullable(),
    renewalAt: occurredAt.optional().nullable(),
    premiumDueDay: z.number().int().min(1).max(31).nullable().optional(),
    deductibleAmount: money.optional().nullable(),
    deductibleCurrency: currency.optional().nullable(),
    providerContact: z.string().trim().max(255).nullable().optional(),
    policyTerms: z.string().trim().max(12_000).nullable().optional(),
    beneficiaries: z.string().trim().max(4000).nullable(),
    claimsNote: z.string().trim().max(4000).nullable(),
  })).mutation(async ({ ctx, input }) => {
    const hasPremium = Boolean(input.premiumAmount?.trim());
    const hasCadence = Boolean(input.premiumCadence);
    if (hasPremium !== hasCadence) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل قيمة القسط ودورية سداده معًا." });
    if (input.startsAt != null && input.endsAt != null && input.endsAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء الوثيقة لا يمكن أن يسبق تاريخ بدايتها." });
    if (input.renewalAt != null && input.startsAt != null && input.renewalAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ التجديد لا يمكن أن يسبق بداية الوثيقة." });
    if (input.renewalAt != null && input.endsAt != null && input.renewalAt > input.endsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ التجديد يجب أن يقع قبل انتهاء الوثيقة أو يساويه." });
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    if (input.cashFlowCategoryId) {
      const [category] = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.id, input.cashFlowCategoryId), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.direction, "expense"))).limit(1);
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "فئة قسط التأمين يجب أن تكون مصروفًا ضمن نطاقك." });
    }
    const coverage = input.coverageAmount?.trim() ? parsePositiveAmount(input.coverageAmount, "قيمة التغطية") : null;
    const premium = input.premiumAmount?.trim() ? parsePositiveAmount(input.premiumAmount, "قسط التأمين") : null;
    const deductible = input.deductibleAmount?.trim() ? parsePositiveAmount(input.deductibleAmount, "قيمة التحمل") : null;
    if (deductible && !input.deductibleCurrency) throw new TRPCError({ code: "BAD_REQUEST", message: "قيمة التحمل تتطلب عملة صريحة." });
    if (input.deductibleCurrency && input.deductibleCurrency.toUpperCase() !== input.currency.toUpperCase()) throw new TRPCError({ code: "BAD_REQUEST", message: "عملة التحمل يجب أن تطابق عملة الوثيقة." });
    const now = Date.now();
    const result = await db.insert(insurancePolicies).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      name: input.name,
      policyType: input.policyType,
      insurer: input.insurer,
      policyNumber: input.policyNumber,
      coverageAmount: coverage?.toFixed(6) ?? null,
      currency: input.currency.toUpperCase(),
      premiumAmount: premium?.toFixed(6) ?? null,
      premiumCadence: input.premiumCadence,
      cashFlowCategoryId: input.cashFlowCategoryId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      renewalAt: input.renewalAt,
      premiumDueDay: input.premiumDueDay,
      deductibleAmount: deductible?.toFixed(6) ?? null,
      deductibleCurrency: input.deductibleCurrency?.toUpperCase() ?? null,
      providerContact: input.providerContact,
      policyTerms: input.policyTerms,
      beneficiaries: input.beneficiaries,
      claimsNote: input.claimsNote,
      status: "active",
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(result[0].insertId);
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "insurance_policy.created",
      targetType: "insurance_policy",
      targetId: String(id),
      beforeState: null,
      afterState: { ...input, coverageAmount: coverage?.toFixed(6) ?? null, premiumAmount: premium?.toFixed(6) ?? null },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
    invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
    return { id };
  }),

  postPremium: protectedProcedure.input(z.object({
    policyId: z.number().int().positive(),
    cashAccountId: z.number().int().positive(),
    amount: money,
    occurredAt,
    memo: z.string().trim().max(2000).nullable(),
    idempotencyKey,
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [policy] = await db.select().from(insurancePolicies).where(and(eq(insurancePolicies.id, input.policyId), eq(insurancePolicies.workspaceId, family.workspace.id), eq(insurancePolicies.profileId, family.profile.id), eq(insurancePolicies.status, "active"))).limit(1);
    if (!policy) throw new TRPCError({ code: "NOT_FOUND", message: "بوليصة التأمين النشطة غير موجودة ضمن نطاقك المالي." });
    if (!policy.cashFlowCategoryId) throw new TRPCError({ code: "BAD_REQUEST", message: "اربط البوليصة بفئة مصروف قبل تسجيل قسط مدفوع." });
    const [cashAccount] = await db.select().from(accounts).where(and(eq(accounts.id, input.cashAccountId), eq(accounts.workspaceId, family.workspace.id), eq(accounts.ownerProfileId, family.profile.id), eq(accounts.status, "active"))).limit(1);
    if (!cashAccount || !["cash", "bank", "brokerage", "wallet"].includes(cashAccount.accountType)) throw new TRPCError({ code: "NOT_FOUND", message: "اختر حسابًا نقديًا أو مصرفيًا نشطًا من نطاقك." });
    if (cashAccount.currency !== policy.currency) throw new TRPCError({ code: "BAD_REQUEST", message: "عملة حساب الدفع يجب أن تطابق عملة البوليصة في الإصدار الحالي." });
    const event = await postCashEvent({
      context: family,
      actorUserId: ctx.user.id,
      eventType: "expense",
      accountId: cashAccount.id,
      amount: input.amount,
      currency: policy.currency,
      occurredAt: input.occurredAt,
      categoryId: policy.cashFlowCategoryId,
      memo: input.memo || `قسط تأمين: ${policy.name}`,
      idempotencyKey: input.idempotencyKey,
      afterPosted: async (tx, postedEvent, postedAmount) => {
        const now = Date.now();
        await tx.insert(insurancePremiumPayments).values({
          workspaceId: family.workspace.id,
          profileId: family.profile.id,
          policyId: policy.id,
          financialEventId: postedEvent.id,
          cashAccountId: cashAccount.id,
          amount: postedAmount.toFixed(6),
          currency: policy.currency,
          occurredAt: input.occurredAt,
          createdByUserId: ctx.user.id,
          createdAt: now,
        });
        await tx.insert(auditEvents).values({
          workspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          action: "insurance_premium.posted",
          targetType: "insurance_policy",
          targetId: String(policy.id),
          beforeState: null,
          afterState: { amount: postedAmount.toFixed(6), currency: policy.currency, cashAccountId: cashAccount.id, financialEventId: postedEvent.id },
          requestId: crypto.randomUUID(),
          occurredAt: input.occurredAt,
        });
      },
    });
    return event;
  }),

  claims: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();
    return db.select({
      id: insuranceClaims.id,
      policyId: insuranceClaims.policyId,
      policyName: insurancePolicies.name,
      referenceNumber: insuranceClaims.referenceNumber,
      claimedAmount: insuranceClaims.claimedAmount,
      receivedAmount: insuranceClaims.receivedAmount,
      currency: insuranceClaims.currency,
      submittedAt: insuranceClaims.submittedAt,
      expectedAt: insuranceClaims.expectedAt,
      receivedEventId: insuranceClaims.receivedEventId,
      status: insuranceClaims.status,
      note: insuranceClaims.note,
    }).from(insuranceClaims)
      .innerJoin(insurancePolicies, eq(insuranceClaims.policyId, insurancePolicies.id))
      .where(and(eq(insuranceClaims.workspaceId, family.workspace.id), eq(insuranceClaims.profileId, family.profile.id)))
      .orderBy(desc(insuranceClaims.submittedAt));
  }),

  createClaim: protectedProcedure.input(z.object({
    policyId: z.number().int().positive(),
    referenceNumber: z.string().trim().max(160).nullable(),
    claimedAmount: money,
    submittedAt: occurredAt,
    expectedAt: occurredAt.nullable(),
    note: z.string().trim().max(4000).nullable(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [policy] = await db.select({ id: insurancePolicies.id, currency: insurancePolicies.currency }).from(insurancePolicies).where(and(eq(insurancePolicies.id, input.policyId), eq(insurancePolicies.workspaceId, family.workspace.id), eq(insurancePolicies.profileId, family.profile.id), eq(insurancePolicies.status, "active"))).limit(1);
    if (!policy) throw new TRPCError({ code: "NOT_FOUND", message: "بوليصة التأمين النشطة غير موجودة ضمن نطاقك." });
    const amount = parsePositiveAmount(input.claimedAmount, "قيمة المطالبة");
    const now = Date.now();
    const result = await db.insert(insuranceClaims).values({
      workspaceId: family.workspace.id,
      profileId: family.profile.id,
      policyId: policy.id,
      referenceNumber: input.referenceNumber,
      claimedAmount: amount.toFixed(6),
      receivedAmount: null,
      currency: policy.currency,
      submittedAt: input.submittedAt,
      expectedAt: input.expectedAt,
      receivedEventId: null,
      status: "submitted",
      note: input.note,
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(result[0].insertId);
    await db.insert(auditEvents).values({
      workspaceId: family.workspace.id,
      actorUserId: ctx.user.id,
      action: "insurance_claim.created",
      targetType: "insurance_claim",
      targetId: String(id),
      beforeState: null,
      afterState: { policyId: policy.id, claimedAmount: amount.toFixed(6), currency: policy.currency, submittedAt: input.submittedAt },
      requestId: crypto.randomUUID(),
      occurredAt: now,
    });
    return { id };
  }),

  markReceived: protectedProcedure.input(z.object({
    claimId: z.number().int().positive(),
    financialEventId: z.number().int().positive(),
  })).mutation(async ({ ctx, input }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();
    const [claim] = await db.select().from(insuranceClaims).where(and(eq(insuranceClaims.id, input.claimId), eq(insuranceClaims.workspaceId, family.workspace.id), eq(insuranceClaims.profileId, family.profile.id), eq(insuranceClaims.status, "submitted"))).limit(1);
    if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "المطالبة المقدمة غير موجودة ضمن نطاقك." });
    const [event] = await db.select({ id: financialEvents.id, eventType: financialEvents.eventType, currency: financialEvents.currency, grossAmount: financialEvents.grossAmount, status: financialEvents.status }).from(financialEvents).where(and(eq(financialEvents.id, input.financialEventId), eq(financialEvents.workspaceId, family.workspace.id), eq(financialEvents.profileId, family.profile.id), eq(financialEvents.status, "posted"))).limit(1);
    if (!event || event.eventType !== "income" || event.currency !== claim.currency || new Decimal(event.grossAmount).lte(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "اربط المطالبة بحركة دخل منشورة وبالعملة نفسها." });
    const now = Date.now();
    await db.transaction(async tx => {
      await tx.update(insuranceClaims).set({ status: "paid", receivedAmount: event.grossAmount, receivedEventId: event.id, updatedAt: now }).where(eq(insuranceClaims.id, claim.id));
      await tx.insert(auditEvents).values({
        workspaceId: family.workspace.id,
        actorUserId: ctx.user.id,
        action: "insurance_claim.received",
        targetType: "insurance_claim",
        targetId: String(claim.id),
        beforeState: { status: "submitted", receivedEventId: null },
        afterState: { status: "paid", receivedEventId: event.id, receivedAmount: event.grossAmount },
        requestId: crypto.randomUUID(),
        occurredAt: now,
      });
    });
    return { id: claim.id, receivedEventId: event.id };
  }),
});
