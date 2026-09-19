import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { ENV } from "./_core/env";
import { accounts, allocationTargets, approvalDecisions, approvalPolicies, approvalRequests, auditEvents, bankStatementImports, bankStatementRows, budgetTemplateLines, budgetTemplates, budgets, cashFlowCategories, emergencyFundPlans, feeTaxRules, financialEvents, financialGoals, financialPeriods, financialProfiles, fxRates, insuranceClaims, insurancePolicies, insurancePremiumPayments, instruments, investmentLots, corporateActions, journalEntries, journalLines, lotMatches, lotTransfers, marketEmailPreferences, memberships, officialValuationSnapshots, personalIous, planningScenarios, positions, priceQuotes, recurringRules, researchNotes, retirementPlans, riskProfiles, specialAssets, specialAssetValuations, users, valuationProvenance, valuationSnapshots, vaultDocuments, watchlistItems, workspaceInvitations, workspaces, zakatAssessments } from "../drizzle/schema";
import { assertRole, ensurePersonalFamilyContext, listAccessibleWorkspaces, setActiveFamilyWorkspace, type FamilyContext } from "./familyAccess";
import { createDebt, createFamilyAccount, postCashEvent, postDebtPayment, postImportedCashBatch, postPositionTransfer, postStockSplit, postTrade, postTransfer, reverseImportedCashBatch, revalueAssetAccount } from "./familyLedger";
import { getCashFlowHistory, getCashFlowSummary, getDashboardMarketOverview, getDashboardSummary, getEmergencyFundSummary, getMarketDataQuality, getRiskAllocationSummary, listAccountSnapshots, listDebtSummaries, listPortfolioPositions, listRecentEvents } from "./familyRead";
import { getSmtpConfiguration } from "./mailer";
import { getDb } from "./db";
import { parseNonNegativeAmount, parsePositiveAmount } from "./ledgerMath";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "../shared/const";
import Decimal from "decimal.js";
import { compareExtraDebtPayment, projectDebtSchedule } from "./debtMath";
import { projectFinancialGoal, projectRetirementPlan } from "./planningMath";
import { validateAllocationTargets, type AllocationClass } from "./allocationMath";
import { buildImportRows, detectDuplicate, parseCsv, sha256, validateColumnMapping } from "./bankImportMath";
import { canPostImportedRow, shouldKeepImportInReview } from "./bankImportWorkflow";
import { projectScenario } from "./scenarioMath";
import { approvalActionTypes, isApprovalExecutable, requiresApproval, type ApprovalActionType } from "./approvalWorkflowMath";
import { calculateGold24kGramEgp, fetchYahooFxQuote, fetchYahooQuote } from "./marketData";
import { calculateZakat } from "./zakatMath";
import { storageGetSignedUrl, storagePut } from "./storage";
import { decryptVaultValue, encryptVaultValue } from "./vaultCrypto";
import { buildMarketSignals } from "./investmentSignals";
import { suggestTradeCharges } from "./chargeMath";
import { suggestGoldRevaluation } from "./goldQuoteMath";
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
import { buildFxProvenance, buildInstrumentSnapshot, buildManualProvenance, buildMarketProvenance } from "./valuationProvenance";
import { listValuationHistory } from "./valuationRead";
import { captureOfficialValuationSnapshot, getLatestOfficialValuationSnapshot, listOfficialValuationSnapshots } from "./officialValuation";
import { rebuildLotsFromEvents, type RebuildEvent } from "./lotRebuild";
import { financialStatementsRouter, generateFinancialStatementsPackage } from "./financialStatementsRouter";
import { wealthHealthRouter } from "./wealthHealthRouter";
import { invalidateReadModelCache } from "./readModelCache";

const currency = z.string().trim().regex(/^[A-Za-z]{3}$/, "أدخل رمز عملة ISO من ثلاثة أحرف.");
const idempotencyKey = z.string().trim().min(16).max(160);
const occurredAt = z
  .number()
  .int()
  .positive()
  .refine(val => val <= Date.now() + 5 * 60 * 1000, {
    message: "لا يمكن تسجيل عملية في المستقبل.",
  });
