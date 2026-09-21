import { and, desc, eq, gt, or, like, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  accounts,
  approvalDecisions,
  approvalPolicies,
  approvalRequests,
  auditEvents,
  bankStatementImports,
  bankStatementRows,
  budgets,
  cashFlowCategories,
  corporateActions,
  financialEvents,
  financialPeriods,
  financialProfiles,
  fxRates,
  insuranceClaims,
  insurancePolicies,
  instruments,
  investmentLots,
  journalEntries,
  journalLines,
  lotMatches,
  lotTransfers,
  memberships,
  personalIous,
  positions,
  priceQuotes,
  specialAssets,
  users,
  valuationProvenance,
  valuationSnapshots,
  vaultDocuments,
  watchlistItems,
  workspaceInvitations,
  workspaces,
  zakatAssessments,
} from "../drizzle/schema";
import { assertRole, ensurePersonalFamilyContext, listAccessibleWorkspaces, setActiveFamilyWorkspace, type FamilyContext } from "./familyAccess";
import {
  createFamilyAccount,
  postImportedCashBatch,
  postPositionTransfer,
  postStockSplit,
  postTrade,
  reverseImportedCashBatch,
  reverseFinancialEvent,
} from "./familyLedger";
import {
  getDashboardMarketOverview,
  getDashboardSummary,
  getMarketDataQuality,
  listAccountSnapshots,
  listPortfolioPositions,
  listRecentEvents,
} from "./familyRead";
import { getDb } from "./db";
import { parsePositiveAmount } from "./ledgerMath";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import Decimal from "decimal.js";
import { buildImportRows, detectDuplicate, parseCsv, sha256, validateColumnMapping } from "./bankImportMath";
import { canPostImportedRow, shouldKeepImportInReview } from "./bankImportWorkflow";
import { isApprovalExecutable, requiresApproval, type ApprovalActionType } from "./approvalWorkflowMath";
import { BENCHMARK_SYMBOLS, calculateGold24kGramEgp, checkQuoteSanity, fetchEgxOrYahooQuote, fetchYahooFxQuote } from "./marketData";
import { storageGetSignedUrl, storagePut } from "./storage";
import { decryptVaultValue, encryptVaultValue } from "./vaultCrypto";
import { createBackupEnvelope } from "./backupSnapshot";
import { exportFullWorkspaceBackup, restoreFullWorkspaceBackup, validateWorkspaceBackup } from "./backupRestoreService";
import { postCashDividend } from "./dividendPosting";
import { archivePeriodClosureDossier, getPeriodClosureDossier } from "./periodArchivalService";
import {
  issueAuditorAccessToken,
  revokeAuditorToken,
  listAuditorTokens,
  parseAndVerifyToken,
  recordAuditorAccessEvent,
} from "./auditorTokenService";
import { buildReconciliationReport } from "./reconciliation";
import { buildInstrumentSnapshot, buildManualProvenance, buildMarketProvenance } from "./valuationProvenance";
import { listValuationHistory } from "./valuationRead";
import { captureOfficialValuationSnapshot, getLatestOfficialValuationSnapshot, listOfficialValuationSnapshots } from "./officialValuation";
import { rebuildLotsFromEvents, type RebuildEvent } from "./lotRebuild";
import { financialStatementsRouter, generateFinancialStatementsPackage } from "./financialStatementsRouter";
import { wealthHealthRouter } from "./wealthHealthRouter";
import { invalidateReadModelCache } from "./readModelCache";
import {
  currency,
  idempotencyKey,
  occurredAt,
  money,
  approvalActionType,
  csvCell,
  notAvailable,
  parseTradeTimestamp,
} from "./schemas/familySchemas";
import { familyCashFlowRouter } from "./routers/family/familyCashFlowRouter";
import { familyDebtsRouter } from "./routers/family/familyDebtsRouter";
import {
  familyEmergencyFundRouter,
  familyGoalsRouter,
  familyRetirementRouter,
  familyRiskRouter,
  familyPlanningSubRouter,
} from "./routers/family/familyPlanningRouter";
import {
  familySpecialAssetsRouter,
  familyInsuranceRouter,
} from "./routers/family/familyAssetsInsuranceRouter";
import {
  familyFeeTaxRouter,
  familyZakatRouter,
} from "./routers/family/familyTaxZakatRouter";
import { familyLedgerRouter } from "./routers/family/familyLedgerRouter";

async function assertVaultLink(db: any, workspaceId: number, profileId: number, linkedEntityType: string, linkedEntityId: string) {
  if (linkedEntityType === "general") return;
  const id = Number(linkedEntityId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "يتطلب هذا النوع من الإرفاق رقم سجل صالحاً ضمن مساحة FAMILY." });
  const filters = { workspaceId, profileId };
  let linked = false;
  if (linkedEntityType === "insurance_policy") linked = Boolean((await db.select({ id: insurancePolicies.id }).from(insurancePolicies).where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.workspaceId, filters.workspaceId), eq(insurancePolicies.profileId, filters.profileId))).limit(1))[0]);
  if (linkedEntityType === "insurance_claim") linked = Boolean((await db.select({ id: insuranceClaims.id }).from(insuranceClaims).where(and(eq(insuranceClaims.id, id), eq(insuranceClaims.workspaceId, filters.workspaceId), eq(insuranceClaims.profileId, filters.profileId))).limit(1))[0]);
  if (linkedEntityType === "special_asset") linked = Boolean((await db.select({ id: specialAssets.id }).from(specialAssets).where(and(eq(specialAssets.id, id), eq(specialAssets.workspaceId, filters.workspaceId), eq(specialAssets.profileId, filters.profileId))).limit(1))[0]);
  if (linkedEntityType === "financial_event") linked = Boolean((await db.select({ id: financialEvents.id }).from(financialEvents).where(and(eq(financialEvents.id, id), eq(financialEvents.workspaceId, filters.workspaceId), eq(financialEvents.profileId, filters.profileId))).limit(1))[0]);
  if (!linked) throw new TRPCError({ code: "NOT_FOUND", message: "السجل المرتبط غير موجود أو لا يخص ملفك داخل مساحة FAMILY الحالية." });
}

async function familyContext(user: NonNullable<Parameters<typeof ensurePersonalFamilyContext>[0]>) {
  return ensurePersonalFamilyContext(user);
}

async function getLotRebuildReport(family: Awaited<ReturnType<typeof ensurePersonalFamilyContext>>) {
  const db = await getDb();
  if (!db) throw notAvailable();
  const [events, actions, persistedLots] = await Promise.all([
    db.select({ id: financialEvents.id, eventType: financialEvents.eventType, occurredAt: financialEvents.occurredAt, primaryAccountId: financialEvents.primaryAccountId, counterAccountId: financialEvents.counterAccountId, instrumentId: financialEvents.instrumentId, quantity: financialEvents.quantity, unitPrice: financialEvents.unitPrice, feeAmount: financialEvents.feeAmount, taxAmount: financialEvents.taxAmount, currency: financialEvents.currency }).from(financialEvents).where(and(eq(financialEvents.workspaceId, family.workspace.id), eq(financialEvents.status, "posted"))).orderBy(financialEvents.occurredAt, financialEvents.id),
    db.select({ financialEventId: corporateActions.financialEventId, ratio: corporateActions.ratio }).from(corporateActions).where(eq(corporateActions.workspaceId, family.workspace.id)),
    db.select().from(investmentLots).where(eq(investmentLots.workspaceId, family.workspace.id)).orderBy(investmentLots.acquiredAt, investmentLots.id),
  ]);
  const ratioByEvent = new Map(actions.map(action => [action.financialEventId, action.ratio]));
  const rebuildEvents: RebuildEvent[] = events.filter(event => ["buy", "sell", "position_transfer", "corporate_action"].includes(event.eventType)).map(event => ({
    id: event.id,
    eventType: event.eventType as RebuildEvent["eventType"],
    occurredAt: event.occurredAt,
    primaryAccountId: event.primaryAccountId,
    counterAccountId: event.counterAccountId,
    instrumentId: event.instrumentId,
    quantity: event.quantity,
    unitPrice: event.unitPrice,
    feeAmount: event.feeAmount,
    taxAmount: event.taxAmount,
    currency: event.currency,
    ratio: ratioByEvent.get(event.id) ?? null,
  }));
  const rebuilt = rebuildLotsFromEvents(rebuildEvents);
  const sourceEventById = new Map(persistedLots.map(lot => [lot.id, lot.acquisitionEventId]));
  const persistedKey = (lot: typeof persistedLots[number]) => `${lot.acquisitionEventId}:${lot.accountId}:${lot.instrumentId}:${lot.sourceLotId ? sourceEventById.get(lot.sourceLotId) ?? "unknown" : "root"}`;
  const rebuiltKey = (lot: typeof rebuilt.lots[number]) => `${lot.acquisitionEventId}:${lot.accountId}:${lot.instrumentId}:${lot.sourceLotKey ? lot.sourceLotKey.replace("event:", "") : "root"}`;
  const persistedByKey = new Map(persistedLots.map(lot => [persistedKey(lot), lot]));
  const rebuiltByKey = new Map(rebuilt.lots.map(lot => [rebuiltKey(lot), lot]));
  const differences: Array<Record<string, unknown>> = [];
  rebuiltByKey.forEach((lot, key) => {
    const persisted = persistedByKey.get(key);
    if (!persisted) {
      differences.push({ type: "missing_persisted_lot", key, acquisitionEventId: lot.acquisitionEventId, accountId: lot.accountId, instrumentId: lot.instrumentId });
      return;
    }
    const fields = [
      ["originalQuantity", lot.originalQuantity, persisted.originalQuantity],
      ["remainingQuantity", lot.remainingQuantity, persisted.remainingQuantity],
      ["unitCost", lot.unitCost, persisted.unitCost],
      ["totalCost", lot.totalCost, persisted.totalCost],
    ] as const;
    for (const [field, expected, actual] of fields) {
      if (!expected.eq(actual)) differences.push({ type: "lot_value_mismatch", key, field, expected: expected.toFixed(8), actual });
    }
  });
  persistedByKey.forEach((lot, key) => {
    if (!rebuiltByKey.has(key)) differences.push({ type: "unexpected_persisted_lot", key, acquisitionEventId: lot.acquisitionEventId, accountId: lot.accountId, instrumentId: lot.instrumentId });
  });
  return {
    status: differences.length || rebuilt.issues.length ? "review_required" : "matched",
    source: "posted_financial_events",
    rebuiltAt: Date.now(),
    rebuiltLotCount: rebuilt.lots.length,
    persistedLotCount: persistedLots.length,
    rebuiltMatchCount: rebuilt.matches.length,
    issueCount: rebuilt.issues.length,
    differenceCount: differences.length,
    issues: rebuilt.issues,
    differences,
  } as const;
}