const money = z.string().trim().min(1).max(64);
const approvalActionType = z.enum(approvalActionTypes);
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function notAvailable() {
  return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة حاليًا." });
}

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

  cashFlow: router({
    categories: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const activeCategories = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.isArchived, "no"))).orderBy(cashFlowCategories.direction, cashFlowCategories.name);
      return activeCategories.map(category => ({ ...category, isArchived: false as const }));
    }),
    summary: protectedProcedure.input(z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => getCashFlowSummary(await familyContext(ctx.user), input.periodKey)),
    history: protectedProcedure.input(z.object({ months: z.number().int().min(1).max(24).optional() }).optional()).query(async ({ ctx, input }) => getCashFlowHistory(await familyContext(ctx.user), input?.months ?? 6)),
    runway: protectedProcedure.query(async ({ ctx }) => getEmergencyFundSummary(await familyContext(ctx.user))),
    createCategory: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), direction: z.enum(["income", "expense"]), color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(), isEssential: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const now = Date.now();
      const result = await db.insert(cashFlowCategories).values({ workspaceId: family.workspace.id, name: input.name, direction: input.direction, color: input.color ?? null, isEssential: input.isEssential ? "yes" : "no", isArchived: "no", createdAt: now, updatedAt: now });
      const id = Number(result[0].insertId);
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "cash_flow_category.created", targetType: "cash_flow_category", targetId: String(id), beforeState: null, afterState: input, requestId: crypto.randomUUID(), occurredAt: now });
      return { id };
    }),
    setEssential: protectedProcedure.input(z.object({ categoryId: z.number().int().positive(), isEssential: z.boolean() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "owner");
      const db = await getDb();
      if (!db) throw notAvailable();
      const [category] = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.id, input.categoryId), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.direction, "expense"), eq(cashFlowCategories.isArchived, "no"))).limit(1);
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "فئة المصروف النشطة غير موجودة ضمن مساحة FAMILY الحالية." });
      const now = Date.now();
      await db.update(cashFlowCategories).set({ isEssential: input.isEssential ? "yes" : "no", updatedAt: now }).where(eq(cashFlowCategories.id, category.id));
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "cash_flow_category.essential_updated", targetType: "cash_flow_category", targetId: String(category.id), beforeState: { isEssential: category.isEssential }, afterState: { isEssential: input.isEssential ? "yes" : "no" }, requestId: crypto.randomUUID(), occurredAt: now });
      return { id: category.id, isEssential: input.isEssential };
    }),
    budgets: protectedProcedure.input(z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      return db.select({ id: budgets.id, periodKey: budgets.periodKey, plannedAmountBase: budgets.plannedAmountBase, categoryId: cashFlowCategories.id, categoryName: cashFlowCategories.name, direction: cashFlowCategories.direction, color: cashFlowCategories.color }).from(budgets).innerJoin(cashFlowCategories, eq(budgets.categoryId, cashFlowCategories.id)).where(and(eq(budgets.workspaceId, family.workspace.id), eq(budgets.periodKey, input.periodKey))).orderBy(cashFlowCategories.direction, cashFlowCategories.name);
    }),
    upsertBudget: protectedProcedure.input(z.object({ categoryId: z.number().int().positive(), periodKey: z.string().regex(/^\d{4}-\d{2}$/), plannedAmountBase: money })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
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
        const [existingRequest] = await db.select({ id: approvalRequests.id }).from(approvalRequests).where(and(eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.actionType, "budget_adjustment"), eq(approvalRequests.status, "pending"), sql`JSON_UNQUOTE(JSON_EXTRACT(${approvalRequests.actionPayload}, '$.idempotencyKey')) = ${settlementKey}`)).limit(1);
        if (existingRequest) return { approvalRequired: true as const, approvalRequestId: existingRequest.id, duplicate: true };
        const policies = await db.select().from(approvalPolicies).where(and(eq(approvalPolicies.workspaceId, family.workspace.id), eq(approvalPolicies.actionType, "budget_adjustment"), eq(approvalPolicies.status, "active")));
        const policy = policies.filter(item => requiresApproval(amount.toFixed(6), item.thresholdAmount, item.currency === family.workspace.baseCurrency)).sort((left, right) => new Decimal(left.thresholdAmount).cmp(right.thresholdAmount))[0];
        const inserted = await db.insert(approvalRequests).values({ workspaceId: family.workspace.id, policyId: policy?.id ?? null, requestedByUserId: ctx.user.id, actionType: "budget_adjustment", actionPayload: { operation: "closed_period_budget_settlement", categoryId: category.id, periodKey: input.periodKey, proposedAmountBase: amount.toFixed(6), previousAmountBase: existingBudget?.plannedAmountBase ?? null, idempotencyKey: settlementKey }, amount: amount.toFixed(6), currency: family.workspace.baseCurrency, status: "pending", requiredApproverRole: policy?.approverRole ?? "advisor", expiresAt: now + 7 * 86_400_000, executedEventId: null, createdAt: now, updatedAt: now });
        const requestId = Number(inserted[0].insertId);
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "budget.adjustment_requested", targetType: "budget", targetId: `${category.id}:${input.periodKey}`, beforeState: { plannedAmountBase: existingBudget?.plannedAmountBase ?? null }, afterState: { proposedAmountBase: amount.toFixed(6), approvalRequestId: requestId }, requestId: crypto.randomUUID(), occurredAt: now });
        return { approvalRequired: true as const, approvalRequestId: requestId, duplicate: false };
      }
      const now = Date.now();
      await db.insert(budgets).values({ workspaceId: family.workspace.id, categoryId: category.id, periodKey: input.periodKey, plannedAmountBase: amount.toFixed(6), createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { plannedAmountBase: amount.toFixed(6), createdByUserId: ctx.user.id, updatedAt: now } });
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "budget.upserted", targetType: "budget", targetId: `${category.id}:${input.periodKey}`, beforeState: null, afterState: { categoryId: category.id, periodKey: input.periodKey, plannedAmountBase: amount.toFixed(6) }, requestId: crypto.randomUUID(), occurredAt: now });
      invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
      return { approvalRequired: false as const, categoryId: category.id, periodKey: input.periodKey };
    }),
    templates: protectedProcedure.query(async () => [] as Array<{ id: number; name: string; horizonMonths: string; startsPeriodKey: string; spendingLimitBase: string | null; status: string; createdAt: number; updatedAt: number }>),
    createRollingTemplate: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(140), horizonMonths: z.enum(["3", "6"]), startsPeriodKey: z.string().regex(/^\d{4}-\d{2}$/), spendingLimitBase: money.nullable(), lines: z.array(z.object({ categoryId: z.number().int().positive(), plannedAmountBase: money })).min(1).max(50) })).mutation(async () => { throw new TRPCError({ code: "BAD_REQUEST", message: "قوالب الميزانية المتدحرجة متوقفة في هذا الإصدار لصالح التخطيط القياسي." }); }),
    applyRollingTemplate: protectedProcedure.input(z.object({ templateId: z.number().int().positive() })).mutation(async () => { throw new TRPCError({ code: "BAD_REQUEST", message: "قوالب الميزانية المتدحرجة متوقفة في هذا الإصدار." }); }),
    recurring: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const family = await familyContext(ctx.user);
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
        const family = await familyContext(ctx.user);
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
        const family = await familyContext(ctx.user);
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
        const family = await familyContext(ctx.user);
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
  }),

  debts: router({
    list: protectedProcedure.query(async ({ ctx }) => listDebtSummaries(await familyContext(ctx.user))),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), lender: z.string().trim().max(160).nullable(), debtType: z.enum(["loan", "credit_card", "mortgage", "personal", "other"]), originalPrincipal: money, currency, annualInterestRate: money, minimumPayment: money, paymentDay: z.number().int().min(1).max(31).nullable(), startDate: z.number().int().positive(), maturityDate: z.number().int().positive().nullable(), cashAccountId: z.number().int().positive().nullable(), cashFlowCategoryId: z.number().int().positive().nullable(), memo: z.string().trim().max(2000).nullable(), idempotencyKey })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      return createDebt({ context: family, actorUserId: ctx.user.id, ...input });
    }),
    postPayment: protectedProcedure.input(z.object({ debtId: z.number().int().positive(), cashAccountId: z.number().int().positive(), principalAmount: money, interestAmount: money.nullable(), feeAmount: money.nullable(), occurredAt, memo: z.string().trim().max(2000).nullable(), idempotencyKey })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      return postDebtPayment({ context: family, actorUserId: ctx.user.id, ...input });
    }),
    projection: protectedProcedure.input(z.object({ debtId: z.number().int().positive(), horizonMonths: z.number().int().min(1).max(600).default(120), extraPrincipal: money.optional() })).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const debt = (await listDebtSummaries(family)).find(item => item.id === input.debtId);
      if (!debt) throw new TRPCError({ code: "NOT_FOUND", message: "الدين غير موجود ضمن نطاقك المالي." });
      const schedule = projectDebtSchedule({ outstanding: debt.outstanding, annualInterestRatePercent: debt.annualInterestRate, monthlyPayment: debt.minimumPayment, months: input.horizonMonths });
      const comparison = input.extraPrincipal ? compareExtraDebtPayment({ outstanding: debt.outstanding, annualInterestRatePercent: debt.annualInterestRate, monthlyPayment: debt.minimumPayment, extraPrincipal: input.extraPrincipal }) : null;
      return { debtId: debt.id, currency: debt.currency, schedule, comparison };
    }),
  }),

  emergencyFund: router({
    summary: protectedProcedure.query(async ({ ctx }) => getEmergencyFundSummary(await familyContext(ctx.user))),
    upsertPlan: protectedProcedure.input(z.object({ targetMonths: money, lookbackMonths: z.number().int().min(1).max(24), targetDate: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const targetMonths = parsePositiveAmount(input.targetMonths, "عدد أشهر الهدف");
      if (targetMonths.gt(60)) throw new TRPCError({ code: "BAD_REQUEST", message: "عدد أشهر هدف الاحتياطي يجب ألا يتجاوز 60." });
      const now = Date.now();
      await db.insert(emergencyFundPlans).values({ workspaceId: family.workspace.id, profileId: family.profile.id, targetMonths: targetMonths.toFixed(2), lookbackMonths: input.lookbackMonths, targetDate: input.targetDate, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { targetMonths: targetMonths.toFixed(2), lookbackMonths: input.lookbackMonths, targetDate: input.targetDate, createdByUserId: ctx.user.id, updatedAt: now } });
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "emergency_fund_plan.upserted", targetType: "emergency_fund_plan", targetId: String(family.profile.id), beforeState: null, afterState: { targetMonths: targetMonths.toFixed(2), lookbackMonths: input.lookbackMonths, targetDate: input.targetDate }, requestId: crypto.randomUUID(), occurredAt: now });
      return { profileId: family.profile.id };
    }),
  }),

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
        subCategory: z.string().trim().max(64).optional().nullable(),
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

  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const [summary, db] = await Promise.all([getDashboardSummary(family), getDb()]);
      if (!db) throw notAvailable();
      const rows = await db.select().from(financialGoals).where(eq(financialGoals.workspaceId, family.workspace.id)).orderBy(desc(financialGoals.createdAt));
      const metrics = { net_worth: summary.netWorthBase, liquid_assets: summary.liquidBalanceBase, investments: summary.investmentValueBase };
      return rows.map(goal => {
        const currentAmount = metrics[goal.metric];
        const target = Number(goal.targetAmount);
        const current = Number(currentAmount);
        const projection = projectFinancialGoal({ currentAmount, targetAmount: goal.targetAmount, monthlyContribution: goal.monthlyContribution, annualReturnPercent: goal.assumedAnnualReturn, annualInflationPercent: goal.assumedAnnualInflation, targetDate: goal.targetDate, now: Date.now() });
        return { ...goal, currentAmount, progressPercent: target > 0 ? Math.min(Math.round((current / target) * 10_000) / 100, 100) : 0, projection };
      });
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(160), goalType: z.enum(["emergency_fund", "retirement", "education", "legacy", "custom"]), metric: z.enum(["net_worth", "liquid_assets", "investments"]), targetAmount: money, targetDate: z.number().int().positive().optional().nullable(), priority: z.number().int().min(1).max(5).default(3), fundingSource: z.enum(["cash_flow", "savings", "investments", "mixed", "other"]).default("cash_flow"), monthlyContribution: money.default("0"), assumedAnnualReturn: money.default("0"), assumedAnnualInflation: money.default("0") }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const targetAmount = parsePositiveAmount(input.targetAmount, "قيمة الهدف");
        const monthlyContribution = parseNonNegativeAmount(input.monthlyContribution, "المساهمة الشهرية");
        const assumedAnnualReturn = parseNonNegativeAmount(input.assumedAnnualReturn, "العائد المفترض");
        const assumedAnnualInflation = parseNonNegativeAmount(input.assumedAnnualInflation, "التضخم المفترض");
        if (assumedAnnualReturn.gt(1000) || assumedAnnualInflation.gt(1000)) throw new TRPCError({ code: "BAD_REQUEST", message: "افتراض العائد أو التضخم غير منطقي." });
        const db = await getDb();
        if (!db) throw notAvailable();
        const now = Date.now();
        const result = await db.insert(financialGoals).values({ workspaceId: family.workspace.id, profileId: family.profile.id, name: input.name, goalType: input.goalType, metric: input.metric, targetAmount: targetAmount.toFixed(6), currency: family.workspace.baseCurrency, targetDate: input.targetDate ?? null, priority: input.priority, fundingSource: input.fundingSource, monthlyContribution: monthlyContribution.toFixed(6), assumedAnnualReturn: assumedAnnualReturn.toFixed(6), assumedAnnualInflation: assumedAnnualInflation.toFixed(6), status: "active", createdAt: now, updatedAt: now });
        const id = Number(result[0].insertId);
        await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "financial_goal.created", targetType: "financial_goal", targetId: String(id), beforeState: null, afterState: { name: input.name, goalType: input.goalType, metric: input.metric, targetAmount: targetAmount.toFixed(6), currency: family.workspace.baseCurrency, priority: input.priority, fundingSource: input.fundingSource, monthlyContribution: monthlyContribution.toFixed(6), assumedAnnualReturn: assumedAnnualReturn.toFixed(6), assumedAnnualInflation: assumedAnnualInflation.toFixed(6) }, requestId: crypto.randomUUID(), occurredAt: now });
        return { id };
      }),
  }),

  retirement: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const [plan] = await db.select().from(retirementPlans).where(and(eq(retirementPlans.workspaceId, family.workspace.id), eq(retirementPlans.profileId, family.profile.id))).limit(1);
      return plan ?? null;
    }),
    upsert: protectedProcedure.input(z.object({ currentAge: z.number().int().min(0).max(99), retirementAge: z.number().int().min(1).max(100), currentRetirementAssets: money, monthlyContribution: money, annualSpending: money, safeWithdrawalRate: money, assumedAnnualReturn: money, assumedAnnualInflation: money })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
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
      const values = { workspaceId: family.workspace.id, profileId: family.profile.id, currentAge: input.currentAge, retirementAge: input.retirementAge, currentRetirementAssets: currentRetirementAssets.toFixed(6), monthlyContribution: monthlyContribution.toFixed(6), annualSpending: annualSpending.toFixed(6), safeWithdrawalRate: safeWithdrawalRate.toFixed(6), assumedAnnualReturn: assumedAnnualReturn.toFixed(6), assumedAnnualInflation: assumedAnnualInflation.toFixed(6), currency: family.workspace.baseCurrency, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now };
      await db.insert(retirementPlans).values(values).onDuplicateKeyUpdate({ set: { currentAge: values.currentAge, retirementAge: values.retirementAge, currentRetirementAssets: values.currentRetirementAssets, monthlyContribution: values.monthlyContribution, annualSpending: values.annualSpending, safeWithdrawalRate: values.safeWithdrawalRate, assumedAnnualReturn: values.assumedAnnualReturn, assumedAnnualInflation: values.assumedAnnualInflation, currency: values.currency, createdByUserId: ctx.user.id, updatedAt: now } });
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "retirement_plan.upserted", targetType: "retirement_plan", targetId: String(family.profile.id), beforeState: null, afterState: values, requestId: crypto.randomUUID(), occurredAt: now });
      return { profileId: family.profile.id };
    }),
    projection: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const [plan] = await db.select().from(retirementPlans).where(and(eq(retirementPlans.workspaceId, family.workspace.id), eq(retirementPlans.profileId, family.profile.id))).limit(1);
      if (!plan) return null;
      return { plan, projection: projectRetirementPlan({ currentAge: plan.currentAge, retirementAge: plan.retirementAge, currentAssets: plan.currentRetirementAssets, monthlyContribution: plan.monthlyContribution, annualSpending: plan.annualSpending, safeWithdrawalRatePercent: plan.safeWithdrawalRate, annualReturnPercent: plan.assumedAnnualReturn, annualInflationPercent: plan.assumedAnnualInflation }) };
    }),
  }),

  risk: router({
    summary: protectedProcedure.query(async ({ ctx }) => getRiskAllocationSummary(await familyContext(ctx.user))),
    upsertProfile: protectedProcedure.input(z.object({ riskLevel: z.enum(["conservative", "moderate", "growth", "aggressive"]), questionnaireScore: z.number().int().min(0).max(100).nullable(), rationale: z.string().trim().max(2000).nullable() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const db = await getDb();
      if (!db) throw notAvailable();
      const now = Date.now();
      await db.insert(riskProfiles).values({ workspaceId: family.workspace.id, profileId: family.profile.id, riskLevel: input.riskLevel, questionnaireScore: input.questionnaireScore, rationale: input.rationale, completedAt: now, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { riskLevel: input.riskLevel, questionnaireScore: input.questionnaireScore, rationale: input.rationale, completedAt: now, createdByUserId: ctx.user.id, updatedAt: now } });
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "risk_profile.upserted", targetType: "risk_profile", targetId: String(family.profile.id), beforeState: null, afterState: input, requestId: crypto.randomUUID(), occurredAt: now });
      return { profileId: family.profile.id };
    }),
    upsertAllocationTargets: protectedProcedure.input(z.object({ targets: z.array(z.object({ assetClass: z.enum(["cash", "equity", "fixed_income", "alternatives", "other"]), targetPercent: money, driftThresholdPercent: money })).length(5) })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      assertRole(family, "editor");
      const parsedTargets = input.targets.map(target => ({ assetClass: target.assetClass as AllocationClass, targetPercent: parseNonNegativeAmount(target.targetPercent, "نسبة التخصيص"), driftThresholdPercent: parseNonNegativeAmount(target.driftThresholdPercent, "حد الانحراف") }));
      try { validateAllocationTargets(parsedTargets); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تخصيص غير صالح." }); }
      const db = await getDb();
      if (!db) throw notAvailable();
      const now = Date.now();
      for (const target of parsedTargets) await db.insert(allocationTargets).values({ workspaceId: family.workspace.id, profileId: family.profile.id, assetClass: target.assetClass, targetPercent: target.targetPercent.toFixed(4), driftThresholdPercent: target.driftThresholdPercent.toFixed(4), createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { targetPercent: target.targetPercent.toFixed(4), driftThresholdPercent: target.driftThresholdPercent.toFixed(4), createdByUserId: ctx.user.id, updatedAt: now } });
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "allocation_targets.upserted", targetType: "allocation_target", targetId: String(family.profile.id), beforeState: null, afterState: parsedTargets.map(target => ({ assetClass: target.assetClass, targetPercent: target.targetPercent.toFixed(4), driftThresholdPercent: target.driftThresholdPercent.toFixed(4) })), requestId: crypto.randomUUID(), occurredAt: now });
      return { profileId: family.profile.id };
    }),
  }),

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

  feeTax: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable();
      return db.select().from(feeTaxRules).where(and(eq(feeTaxRules.workspaceId, family.workspace.id), eq(feeTaxRules.profileId, family.profile.id))).orderBy(desc(feeTaxRules.updatedAt));
    }),
    preview: protectedProcedure.input(z.object({ side: z.enum(["buy", "sell"]), grossAmount: money, currency })).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();
      const rules = await db.select({ name: feeTaxRules.name, chargeType: feeTaxRules.chargeType, appliesTo: feeTaxRules.appliesTo, calculationMethod: feeTaxRules.calculationMethod, value: feeTaxRules.value, currency: feeTaxRules.currency }).from(feeTaxRules).where(and(eq(feeTaxRules.workspaceId, family.workspace.id), eq(feeTaxRules.profileId, family.profile.id), eq(feeTaxRules.status, "active")));
      return suggestTradeCharges({ side: input.side, grossAmount: parsePositiveAmount(input.grossAmount, "قيمة الصفقة").toFixed(8), currency: input.currency, rules });
    }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), chargeType: z.enum(["fee", "tax"]), appliesTo: z.enum(["buy", "sell", "both"]), calculationMethod: z.enum(["flat", "percentage"]), value: money, currency: currency.optional().nullable(), jurisdictionNote: z.string().trim().max(4000).nullable() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user); assertRole(family, "editor");
      const value = parsePositiveAmount(input.value, "قيمة القاعدة");
      if (input.calculationMethod === "percentage" && value.gt(100)) throw new TRPCError({ code: "BAD_REQUEST", message: "النسبة المئوية لا يمكن أن تتجاوز 100%." });
      if (input.calculationMethod === "flat" && !input.currency) throw new TRPCError({ code: "BAD_REQUEST", message: "القاعدة الثابتة تتطلب عملة صريحة." });
      if (input.calculationMethod === "percentage" && input.currency) throw new TRPCError({ code: "BAD_REQUEST", message: "القاعدة النسبية لا تتطلب عملة." });
      const db = await getDb(); if (!db) throw notAvailable(); const now = Date.now();
      const result = await db.insert(feeTaxRules).values({ workspaceId: family.workspace.id, profileId: family.profile.id, name: input.name, chargeType: input.chargeType, appliesTo: input.appliesTo, calculationMethod: input.calculationMethod, value: value.toFixed(8), currency: input.currency?.toUpperCase() ?? null, jurisdictionNote: input.jurisdictionNote, status: "active", createdByUserId: ctx.user.id, createdAt: now, updatedAt: now });
      const id = Number(result[0].insertId);
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "fee_tax_rule.created", targetType: "fee_tax_rule", targetId: String(id), beforeState: null, afterState: { ...input, value: value.toFixed(8) }, requestId: crypto.randomUUID(), occurredAt: now });
      return { id };
    }),
    archive: protectedProcedure.input(z.object({ ruleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable();
      const [rule] = await db.select().from(feeTaxRules).where(and(eq(feeTaxRules.id, input.ruleId), eq(feeTaxRules.workspaceId, family.workspace.id), eq(feeTaxRules.profileId, family.profile.id))).limit(1);
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "القاعدة غير موجودة ضمن نطاقك المالي." });
      const now = Date.now(); await db.update(feeTaxRules).set({ status: "archived", updatedAt: now }).where(eq(feeTaxRules.id, rule.id));
      await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "fee_tax_rule.archived", targetType: "fee_tax_rule", targetId: String(rule.id), beforeState: { status: rule.status }, afterState: { status: "archived" }, requestId: crypto.randomUUID(), occurredAt: now });
      return { id: rule.id };
    }),
  }),

  specialAssets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable();
      const [rows, snapshots, valuations] = await Promise.all([
        db.select({ id: specialAssets.id, assetType: specialAssets.assetType, name: specialAssets.name, quantity: specialAssets.quantity, unit: specialAssets.unit, ownershipType: specialAssets.ownershipType, ownershipShare: specialAssets.ownershipShare, acquisitionDate: specialAssets.acquisitionDate, acquisitionCost: specialAssets.acquisitionCost, acquisitionCurrency: specialAssets.acquisitionCurrency, location: specialAssets.location, marketSymbol: specialAssets.marketSymbol, purity: specialAssets.purity, valuationMethod: specialAssets.valuationMethod, valuationSource: specialAssets.valuationSource, valuationAsOf: specialAssets.valuationAsOf, valuationStatus: specialAssets.valuationStatus, valuationNote: specialAssets.valuationNote, details: specialAssets.details, status: specialAssets.status, accountId: accounts.id, accountName: accounts.name, currency: accounts.currency }).from(specialAssets).innerJoin(accounts, eq(specialAssets.assetAccountId, accounts.id)).where(and(eq(specialAssets.workspaceId, family.workspace.id), eq(specialAssets.profileId, family.profile.id))).orderBy(desc(specialAssets.updatedAt)),
        listAccountSnapshots(family),
        db.select().from(specialAssetValuations).where(and(eq(specialAssetValuations.workspaceId, family.workspace.id), eq(specialAssetValuations.profileId, family.profile.id))).orderBy(desc(specialAssetValuations.asOf), desc(specialAssetValuations.id)),
      ]);
      const snapshotByAccountId = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));
      const latestValuationByAssetId = new Map<number, typeof valuations[number]>();
      valuations.forEach(valuation => { if (!latestValuationByAssetId.has(valuation.assetId)) latestValuationByAssetId.set(valuation.assetId, valuation); });
      return rows.map(row => {
        const snapshot = snapshotByAccountId.get(row.accountId);
        const latestValuation = latestValuationByAssetId.get(row.id) ?? null;
        return { ...row, balance: snapshot?.balance ?? "0.00", baseValue: snapshot?.baseValue ?? null, ledgerValuationStatus: snapshot?.valuationStatus ?? "unvalued", rateAsOf: snapshot?.rateAsOf ?? null, latestValuation };
      });
    }),
    create: protectedProcedure.input(z.object({ assetAccountId: z.number().int().positive(), assetType: z.enum(["real_estate", "gold", "commodity", "other"]), name: z.string().trim().min(2).max(200), quantity: money.optional().nullable(), unit: z.string().trim().max(48).nullable(), ownershipType: z.enum(["sole", "joint", "usufruct", "other"]).default("sole"), ownershipShare: money.default("100"), acquisitionDate: occurredAt.optional().nullable(), acquisitionCost: money.optional().nullable(), acquisitionCurrency: currency.optional().nullable(), location: z.string().trim().max(255).nullable().optional(), marketSymbol: z.string().trim().max(48).nullable().optional(), purity: money.optional().nullable(), valuationMethod: z.enum(["ledger_balance", "market_quote", "manual", "appraisal"]).default("ledger_balance"), valuationSource: z.string().trim().max(255).nullable().optional(), valuationAsOf: occurredAt.optional().nullable(), valuationNote: z.string().trim().max(4000).nullable().optional(), details: z.string().trim().max(4000).nullable() })).mutation(async ({ ctx, input }) => { const hasQuantity = Boolean(input.quantity?.trim()); const hasUnit = Boolean(input.unit?.trim()); if (hasQuantity !== hasUnit) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل كمية الأصل ووحدتها معًا." }); const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const [account] = await db.select().from(accounts).where(and(eq(accounts.id, input.assetAccountId), eq(accounts.workspaceId, family.workspace.id), eq(accounts.ownerProfileId, family.profile.id), eq(accounts.accountType, "asset"), eq(accounts.status, "active"))).limit(1); if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "اختر حساب أصل نشطًا ومملوكًا لك ضمن FAMILY." }); const [existing] = await db.select({ id: specialAssets.id }).from(specialAssets).where(and(eq(specialAssets.workspaceId, family.workspace.id), eq(specialAssets.profileId, family.profile.id), eq(specialAssets.assetAccountId, account.id))).limit(1); if (existing) throw new TRPCError({ code: "CONFLICT", message: "يرتبط حساب الأصل هذا بسجل أصل خاص بالفعل." }); const quantity = input.quantity?.trim() ? parsePositiveAmount(input.quantity, "كمية الأصل") : null; const ownershipShare = parsePositiveAmount(input.ownershipShare, "نسبة الملكية"); if (ownershipShare.gt(100)) throw new TRPCError({ code: "BAD_REQUEST", message: "نسبة الملكية يجب أن تكون بين 0 و100." }); const acquisitionCost = input.acquisitionCost?.trim() ? parsePositiveAmount(input.acquisitionCost, "تكلفة الاقتناء") : null; const purity = input.purity?.trim() ? parsePositiveAmount(input.purity, "نقاوة الذهب") : null; if (purity && purity.gt(100)) throw new TRPCError({ code: "BAD_REQUEST", message: "نقاوة الذهب يجب ألا تتجاوز 100%." }); if (input.assetType === "gold" && purity && purity.gt(0) && purity.lte(1)) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل نقاوة الذهب كنسبة مئوية مثل 99.9." }); if (input.assetType === "gold" && input.valuationMethod === "market_quote" && !input.marketSymbol) throw new TRPCError({ code: "BAD_REQUEST", message: "تقييم الذهب بسعر سوق يتطلب رمزًا مثل GC=F." }); const now = Date.now(); const result = await db.insert(specialAssets).values({ workspaceId: family.workspace.id, profileId: family.profile.id, assetAccountId: account.id, assetType: input.assetType, name: input.name, quantity: quantity?.toFixed(8) ?? null, unit: input.unit, ownershipType: input.ownershipType, ownershipShare: ownershipShare.toFixed(5), acquisitionDate: input.acquisitionDate, acquisitionCost: acquisitionCost?.toFixed(6) ?? null, acquisitionCurrency: input.acquisitionCurrency?.toUpperCase() ?? null, location: input.location, marketSymbol: input.marketSymbol?.toUpperCase() ?? null, purity: purity?.toFixed(6) ?? null, valuationMethod: input.valuationMethod, valuationSource: input.valuationSource, valuationAsOf: input.valuationAsOf, valuationStatus: input.valuationMethod === "ledger_balance" ? "unvalued" : "review_required", valuationNote: input.valuationNote, details: input.details, status: "active", createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }); const id = Number(result[0].insertId); await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "special_asset.created", targetType: "special_asset", targetId: String(id), beforeState: null, afterState: { ...input, quantity: quantity?.toFixed(8) ?? null }, requestId: crypto.randomUUID(), occurredAt: now }); return { id }; }),
    suggestYahooGoldValue: protectedProcedure.input(z.object({ assetId: z.number().int().positive(), symbol: z.string().trim().min(1).max(48).default("GC=F") })).query(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable();
      const [asset] = await db.select().from(specialAssets).innerJoin(accounts, eq(specialAssets.assetAccountId, accounts.id)).where(and(eq(specialAssets.id, input.assetId), eq(specialAssets.workspaceId, family.workspace.id), eq(specialAssets.profileId, family.profile.id), eq(specialAssets.assetType, "gold"), eq(specialAssets.status, "active"))).limit(1);
      if (!asset || !asset.special_assets.quantity || !asset.special_assets.unit) throw new TRPCError({ code: "NOT_FOUND", message: "يلزم أصل ذهب نشط مع كمية ووحدة مسجلتين داخل نطاقك." });
      const quote = await fetchYahooQuote(input.symbol);
      if (quote.currency !== asset.accounts.currency) throw new TRPCError({ code: "BAD_GATEWAY", message: "عملة سعر Yahoo لا تطابق عملة حساب أصل الذهب؛ راجع الرمز أو استخدم إعادة التقييم اليدوية." });
      let suggestion; try { suggestion = suggestGoldRevaluation({ quantity: asset.special_assets.quantity, unit: asset.special_assets.unit, quotePerTroyOunce: quote.price }); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر احتساب اقتراح الذهب." }); }
      return { assetId: asset.special_assets.id, symbol: input.symbol.toUpperCase(), source: quote.source, quoteStatus: quote.quoteStatus, asOf: quote.asOf, currency: quote.currency, ...suggestion };
    }),
    recordYahooGoldValuation: protectedProcedure.input(z.object({ assetId: z.number().int().positive(), symbol: z.string().trim().min(1).max(48).default("GC=F"), note: z.string().trim().max(4000).nullable() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user); assertRole(family, "advisor"); const db = await getDb(); if (!db) throw notAvailable();
      const [asset] = await db.select().from(specialAssets).innerJoin(accounts, eq(specialAssets.assetAccountId, accounts.id)).where(and(eq(specialAssets.id, input.assetId), eq(specialAssets.workspaceId, family.workspace.id), eq(specialAssets.profileId, family.profile.id), eq(specialAssets.assetType, "gold"), eq(specialAssets.status, "active"))).limit(1);
      if (!asset || !asset.special_assets.quantity || !asset.special_assets.unit) throw new TRPCError({ code: "NOT_FOUND", message: "يلزم أصل ذهب نشط مع كمية ووحدة قبل حفظ تقييم السوق." });
      const quote = await fetchYahooQuote(input.symbol);
      if (quote.currency !== asset.accounts.currency) throw new TRPCError({ code: "BAD_GATEWAY", message: "عملة سعر Yahoo لا تطابق عملة حساب أصل الذهب." });
      let suggestion; try { suggestion = suggestGoldRevaluation({ quantity: asset.special_assets.quantity, unit: asset.special_assets.unit, quotePerTroyOunce: quote.price }); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر احتساب تقييم الذهب." }); }
      const now = Date.now(); const quality = quote.quoteStatus === "delayed" ? "delayed" : "review_required"; const result = await db.transaction(async tx => {
        const inserted = await tx.insert(specialAssetValuations).values({ workspaceId: family.workspace.id, profileId: family.profile.id, assetId: asset.special_assets.id, financialEventId: null, valuationMethod: "market_quote", value: suggestion.suggestedTargetValue, currency: quote.currency, marketSymbol: input.symbol.toUpperCase(), source: quote.source, quoteValue: quote.price, quoteCurrency: quote.currency, asOf: quote.asOf, quality, note: input.note, createdByUserId: ctx.user.id, createdAt: now });
        await tx.update(specialAssets).set({ marketSymbol: input.symbol.toUpperCase(), valuationMethod: "market_quote", valuationSource: quote.source, valuationAsOf: quote.asOf, valuationStatus: quality === "delayed" ? "review_required" : "current", valuationNote: input.note, updatedAt: now }).where(eq(specialAssets.id, asset.special_assets.id));
        await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "special_asset.market_valuation_recorded", targetType: "special_asset", targetId: String(asset.special_assets.id), beforeState: { valuationAsOf: asset.special_assets.valuationAsOf, valuationStatus: asset.special_assets.valuationStatus }, afterState: { valuationAsOf: quote.asOf, valuationStatus: quality === "delayed" ? "review_required" : "current", value: suggestion.suggestedTargetValue, source: quote.source, symbol: input.symbol.toUpperCase() }, requestId: crypto.randomUUID(), occurredAt: now });
        return { id: Number(inserted[0].insertId) };
      });
      invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`);
      invalidateReadModelCache(`stress-testing:${family.workspace.id}:`);
      return { ...result, assetId: asset.special_assets.id, symbol: input.symbol.toUpperCase(), source: quote.source, quoteStatus: quote.quoteStatus, asOf: quote.asOf, currency: quote.currency, ...suggestion };
    }),
    revalue: protectedProcedure.input(z.object({ assetId: z.number().int().positive(), targetValue: money, occurredAt, memo: z.string().trim().max(2000).nullable(), idempotencyKey })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user); assertRole(family, "advisor"); const db = await getDb(); if (!db) throw notAvailable();
      const [asset] = await db.select().from(specialAssets).innerJoin(accounts, eq(specialAssets.assetAccountId, accounts.id)).where(and(eq(specialAssets.id, input.assetId), eq(specialAssets.workspaceId, family.workspace.id), eq(specialAssets.profileId, family.profile.id), eq(specialAssets.status, "active"))).limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الأصل الخاص النشط غير موجود ضمن نطاقك المالي." });
      const result = await revalueAssetAccount({ context: family, actorUserId: ctx.user.id, accountId: asset.special_assets.assetAccountId, targetValue: input.targetValue, currency: asset.accounts.currency, occurredAt: input.occurredAt, memo: input.memo, idempotencyKey: input.idempotencyKey });
      if (!result.duplicate) await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "special_asset.revalued", targetType: "special_asset", targetId: String(asset.special_assets.id), beforeState: { value: result.priorValue }, afterState: { targetValue: result.targetValue, direction: result.direction, financialEventId: result.id }, requestId: crypto.randomUUID(), occurredAt: input.occurredAt });
      return result;
    }),
  }),
  insurance: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable();
      const [policies, payments, claims] = await Promise.all([
        db.select().from(insurancePolicies).where(and(eq(insurancePolicies.workspaceId, family.workspace.id), eq(insurancePolicies.profileId, family.profile.id))).orderBy(desc(insurancePolicies.updatedAt)),
        db.select().from(insurancePremiumPayments).where(and(eq(insurancePremiumPayments.workspaceId, family.workspace.id), eq(insurancePremiumPayments.profileId, family.profile.id))).orderBy(desc(insurancePremiumPayments.occurredAt)),
        db.select().from(insuranceClaims).where(and(eq(insuranceClaims.workspaceId, family.workspace.id), eq(insuranceClaims.profileId, family.profile.id))).orderBy(desc(insuranceClaims.submittedAt)),
      ]);
      const latestPaymentByPolicyId = new Map<number, typeof payments[number]>();
      payments.forEach(payment => { if (!latestPaymentByPolicyId.has(payment.policyId)) latestPaymentByPolicyId.set(payment.policyId, payment); });
      const claimsByPolicyId = new Map<number, typeof claims>();
      claims.forEach(claim => { const list = claimsByPolicyId.get(claim.policyId) ?? []; list.push(claim); claimsByPolicyId.set(claim.policyId, list); });
      return policies.map(policy => { const policyClaims = claimsByPolicyId.get(policy.id) ?? []; return { ...policy, latestPremiumPayment: latestPaymentByPolicyId.get(policy.id) ?? null, claimSummary: { total: policyClaims.length, submitted: policyClaims.filter(claim => claim.status === "submitted").length, paid: policyClaims.filter(claim => claim.status === "paid").length, claimedAmount: policyClaims.reduce((sum, claim) => sum.plus(claim.claimedAmount), new Decimal(0)).toFixed(6), receivedAmount: policyClaims.reduce((sum, claim) => sum.plus(claim.receivedAmount ?? 0), new Decimal(0)).toFixed(6) } }; });
    }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(200), policyType: z.enum(["health", "life", "property", "motor", "other"]), insurer: z.string().trim().max(160).nullable(), policyNumber: z.string().trim().max(160).nullable(), coverageAmount: money.optional().nullable(), currency, premiumAmount: money.optional().nullable(), premiumCadence: z.enum(["monthly", "quarterly", "yearly", "other"]).nullable(), cashFlowCategoryId: z.number().int().positive().nullable(), startsAt: occurredAt.optional().nullable(), endsAt: occurredAt.optional().nullable(), renewalAt: occurredAt.optional().nullable(), premiumDueDay: z.number().int().min(1).max(31).nullable().optional(), deductibleAmount: money.optional().nullable(), deductibleCurrency: currency.optional().nullable(), providerContact: z.string().trim().max(255).nullable().optional(), policyTerms: z.string().trim().max(12_000).nullable().optional(), beneficiaries: z.string().trim().max(4000).nullable(), claimsNote: z.string().trim().max(4000).nullable() })).mutation(async ({ ctx, input }) => { const hasPremium = Boolean(input.premiumAmount?.trim()); const hasCadence = Boolean(input.premiumCadence); if (hasPremium !== hasCadence) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل قيمة القسط ودورية سداده معًا." }); if (input.startsAt != null && input.endsAt != null && input.endsAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء الوثيقة لا يمكن أن يسبق تاريخ بدايتها." }); if (input.renewalAt != null && input.startsAt != null && input.renewalAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ التجديد لا يمكن أن يسبق بداية الوثيقة." }); if (input.renewalAt != null && input.endsAt != null && input.renewalAt > input.endsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ التجديد يجب أن يقع قبل انتهاء الوثيقة أو يساويه." }); const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); if (input.cashFlowCategoryId) { const [category] = await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.id, input.cashFlowCategoryId), eq(cashFlowCategories.workspaceId, family.workspace.id), eq(cashFlowCategories.direction, "expense"))).limit(1); if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "فئة قسط التأمين يجب أن تكون مصروفًا ضمن نطاقك." }); } const coverage = input.coverageAmount?.trim() ? parsePositiveAmount(input.coverageAmount, "قيمة التغطية") : null; const premium = input.premiumAmount?.trim() ? parsePositiveAmount(input.premiumAmount, "قسط التأمين") : null; const deductible = input.deductibleAmount?.trim() ? parsePositiveAmount(input.deductibleAmount, "قيمة التحمل") : null; if (deductible && !input.deductibleCurrency) throw new TRPCError({ code: "BAD_REQUEST", message: "قيمة التحمل تتطلب عملة صريحة." }); if (input.deductibleCurrency && input.deductibleCurrency.toUpperCase() !== input.currency.toUpperCase()) throw new TRPCError({ code: "BAD_REQUEST", message: "عملة التحمل يجب أن تطابق عملة الوثيقة." }); const now = Date.now(); const result = await db.insert(insurancePolicies).values({ workspaceId: family.workspace.id, profileId: family.profile.id, name: input.name, policyType: input.policyType, insurer: input.insurer, policyNumber: input.policyNumber, coverageAmount: coverage?.toFixed(6) ?? null, currency: input.currency.toUpperCase(), premiumAmount: premium?.toFixed(6) ?? null, premiumCadence: input.premiumCadence, cashFlowCategoryId: input.cashFlowCategoryId, startsAt: input.startsAt, endsAt: input.endsAt, renewalAt: input.renewalAt, premiumDueDay: input.premiumDueDay, deductibleAmount: deductible?.toFixed(6) ?? null, deductibleCurrency: input.deductibleCurrency?.toUpperCase() ?? null, providerContact: input.providerContact, policyTerms: input.policyTerms, beneficiaries: input.beneficiaries, claimsNote: input.claimsNote, status: "active", createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }); const id = Number(result[0].insertId); await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "insurance_policy.created", targetType: "insurance_policy", targetId: String(id), beforeState: null, afterState: { ...input, coverageAmount: coverage?.toFixed(6) ?? null, premiumAmount: premium?.toFixed(6) ?? null }, requestId: crypto.randomUUID(), occurredAt: now }); invalidateReadModelCache(`wealth-health:score:${family.workspace.id}`); invalidateReadModelCache(`stress-testing:${family.workspace.id}:`); return { id }; }),
    postPremium: protectedProcedure.input(z.object({ policyId: z.number().int().positive(), cashAccountId: z.number().int().positive(), amount: money, occurredAt, memo: z.string().trim().max(2000).nullable(), idempotencyKey })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable();
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
          await tx.insert(insurancePremiumPayments).values({ workspaceId: family.workspace.id, profileId: family.profile.id, policyId: policy.id, financialEventId: postedEvent.id, cashAccountId: cashAccount.id, amount: postedAmount.toFixed(6), currency: policy.currency, occurredAt: input.occurredAt, createdByUserId: ctx.user.id, createdAt: now });
          await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "insurance_premium.posted", targetType: "insurance_policy", targetId: String(policy.id), beforeState: null, afterState: { amount: postedAmount.toFixed(6), currency: policy.currency, cashAccountId: cashAccount.id, financialEventId: postedEvent.id }, requestId: crypto.randomUUID(), occurredAt: input.occurredAt });
        },
      });
      return event;
    }),
    claims: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select({ id: insuranceClaims.id, policyId: insuranceClaims.policyId, policyName: insurancePolicies.name, referenceNumber: insuranceClaims.referenceNumber, claimedAmount: insuranceClaims.claimedAmount, receivedAmount: insuranceClaims.receivedAmount, currency: insuranceClaims.currency, submittedAt: insuranceClaims.submittedAt, expectedAt: insuranceClaims.expectedAt, receivedEventId: insuranceClaims.receivedEventId, status: insuranceClaims.status, note: insuranceClaims.note }).from(insuranceClaims).innerJoin(insurancePolicies, eq(insuranceClaims.policyId, insurancePolicies.id)).where(and(eq(insuranceClaims.workspaceId, family.workspace.id), eq(insuranceClaims.profileId, family.profile.id))).orderBy(desc(insuranceClaims.submittedAt)); }),
    createClaim: protectedProcedure.input(z.object({ policyId: z.number().int().positive(), referenceNumber: z.string().trim().max(160).nullable(), claimedAmount: money, submittedAt: occurredAt, expectedAt: occurredAt.nullable(), note: z.string().trim().max(4000).nullable() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const [policy] = await db.select({ id: insurancePolicies.id, currency: insurancePolicies.currency }).from(insurancePolicies).where(and(eq(insurancePolicies.id, input.policyId), eq(insurancePolicies.workspaceId, family.workspace.id), eq(insurancePolicies.profileId, family.profile.id), eq(insurancePolicies.status, "active"))).limit(1); if (!policy) throw new TRPCError({ code: "NOT_FOUND", message: "بوليصة التأمين النشطة غير موجودة ضمن نطاقك." }); const amount = parsePositiveAmount(input.claimedAmount, "قيمة المطالبة"); const now = Date.now(); const result = await db.insert(insuranceClaims).values({ workspaceId: family.workspace.id, profileId: family.profile.id, policyId: policy.id, referenceNumber: input.referenceNumber, claimedAmount: amount.toFixed(6), receivedAmount: null, currency: policy.currency, submittedAt: input.submittedAt, expectedAt: input.expectedAt, receivedEventId: null, status: "submitted", note: input.note, createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }); const id = Number(result[0].insertId); await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "insurance_claim.created", targetType: "insurance_claim", targetId: String(id), beforeState: null, afterState: { policyId: policy.id, claimedAmount: amount.toFixed(6), currency: policy.currency, submittedAt: input.submittedAt }, requestId: crypto.randomUUID(), occurredAt: now }); return { id }; }),
    markReceived: protectedProcedure.input(z.object({ claimId: z.number().int().positive(), financialEventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const [claim] = await db.select().from(insuranceClaims).where(and(eq(insuranceClaims.id, input.claimId), eq(insuranceClaims.workspaceId, family.workspace.id), eq(insuranceClaims.profileId, family.profile.id), eq(insuranceClaims.status, "submitted"))).limit(1); if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "المطالبة المقدمة غير موجودة ضمن نطاقك." }); const [event] = await db.select({ id: financialEvents.id, eventType: financialEvents.eventType, currency: financialEvents.currency, grossAmount: financialEvents.grossAmount, status: financialEvents.status }).from(financialEvents).where(and(eq(financialEvents.id, input.financialEventId), eq(financialEvents.workspaceId, family.workspace.id), eq(financialEvents.profileId, family.profile.id), eq(financialEvents.status, "posted"))).limit(1); if (!event || event.eventType !== "income" || event.currency !== claim.currency || new Decimal(event.grossAmount).lte(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "اربط المطالبة بحركة دخل منشورة وبالعملة نفسها." }); const now = Date.now(); await db.transaction(async tx => { await tx.update(insuranceClaims).set({ status: "paid", receivedAmount: event.grossAmount, receivedEventId: event.id, updatedAt: now }).where(eq(insuranceClaims.id, claim.id)); await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "insurance_claim.received", targetType: "insurance_claim", targetId: String(claim.id), beforeState: { status: "submitted", receivedEventId: null }, afterState: { status: "paid", receivedEventId: event.id, receivedAmount: event.grossAmount }, requestId: crypto.randomUUID(), occurredAt: now }); }); return { id: claim.id, receivedEventId: event.id }; }),
  }),

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

  zakat: router({
    list: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select().from(zakatAssessments).where(and(eq(zakatAssessments.workspaceId, family.workspace.id), eq(zakatAssessments.profileId, family.profile.id))).orderBy(desc(zakatAssessments.assessedAt)); }),
    calculate: protectedProcedure.input(z.object({ haulStartedAt: occurredAt, goldPricePerGramBase: money, goldNisabGrams: money.optional(), annualRatePercent: money.optional(), calendarType: z.enum(["hijri", "gregorian"]).optional(), eligibleAdjustmentBase: z.string().trim().regex(/^-?\d+(\.\d+)?$/).optional(), haulCompleted: z.boolean() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const summary = await getDashboardSummary(family); const baseEligible = new Decimal(summary.liquidBalanceBase).plus(summary.investmentValueBase); const adjustment = new Decimal(input.eligibleAdjustmentBase ?? "0"); const eligibleBase = Decimal.max(0, baseEligible.plus(adjustment)); const result = calculateZakat({ eligibleBase: eligibleBase.toFixed(6), goldPricePerGramBase: input.goldPricePerGramBase, goldNisabGrams: input.goldNisabGrams, annualRatePercent: input.annualRatePercent, calendarType: input.calendarType, haulCompleted: input.haulCompleted }); const now = Date.now(); const inserted = await db.insert(zakatAssessments).values({ workspaceId: family.workspace.id, profileId: family.profile.id, haulStartedAt: input.haulStartedAt, assessedAt: now, goldNisabGrams: result.goldNisabGrams, goldPricePerGramBase: result.goldPricePerGramBase, eligibleBase: result.eligibleBase, nisabBase: result.nisabBase, zakatDueBase: result.zakatDueBase, currency: family.workspace.baseCurrency, methodology: { baseEligible: baseEligible.toFixed(6), adjustment: adjustment.toFixed(6), annualRatePercent: result.annualRatePercent, calendarType: result.calendarType, haulCompleted: result.haulCompleted, disclosure: result.disclosure }, paymentEventId: null, status: "calculated", createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }); const id = Number(inserted[0].insertId); await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "zakat.calculated", targetType: "zakat_assessment", targetId: String(id), beforeState: null, afterState: { eligibleBase: result.eligibleBase, nisabBase: result.nisabBase, zakatDueBase: result.zakatDueBase, currency: family.workspace.baseCurrency }, requestId: crypto.randomUUID(), occurredAt: now }); return { id, ...result, currency: family.workspace.baseCurrency }; }),
    markPaid: protectedProcedure.input(z.object({ assessmentId: z.number().int().positive(), financialEventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const [assessment] = await db.select().from(zakatAssessments).where(and(eq(zakatAssessments.id, input.assessmentId), eq(zakatAssessments.workspaceId, family.workspace.id), eq(zakatAssessments.profileId, family.profile.id), eq(zakatAssessments.status, "calculated"))).limit(1); if (!assessment) throw new TRPCError({ code: "NOT_FOUND", message: "تقييم الزكاة القابل للدفع غير موجود ضمن نطاقك." }); const [event] = await db.select({ id: financialEvents.id, eventType: financialEvents.eventType, currency: financialEvents.currency, grossAmount: financialEvents.grossAmount, status: financialEvents.status }).from(financialEvents).where(and(eq(financialEvents.id, input.financialEventId), eq(financialEvents.workspaceId, family.workspace.id), eq(financialEvents.profileId, family.profile.id), eq(financialEvents.status, "posted"))).limit(1); if (!event || event.eventType !== "expense" || event.currency !== assessment.currency || new Decimal(event.grossAmount).lt(assessment.zakatDueBase)) throw new TRPCError({ code: "BAD_REQUEST", message: "اربط التقييم بمصروف دفتر منشور بعملة وقيمة متوافقتين." }); const now = Date.now(); await db.transaction(async tx => { await tx.update(zakatAssessments).set({ status: "paid", paymentEventId: event.id, updatedAt: now }).where(eq(zakatAssessments.id, assessment.id)); await tx.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "zakat.marked_paid", targetType: "zakat_assessment", targetId: String(assessment.id), beforeState: { status: "calculated", paymentEventId: null }, afterState: { status: "paid", paymentEventId: event.id }, requestId: crypto.randomUUID(), occurredAt: now }); }); return { id: assessment.id, paymentEventId: event.id }; }),
  }),

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
        try { quote = await fetchYahooQuote(instrument.symbol); } catch { throw new TRPCError({ code: "BAD_GATEWAY", message: "تعذر الحصول على سعر صالح من Yahoo Finance الآن. استخدم تسجيلاً يدويًا أو حاول لاحقًا." }); }
        if (quote.currency !== instrument.currency) throw new TRPCError({ code: "BAD_GATEWAY", message: "عملة سعر Yahoo لا تطابق عملة الأداة المسجلة؛ راجع رمز السوق أو سجّل سعراً يدويًا." });
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
  planning: router({
    scenarios: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); return db.select().from(planningScenarios).where(and(eq(planningScenarios.workspaceId, family.workspace.id), eq(planningScenarios.status, "active"))).orderBy(planningScenarios.updatedAt); }),
    createScenario: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), scenarioType: z.enum(["debt", "retirement", "emergency", "cash_flow"]), monthlyIncome: z.number().min(0), monthlyExpense: z.number().min(0), liquidReserve: z.number().min(0), debtBalance: z.number().min(0), annualReturnPercent: z.number().min(-50).max(100), annualInflationPercent: z.number().min(-20).max(100), months: z.number().int().min(1).max(120), annualDebtRatePercent: z.number().min(0).max(100).optional(), extraDebtPayment: z.number().min(0).optional(), retirementAssets: z.number().min(0).optional(), monthlyRetirementContribution: z.number().min(0).optional(), retirementAge: z.number().int().min(0).max(120).optional(), currentAge: z.number().int().min(0).max(120).optional(), retirementAnnualSpending: z.number().min(0).optional(), emergencyTargetMonths: z.number().int().min(1).max(24).optional() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const nowDate = new Date(); const historicalPeriodKeys = Array.from({ length: 12 }, (_, offset) => { const date = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - 1 - offset, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }); const histories = await Promise.all(historicalPeriodKeys.map(periodKey => getCashFlowSummary(family, periodKey))); const historicalMonthlyExpenses = histories.map(item => Number(item.expenseActualBase)).filter(value => Number.isFinite(value) && value >= 0); const result = projectScenario({ type: input.scenarioType, ...input, historicalMonthlyExpenses }); const now = Date.now(); const assumptions = { ...input, historicalExpenseBasis: { periodKeys: historicalPeriodKeys, sampleMonths: historicalMonthlyExpenses.length, baseCurrency: family.workspace.baseCurrency } }; const inserted = await db.insert(planningScenarios).values({ workspaceId: family.workspace.id, profileId: family.profile.id, name: input.name, scenarioType: input.scenarioType, assumptions, result, confidence: result.confidence, status: "active", createdByUserId: ctx.user.id, createdAt: now, updatedAt: now }); return { id: Number(inserted[0].insertId), result }; }),
    marketSignals: protectedProcedure.query(async ({ ctx }) => {
      const family = await familyContext(ctx.user);
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
    decisionCenter: protectedProcedure.query(async ({ ctx }) => { const family = await familyContext(ctx.user); const db = await getDb(); if (!db) throw notAvailable(); const date = new Date(); const currentPeriodKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; const [summary, debtItems, pending, cashFlow] = await Promise.all([getDashboardSummary(family), listDebtSummaries(family), db.select({ id: approvalRequests.id, amount: approvalRequests.amount, currency: approvalRequests.currency, actionType: approvalRequests.actionType }).from(approvalRequests).where(and(eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.status, "pending"))).orderBy(approvalRequests.createdAt), getCashFlowSummary(family, currentPeriodKey)]); const currency = family.workspace.baseCurrency; const signals: Array<{ id: string; impact: number; tone: string; title: string; detail: string; amount: string | null; currency: string | null; actionPath: string }> = []; const liquid = new Decimal(summary.liquidBalanceBase || 0); const liabilities = new Decimal(summary.liabilityBalanceBase || 0); const plannedExpense = new Decimal(cashFlow.expensePlanBase || 0); const actualExpense = new Decimal(cashFlow.expenseActualBase || 0); if (liquid.lte(0)) signals.push({ id: "liquidity", impact: 100, tone: "danger", title: "سيولة تشغيلية منخفضة", detail: "راجع الحسابات النقدية وخطة الاحتياطي قبل إنشاء التزام جديد.", amount: liquid.toFixed(6), currency, actionPath: "/emergency-fund" }); if (liabilities.gt(liquid) && liabilities.gt(0)) signals.push({ id: "debt", impact: 85, tone: "warning", title: "الالتزامات تتجاوز السيولة", amount: liabilities.toFixed(6), detail: `${debtItems.filter(item => item.status === "active").length} التزامات نشطة تحتاج مراجعة تدفق السداد.`, currency, actionPath: "/debts" }); if (plannedExpense.gt(0) && actualExpense.gt(plannedExpense)) { const variance = actualExpense.minus(plannedExpense); const overspendPercent = variance.div(plannedExpense).mul(100); signals.push({ id: `budget-${currentPeriodKey}`, impact: Math.min(95, 72 + Number(overspendPercent)), tone: "warning", title: "انحراف في ميزانية المصروفات", detail: `تجاوزت المصروفات الفعلية خطة ${currentPeriodKey} بمقدار ${variance.toFixed(2)} من عملة الأساس.`, amount: variance.toFixed(6), currency, actionPath: "/cash-flow" }); } for (const item of pending) signals.push({ id: `approval-${item.id}`, impact: 70 + Math.min(20, Number(item.amount || 0) / 100000), tone: "warning", title: "اعتماد عائلي مطلوب", detail: `${item.actionType} بانتظار قرار معتمد`, amount: item.amount, currency: item.currency, actionPath: "/approvals" }); return signals.sort((a, b) => b.impact - a.impact).slice(0, 3).map((signal, index) => ({ ...signal, priority: index + 1 })); }),
  }),

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

  ledger: router({
    recent: protectedProcedure.query(async ({ ctx }) => listRecentEvents(await familyContext(ctx.user))),
    postCash: protectedProcedure
      .input(z.object({ eventType: z.enum(["opening_balance", "deposit", "withdrawal", "income", "expense"]), accountId: z.number().int().positive(), amount: money, currency, occurredAt, categoryId: z.number().int().positive().optional().nullable(), memo: z.string().trim().max(2_000).optional().nullable(), idempotencyKey }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const normalizedCurrency = input.currency.toUpperCase(); const amount = parsePositiveAmount(input.amount);
        const policies = await db.select().from(approvalPolicies).where(and(eq(approvalPolicies.workspaceId, family.workspace.id), eq(approvalPolicies.actionType, "cash_event"), eq(approvalPolicies.status, "active")));
        const policy = policies.filter(item => item.currency === normalizedCurrency).sort((a, b) => new Decimal(a.thresholdAmount).cmp(b.thresholdAmount)).find(item => amount.gte(new Decimal(item.thresholdAmount)));
        if (policy) { const now = Date.now(); const inserted = await db.insert(approvalRequests).values({ workspaceId: family.workspace.id, policyId: policy.id, requestedByUserId: ctx.user.id, actionType: "cash_event", actionPayload: { ...input, currency: normalizedCurrency }, amount: amount.toFixed(6), currency: normalizedCurrency, status: "pending", requiredApproverRole: policy.approverRole, expiresAt: now + 7 * 86400000, executedEventId: null, createdAt: now, updatedAt: now }); const requestId = Number(inserted[0].insertId); await db.insert(auditEvents).values({ workspaceId: family.workspace.id, actorUserId: ctx.user.id, action: "approval_request.created", targetType: "approval_request", targetId: String(requestId), beforeState: null, afterState: { policyId: policy.id, amount: amount.toFixed(6), currency: normalizedCurrency }, requestId: crypto.randomUUID(), occurredAt: now }); return { approvalRequired: true as const, approvalRequestId: requestId }; }
        const event = await postCashEvent({ context: family, actorUserId: ctx.user.id, ...input, currency: normalizedCurrency }); return { approvalRequired: false as const, event };
      }),
    executeApprovedCash: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const family = await familyContext(ctx.user); assertRole(family, "editor"); const db = await getDb(); if (!db) throw notAvailable(); const [request] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.workspaceId, family.workspace.id), eq(approvalRequests.actionType, "cash_event"), eq(approvalRequests.status, "approved"))).limit(1); if (!request) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد طلب اعتماد نقدي موافق عليه وقابل للتنفيذ." }); const payload = request.actionPayload as Record<string, unknown>; const eventType = payload.eventType; const accountId = payload.accountId; const amount = payload.amount; const currencyValue = payload.currency; const occurred = payload.occurredAt; const key = payload.idempotencyKey; if (!(["opening_balance", "deposit", "withdrawal", "income", "expense"].includes(String(eventType)) && Number.isInteger(accountId) && typeof amount === "string" && typeof currencyValue === "string" && Number.isInteger(occurred) && typeof key === "string")) throw new TRPCError({ code: "BAD_REQUEST", message: "البيانات المجمدة في طلب الاعتماد غير صالحة." }); const event = await postCashEvent({ context: family, actorUserId: ctx.user.id, eventType: eventType as "opening_balance" | "deposit" | "withdrawal" | "income" | "expense", accountId: accountId as number, amount, currency: currencyValue, occurredAt: occurred as number, categoryId: typeof payload.categoryId === "number" ? payload.categoryId : null, memo: typeof payload.memo === "string" ? payload.memo : null, idempotencyKey: key }); await db.update(approvalRequests).set({ status: "executed", executedEventId: event.id, updatedAt: Date.now() }).where(eq(approvalRequests.id, request.id)); return { eventId: event.id }; }),
    executeApprovedTransfer: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const family = await familyContext(ctx.user);
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
      const family = await familyContext(ctx.user);
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
      .input(z.object({ fromAccountId: z.number().int().positive(), toAccountId: z.number().int().positive(), amount: money, currency, occurredAt, memo: z.string().trim().max(2_000).optional().nullable(), idempotencyKey }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const normalizedCurrency = input.currency.toUpperCase();
        const frozen = await createFrozenApprovalRequest({ db, workspaceId: family.workspace.id, actorUserId: ctx.user.id, actionType: "transfer", amount: input.amount, currency: normalizedCurrency, payload: { ...input, currency: normalizedCurrency } });
        if (frozen) return { approvalRequired: true as const, approvalRequestId: frozen.id, duplicate: frozen.duplicate };
        const event = await postTransfer({ context: family, actorUserId: ctx.user.id, ...input, currency: normalizedCurrency });
        return { approvalRequired: false as const, event };
      }),
    trade: protectedProcedure
      .input(z.object({ side: z.enum(["buy", "sell"]), accountId: z.number().int().positive(), instrumentId: z.number().int().positive(), quantity: money, unitPrice: money, feeAmount: money.optional().nullable(), taxAmount: money.optional().nullable(), feeRuleId: z.number().int().positive().optional().nullable(), taxRuleId: z.number().int().positive().optional().nullable(), occurredAt, memo: z.string().trim().max(2_000).optional().nullable(), idempotencyKey }))
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
        assertRole(family, "editor");
        const db = await getDb();
        if (!db) throw notAvailable();
        const [instrument] = await db.select({ id: instruments.id, currency: instruments.currency }).from(instruments).where(and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, family.workspace.id))).limit(1);
        if (!instrument) throw new TRPCError({ code: "NOT_FOUND", message: "الأداة الاستثمارية غير موجودة ضمن مساحة FAMILY الحالية." });
        const grossAmount = parsePositiveAmount(input.quantity, "الكمية").mul(parsePositiveAmount(input.unitPrice, "سعر الوحدة"));
        const frozen = await createFrozenApprovalRequest({ db, workspaceId: family.workspace.id, actorUserId: ctx.user.id, actionType: "trade", amount: grossAmount.toFixed(6), currency: instrument.currency, payload: { ...input, currency: instrument.currency, grossAmount: grossAmount.toFixed(6) } });
        if (frozen) return { approvalRequired: true as const, approvalRequestId: frozen.id, duplicate: frozen.duplicate };
        const event = await postTrade({ context: family, actorUserId: ctx.user.id, ...input });
        return { approvalRequired: false as const, event };
      }),
    postDividend: protectedProcedure
      .input(
        z.object({
          accountId: z.number().int().positive(),
          instrumentId: z.number().int().positive(),
          amount: money,
          currency,
          occurredAt,
          memo: z.string().trim().max(2_000).optional().nullable(),
          idempotencyKey,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const family = await familyContext(ctx.user);
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
  }),

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