async function createFrozenApprovalRequest(args: {
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
  await args.db.insert(auditEvents).values({ workspaceId: args.workspaceId, actorUserId: args.actorUserId, action: "approval_request.created", targetType: "approval_request", targetId: String(id), beforeState: null, afterState: { policyId: policy.id, actionType: args.actionType, amount: amount.toFixed(6), currency: normalizedCurrency }, requestId: crypto.randomUUID(), occurredAt: now });
  return { id, duplicate: false };
}

function normalizeAssetType(val: unknown): "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other" {
  if (typeof val !== "string") return "other";
  const cleaned = val.trim().toLowerCase();
  if (["equity", "fund", "bond", "gold", "real_estate", "cash_equivalent", "other"].includes(cleaned)) {
    return cleaned as "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other";
  }
  if (["stock", "stocks", "shares", "سهم", "أسهم", "سهم مدرج"].includes(cleaned)) return "equity";
  if (["funds", "etf", "mutual_fund", "صندوق", "صناديق", "صندوق استثمار"].includes(cleaned)) return "fund";
  if (["bonds", "sukuk", "treasury", "سند", "سندات", "صكوك", "أذون"].includes(cleaned)) return "bond";
  if (["bullion", "metals", "ذهب", "معادن", "ذهب عيني"].includes(cleaned)) return "gold";
  if (["realestate", "property", "reit", "عقار", "عقارات", "أصول عقارية"].includes(cleaned)) return "real_estate";
  if (["cash", "money_market", "نقد", "كاش", "ما يعادل النقد", "سيولة"].includes(cleaned)) return "cash_equivalent";
  return "other";
}

export const familyRouter = router({
  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const family = await familyContext(ctx.user);
    return { workspace: family.workspace, profile: family.profile, membership: family.membership };
  }),

  dashboard: protectedProcedure.query(async ({ ctx }) => getDashboardSummary(await familyContext(ctx.user))),
  marketOverview: protectedProcedure.query(async ({ ctx }) => getDashboardMarketOverview(await familyContext(ctx.user))),
  marketDataQuality: protectedProcedure.query(async ({ ctx }) => getMarketDataQuality(await familyContext(ctx.user))),
  valuation: router({
    history: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional()).query(async ({ ctx, input }) => listValuationHistory(await familyContext(ctx.user), input?.limit ?? 50)),
    officialLatest: protectedProcedure.query(async ({ ctx }) => getLatestOfficialValuationSnapshot(await familyContext(ctx.user))),
    officialHistory: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional()).query(async ({ ctx, input }) => listOfficialValuationSnapshots(await familyContext(ctx.user), input?.limit ?? 20)),
    captureOfficial: protectedProcedure.mutation(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      if (!["owner", "advisor"].includes(family.membership.role)) throw new TRPCError({ code: "FORBIDDEN", message: "تتطلب لقطة التقرير الرسمية صلاحية المالك أو المستشار." });
      const result = await captureOfficialValuationSnapshot(family, ctx.user.id);
      const db = await getDb();
      if (db) await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "valuation_snapshot.captured", targetType: "official_valuation_snapshot", targetId: String(result.id), beforeState: null, afterState: { status: result.status, quality: result.quality, valuationAsOf: result.valuationAsOf }, requestId: crypto.randomUUID(), occurredAt: result.createdAt });
      return result;
    }),
  }),

  reconciliation: router({
    report: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const [entries, lines, events, persistedPositions, rates, currentCashFlow, actions] = await Promise.all([
        db.select({ id: journalEntries.id, eventId: journalEntries.eventId, status: journalEntries.status, reversalOfEntryId: journalEntries.reversalOfEntryId }).from(journalEntries).where(eq(journalEntries.workspaceId, family.workspace.id)),
        db.select({ id: journalLines.id, entryId: journalLines.entryId, accountId: journalLines.accountId, direction: journalLines.direction, amount: journalLines.amount, baseAmount: journalLines.baseAmount, currency: journalLines.currency }).from(journalLines).where(eq(journalLines.workspaceId, family.workspace.id)),
        db.select({ id: financialEvents.id, status: financialEvents.status, primaryAccountId: financialEvents.primaryAccountId, instrumentId: financialEvents.instrumentId, eventType: financialEvents.eventType, categoryId: financialEvents.categoryId, currency: financialEvents.currency, quantity: financialEvents.quantity, unitPrice: financialEvents.unitPrice, grossAmount: financialEvents.grossAmount, feeAmount: financialEvents.feeAmount, taxAmount: financialEvents.taxAmount, idempotencyKey: financialEvents.idempotencyKey, occurredAt: financialEvents.occurredAt }).from(financialEvents).where(eq(financialEvents.workspaceId, family.workspace.id)),
        db.select({ accountId: positions.accountId, instrumentId: positions.instrumentId, quantity: positions.quantity, averageCost: positions.averageCost }).from(positions).where(eq(positions.workspaceId, family.workspace.id)),
        db.select({ fromCurrency: fxRates.fromCurrency, toCurrency: fxRates.toCurrency, rate: fxRates.rate, asOf: fxRates.asOf, rateStatus: fxRates.rateStatus }).from(fxRates).where(eq(fxRates.workspaceId, family.workspace.id)),
        db.select({ categoryId: cashFlowCategories.id, actualAmountBase: sql<string>`COALESCE(SUM(${journalLines.baseAmount}), 0)` }).from(financialEvents).innerJoin(cashFlowCategories, eq(financialEvents.categoryId, cashFlowCategories.id)).innerJoin(journalEntries, eq(journalEntries.eventId, financialEvents.id)).innerJoin(journalLines, and(eq(journalLines.entryId, journalEntries.id), eq(journalLines.accountId, financialEvents.primaryAccountId!))).where(and(eq(financialEvents.workspaceId, family.workspace.id), eq(financialEvents.status, "posted"), sql`${financialEvents.eventType} IN ('income', 'expense', 'debt_payment')`)).groupBy(cashFlowCategories.id),
        db.select({ instrumentId: corporateActions.instrumentId, actionType: corporateActions.actionType, ratio: corporateActions.ratio, effectiveAt: corporateActions.effectiveAt }).from(corporateActions).where(eq(corporateActions.workspaceId, family.workspace.id)),
      ]);
      return buildReconciliationReport({ baseCurrency: family.workspace.baseCurrency, fxRates: rates, expectedCashFlowByCategory: currentCashFlow, entries, lines, events, positions: persistedPositions, corporateActions: actions });
    }),
  }),

  cashFlow: familyCashFlowRouter,
  debts: familyDebtsRouter,
  emergencyFund: familyEmergencyFundRouter,


  workspaces: router({
    list: protectedProcedure.query(async ({ ctx }) => listAccessibleWorkspaces(ctx.user)),
    setActive: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => setActiveFamilyWorkspace(ctx.user, input.workspaceId)),
  }),

  members: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const activeMembers = await db.select({ id: memberships.id, role: memberships.role, status: memberships.status, userId: users.id, name: users.name, email: users.email, createdAt: memberships.createdAt }).from(memberships).innerJoin(users, eq(memberships.userId, users.id)).where(eq(memberships.workspaceId, family.workspace.id));
      const invitations = await db.select({ id: workspaceInvitations.id, email: workspaceInvitations.email, role: workspaceInvitations.role, status: workspaceInvitations.status, expiresAt: workspaceInvitations.expiresAt, createdAt: workspaceInvitations.createdAt }).from(workspaceInvitations).where(eq(workspaceInvitations.workspaceId, family.workspace.id));
      const now = Date.now();
      return { activeMembers, invitations: invitations.map(invitation => ({ ...invitation, status: invitation.status === "pending" && invitation.expiresAt <= now ? "expired" as const : invitation.status })) };
    }),
    invite: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320), role: z.enum(["advisor", "editor", "viewer"]) })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "owner");
      const db = await getDb();
      if (!db) throw notAvailable();
      const now = Date.now();
      const email = input.email.toLowerCase();
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing[0]?.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن دعوة حسابك نفسه." });
      await db.insert(workspaceInvitations).values({ workspaceId: family.workspace.id, invitedByUserId: ctx.user.id, email, role: input.role, status: "pending", expiresAt: now + 7 * 24 * 60 * 60 * 1000, acceptedByUserId: null, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { role: input.role, status: "pending", expiresAt: now + 7 * 24 * 60 * 60 * 1000, invitedByUserId: ctx.user.id, updatedAt: now } });
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "workspace_invitation.created", targetType: "workspace_invitation", targetId: email, beforeState: null, afterState: { email, role: input.role }, requestId: crypto.randomUUID(), occurredAt: now });
      return { email, expiresAt: now + 7 * 24 * 60 * 60 * 1000 };
    }),
    cancelInvitation: protectedProcedure.input(z.object({ invitationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "owner");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [invitation] = await db.select().from(workspaceInvitations).where(and(eq(workspaceInvitations.id, input.invitationId), eq(workspaceInvitations.workspaceId, family.workspace.id))).limit(1);
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "الدعوة غير موجودة ضمن مساحة FAMILY الحالية." });
      if (invitation.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إلغاء دعوة ليست معلقة." });
      const now = Date.now();
      await db.update(workspaceInvitations).set({ status: "cancelled", updatedAt: now }).where(eq(workspaceInvitations.id, invitation.id));
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "workspace_invitation.cancelled", targetType: "workspace_invitation", targetId: String(invitation.id), beforeState: { email: invitation.email, role: invitation.role, status: invitation.status }, afterState: { status: "cancelled" }, requestId: crypto.randomUUID(), occurredAt: now });
      return { id: invitation.id, status: "cancelled" as const };
    }),
  }),

  accounts: router({
    list: protectedProcedure.query(async ({ ctx }) => listAccountSnapshots(await familyContext(ctx.user))),
    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(160),
        accountType: z.enum(["cash", "bank", "brokerage", "wallet", "credit", "loan", "asset"]),
        currency,
        institution: z.string().trim().max(160).optional().nullable(),
        openingBalance: money.optional().nullable(),
        occurredAt,
        idempotencyKey,
      }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        return createFamilyAccount({ context: family, actorUserId: ctx.user.id, ...input, currency: input.currency.toUpperCase() });
      }),
  }),

  instruments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      return db.select().from(instruments).where(eq(instruments.workspaceId, family.workspace.id)).orderBy(instruments.name);
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2, "اسم الأداة يجب أن لا يقل عن حرفين").max(200),
        symbol: z.string().trim().max(48).optional().nullable(),
        assetType: z.string().trim().min(1, "نوع الفئة مطلوب"),
        subCategory: z.string().trim().max(100).optional().nullable(),
        sector: z.string().trim().max(100).optional().nullable(),
        currency,
        isin: z.string().trim().max(32).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const family = await familyContext(ctx.user);
          assertRole(family, "editor");
          const db = await getDb();
          if (!db) throw notAvailable();

          const canonicalAssetType = normalizeAssetType(input.assetType);
          const cleanSymbol = input.symbol?.trim() ? input.symbol.trim().toUpperCase() : null;

          if (cleanSymbol) {
            const [existing] = await db
              .select({ id: instruments.id, name: instruments.name })
              .from(instruments)
              .where(and(eq(instruments.workspaceId, family.workspace.id), eq(instruments.symbol, cleanSymbol)))
              .limit(1);
            if (existing) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `الأداة المالية بالرمز (${cleanSymbol}) مسجلة مسبقًا باسم "${existing.name}".`,
              });
            }
          }

          const now = Date.now();
          const result = await db.insert(instruments).values({
            workspaceId: family.workspace.id,
            name: input.name.trim(),
            symbol: cleanSymbol,
            assetType: canonicalAssetType,
            subCategory: input.subCategory?.trim() || null,
            sector: input.sector?.trim() || null,
            currency: input.currency.toUpperCase(),
            isin: input.isin?.trim() ? input.isin.trim().toUpperCase() : null,
            createdAt: now,
            updatedAt: now,
          });

          const id = Number(result[0].insertId);
          await db.insert(auditEvents).values({
            workspaceId: family.workspace.id,
            actorUserId: ctx.user.id,
            action: "instrument.created",
            targetType: "instrument",
            targetId: String(id),
            beforeState: null,
            afterState: {
              name: input.name.trim(),
              symbol: cleanSymbol,
              assetType: canonicalAssetType,
              subCategory: input.subCategory?.trim() || null,
              sector: input.sector?.trim() || null,
            },
            requestId: crypto.randomUUID(),
            occurredAt: now,
          });

          return { id, name: input.name.trim(), symbol: cleanSymbol, assetType: canonicalAssetType };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.error("[Instruments.create] Error creating instrument:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err instanceof Error ? `فشل حفظ الأداة: ${err.message}` : "فشل حفظ الأداة الاستثمارية في قاعدة البيانات.",
          });
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().trim().optional(),
        symbol: z.string().trim().max(48).optional().nullable(),
        ticker: z.string().trim().max(48).optional().nullable(),
        assetType: z.string().trim().optional(),
        category: z.string().trim().optional(),
        subCategory: z.string().trim().max(100).optional().nullable(),
        sector: z.string().trim().max(100).optional().nullable(),
        currency: currency.optional(),
        isin: z.string().trim().max(32).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const family = await familyContext(ctx.user);
          assertRole(family, "editor");
          const db = await getDb();
          if (!db) throw notAvailable();

          const [existing] = await db
            .select()
            .from(instruments)
            .where(and(eq(instruments.id, input.id), eq(instruments.workspaceId, family.workspace.id)))
            .limit(1);

          if (!existing) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "الأداة المالية غير موجودة.",
            });
          }

          const resolvedName = input.name !== undefined ? input.name.trim() : existing.name;
          const rawSymbol = input.ticker !== undefined ? input.ticker : input.symbol;
          const cleanSymbol = rawSymbol !== undefined
            ? (rawSymbol?.trim() ? rawSymbol.trim().toUpperCase() : null)
            : existing.symbol;

          const rawCategory = input.category !== undefined ? input.category : input.assetType;
          const canonicalAssetType = rawCategory !== undefined ? normalizeAssetType(rawCategory) : existing.assetType;
          const subCategoryValue = input.subCategory !== undefined ? (input.subCategory?.trim() || null) : existing.subCategory;
          const sectorValue = input.sector !== undefined ? (input.sector?.trim() || null) : existing.sector;

          if (cleanSymbol) {
            const [conflict] = await db
              .select({ id: instruments.id, name: instruments.name })
              .from(instruments)
              .where(and(
                eq(instruments.workspaceId, family.workspace.id),
                eq(instruments.symbol, cleanSymbol),
                sql`${instruments.id} != ${input.id}`
              ))
              .limit(1);
            if (conflict) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `الأداة المالية بالرمز (${cleanSymbol}) مسجلة مسبقًا باسم "${conflict.name}".`,
              });
            }
          }

          const now = Date.now();
          const nextCurrency = input.currency ? input.currency.toUpperCase() : existing.currency;

          await db
            .update(instruments)
            .set({
              name: resolvedName,
              symbol: cleanSymbol,
              assetType: canonicalAssetType,
              subCategory: subCategoryValue,
              sector: sectorValue,
              currency: nextCurrency,
              isin: input.isin !== undefined ? (input.isin?.trim() ? input.isin.trim().toUpperCase() : null) : existing.isin,
              updatedAt: now,
            })
            .where(eq(instruments.id, input.id));

          await db.insert(auditEvents).values({
            workspaceId: family.workspace.id,
            actorUserId: ctx.user.id,
            action: "instrument.updated",
            targetType: "instrument",
            targetId: String(input.id),
            beforeState: {
              name: existing.name,
              symbol: existing.symbol,
              assetType: existing.assetType,
              subCategory: existing.subCategory,
              sector: existing.sector,
              currency: existing.currency,
            },
            afterState: {
              name: resolvedName,
              symbol: cleanSymbol,
              assetType: canonicalAssetType,
              subCategory: subCategoryValue,
              sector: sectorValue,
              currency: nextCurrency,
            },
            requestId: crypto.randomUUID(),
            occurredAt: now,
          });

          return { id: input.id, name: resolvedName, symbol: cleanSymbol, assetType: canonicalAssetType };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.error("[Instruments.update] Error:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err instanceof Error ? err.message : "فشل تحديث الأداة الاستثمارية.",
          });
        }
      }),

    delete: protectedProcedure
      .input(z.object({
        id: z.number().int().positive("معرف الأداة مطلوب"),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const family = await familyContext(ctx.user);
          assertRole(family, "editor");
          const db = await getDb();
          if (!db) throw notAvailable();

          const [existing] = await db
            .select()
            .from(instruments)
            .where(and(eq(instruments.id, input.id), eq(instruments.workspaceId, family.workspace.id)))
            .limit(1);

          if (!existing) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "الأداة المالية غير موجودة.",
            });
          }

          // Safe check: Active holdings in positions
          const [activePos] = await db
            .select({ id: positions.id, quantity: positions.quantity })
            .from(positions)
            .where(and(
              eq(positions.workspaceId, family.workspace.id),
              eq(positions.instrumentId, input.id),
              gt(positions.quantity, "0")
            ))
            .limit(1);

          if (activePos && new Decimal(activePos.quantity).gt(0)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "لا يمكن حذف هذه الأداة المالية لأنها تمتلك رصيد حيازات نشط في المحفظة.",
            });
          }

          // Safe check: Ledger transactions / financial events
          const [linkedEvent] = await db
            .select({ id: financialEvents.id })
            .from(financialEvents)
            .where(and(
              eq(financialEvents.workspaceId, family.workspace.id),
              eq(financialEvents.instrumentId, input.id)
            ))
            .limit(1);

          if (linkedEvent) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "لا يمكن حذف هذه الأداة المالية لوجود قيود محاسبية وعمليات مالية مسجلة عليها في دفتر الأستاذ.",
            });
          }

          // Safe check: Investment lots
          const [linkedLot] = await db
            .select({ id: investmentLots.id })
            .from(investmentLots)
            .where(and(
              eq(investmentLots.workspaceId, family.workspace.id),
              eq(investmentLots.instrumentId, input.id)
            ))
            .limit(1);

          if (linkedLot) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "لا يمكن حذف هذه الأداة المالية لوجود سجلات تخصيص Lots مرتبطة بها.",
            });
          }

          // Clean up dependent quotes, watchlists, zero-positions
          await db.delete(priceQuotes).where(and(
            eq(priceQuotes.workspaceId, family.workspace.id),
            eq(priceQuotes.instrumentId, input.id)
          ));
          await db.delete(watchlistItems).where(and(
            eq(watchlistItems.workspaceId, family.workspace.id),
            eq(watchlistItems.instrumentId, input.id)
          ));
          await db.delete(positions).where(and(
            eq(positions.workspaceId, family.workspace.id),
            eq(positions.instrumentId, input.id)
          ));

          await db.delete(instruments).where(eq(instruments.id, input.id));

          const now = Date.now();
          await db.insert(auditEvents).values({
            workspaceId: family.workspace.id,
            actorUserId: ctx.user.id,
            action: "instrument.deleted",
            targetType: "instrument",
            targetId: String(input.id),
            beforeState: {
              name: existing.name,
              symbol: existing.symbol,
              assetType: existing.assetType,
            },
            afterState: null,
            requestId: crypto.randomUUID(),
            occurredAt: now,
          });

          return { success: true, id: input.id };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.error("[Instruments.delete] Error:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err instanceof Error ? err.message : "فشل حذف الأداة الاستثمارية.",
          });
        }
      }),
  }),

  portfolio: router({
    list: protectedProcedure.query(async ({ ctx }) => listPortfolioPositions(await familyContext(ctx.user))),
  }),

  lots: router({
    list: protectedProcedure.input(z.object({ accountId: z.number().int().positive().optional(), instrumentId: z.number().int().positive().optional(), status: z.enum(["open", "closed"]).optional() }).optional()).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const filters = [eq(investmentLots.workspaceId, family.workspace.id)];
      if (input?.accountId) filters.push(eq(investmentLots.accountId, input.accountId));
      if (input?.instrumentId) filters.push(eq(investmentLots.instrumentId, input.instrumentId));
      if (input?.status) filters.push(eq(investmentLots.status, input.status));
      return db.select({
        id: investmentLots.id,
        accountId: investmentLots.accountId,
        instrumentId: investmentLots.instrumentId,
        acquisitionEventId: investmentLots.acquisitionEventId,
        sourceLotId: investmentLots.sourceLotId,
        acquiredAt: investmentLots.acquiredAt,
        originalQuantity: investmentLots.originalQuantity,
        remainingQuantity: investmentLots.remainingQuantity,
        unitCost: investmentLots.unitCost,
        totalCost: investmentLots.totalCost,
        costCurrency: investmentLots.costCurrency,
        feeAmount: investmentLots.feeAmount,
        taxAmount: investmentLots.taxAmount,
        status: investmentLots.status,
      }).from(investmentLots).where(and(...filters)).orderBy(desc(investmentLots.acquiredAt), desc(investmentLots.id));
    }),
    rebuildReport: protectedProcedure.query(async ({ ctx }) => getLotRebuildReport(await familyContext(ctx.user))),
    transfers: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional()).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      return db.select().from(lotTransfers).where(eq(lotTransfers.workspaceId, family.workspace.id)).orderBy(desc(lotTransfers.createdAt), desc(lotTransfers.id)).limit(input?.limit ?? 100);
    }),
    corporateActions: protectedProcedure.input(z.object({ instrumentId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const filters = [eq(corporateActions.workspaceId, family.workspace.id)];
      if (input?.instrumentId) filters.push(eq(corporateActions.instrumentId, input.instrumentId));
      return db.select().from(corporateActions).where(and(...filters)).orderBy(desc(corporateActions.effectiveAt), desc(corporateActions.id));
    }),
    transfer: protectedProcedure.input(z.object({ fromAccountId: z.number().int().positive(), toAccountId: z.number().int().positive(), instrumentId: z.number().int().positive(), quantity: money, occurredAt, memo: z.string().trim().max(2_000).optional().nullable(), idempotencyKey })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      return postPositionTransfer({ context: family, actorUserId: ctx.user.id, ...input });
    }),
    stockSplit: protectedProcedure.input(z.object({ instrumentId: z.number().int().positive(), ratio: money, effectiveAt: z.number().int().positive(), memo: z.string().trim().max(2_000).optional().nullable(), idempotencyKey })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      return postStockSplit({ context: family, actorUserId: ctx.user.id, ...input });
    }),
    cashDividend: protectedProcedure.input(z.object({
      instrumentId: z.number().int().positive(),
      cashAccountId: z.number().int().positive(),
      dividendPerShare: money,
      exDate: occurredAt,
      paymentDate: occurredAt,
      taxAmount: money.optional().nullable(),
      memo: z.string().trim().max(2_000).optional().nullable(),
      idempotencyKey,
    })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      return postCashDividend({ context: family, actorUserId: ctx.user.id, ...input });
    }),
  }),

  realizedPnl: router({
    list: protectedProcedure.input(z.object({ accountId: z.number().int().positive().optional(), instrumentId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(200).default(100) }).optional()).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const filters = [eq(lotMatches.workspaceId, family.workspace.id)];
      if (input?.accountId) filters.push(eq(investmentLots.accountId, input.accountId));
      if (input?.instrumentId) filters.push(eq(investmentLots.instrumentId, input.instrumentId));
      return db.select({
        id: lotMatches.id,
        sellEventId: lotMatches.sellEventId,
        lotId: lotMatches.lotId,
        acquisitionEventId: investmentLots.acquisitionEventId,
        accountId: investmentLots.accountId,
        instrumentId: investmentLots.instrumentId,
        quantity: lotMatches.quantity,
        costBasis: lotMatches.costBasis,
        grossProceeds: lotMatches.grossProceeds,
        allocatedFee: lotMatches.allocatedFee,
        allocatedTax: lotMatches.allocatedTax,
        realizedPnl: lotMatches.realizedPnl,
        currency: lotMatches.currency,
        matchedAt: lotMatches.matchedAt,
      }).from(lotMatches).innerJoin(investmentLots, eq(lotMatches.lotId, investmentLots.id)).where(and(...filters)).orderBy(desc(lotMatches.matchedAt), desc(lotMatches.id)).limit(input?.limit ?? 100);
    }),
    summary: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const [row] = await db.select({
        costBasis: sql<string>`COALESCE(SUM(${lotMatches.costBasis}), 0)`,
        grossProceeds: sql<string>`COALESCE(SUM(${lotMatches.grossProceeds}), 0)`,
        fees: sql<string>`COALESCE(SUM(${lotMatches.allocatedFee}), 0)`,
        taxes: sql<string>`COALESCE(SUM(${lotMatches.allocatedTax}), 0)`,
        realizedPnl: sql<string>`COALESCE(SUM(${lotMatches.realizedPnl}), 0)`,
      }).from(lotMatches).where(eq(lotMatches.workspaceId, family.workspace.id));
      return row ?? { costBasis: "0", grossProceeds: "0", fees: "0", taxes: "0", realizedPnl: "0" };
    }),
  }),

  investments: router({
    transactions: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(200).default(50),
        instrumentId: z.number().int().positive().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        const db = await getDb();
        if (!db) throw notAvailable();
        const filters = [
          eq(financialEvents.workspaceId, family.workspace.id),
          sql`${financialEvents.eventType} IN ('buy', 'sell')`,
        ];
        if (input?.instrumentId) {
          filters.push(eq(financialEvents.instrumentId, input.instrumentId));
        }
        return db
          .select({
            id: financialEvents.id,
            eventType: financialEvents.eventType,
            status: financialEvents.status,
            occurredAt: financialEvents.occurredAt,
            currency: financialEvents.currency,
            grossAmount: financialEvents.grossAmount,
            feeAmount: financialEvents.feeAmount,
            taxAmount: financialEvents.taxAmount,
            quantity: financialEvents.quantity,
            unitPrice: financialEvents.unitPrice,
            memo: financialEvents.memo,
            primaryAccountId: financialEvents.primaryAccountId,
            counterAccountId: financialEvents.counterAccountId,
            instrumentId: financialEvents.instrumentId,
          })
          .from(financialEvents)
          .where(and(...filters))
          .orderBy(desc(financialEvents.occurredAt), desc(financialEvents.id))
          .limit(input?.limit ?? 50);
      }),

    deleteTransaction: protectedProcedure
      .input(z.object({
        id: z.number().int().positive("معرف العملية مطلوب"),
        reason: z.string().trim().max(500).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
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
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();

        const [origEvent] = await db
          .select()
          .from(financialEvents)
          .where(and(
            eq(financialEvents.id, input.id),
            eq(financialEvents.workspaceId, family.workspace.id),
            eq(financialEvents.status, "posted")
          ))
          .limit(1);

        if (!origEvent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "العملية الاستثمارية غير موجودة أو تم إلغاؤها مسبقًا.",
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

        // 1. Reverse original event synchronously (restores lots, inverts GL entries)
        await reverseFinancialEvent({
          context: family,
          actorUserId: ctx.user.id,
          eventId: input.id,
          reason: `تعديل واستبدال الصفقة #${input.id}`,
        });

        // 2. Post replacement trade with updated parameters
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
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const [instrument] = await db.select({ id: instruments.id, currency: instruments.currency }).from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id))).limit(1);
        if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن مساحة FAMILY الحالية." });
        const resolvedOccurredAt = parseTradeTimestamp(input);
        const grossAmount = parsePositiveAmount(input.quantity, "الكمية").mul(parsePositiveAmount(input.unitPrice, "سعر الوحدة"));
        const frozen = await createFrozenApprovalRequest({ db, workspaceId: family.workspace.id, actorUserId: ctx.user.id, actionType: "trade", amount: grossAmount.toFixed(6), currency: instrument.currency, payload: { ...input, occurredAt: resolvedOccurredAt, currency: instrument.currency, grossAmount: grossAmount.toFixed(6) } });
        if (frozen) return { approvalRequired: true as const, approvalRequestId: frozen.id, duplicate: frozen.duplicate };
        const event = await postTrade({ context: family, actorUserId: ctx.user.id, ...input, occurredAt: resolvedOccurredAt });
        return { approvalRequired: false as const, event };
      }),

    previewMarketPrices: protectedProcedure
      .mutation(async ({ ctx }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();

        const instRows = await db
          .select()
          .from(instruments)
          .where(
            and(
              eq(instruments.workspaceId, family.workspace.id),
              sql`${instruments.symbol} IS NOT NULL AND ${instruments.symbol} != ''`
            )
          );

        // Fetch latest recorded quotes for each instrument
        const existingQuotes = await db
          .select()
          .from(priceQuotes)
          .where(eq(priceQuotes.workspaceId, family.workspace.id))
          .orderBy(desc(priceQuotes.asOf));

        const latestByInst = new Map<number, typeof existingQuotes[number]>();
        for (const q of existingQuotes) {
          if (!latestByInst.has(q.instrumentId)) {
            latestByInst.set(q.instrumentId, q);
          }
        }

        const previewList: Array<{
          instrumentId: number;
          symbol: string;
          name: string;
          currency: string;
          assetType?: string;
          currentRecordedPrice: string | null;
          fetchedPrice: string;
          changePercent: number;
          asOf: number;
          dateFormatted: string;
          source: string;
          resolvedSymbol: string;
          isStaleDate: boolean;
          isDeviationWarning: boolean;
          deviationPercent: number;
          sanityStatus: "normal" | "deviation_warning" | "stale_warning";
          sanityMessage: string;
          selectedPrice: string;
        }> = [];

        const errors: Array<{ symbol: string; reason: string }> = [];

        for (const inst of instRows) {
          if (!inst.symbol) continue;
          try {
            const quote = await fetchEgxOrYahooQuote(inst.symbol, inst.currency, undefined, inst.assetType, inst.name);
            const currentQuote = latestByInst.get(inst.id);
            const currentPriceNum = currentQuote?.price ? Number(currentQuote.price) : null;
            const fetchedPriceNum = Number(quote.price);

            const sanity = checkQuoteSanity(fetchedPriceNum, currentPriceNum, quote.asOf, inst.assetType);

            let changePercent = quote.changePercent ?? 0;
            if (!quote.changePercent && currentPriceNum && currentPriceNum > 0) {
              changePercent = Math.round(((fetchedPriceNum - currentPriceNum) / currentPriceNum) * 10000) / 100;
            }

            const dateFormatted = new Date(quote.asOf).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            previewList.push({
              instrumentId: inst.id,
              symbol: inst.symbol,
              name: inst.name,
              currency: inst.currency,
              assetType: inst.assetType,
              currentRecordedPrice: currentQuote?.price ? Number(currentQuote.price).toFixed(2) : null,
              fetchedPrice: fetchedPriceNum.toFixed(2),
              changePercent,
              asOf: quote.asOf,
              dateFormatted,
              source: quote.source,
              resolvedSymbol: quote.resolvedSymbol || inst.symbol,
              isStaleDate: sanity.isStaleDate,
              isDeviationWarning: sanity.isDeviationWarning,
              deviationPercent: sanity.deviationPercent,
              sanityStatus: sanity.status,
              sanityMessage: sanity.message,
              selectedPrice: fetchedPriceNum.toFixed(2),
            });
          } catch (err: any) {
            errors.push({ symbol: inst.symbol, reason: err?.message || "تعذر جلب السعر" });
          }
        }

        return {
          previewList,
          errors,
        };
      }),

    commitMarketPrices: protectedProcedure
      .input(
        z.object({
          quotes: z.array(
            z.object({
              instrumentId: z.number().int().positive(),
              price: z.string().trim().min(1),
              source: z.string().trim().optional(),
              asOf: z.number().int().positive().optional(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();

        const now = Date.now();
        let committedCount = 0;

        for (const item of input.quotes) {
          const priceDecimal = parsePositiveAmount(item.price, "سعر السوق");
          const [inst] = await db
            .select()
            .from(instruments)
            .where(
              and(
                eq(instruments.id, item.instrumentId),
                eq(instruments.workspaceId, family.workspace.id)
              )
            )
            .limit(1);

          if (!inst) continue;

          const asOf = item.asOf || now;
          const source = item.source || "مباشر مصر / سوق مصر";

          const insertResult = await db.insert(priceQuotes).values({
            workspaceId: family.workspace.id,
            instrumentId: inst.id,
            price: priceDecimal.toFixed(8),
            currency: inst.currency,
            source,
            quoteStatus: "delayed",
            asOf,
            createdAt: now,
          });
          const quoteId = Number(insertResult[0].insertId);

          const provResult = await db.insert(valuationProvenance).values(
            buildMarketProvenance({
              workspaceId: family.workspace.id,
              provider: "egx-market-direct",
              source,
              rawSymbol: inst.symbol || inst.name,
              fetchedAt: now,
              asOf,
              status: "delayed",
              metadata: { instrumentId: inst.id, quoteId, price: priceDecimal.toFixed(8) },
            })
          );

          await db.insert(valuationSnapshots).values(
            buildInstrumentSnapshot({
              workspaceId: family.workspace.id,
              instrumentId: inst.id,
              provenanceId: Number(provResult[0].insertId),
              quoteId,
              price: priceDecimal.toFixed(8),
              currency: inst.currency,
              baseCurrency: family.workspace.baseCurrency,
              status: "delayed",
              asOf,
              capturedAt: now,
            })
          );

          await db.update(instruments).set({ updatedAt: now }).where(eq(instruments.id, inst.id));
          committedCount++;
        }

        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);

        return {
          success: true,
          count: committedCount,
        };
      }),

    purgeStaleQuotes: protectedProcedure
      .mutation(async ({ ctx }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();

        const staleDateThreshold = 1735689600000; // 2025-01-01
        const staleQuotes = await db
          .select({ id: priceQuotes.id })
          .from(priceQuotes)
          .where(
            and(
              eq(priceQuotes.workspaceId, family.workspace.id),
              or(
                sql`${priceQuotes.asOf} < ${staleDateThreshold}`,
                like(priceQuotes.source, "%Yahoo%")
              )
            )
          );

        let deletedCount = 0;
        if (staleQuotes.length > 0) {
          const staleIds = staleQuotes.map((q) => q.id);
          const delRes = await db
            .delete(priceQuotes)
            .where(
              and(
                eq(priceQuotes.workspaceId, family.workspace.id),
                inArray(priceQuotes.id, staleIds)
              )
            );
          deletedCount = staleQuotes.length;
        }

        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);

        return {
          success: true,
          deletedCount,
        };
      }),

    syncMarketPrices: protectedProcedure
      .mutation(async ({ ctx }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();

        const instRows = await db
          .select()
          .from(instruments)
          .where(
            and(
              eq(instruments.workspaceId, family.workspace.id),
              sql`${instruments.symbol} IS NOT NULL AND ${instruments.symbol} != ''`
            )
          );

        let updatedCount = 0;
        let skippedCount = 0;
        const failed: Array<{ symbol: string; reason: string }> = [];
        const updatedList: Array<{ id: number; symbol: string; name: string; price: string; currency: string }> = [];
        const now = Date.now();

        for (const inst of instRows) {
          if (!inst.symbol) {
            skippedCount++;
            continue;
          }
          try {
            const quote = await fetchEgxOrYahooQuote(inst.symbol, inst.currency, undefined, inst.assetType, inst.name);
            const insertResult = await db.insert(priceQuotes).values({
              workspaceId: family.workspace.id,
              instrumentId: inst.id,
              price: quote.price,
              currency: quote.currency,
              source: quote.source,
              quoteStatus: quote.quoteStatus,
              asOf: quote.asOf,
              createdAt: now,
            });
            const quoteId = Number(insertResult[0].insertId);
            const provResult = await db.insert(valuationProvenance).values(
              buildMarketProvenance({
                workspaceId: family.workspace.id,
                provider: "egx-market-direct",
                source: quote.source,
                rawSymbol: inst.symbol,
                fetchedAt: now,
                asOf: quote.asOf,
                status: quote.quoteStatus,
                metadata: { instrumentId: inst.id, quoteId, resolvedSymbol: quote.resolvedSymbol },
              })
            );
            await db.insert(valuationSnapshots).values(
              buildInstrumentSnapshot({
                workspaceId: family.workspace.id,
                instrumentId: inst.id,
                provenanceId: Number(provResult[0].insertId),
                quoteId,
                price: quote.price,
                currency: quote.currency,
                baseCurrency: family.workspace.baseCurrency,
                status: quote.quoteStatus,
                asOf: quote.asOf,
                capturedAt: now,
              })
            );
            await db.update(instruments).set({ updatedAt: now }).where(eq(instruments.id, inst.id));

            updatedCount++;
            updatedList.push({
              id: inst.id,
              symbol: inst.symbol,
              name: inst.name,
              price: quote.price,
              currency: quote.currency,
            });
          } catch (err: any) {
            failed.push({ symbol: inst.symbol, reason: err?.message || "فشل مزود السوق" });
          }
        }

        // Sync Egyptian benchmark indices (EGX30, EGX33, EGX70)
        const benchmarkKeys = ["EGX30", "EGX33", "EGX70"];
        for (const bmkKey of benchmarkKeys) {
          try {
            let [bmkInst] = await db
              .select()
              .from(instruments)
              .where(
                and(
                  eq(instruments.workspaceId, family.workspace.id),
                  eq(instruments.symbol, bmkKey)
                )
              )
              .limit(1);

            const bmkInfo = BENCHMARK_SYMBOLS[bmkKey];
            if (!bmkInst && bmkInfo) {
              const created = await db.insert(instruments).values({
                workspaceId: family.workspace.id,
                name: bmkInfo.name,
                symbol: bmkKey,
                assetType: "fund",
                subCategory: "مؤشر سوقي",
                sector: "مؤشرات السوق",
                currency: bmkInfo.currency,
                isin: null,
                createdAt: now,
                updatedAt: now,
              });
              const newId = Number(created[0].insertId);
              bmkInst = { id: newId, symbol: bmkKey, currency: bmkInfo.currency, name: bmkInfo.name } as any;
            }

            if (bmkInst) {
              const bmkQuote = await fetchEgxOrYahooQuote(bmkKey, bmkInst.currency);
              await db.insert(priceQuotes).values({
                workspaceId: family.workspace.id,
                instrumentId: bmkInst.id,
                price: bmkQuote.price,
                currency: bmkQuote.currency,
                source: bmkQuote.source || "egx_benchmark",
                quoteStatus: "delayed",
                asOf: bmkQuote.asOf,
                createdAt: now,
              });
            }
          } catch {}
        }

        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);

        return {
          success: true,
          updatedCount,
          skippedCount,
          failedCount: failed.length,
          failed,
          updatedList,
        };
      }),
  }),

  goals: familyGoalsRouter,
  retirement: familyRetirementRouter,
  risk: familyRiskRouter,


  research: router({
    watchlist: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const [items, quotes] = await Promise.all([
        db.select({ id: watchlistItems.id, note: watchlistItems.note, status: watchlistItems.status, createdAt: watchlistItems.createdAt, instrumentId: instruments.id, name: instruments.name, symbol: instruments.symbol, assetType: instruments.assetType, currency: instruments.currency }).from(watchlistItems).innerJoin(instruments, eq(watchlistItems.instrumentId, instruments.id)).where(and(eq(watchlistItems.workspaceId, family.workspace.id), eq(watchlistItems.profileId, family.profile.id))).orderBy(desc(watchlistItems.createdAt)),
        db.select().from(priceQuotes).where(eq(priceQuotes.workspaceId, family.workspace.id)).orderBy(desc(priceQuotes.asOf)),
      ]);
      const latestQuote = new Map<number, typeof quotes[number]>();
      quotes.forEach(quote => { if (!latestQuote.has(quote.instrumentId)) latestQuote.set(quote.instrumentId, quote); });
      return items.map(item => ({ ...item, latestQuote: latestQuote.get(item.instrumentId) ?? null }));
    }),
    addWatchlistItem: protectedProcedure.input(z.object({ instrumentId: z.number().int().positive(), note: z.string().trim().max(2000).nullable() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [instrument] = await db.select({ id: instruments.id }).from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id))).limit(1);
      if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة غير موجودة ضمن نطاق FAMILY الحالي." });
      const now = Date.now();
      await db.insert(watchlistItems).values({ workspaceId: family.workspace.id, profileId: family.profile.id, instrumentId: instrument.id, note: input.note, status: "active", createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { note: input.note, status: "active", createdByUserId: ctx.user.id, updatedAt: now } });
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "watchlist_item.upserted", targetType: "watchlist_item", targetId: String(instrument.id), beforeState: null, afterState: input, requestId: crypto.randomUUID(), occurredAt: now });
      return { instrumentId: instrument.id };
    }),
    archiveWatchlistItem: protectedProcedure.input(z.object({ itemId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [item] = await db.select().from(watchlistItems).where(and(eq(watchlistItems.id, input.itemId), eq(watchlistItems.workspaceId, family.workspace.id), eq(watchlistItems.profileId, family.profile.id))).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "عنصر المراقبة غير موجود ضمن نطاقك." });
      const now = Date.now();
      await db.update(watchlistItems).set({ status: "archived", updatedAt: now }).where(eq(watchlistItems.id, item.id));
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "watchlist_item.archived", targetType: "watchlist_item", targetId: String(item.id), beforeState: { status: item.status }, afterState: { status: "archived" }, requestId: crypto.randomUUID(), occurredAt: now });
      return { id: item.id };
    }),
    notes: protectedProcedure.query(async () => [] as Array<{ id: number; title: string; thesis: string; risks: string | null; sourceUrl: string | null; status: string; createdAt: number; updatedAt: number; instrumentId: number | null; instrumentName: string | null; symbol: string | null }>),
    createNote: protectedProcedure.input(z.object({ instrumentId: z.number().int().positive().nullable(), title: z.string().trim().min(2).max(180), thesis: z.string().trim().min(2).max(12_000), risks: z.string().trim().max(12_000).nullable(), sourceUrl: z.string().trim().url().max(2048).nullable(), status: z.enum(["draft", "active"]).default("draft") })).mutation(async () => {
      throw new TRPCError({ code: "BAD_REQUEST", message: "نظام الملاحظات البحثية متوقف في هذا الإصدار." });
    }),
  }),

  market: router({
    getDerivedGoldPrice: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const [goldQuote] = await db
        .select()
        .from(priceQuotes)
        .where(and(eq(priceQuotes.workspaceId, family.workspace.id), eq(priceQuotes.currency, "USD")))
        .orderBy(desc(priceQuotes.asOf))
        .limit(1);
      const [usdRate] = await db
        .select()
        .from(fxRates)
        .where(
          and(
            eq(fxRates.workspaceId, family.workspace.id),
            eq(fxRates.fromCurrency, "USD"),
            eq(fxRates.toCurrency, "EGP")
          )
        )
        .orderBy(desc(fxRates.asOf))
        .limit(1);
      const goldOunceUsd = goldQuote?.price ? Number(goldQuote.price) : 2600.0;
      const usdEgpRate = usdRate?.rate ? Number(usdRate.rate) : 48.5;
      return calculateGold24kGramEgp({ goldOunceUsd, usdEgpRate });
    }),
    recordFundNav: protectedProcedure
      .input(
        z.object({
          instrumentId: z.number().int().positive(),
          navPrice: money,
          asOf: z.number().int().positive().optional(),
          source: z.string().trim().max(120).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const [instrument] = await db
          .select()
          .from(instruments)
          .where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id)))
          .limit(1);
        if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة أو الصندوق الاستثماري غير موجود." });
        const now = Date.now();
        const asOf = input.asOf ?? now;
        const insert = await db.insert(priceQuotes).values({
          workspaceId: family.workspace.id,
          instrumentId: instrument.id,
          price: input.navPrice,
          currency: instrument.currency,
          source: input.source || "تقييم يدوي معتمد لوثيقة الصندوق",
          quoteStatus: "manual",
          asOf,
          createdAt: now,
        });
        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        return { id: Number(insert[0].insertId), price: input.navPrice };
      }),
    getPriceTriggers: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const items = await db
        .select({
          instrumentId: watchlistItems.instrumentId,
          note: watchlistItems.note,
        })
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.workspaceId, family.workspace.id),
            eq(watchlistItems.profileId, family.profile.id)
          )
        );
      const triggersMap: Record<number, { targetBuyPrice?: string | null; targetTakeProfitPrice?: string | null }> = {};
      items.forEach((item) => {
        if (item.note) {
          try {
            const parsed = JSON.parse(item.note);
            if (parsed && typeof parsed === "object") {
              triggersMap[item.instrumentId] = {
                targetBuyPrice: parsed.targetBuyPrice ?? null,
                targetTakeProfitPrice: parsed.targetTakeProfitPrice ?? null,
              };
            }
          } catch {
            // Not a JSON note
          }
        }
      });
      return triggersMap;
    }),
    setPriceTriggers: protectedProcedure
      .input(
        z.object({
          instrumentId: z.number().int().positive(),
          targetBuyPrice: money.optional().nullable(),
          targetTakeProfitPrice: money.optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const now = Date.now();
        const notePayload = JSON.stringify({
          targetBuyPrice: input.targetBuyPrice || null,
          targetTakeProfitPrice: input.targetTakeProfitPrice || null,
          updatedAt: now,
        });
        await db
          .insert(watchlistItems)
          .values({
            workspaceId: family.workspace.id,
            profileId: family.profile.id,
            instrumentId: input.instrumentId,
            note: notePayload,
            status: "active",
            createdByUserId: ctx.user.id,
            createdAt: now,
            updatedAt: now,
          })
          .onDuplicateKeyUpdate({
            set: { note: notePayload, status: "active", createdByUserId: ctx.user.id, updatedAt: now },
          });
        return { success: true };
      }),
  }),

  feeTax: familyFeeTaxRouter,
  specialAssets: familySpecialAssetsRouter,
  insurance: familyInsuranceRouter,


  ious: router({
    list: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select().from(personalIous).where(and(eq(personalIous.workspaceId, family.workspace.id), eq(personalIous.profileId, family.profile.id))).orderBy(personalIous.dueAt); }),
    create: protectedProcedure.input(z.object({ direction: z.enum(["receivable", "payable"]), counterpartyName: z.string().trim().min(2).max(200), description: z.string().trim().max(4000).nullable(), amount: money, currency, dueAt: occurredAt.nullable() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const amount = parsePositiveAmount(input.amount, "قيمة المستحق"); const now = Date.now(); const result = await db.insert(personalIous).values({ workspaceId: family.workspace.id, profileId: family.profile.id, direction: input.direction, counterpartyName: input.counterpartyName, description: input.description, amount: amount.toFixed(6), currency: input.currency.toUpperCase(), dueAt: input.dueAt, settlementEventId: null, status: "active", createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }); const id = Number(result[0].insertId); await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "personal_iou.created", targetType: "personal_iou", targetId: String(id), beforeState: null, afterState: { direction: input.direction, amount: amount.toFixed(6), currency: input.currency.toUpperCase(), dueAt: input.dueAt }, requestId: crypto.randomUUID(), occurredAt: now }); return { id }; }),
    settle: protectedProcedure.input(z.object({ iouId: z.number().int().positive(), financialEventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const [iou] = await db.select().from(personalIous).where(and(eq(personalIous.id, input.iouId), eq(personalIous.workspaceId, family.workspace.id), eq(personalIous.profileId, family.profile.id), eq(personalIous.status, "active"))).limit(1); if (!iou) throw new TRPCError({ code: "NOT_FOUND", message: "المستحق النشط غير موجود ضمن نطاقك." }); const requiredEventType = iou.direction === "receivable" ? "income" : "expense"; const [event] = await db.select({ id: financialEvents.id, eventType: financialEvents.eventType, currency: financialEvents.currency, status: financialEvents.status }).from(financialEvents).where(and(eq(financialEvents.id, input.financialEventId), eq(financialEvents.workspaceId, family.workspace.id), eq(financialEvents.profileId, family.profile.id), eq(financialEvents.status, "posted"))).limit(1); if (!event || event.eventType !== requiredEventType || event.currency !== iou.currency) throw new TRPCError({ code: "BAD_REQUEST", message: "اربط المستحق بحركة دفتر منشورة وبالنوع والعملة المتوافقين." }); const now = Date.now(); await db.transaction(async tx => { await tx.update(personalIous).set({ status: "settled", settlementEventId: event.id, updatedAt: now }).where(eq(personalIous.id, iou.id)); await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "personal_iou.settled", targetType: "personal_iou", targetId: String(iou.id), beforeState: { status: "active", settlementEventId: null }, afterState: { status: "settled", settlementEventId: event.id }, requestId: crypto.randomUUID(), occurredAt: now }); }); return { id: iou.id, settlementEventId: event.id }; }),
  }),

  vault: router({
    list: protectedProcedure.input(z.object({ linkedEntityType: z.string().trim().max(80).optional(), linkedEntityId: z.string().trim().max(100).optional() })).query(async ({ ctx, input }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); const conditions = [eq(vaultDocuments.workspaceId, family.workspace.id), eq(vaultDocuments.profileId, family.profile.id)]; if (input.linkedEntityType) conditions.push(eq(vaultDocuments.linkedEntityType, input.linkedEntityType)); if (input.linkedEntityId) conditions.push(eq(vaultDocuments.linkedEntityId, input.linkedEntityId)); const rows = await db.select({ id: vaultDocuments.id, encryptedOriginalName: vaultDocuments.encryptedOriginalName, mimeType: vaultDocuments.mimeType, byteSize: vaultDocuments.byteSize, sha256: vaultDocuments.sha256, linkedEntityType: vaultDocuments.linkedEntityType, linkedEntityId: vaultDocuments.linkedEntityId, createdAt: vaultDocuments.createdAt, updatedAt: vaultDocuments.updatedAt }).from(vaultDocuments).where(and(...conditions)).orderBy(desc(vaultDocuments.createdAt)); return rows.map(row => ({ ...row, originalName: decryptVaultValue(row.encryptedOriginalName), encryptedOriginalName: undefined })); }),
    upload: protectedProcedure.input(z.object({ originalName: z.string().trim().min(1).max(240), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"]), contentBase64: z.string().min(4).max(11_200_000).regex(/^[A-Za-z0-9+/]+={0,2}$/), linkedEntityType: z.enum(["general", "insurance_policy", "insurance_claim", "special_asset", "financial_event"]), linkedEntityId: z.string().trim().min(1).max(100) })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const bytes = Buffer.from(input.contentBase64, "base64"); if (!bytes.length || bytes.length > 8_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "الحد الأقصى لمستند الخزنة هو 8 ميغابايت." }); const db = await getDb(); if (!db) throw notAvailable(); await assertVaultLink(db, family.workspace.id, family.profile.id, input.linkedEntityType, input.linkedEntityId); const object = await storagePut(`vault/${family.workspace.id}/${crypto.randomUUID()}`, bytes, input.mimeType); const now = Date.now(); const originalName = input.originalName.replace(/[\\/]/g, "_"); const sha256 = createHash("sha256").update(bytes).digest("hex"); const encryptedStorageKey = encryptVaultValue(object.key); const encryptedOriginalName = encryptVaultValue(originalName); const inserted = await db.insert(vaultDocuments).values({ workspaceId: family.workspace.id, profileId: family.profile.id, encryptedStorageKey, encryptedOriginalName, mimeType: input.mimeType, byteSize: bytes.length, sha256, linkedEntityType: input.linkedEntityType, linkedEntityId: input.linkedEntityId, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }); const id = Number(inserted[0].insertId); await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "vault_document.uploaded", targetType: "vault_document", targetId: String(id), beforeState: null, afterState: { mimeType: input.mimeType, byteSize: bytes.length, sha256, linkedEntityType: input.linkedEntityType, linkedEntityId: input.linkedEntityId }, requestId: crypto.randomUUID(), occurredAt: now }); return { id, mimeType: input.mimeType, byteSize: bytes.length, sha256 }; }),
    download: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); const [document] = await db.select().from(vaultDocuments).where(and(eq(vaultDocuments.id, input.documentId), eq(vaultDocuments.workspaceId, family.workspace.id), eq(vaultDocuments.profileId, family.profile.id))).limit(1); if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "المستند غير موجود ضمن مساحة FAMILY الحالية." }); let key: string; let name: string; try { key = decryptVaultValue(document.encryptedStorageKey); name = decryptVaultValue(document.encryptedOriginalName); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر فتح بيانات المستند المشفرة." }); } await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "vault_document.download_requested", targetType: "vault_document", targetId: String(document.id), beforeState: null, afterState: { mimeType: document.mimeType, byteSize: document.byteSize }, requestId: crypto.randomUUID(), occurredAt: Date.now() }); return { url: await storageGetSignedUrl(key), filename: name, mimeType: document.mimeType }; }),
  }),

  exports: router({
    family: protectedProcedure.input(z.object({ format: z.enum(["json", "csv"]) })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "advisor"); const db = await getDb(); if (!db) throw notAvailable(); const [summary, accountsSnapshot, events, portfolio, iouRows, zakatRows] = await Promise.all([getDashboardSummary(family), listAccountSnapshots(family), listRecentEvents(family, 2_000), listPortfolioPositions(family), db.select().from(personalIous).where(and(eq(personalIous.workspaceId, family.workspace.id), eq(personalIous.profileId, family.profile.id))), db.select().from(zakatAssessments).where(and(eq(zakatAssessments.workspaceId, family.workspace.id), eq(zakatAssessments.profileId, family.profile.id)))]); const exportedAt = Date.now(); const payload = { metadata: { workspaceId: family.workspace.id, baseCurrency: family.workspace.baseCurrency, exportedAt, scope: "family-private-export-v1" }, summary, accounts: accountsSnapshot, portfolio, financialEvents: events, personalIous: iouRows, zakatAssessments: zakatRows }; await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "family_data.exported", targetType: "family_export", targetId: String(exportedAt), beforeState: null, afterState: { format: input.format, eventCount: events.length, accountCount: accountsSnapshot.length }, requestId: crypto.randomUUID(), occurredAt: exportedAt }); if (input.format === "json") return { filename: `family-export-${new Date(exportedAt).toISOString().slice(0, 10)}.json`, contentType: "application/json", content: JSON.stringify(payload, null, 2) }; const rows = ["section,id,name,amount,currency,date,status", ...accountsSnapshot.map(row => ["account", row.id, row.name, row.balance, row.currency, "", row.status].map(csvCell).join(",")), ...events.map(row => ["financial_event", row.id, row.eventType, row.grossAmount, row.currency, new Date(row.occurredAt).toISOString(), row.status].map(csvCell).join(",")), ...iouRows.map(row => ["personal_iou", row.id, row.counterpartyName, row.amount, row.currency, row.dueAt ? new Date(row.dueAt).toISOString() : "", row.status].map(csvCell).join(",")), ...zakatRows.map(row => ["zakat_assessment", row.id, "zakat", row.zakatDueBase, row.currency, new Date(row.assessedAt).toISOString(), row.status].map(csvCell).join(","))]; return { filename: `family-export-${new Date(exportedAt).toISOString().slice(0, 10)}.csv`, contentType: "text/csv;charset=utf-8", content: rows.join("\n") }; }),
  }),

  reports: financialStatementsRouter,
  wealthHealth: wealthHealthRouter,

  zakat: familyZakatRouter,


  prices: router({
    recordManual: protectedProcedure
      .input(z.object({ instrumentId: z.number().int().positive(), price: money, asOf: occurredAt }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "advisor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const [instrument] = await db.select().from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id))).limit(1);
        if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن نطاقك المالي." });
        const value = parsePositiveAmount(input.price, "سعر السوق");
        const now = Date.now();
        const result = await db.insert(priceQuotes).values({ workspaceId: family.workspace.id, instrumentId: instrument.id, price: value.toFixed(8), currency: instrument.currency, source: "user_manual", quoteStatus: "manual", asOf: input.asOf, createdAt: now });
        const id = Number(result[0].insertId);
        const provenance = await db.insert(valuationProvenance).values(buildManualProvenance({ workspaceId: family.workspace.id, source: "user_manual", rawSymbol: instrument.symbol, asOf: input.asOf, capturedAt: now, userId: ctx.user.id }));
        await db.insert(valuationSnapshots).values(buildInstrumentSnapshot({ workspaceId: family.workspace.id, instrumentId: instrument.id, provenanceId: Number(provenance[0].insertId), quoteId: id, price: value.toFixed(8), currency: instrument.currency, baseCurrency: family.workspace.baseCurrency, status: "manual", asOf: input.asOf, capturedAt: now }));
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "price.recorded", targetType: "price_quote", targetId: String(id), beforeState: null, afterState: { instrumentId: instrument.id, price: value.toFixed(8), currency: instrument.currency, asOf: input.asOf }, requestId: crypto.randomUUID(), occurredAt: now });
        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
        return { id, quoteStatus: "manual" as const };
      }),
    refreshYahoo: protectedProcedure
      .input(z.object({ instrumentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "advisor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const [instrument] = await db.select().from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id))).limit(1);
        if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن مساحة FAMILY الحالية." });
        if (!["equity", "fund", "gold"].includes(instrument.assetType) || !instrument.symbol) throw new TRPCError({ code: "BAD_REQUEST", message: "تحديث Yahoo يتطلب سهماً أو صندوقاً أو أداة ذهب لها رمز سوقي." });
        let quote;
        try { quote = await fetchEgxOrYahooQuote(instrument.symbol, instrument.currency); } catch { throw new TRPCError({ code: "BAD_GATEWAY", message: "تعذر الحصول على سعر صالح من السوق أو البورصة المصرية الآن. استخدم تسجيلاً يدويًا أو حاول لاحقًا." }); }
        if (quote.currency !== instrument.currency) throw new TRPCError({ code: "BAD_GATEWAY", message: "عملة سعر السوق لا تطابق عملة الأداة المسجلة؛ راجع رمز السوق أو سجّل سعراً يدويًا." });
        const now = Date.now();
        const result = await db.insert(priceQuotes).values({ workspaceId: family.workspace.id, instrumentId: instrument.id, price: quote.price, currency: quote.currency, source: quote.source, quoteStatus: quote.quoteStatus, asOf: quote.asOf, createdAt: now });
        const id = Number(result[0].insertId);
        const provenance = await db.insert(valuationProvenance).values(buildMarketProvenance({ workspaceId: family.workspace.id, provider: "yahoo-finance2", source: quote.source, rawSymbol: instrument.symbol, fetchedAt: now, asOf: quote.asOf, status: quote.quoteStatus, metadata: { instrumentId: instrument.id, quoteId: id } }));
        await db.insert(valuationSnapshots).values(buildInstrumentSnapshot({ workspaceId: family.workspace.id, instrumentId: instrument.id, provenanceId: Number(provenance[0].insertId), quoteId: id, price: quote.price, currency: quote.currency, baseCurrency: family.workspace.baseCurrency, status: quote.quoteStatus, asOf: quote.asOf, capturedAt: now }));
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "price.refreshed_yahoo", targetType: "price_quote", targetId: String(id), beforeState: null, afterState: { instrumentId: instrument.id, symbol: instrument.symbol, price: quote.price, currency: quote.currency, asOf: quote.asOf, source: quote.source, quoteStatus: quote.quoteStatus }, requestId: crypto.randomUUID(), occurredAt: now });
        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
        return { id, instrumentId: instrument.id, ...quote };
      }),
    syncMarketPrices: protectedProcedure
      .mutation(async ({ ctx }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();

        const instRows = await db
          .select()
          .from(instruments)
          .where(
            and(
              eq(instruments.workspaceId, family.workspace.id),
              sql`${instruments.symbol} IS NOT NULL AND ${instruments.symbol} != ''`
            )
          );

        let updatedCount = 0;
        let skippedCount = 0;
        const failed: Array<{ symbol: string; reason: string }> = [];
        const updatedList: Array<{ id: number; symbol: string; name: string; price: string; currency: string }> = [];
        const now = Date.now();

        for (const inst of instRows) {
          if (!inst.symbol) {
            skippedCount++;
            continue;
          }
          try {
            const quote = await fetchEgxOrYahooQuote(inst.symbol, inst.currency);
            const insertResult = await db.insert(priceQuotes).values({
              workspaceId: family.workspace.id,
              instrumentId: inst.id,
              price: quote.price,
              currency: quote.currency,
              source: quote.source,
              quoteStatus: quote.quoteStatus,
              asOf: quote.asOf,
              createdAt: now,
            });
            const quoteId = Number(insertResult[0].insertId);
            const provResult = await db.insert(valuationProvenance).values(
              buildMarketProvenance({
                workspaceId: family.workspace.id,
                provider: "yahoo-finance-egx",
                source: quote.source,
                rawSymbol: inst.symbol,
                fetchedAt: now,
                asOf: quote.asOf,
                status: quote.quoteStatus,
                metadata: { instrumentId: inst.id, quoteId, resolvedSymbol: quote.resolvedSymbol },
              })
            );
            await db.insert(valuationSnapshots).values(
              buildInstrumentSnapshot({
                workspaceId: family.workspace.id,
                instrumentId: inst.id,
                provenanceId: Number(provResult[0].insertId),
                quoteId,
                price: quote.price,
                currency: quote.currency,
                baseCurrency: family.workspace.baseCurrency,
                status: quote.quoteStatus,
                asOf: quote.asOf,
                capturedAt: now,
              })
            );
            await db.update(instruments).set({ updatedAt: now }).where(eq(instruments.id, inst.id));

            updatedCount++;
            updatedList.push({
              id: inst.id,
              symbol: inst.symbol,
              name: inst.name,
              price: quote.price,
              currency: quote.currency,
            });
          } catch (err: any) {
            failed.push({ symbol: inst.symbol, reason: err?.message || "فشل مزود السوق" });
          }
        }

        // Benchmark indices
        const benchmarkKeys = ["EGX30", "EGX33", "EGX70"];
        for (const bmkKey of benchmarkKeys) {
          try {
            let [bmkInst] = await db
              .select()
              .from(instruments)
              .where(
                and(
                  eq(instruments.workspaceId, family.workspace.id),
                  eq(instruments.symbol, bmkKey)
                )
              )
              .limit(1);

            const bmkInfo = BENCHMARK_SYMBOLS[bmkKey];
            if (!bmkInst && bmkInfo) {
              const created = await db.insert(instruments).values({
                workspaceId: family.workspace.id,
                name: bmkInfo.name,
                symbol: bmkKey,
                assetType: "fund",
                subCategory: "مؤشر سوقي",
                sector: "مؤشرات السوق",
                currency: bmkInfo.currency,
                isin: null,
                createdAt: now,
                updatedAt: now,
              });
              const newId = Number(created[0].insertId);
              bmkInst = { id: newId, symbol: bmkKey, currency: bmkInfo.currency, name: bmkInfo.name } as any;
            }

            if (bmkInst) {
              const bmkQuote = await fetchEgxOrYahooQuote(bmkKey, bmkInst.currency);
              await db.insert(priceQuotes).values({
                workspaceId: family.workspace.id,
                instrumentId: bmkInst.id,
                price: bmkQuote.price,
                currency: bmkQuote.currency,
                source: "yahoo_finance_benchmark",
                quoteStatus: "delayed",
                asOf: bmkQuote.asOf,
                createdAt: now,
              });
            }
          } catch {}
        }

        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);

        return {
          success: true,
          updatedCount,
          skippedCount,
          failedCount: failed.length,
          failed,
          updatedList,
        };
      }),
  }),

  fx: router({
    recordManual: protectedProcedure
      .input(z.object({ fromCurrency: currency, toCurrency: currency, rate: money, asOf: occurredAt }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "advisor");
        const fromCurrency = input.fromCurrency.toUpperCase();
        const toCurrency = input.toCurrency.toUpperCase();
        if (fromCurrency === toCurrency) throw new TRPCError({ code: "BAD_REQUEST", message: "العملتان يجب أن تكونا مختلفتين." });
        const rate = parsePositiveAmount(input.rate, "سعر الصرف");
        const db = await getDb();
        if (!db) throw notAvailable();
        const now = Date.now();
        const result = await db.insert(fxRates).values({ workspaceId: family.workspace.id, fromCurrency, toCurrency, rate: rate.toFixed(10), source: "user_manual", rateStatus: "manual", asOf: input.asOf, createdAt: now });
        const id = Number(result[0].insertId);
        await db.insert(valuationProvenance).values(buildManualProvenance({ workspaceId: family.workspace.id, source: "user_manual", rawSymbol: `${fromCurrency}/${toCurrency}`, asOf: input.asOf, capturedAt: now, userId: ctx.user.id }));
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "fx_rate.recorded", targetType: "fx_rate", targetId: String(id), beforeState: null, afterState: { fromCurrency, toCurrency, rate: rate.toFixed(10), asOf: input.asOf }, requestId: crypto.randomUUID(), occurredAt: now });
        invalidateReadModelCache(`fx:${family.workspace.id}`);
        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
        return { id, rateStatus: "manual" as const };
      }),
    refreshFrankfurter: protectedProcedure
      .input(z.object({ fromCurrency: currency }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "advisor");
        const fromCurrency = input.fromCurrency.toUpperCase();
        const toCurrency = family.workspace.baseCurrency;
        if (fromCurrency === toCurrency) return { skipped: true as const, message: "عملة الأساس لا تحتاج سعر صرف." };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        let payload: { date?: string; rate?: unknown };
        try {
          const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(fromCurrency)}/${encodeURIComponent(toCurrency)}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`upstream status ${response.status}`);
          payload = await response.json() as { date?: string; rate?: unknown };
        } catch {
          throw new TRPCError({ code: "BAD_GATEWAY", message: "تعذر جلب سعر الصرف من المصدر العام الآن. أدخله يدويًا أو حاول لاحقًا." });
        } finally {
          clearTimeout(timeout);
        }
        const rate = parsePositiveAmount(String(payload.rate ?? ""), "سعر الصرف المستورد");
        const asOf = payload.date ? Date.parse(`${payload.date}T00:00:00.000Z`) : Date.now();
        if (!Number.isFinite(asOf)) throw new TRPCError({ code: "BAD_GATEWAY", message: "أعاد مصدر السعر تاريخًا غير صالح." });
        const db = await getDb();
        if (!db) throw notAvailable();
        const now = Date.now();
        const result = await db.insert(fxRates).values({ workspaceId: family.workspace.id, fromCurrency, toCurrency, rate: rate.toFixed(10), source: "Frankfurter v2 (public sources)", rateStatus: "delayed", asOf, createdAt: now });
        const id = Number(result[0].insertId);
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "fx_rate.refreshed_frankfurter", targetType: "fx_rate", targetId: String(id), beforeState: null, afterState: { fromCurrency, toCurrency, rate: rate.toFixed(10), asOf, source: "Frankfurter v2 (public sources)", rateStatus: "delayed" }, requestId: crypto.randomUUID(), occurredAt: now });
        invalidateReadModelCache(`fx:${family.workspace.id}`);
        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
        return { id, fromCurrency, toCurrency, rate: rate.toFixed(10), asOf, rateStatus: "delayed" as const, source: "Frankfurter v2 (public sources)" };
      }),
    refreshYahoo: protectedProcedure
      .input(z.object({ fromCurrency: currency }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "advisor");
        const fromCurrency = input.fromCurrency.toUpperCase();
        const toCurrency = family.workspace.baseCurrency;
        if (fromCurrency === toCurrency) return { skipped: true as const, message: "عملة الأساس لا تحتاج سعر صرف." };
        let quote;
        try {
          quote = await fetchYahooFxQuote(fromCurrency, toCurrency);
        } catch {
          throw new TRPCError({ code: "BAD_GATEWAY", message: "تعذر الحصول على زوج الصرف من Yahoo Finance الآن. أدخل السعر يدويًا أو حاول لاحقًا." });
        }
        const db = await getDb();
        if (!db) throw notAvailable();
        const now = Date.now();
        const result = await db.insert(fxRates).values({ workspaceId: family.workspace.id, fromCurrency, toCurrency, rate: quote.price, source: quote.source, rateStatus: quote.quoteStatus, asOf: quote.asOf, createdAt: now });
        const id = Number(result[0].insertId);
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "fx_rate.refreshed_yahoo", targetType: "fx_rate", targetId: String(id), beforeState: null, afterState: { fromCurrency, toCurrency, rate: quote.price, asOf: quote.asOf, symbol: quote.symbol, source: quote.source, rateStatus: quote.quoteStatus }, requestId: crypto.randomUUID(), occurredAt: now });
        invalidateReadModelCache(`fx:${family.workspace.id}`);
        invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
        invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
        return { id, ...quote };
      }),
  }),

  imports: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      return db.select({
        id: bankStatementImports.id, accountId: bankStatementImports.accountId, accountName: accounts.name, originalFilename: bankStatementImports.originalFilename,
        currency: bankStatementImports.currency, status: bankStatementImports.status, rowCount: bankStatementImports.rowCount, createdAt: bankStatementImports.createdAt,
      }).from(bankStatementImports).innerJoin(accounts, eq(bankStatementImports.accountId, accounts.id)).where(eq(bankStatementImports.workspaceId, family.workspace.id)).orderBy(desc(bankStatementImports.createdAt)).limit(20);
    }),
    rows: protectedProcedure.input(z.object({ importId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const [statement] = await db.select({ id: bankStatementImports.id, accountId: bankStatementImports.accountId, accountName: accounts.name, currency: bankStatementImports.currency, originalFilename: bankStatementImports.originalFilename, status: bankStatementImports.status, rowCount: bankStatementImports.rowCount }).from(bankStatementImports).innerJoin(accounts, eq(bankStatementImports.accountId, accounts.id)).where(and(eq(bankStatementImports.id, input.importId), eq(bankStatementImports.workspaceId, family.workspace.id))).limit(1);
      if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "ملف الاستيراد غير موجود ضمن مساحة FAMILY الحالية." });
      const rows = await db.select({
        id: bankStatementRows.id, sourceRowNumber: bankStatementRows.sourceRowNumber, occurredAt: bankStatementRows.occurredAt, description: bankStatementRows.description,
        amount: bankStatementRows.amount, currency: bankStatementRows.currency, externalRef: bankStatementRows.externalRef, classification: bankStatementRows.classification,
        categoryId: bankStatementRows.categoryId, categoryName: cashFlowCategories.name, matchStatus: bankStatementRows.matchStatus, matchedEventId: bankStatementRows.matchedEventId,
        postedEventId: bankStatementRows.postedEventId, reviewNote: bankStatementRows.reviewNote,
      }).from(bankStatementRows).leftJoin(cashFlowCategories, eq(bankStatementRows.categoryId, cashFlowCategories.id)).where(and(eq(bankStatementRows.importId, statement.id), eq(bankStatementRows.workspaceId, family.workspace.id))).orderBy(bankStatementRows.sourceRowNumber);
      return { statement, rows };
    }),
    uploadCsv: protectedProcedure.input(z.object({
      accountId: z.number().int().positive(), filename: z.string().trim().min(1).max(255), currency,
      content: z.string().min(3).max(1_000_000),
      mapping: z.object({ dateColumn: z.string().min(1), descriptionColumn: z.string().min(1), amountColumn: z.string().min(1).nullable().optional(), debitColumn: z.string().min(1).nullable().optional(), creditColumn: z.string().min(1).nullable().optional(), referenceColumn: z.string().min(1).nullable().optional() }),
    })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const parsed = parseCsv(input.content);
      const mapping = { ...input.mapping, amountColumn: input.mapping.amountColumn ?? null, debitColumn: input.mapping.debitColumn ?? null, creditColumn: input.mapping.creditColumn ?? null, referenceColumn: input.mapping.referenceColumn ?? null };
      validateColumnMapping(parsed.headers, mapping);
      if (parsed.rows.length > 500) throw new TRPCError({ code: "BAD_REQUEST", message: "يدعم Inbox حتى 500 صف في الملف الواحد ضمن الإصدار الحالي." });
      const [account] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.workspaceId, family.workspace.id), eq(accounts.status, "active"))).limit(1);
      if (!account || !["cash", "bank", "brokerage", "wallet"].includes(account.accountType)) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر حساباً نقدياً أو مصرفياً أو وساطة نشطاً لاستيراد كشف الحساب." });
      const normalizedCurrency = input.currency.toUpperCase();
      if (account.currency !== normalizedCurrency) throw new TRPCError({ code: "BAD_REQUEST", message: "عملة الملف يجب أن تطابق عملة الحساب المختار." });
      const contentHash = sha256(input.content);
      const [existingImport] = await db.select({ id: bankStatementImports.id }).from(bankStatementImports).where(and(eq(bankStatementImports.workspaceId, family.workspace.id), eq(bankStatementImports.accountId, account.id), eq(bankStatementImports.contentHash, contentHash))).limit(1);
      if (existingImport) throw new TRPCError({ code: "CONFLICT", message: "تم رفع هذا الكشف للحساب نفسه مسبقاً؛ راجع Inbox الموجود بدلاً من تكراره." });
      const safeFilename = input.filename.replace(/[^\w.\-\u0600-\u06FF]/g, "_");
      const stored = await storagePut(`family/${family.workspace.id}/bank-imports/${Date.now()}-${safeFilename}`, input.content, "text/csv;charset=utf-8");
      const rows = buildImportRows({ rows: parsed.rows, mapping, contentHash });
      const events = await db.select({ id: financialEvents.id, externalRef: financialEvents.externalRef, occurredAt: financialEvents.occurredAt, grossAmount: financialEvents.grossAmount, eventType: financialEvents.eventType }).from(financialEvents).where(eq(financialEvents.workspaceId, family.workspace.id)).orderBy(desc(financialEvents.occurredAt)).limit(2_000);
      const now = Date.now();
      const inserted = await db.transaction(async tx => {
        const result = await tx.insert(bankStatementImports).values({ workspaceId: family.workspace.id, accountId: account.id, originalFilename: safeFilename, storageKey: stored.key, contentHash, currency: normalizedCurrency, columnMapping: mapping, status: "review", rowCount: rows.length, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now });
        const importId = Number(result[0].insertId);
        if (rows.length) await tx.insert(bankStatementRows).values(rows.map(row => {
          const matched = detectDuplicate({ row, events });
          return { workspaceId: family.workspace.id, importId, sourceRowNumber: row.sourceRowNumber, rawData: row.rawData, occurredAt: row.occurredAt, description: row.description, amount: row.amount, currency: normalizedCurrency, externalRef: row.externalRef, classification: row.classification, categoryId: null, matchStatus: row.matchStatus === "invalid" ? "invalid" : matched.status, matchedEventId: matched.eventId, postedEventId: null, reviewNote: row.reviewNote, idempotencyKey: row.idempotencyKey, createdAt: now, updatedAt: now };
        }));
        await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "bank_import.created", targetType: "bank_statement_import", targetId: String(importId), beforeState: null, afterState: { filename: safeFilename, accountId: account.id, rowCount: rows.length, storageKey: stored.key }, requestId: crypto.randomUUID(), occurredAt: now });
        return { importId };
      });
      return { ...inserted, rowCount: rows.length, delimiter: parsed.delimiter };
    }),
    reviewRow: protectedProcedure.input(z.object({ importId: z.number().int().positive(), rowId: z.number().int().positive(), classification: z.enum(["income", "expense", "transfer", "ignore", "unclassified"]), categoryId: z.number().int().positive().nullable(), reviewNote: z.string().trim().max(2_000).nullable() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [row] = await db.select().from(bankStatementRows).innerJoin(bankStatementImports, eq(bankStatementRows.importId, bankStatementImports.id)).where(and(eq(bankStatementRows.id, input.rowId), eq(bankStatementRows.importId, input.importId), eq(bankStatementRows.workspaceId, family.workspace.id), eq(bankStatementImports.workspaceId, family.workspace.id))).limit(1);
      if (!row || row.bank_statement_rows.matchStatus === "posted") throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل صف غير موجود أو تم ترحيله بالفعل." });
      if (["income", "expense"].includes(input.classification) && !input.categoryId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر فئة دخل أو مصروف قبل اعتماد الصف للترحيل." });
      if (input.categoryId) {
        const [category] = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.id, input.categoryId), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.isArchived, "no"))).limit(1);
        if (!category || ((input.classification === "income" && category.direction !== "income") || (input.classification === "expense" && category.direction !== "expense"))) throw new TRPCError({ code: "BAD_REQUEST", message: "الفئة المختارة غير صالحة لتصنيف الصف." });
      }
      const nextStatus = input.classification === "ignore" ? "excluded" : row.bank_statement_rows.matchStatus === "excluded" ? "new" : row.bank_statement_rows.matchStatus;
      const now = Date.now();
      await db.update(bankStatementRows).set({ classification: input.classification, categoryId: input.categoryId, reviewNote: input.reviewNote, matchStatus: nextStatus, updatedAt: now }).where(eq(bankStatementRows.id, input.rowId));
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "bank_import_row.reviewed", targetType: "bank_statement_row", targetId: String(input.rowId), beforeState: null, afterState: { classification: input.classification, categoryId: input.categoryId, matchStatus: nextStatus }, requestId: crypto.randomUUID(), occurredAt: now });
      return { id: input.rowId, matchStatus: nextStatus };
    }),
    postReviewed: protectedProcedure.input(z.object({ importId: z.number().int().positive(), rowIds: z.array(z.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [statement] = await db.select().from(bankStatementImports).where(and(eq(bankStatementImports.id, input.importId), eq(bankStatementImports.workspaceId, family.workspace.id))).limit(1);
      if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "ملف الاستيراد غير موجود ضمن مساحة FAMILY الحالية." });
      const [account] = await db.select().from(accounts).where(and(eq(accounts.id, statement.accountId), eq(accounts.workspaceId, family.workspace.id), eq(accounts.status, "active"))).limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "حساب كشف الحساب غير متاح للترحيل." });
      const rows = await db.select().from(bankStatementRows).where(and(eq(bankStatementRows.importId, statement.id), eq(bankStatementRows.workspaceId, family.workspace.id)));
      const selected = rows.filter(row => input.rowIds.includes(row.id));
      if (selected.length !== input.rowIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "بعض الصفوف المطلوبة غير موجودة ضمن ملف الاستيراد." });
      const eligible = selected.filter(row => canPostImportedRow(row) && new Decimal(row.amount!).abs().gt(0));
      if (!eligible.length) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر صفوفاً جديدة ومصنفة كدخل أو مصروف مع فئة صالحة قبل الترحيل." });
      const batch = await postImportedCashBatch({
        context: family, actorUserId: ctx.user.id, accountId: account.id, currency: statement.currency,
        items: eligible.map(row => ({ eventType: row.classification as "income" | "expense", amount: new Decimal(row.amount!).abs().toFixed(6), occurredAt: row.occurredAt!, categoryId: row.categoryId!, memo: row.description, externalRef: row.externalRef, idempotencyKey: row.idempotencyKey,
          afterPosted: async (tx, postedEvent) => {
            await tx.update(bankStatementRows).set({ matchStatus: "posted", postedEventId: postedEvent.id, matchedEventId: postedEvent.id, updatedAt: Date.now() }).where(and(eq(bankStatementRows.id, row.id), eq(bankStatementRows.workspaceId, family.workspace.id)));
            await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "bank_import_row.posted", targetType: "bank_statement_row", targetId: String(row.id), beforeState: { matchStatus: "new" }, afterState: { financialEventId: postedEvent.id, importId: statement.id }, requestId: crypto.randomUUID(), occurredAt: Date.now() });
          },
          afterDuplicate: async (tx, postedEvent) => { await tx.update(bankStatementRows).set({ matchStatus: "exact_duplicate", matchedEventId: postedEvent.id, updatedAt: Date.now() }).where(and(eq(bankStatementRows.id, row.id), eq(bankStatementRows.workspaceId, family.workspace.id))); },
        })),
        afterBatch: async tx => {
          const importRows = await tx.select({ matchStatus: bankStatementRows.matchStatus }).from(bankStatementRows).where(and(eq(bankStatementRows.importId, statement.id), eq(bankStatementRows.workspaceId, family.workspace.id)));
          await tx.update(bankStatementImports).set({ status: shouldKeepImportInReview(importRows) ? "review" : "posted", updatedAt: Date.now() }).where(eq(bankStatementImports.id, statement.id));
        },
      });
      return { postedEventIds: batch.filter(event => !event.duplicate).map(event => event.id), skippedRowIds: selected.filter(row => !eligible.includes(row)).map(row => row.id) };
    }),
    reversePosted: protectedProcedure.input(z.object({ importId: z.number().int().positive(), rowIds: z.array(z.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [statement] = await db.select({ id: bankStatementImports.id }).from(bankStatementImports).where(and(eq(bankStatementImports.id, input.importId), eq(bankStatementImports.workspaceId, family.workspace.id))).limit(1);
      if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "ملف الاستيراد غير موجود ضمن مساحة FAMILY الحالية." });
      const rows = await db.select().from(bankStatementRows).where(and(eq(bankStatementRows.importId, statement.id), eq(bankStatementRows.workspaceId, family.workspace.id)));
      const selected = rows.filter(row => input.rowIds.includes(row.id));
      if (selected.length !== input.rowIds.length || selected.some(row => row.matchStatus !== "posted" || !row.postedEventId)) throw new TRPCError({ code: "BAD_REQUEST", message: "يمكن عكس الصفوف المترحلة فقط ضمن ملف الاستيراد الحالي." });
      const reversalIds = await reverseImportedCashBatch({ context: family, actorUserId: ctx.user.id, items: selected.map(row => ({ eventId: row.postedEventId!, idempotencyKey: `bank-import-reversal-${row.id}`, afterReversed: async (tx, reversalEventId) => {
        const nextKey = `${row.idempotencyKey.slice(0, 120)}:reversed:${reversalEventId}`;
        await tx.update(bankStatementRows).set({ matchStatus: "new", postedEventId: null, matchedEventId: reversalEventId, idempotencyKey: nextKey, reviewNote: "تم عكس الترحيل؛ راجع الصف قبل إعادة النشر.", updatedAt: Date.now() }).where(and(eq(bankStatementRows.id, row.id), eq(bankStatementRows.workspaceId, family.workspace.id)));
      } })) });
      await db.update(bankStatementImports).set({ status: "review", updatedAt: Date.now() }).where(eq(bankStatementImports.id, statement.id));
      return { reversalEventIds: reversalIds };
    }),
  }),

  governance: router({
    policies: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select().from(approvalPolicies).where(and(eq(approvalPolicies.workspaceId, family.workspace.id), eq(approvalPolicies.status, "active"))).orderBy(approvalPolicies.thresholdAmount); }),
    upsertPolicy: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(2).max(120), actionType: approvalActionType, currency, thresholdAmount: money, approverRole: z.enum(["advisor", "owner"]), requireSeparateApprover: z.boolean(), requireReconfirmation: z.boolean() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "owner"); const db = await getDb(); if (!db) throw notAvailable(); const now = Date.now(); const values = { workspaceId: family.workspace.id, name: input.name, actionType: input.actionType, currency: input.currency.toUpperCase(), thresholdAmount: parsePositiveAmount(input.thresholdAmount).toFixed(6), approverRole: input.approverRole, requireSeparateApprover: input.requireSeparateApprover ? "yes" as const : "no" as const, requireReconfirmation: input.requireReconfirmation ? "yes" as const : "no" as const, status: "active" as const, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }; if (input.id) { await db.update(approvalPolicies).set({ ...values, createdAt: undefined, createdByUserId: undefined }).where(and(eq(approvalPolicies.id, input.id), eq(approvalPolicies.workspaceId, family.workspace.id))); return { id: input.id }; } const inserted = await db.insert(approvalPolicies).values(values); return { id: Number(inserted[0].insertId) }; }),
    requests: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select({ id: approvalRequests.id, actionType: approvalRequests.actionType, amount: approvalRequests.amount, currency: approvalRequests.currency, status: approvalRequests.status, requestedByUserId: approvalRequests.requestedByUserId, requiredApproverRole: approvalRequests.requiredApproverRole, expiresAt: approvalRequests.expiresAt, executedEventId: approvalRequests.executedEventId, createdAt: approvalRequests.createdAt, requesterName: users.name }).from(approvalRequests).innerJoin(users, eq(approvalRequests.requestedByUserId, users.id)).where(eq(approvalRequests.workspaceId, family.workspace.id)).orderBy(approvalRequests.createdAt); }),
    decisionHistory: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select({ id: approvalDecisions.id, requestId: approvalDecisions.requestId, decision: approvalDecisions.decision, note: approvalDecisions.note, reconfirmedAt: approvalDecisions.reconfirmedAt, createdAt: approvalDecisions.createdAt, approverName: users.name, requestStatus: approvalRequests.status }).from(approvalDecisions).innerJoin(approvalRequests, eq(approvalDecisions.requestId, approvalRequests.id)).innerJoin(users, eq(approvalDecisions.decidedByUserId, users.id)).where(eq(approvalDecisions.workspaceId, family.workspace.id)).orderBy(approvalDecisions.createdAt); }),
    decide: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).nullable(), reconfirmed: z.literal(true) })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.status, "pending"))).limit(1); if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الاعتماد المعلّق غير موجود." }); const now = Date.now(); if (request.expiresAt !== null && request.expiresAt <= now) { await db.update(approvalRequests).set({ status: "expired", updatedAt: now }).where(eq(approvalRequests.id, request.id)); throw new TRPCError({ code: "BAD_REQUEST", message: "انتهت صلاحية طلب الاعتماد ويجب إنشاء طلب جديد." }); } assertRole(family, request.requiredApproverRole); if (request.requestedByUserId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "فصل الواجبات يمنع منشئ الطلب من اعتماده." }); if (Date.now() - new Date(ctx.user.lastSignedIn).getTime() > 15 * 60 * 1000) throw new TRPCError({ code: "UNAUTHORIZED", message: "يلزم إعادة تسجيل الدخول قبل اعتماد عملية حساسة." }); await db.transaction(async tx => { await tx.insert(approvalDecisions).values({ workspaceId: family.workspace.id, requestId: request.id, decidedByUserId: ctx.user.id, decision: input.decision, note: input.note, reconfirmedAt: now, createdAt: now }); await tx.update(approvalRequests).set({ status: input.decision, updatedAt: now }).where(eq(approvalRequests.id, request.id)); await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: `approval_request.${input.decision}`, targetType: "approval_request", targetId: String(request.id), beforeState: { status: "pending" }, afterState: { status: input.decision, reconfirmedAt: now }, requestId: crypto.randomUUID(), occurredAt: now }); }); return { id: request.id, status: input.decision }; }),
    periods: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select().from(financialPeriods).where(eq(financialPeriods.workspaceId, family.workspace.id)).orderBy(financialPeriods.periodKey); }),
    requestPeriodClose: protectedProcedure.input(z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const now = Date.now(); const inserted = await db.insert(approvalRequests).values({ workspaceId: family.workspace.id, policyId: null, requestedByUserId: ctx.user.id, actionType: "period_adjustment", actionPayload: { periodKey: input.periodKey, operation: "close" }, amount: null, currency: null, status: "pending", requiredApproverRole: "advisor", expiresAt: now + 7 * 86400000, executedEventId: null, createdAt: now, updatedAt: now }); return { requestId: Number(inserted[0].insertId) }; }),
    closeApprovedPeriod: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.status, "approved"), eq(approvalRequests.actionType, "period_adjustment"))).limit(1);
      if (!request) throw new TRPCError({ code: "BAD_REQUEST", message: "يتطلب إغلاق الفترة طلب اعتماد موافقاً عليه." });
      const payload = request.actionPayload as { periodKey?: string };
      if (!payload.periodKey) throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات طلب إغلاق الفترة غير صالحة." });
      const archival = await archivePeriodClosureDossier({
        context: family,
        actorUserId: ctx.user.id,
        periodKey: payload.periodKey,
        closeApprovalRequestId: request.id,
      });
      return { periodKey: payload.periodKey, status: "closed" as const, archival };
    }),
    periodDossier: protectedProcedure.input(z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      return getPeriodClosureDossier(family, input.periodKey);
    }),
    executeApprovedBudgetAdjustment: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.actionType, "budget_adjustment"))).limit(1);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "طلب تسوية الميزانية غير موجود ضمن مساحة FAMILY الحالية." });
      const now = Date.now();
      if (!isApprovalExecutable({ status: request.status, expiresAt: request.expiresAt, nowMs: now })) throw new TRPCError({ code: "BAD_REQUEST", message: "طلب تسوية الميزانية غير موافق عليه أو انتهت صلاحيته أو تم تنفيذه." });
      const payload = request.actionPayload as Record<string, unknown>;
      if (!(payload.operation === "closed_period_budget_settlement" && Number.isInteger(payload.categoryId) && typeof payload.periodKey === "string" && /^\d{4}-\d{2}$/.test(payload.periodKey) && typeof payload.proposedAmountBase === "string")) throw new TRPCError({ code: "BAD_REQUEST", message: "بيانات تسوية الميزانية المجمدة غير صالحة." });
      const [closedPeriod] = await db.select({ id: financialPeriods.id }).from(financialPeriods).where(and(eq(financialPeriods.workspaceId, family.workspace.id), eq(financialPeriods.periodKey, payload.periodKey), eq(financialPeriods.status, "closed"))).limit(1);
      if (!closedPeriod) throw new TRPCError({ code: "BAD_REQUEST", message: "التسوية المعتمدة مخصصة لفترة مالية مغلقة." });
      const [category] = await db.select({ id: cashFlowCategories.id }).from(cashFlowCategories).where(and(eq(cashFlowCategories.id, payload.categoryId as number), eq(cashFlowCategories.workspaceId, family.workspace.id))).limit(1);
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "فئة تسوية الميزانية غير موجودة ضمن المساحة الحالية." });
      const settledAmount = parsePositiveAmount(payload.proposedAmountBase, "قيمة تسوية الميزانية").toFixed(6);
      await db.transaction(async tx => { await tx.insert(budgets).values({ workspaceId: family.workspace.id, categoryId: category.id, periodKey: payload.periodKey as string, plannedAmountBase: settledAmount, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { plannedAmountBase: settledAmount, createdByUserId: ctx.user.id, updatedAt: now } }); await tx.update(approvalRequests).set({ status: "executed", updatedAt: now }).where(and(eq(approvalRequests.id, request.id), eq(approvalRequests.status, "approved"))); await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "budget.adjustment_executed", targetType: "budget", targetId: `${category.id}:${payload.periodKey}`, beforeState: { approvalRequestId: request.id, proposedAmountBase: payload.previousAmountBase ?? null }, afterState: { plannedAmountBase: settledAmount, source: "approved_closed_period_settlement" }, requestId: crypto.randomUUID(), occurredAt: now }); });
      invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
      return { categoryId: category.id, periodKey: payload.periodKey, plannedAmountBase: settledAmount };
    }),
  }),
  planning: familyPlanningSubRouter,


  backup: router({
    snapshot: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      const snapshot = await getDashboardSummary(family);
      return createBackupEnvelope(family.workspace.id, snapshot);
    }),
    fullExport: protectedProcedure.mutation(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      return exportFullWorkspaceBackup(family.workspace.id);
    }),
    validateBackup: protectedProcedure
      .input(z.object({ envelope: z.unknown() }))
      .mutation(async ({ input }) => {
        return validateWorkspaceBackup(input.envelope);
      }),
    restore: protectedProcedure
      .input(
        z.object({
          backup: z.any(),
          mode: z.enum(["overwrite", "clone"]),
          newWorkspaceName: z.string().trim().max(160).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "owner");
        const result = await restoreFullWorkspaceBackup({
          backup: input.backup,
          targetWorkspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          mode: input.mode,
          newWorkspaceName: input.newWorkspaceName,
        });
        invalidateReadModelCache(`wealth-health:score:${result.workspaceId}`);
        invalidateReadModelCache(`stress-testing:${result.workspaceId}:`);
        invalidateReadModelCache(`consolidation:`);
        return result;
      }),
  }),

  ledger: familyLedgerRouter,

  audit: router({
    recent: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      const db = await getDb();
      if (!db) throw notAvailable();
      return db.select().from(auditEvents).where(eq(auditEvents.workspaceId, family.workspace.id)).orderBy(desc(auditEvents.occurredAt)).limit(50);
    }),
  }),

  auditor: router({
    listTokens: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "advisor");
      return listAuditorTokens(family.workspace.id);
    }),
    issueToken: protectedProcedure
      .input(
        z.object({
          label: z.string().trim().min(2).max(120),
          targetAuditor: z.string().trim().min(2).max(120),
          purpose: z.string().trim().min(2).max(255),
          allowedScopes: z.array(z.enum(["reports", "reconciliation", "zakat", "financial_statements", "lot_accounting"])).min(1),
          durationHours: z.number().int().min(1).max(720).default(72),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "advisor");
        const db = await getDb();
        if (!db) throw notAvailable();
        return issueAuditorAccessToken({
          db,
          workspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          label: input.label,
          targetAuditor: input.targetAuditor,
          purpose: input.purpose,
          allowedScopes: input.allowedScopes,
          durationHours: input.durationHours,
        });
      }),
    revokeToken: protectedProcedure
      .input(z.object({ tokenId: z.string().trim().min(1), reason: z.string().trim().max(255).optional() }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "advisor");
        const db = await getDb();
        if (!db) throw notAvailable();
        return revokeAuditorToken({
          db,
          workspaceId: family.workspace.id,
          actorUserId: ctx.user.id,
          tokenId: input.tokenId,
          reason: input.reason,
        });
      }),
    validateToken: publicProcedure
      .input(z.object({ token: z.string().trim().min(1) }))
      .query(async ({ input }) => {
        const parsed = await parseAndVerifyToken(input.token);
        if (!parsed.valid || !parsed.payload) {
          return { valid: false as const, error: parsed.error };
        }
        return {
          valid: true as const,
          tokenId: parsed.payload.tokenId,
          workspaceId: parsed.payload.workspaceId,
          label: parsed.payload.label,
          targetAuditor: parsed.payload.targetAuditor,
          purpose: parsed.payload.purpose,
          allowedScopes: parsed.payload.allowedScopes,
          expiresAt: parsed.payload.expiresAt,
          issuedAt: parsed.payload.issuedAt,
        };
      }),
    recordAccess: publicProcedure
      .input(z.object({ token: z.string().trim().min(1), accessedRoute: z.string().trim() }))
      .mutation(async ({ input }) => {
        const parsed = await parseAndVerifyToken(input.token);
        if (!parsed.valid || !parsed.payload) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: parsed.error || "رمز الوصول غير صالح." });
        }
        await recordAuditorAccessEvent({
          workspaceId: parsed.payload.workspaceId,
          tokenId: parsed.payload.tokenId,
          targetAuditor: parsed.payload.targetAuditor,
          accessedRoute: input.accessedRoute,
        });
        return { recorded: true };
      }),
    getAuditorFinancialStatements: publicProcedure
      .input(
        z.object({
          token: z.string().trim().min(1),
          asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          periodKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        })
      )
      .query(async ({ input }) => {
        const parsed = await parseAndVerifyToken(input.token);
        if (!parsed.valid || !parsed.payload) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: parsed.error || "رمز وصول المدقق غير صالح أو منتهي الصلاحية." });
        }
        const payload = parsed.payload;
        if (!payload.allowedScopes.includes("financial_statements") && !payload.allowedScopes.includes("reports")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "رمز الوصول لا يملك صلاحية النطاق المطلوب (financial_statements)." });
        }
        const db = await getDb();
        if (!db) throw notAvailable();
        const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, payload.workspaceId)).limit(1);
        if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "مساحة العمل غير موجودة." });
        const [profile] = await db.select().from(financialProfiles).where(eq(financialProfiles.workspaceId, ws.id)).limit(1);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "الملف المالي لمساحة العمل غير موجود." });

        const mockContext: FamilyContext = {
          workspace: ws,
          profile,
          membership: { id: 0, workspaceId: ws.id, userId: payload.issuedByUserId ?? 0, role: "viewer", status: "active", createdAt: 0, updatedAt: 0 },
        };

        const statements = await generateFinancialStatementsPackage(mockContext, {
          asOf: input.asOf,
          periodKey: input.periodKey,
        });

        await recordAuditorAccessEvent({
          workspaceId: payload.workspaceId,
          tokenId: payload.tokenId,
          targetAuditor: payload.targetAuditor,
          accessedRoute: `/auditor-portal/financial-statements?asOf=${input.asOf ?? ""}&periodKey=${input.periodKey ?? ""}`,
        });

        return {
          workspace: { id: ws.id, name: ws.name, baseCurrency: ws.baseCurrency },
          statements,
        };
      }),
    getAuditorReconciliation: publicProcedure
      .input(z.object({ token: z.string().trim().min(1) }))
      .query(async ({ input }) => {
        const parsed = await parseAndVerifyToken(input.token);
        if (!parsed.valid || !parsed.payload) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: parsed.error || "رمز وصول المدقق غير صالح أو منتهي الصلاحية." });
        }
        const payload = parsed.payload;
        if (!payload.allowedScopes.includes("reconciliation")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "رمز الوصول لا يملك صلاحية النطاق المطلوب (reconciliation)." });
        }
        const db = await getDb();
        if (!db) throw notAvailable();
        const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, payload.workspaceId)).limit(1);
        if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "مساحة العمل غير موجودة." });

        const [entries, lines, events, persistedPositions, rates, currentCashFlow, actions] = await Promise.all([
          db.select({ id: journalEntries.id, eventId: journalEntries.eventId, status: journalEntries.status, reversalOfEntryId: journalEntries.reversalOfEntryId }).from(journalEntries).where(eq(journalEntries.workspaceId, payload.workspaceId)),
          db.select({ id: journalLines.id, entryId: journalLines.entryId, accountId: journalLines.accountId, direction: journalLines.direction, amount: journalLines.amount, baseAmount: journalLines.baseAmount, currency: journalLines.currency }).from(journalLines).where(eq(journalLines.workspaceId, payload.workspaceId)),
          db.select({ id: financialEvents.id, status: financialEvents.status, primaryAccountId: financialEvents.primaryAccountId, instrumentId: financialEvents.instrumentId, eventType: financialEvents.eventType, categoryId: financialEvents.categoryId, currency: financialEvents.currency, quantity: financialEvents.quantity, unitPrice: financialEvents.unitPrice, grossAmount: financialEvents.grossAmount, feeAmount: financialEvents.feeAmount, taxAmount: financialEvents.taxAmount, idempotencyKey: financialEvents.idempotencyKey, occurredAt: financialEvents.occurredAt }).from(financialEvents).where(eq(financialEvents.workspaceId, payload.workspaceId)),
          db.select({ accountId: positions.accountId, instrumentId: positions.instrumentId, quantity: positions.quantity, averageCost: positions.averageCost }).from(positions).where(eq(positions.workspaceId, payload.workspaceId)),
          db.select({ fromCurrency: fxRates.fromCurrency, toCurrency: fxRates.toCurrency, rate: fxRates.rate, asOf: fxRates.asOf, rateStatus: fxRates.rateStatus }).from(fxRates).where(eq(fxRates.workspaceId, payload.workspaceId)),
          db.select({ categoryId: cashFlowCategories.id, actualAmountBase: sql<string>`COALESCE(SUM(${journalLines.baseAmount}), 0)` }).from(financialEvents).innerJoin(cashFlowCategories, eq(financialEvents.categoryId, cashFlowCategories.id)).innerJoin(journalEntries, eq(journalEntries.eventId, financialEvents.id)).innerJoin(journalLines, and(eq(journalLines.entryId, journalEntries.id), eq(journalLines.accountId, financialEvents.primaryAccountId!))).where(and(eq(financialEvents.workspaceId, payload.workspaceId), eq(financialEvents.status, "posted"), sql`${financialEvents.eventType} IN ('income', 'expense', 'debt_payment')`)).groupBy(cashFlowCategories.id),
          db.select({ instrumentId: corporateActions.instrumentId, actionType: corporateActions.actionType, ratio: corporateActions.ratio, effectiveAt: corporateActions.effectiveAt }).from(corporateActions).where(eq(corporateActions.workspaceId, payload.workspaceId)),
        ]);

        const report = buildReconciliationReport({
          baseCurrency: ws.baseCurrency,
          fxRates: rates,
          expectedCashFlowByCategory: currentCashFlow,
          entries,
          lines,
          events,
          positions: persistedPositions,
          corporateActions: actions,
        });

        await recordAuditorAccessEvent({
          workspaceId: payload.workspaceId,
          tokenId: payload.tokenId,
          targetAuditor: payload.targetAuditor,
          accessedRoute: "/auditor-portal/reconciliation",
        });

        return {
          workspace: { id: ws.id, name: ws.name, baseCurrency: ws.baseCurrency },
          report,
        };
      }),
    getAuditorZakat: publicProcedure
      .input(
        z.object({
          token: z.string().trim().min(1),
          status: z.enum(["calculated", "paid", "archived"]).optional(),
        })
      )
      .query(async ({ input }) => {
        const parsed = await parseAndVerifyToken(input.token);
        if (!parsed.valid || !parsed.payload) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: parsed.error || "رمز وصول المدقق غير صالح أو منتهي الصلاحية." });
        }
        const payload = parsed.payload;
        if (!payload.allowedScopes.includes("zakat")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "رمز الوصول لا يملك صلاحية النطاق المطلوب (zakat)." });
        }
        const db = await getDb();
        if (!db) throw notAvailable();
        const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, payload.workspaceId)).limit(1);
        if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "مساحة العمل غير موجودة." });

        const conditions = [eq(zakatAssessments.workspaceId, payload.workspaceId)];
        if (input.status) {
          conditions.push(eq(zakatAssessments.status, input.status));
        }

        const assessments = await db
          .select()
          .from(zakatAssessments)
          .where(and(...conditions))
          .orderBy(desc(zakatAssessments.createdAt));

        await recordAuditorAccessEvent({
          workspaceId: payload.workspaceId,
          tokenId: payload.tokenId,
          targetAuditor: payload.targetAuditor,
          accessedRoute: `/auditor-portal/zakat?status=${input.status ?? ""}`,
        });

        return {
          workspace: { id: ws.id, name: ws.name, baseCurrency: ws.baseCurrency },
          assessments,
        };
      }),
    getAuditorLotAccounting: publicProcedure
      .input(
        z.object({
          token: z.string().trim().min(1),
          instrumentId: z.number().int().positive().optional(),
        })
      )
      .query(async ({ input }) => {
        const parsed = await parseAndVerifyToken(input.token);
        if (!parsed.valid || !parsed.payload) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: parsed.error || "رمز وصول المدقق غير صالح أو منتهي الصلاحية." });
        }
        const payload = parsed.payload;
        if (!payload.allowedScopes.includes("lot_accounting")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "رمز الوصول لا يملك صلاحية النطاق المطلوب (lot_accounting)." });
        }
        const db = await getDb();
        if (!db) throw notAvailable();
        const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, payload.workspaceId)).limit(1);
        if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "مساحة العمل غير موجودة." });

        const lotConditions = [eq(investmentLots.workspaceId, payload.workspaceId)];
        if (input.instrumentId) {
          lotConditions.push(eq(investmentLots.instrumentId, input.instrumentId));
        }

        const [lots, matches, insts] = await Promise.all([
          db.select().from(investmentLots).where(and(...lotConditions)).orderBy(desc(investmentLots.acquiredAt)),
          db.select().from(lotMatches).where(eq(lotMatches.workspaceId, payload.workspaceId)).orderBy(desc(lotMatches.matchedAt)),
          db.select({ id: instruments.id, symbol: instruments.symbol, name: instruments.name, assetType: instruments.assetType }).from(instruments).where(eq(instruments.workspaceId, payload.workspaceId)),
        ]);

        await recordAuditorAccessEvent({
          workspaceId: payload.workspaceId,
          tokenId: payload.tokenId,
          targetAuditor: payload.targetAuditor,
          accessedRoute: `/auditor-portal/lot-accounting?instrumentId=${input.instrumentId ?? ""}`,
        });

        return {
          workspace: { id: ws.id, name: ws.name, baseCurrency: ws.baseCurrency },
          lots,
          matches,
          instruments: insts,
        };
      }),
  }),
});
