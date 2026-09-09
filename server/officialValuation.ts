import { and, desc, eq } from "drizzle-orm";
import Decimal from "decimal.js";
import { officialValuationSnapshots, valuationProvenance, valuationSnapshots } from "../drizzle/schema";
import type { FamilyContext } from "./familyAccess";
import { getDb } from "./db";
import { getDashboardSummary } from "./familyRead";
import { VALUATION_STALE_AFTER_MS, type ExternalQuality } from "./valuationProvenance";
import { invalidateReadModelCache } from "./readModelCache";

export type OfficialReportStatus = "official" | "review_required" | "unavailable";

const qualityRank: Record<ExternalQuality, number> = {
  current: 0,
  manual: 1,
  delayed: 2,
  stale: 3,
  unavailable: 4,
};

export function normalizeOfficialQuality(value: string | null | undefined): ExternalQuality {
  if (value === "manual" || value === "delayed" || value === "stale" || value === "unavailable") return value;
  if (value === "last_known") return "stale";
  return value === "live" ? "current" : "unavailable";
}

export function worseQuality(values: ExternalQuality[]): ExternalQuality {
  return values.reduce<ExternalQuality>((worst, value) => qualityRank[value] > qualityRank[worst] ? value : worst, "current");
}

export function officialStatusForQuality(quality: ExternalQuality, hasValuedData: boolean): OfficialReportStatus {
  if (!hasValuedData || quality === "unavailable") return "unavailable";
  return quality === "current" || quality === "manual" ? "official" : "review_required";
}

export function qualityForAsOf(status: string | null | undefined, asOf: number | null | undefined, now: number): ExternalQuality {
  if (!status || !asOf || !Number.isFinite(asOf) || asOf > now) return "unavailable";
  if (now - asOf > VALUATION_STALE_AFTER_MS) return "stale";
  return normalizeOfficialQuality(status);
}

export function buildOfficialSnapshotCandidate(args: {
  workspaceId: number;
  actorUserId: number;
  baseCurrency: string;
  capturedAt: number;
  qualities: ExternalQuality[];
  valuationAsOf: number;
  netWorthBase: string | null;
  liquidBalanceBase: string | null;
  investmentValueBase: string | null;
  liabilityBalanceBase: string | null;
  unrealizedPnlBase: string | null;
  componentSnapshotIds: number[];
  sourceSummary: Record<string, unknown>;
  warnings: string[];
  hasValuedData?: boolean;
}) {
  const quality = worseQuality(args.qualities.length ? args.qualities : ["current"]);
  const hasValuedData = args.hasValuedData ?? [args.netWorthBase, args.liquidBalanceBase, args.investmentValueBase, args.liabilityBalanceBase].some(value => value !== null);
  return {
    workspaceId: args.workspaceId,
    valuationAsOf: args.valuationAsOf,
    capturedAt: args.capturedAt,
    baseCurrency: args.baseCurrency.toUpperCase(),
    status: officialStatusForQuality(quality, hasValuedData),
    quality,
    netWorthBase: args.netWorthBase,
    liquidBalanceBase: args.liquidBalanceBase,
    investmentValueBase: args.investmentValueBase,
    liabilityBalanceBase: args.liabilityBalanceBase,
    unrealizedPnlBase: args.unrealizedPnlBase,
    componentSnapshotIds: args.componentSnapshotIds,
    sourceSummary: args.sourceSummary,
    warnings: args.warnings,
    createdByUserId: args.actorUserId,
    createdAt: args.capturedAt,
  };
}

function minAsOf(values: Array<number | null | undefined>, fallback: number) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0);
  return valid.length ? Math.min(...valid) : fallback;
}

export async function captureOfficialValuationSnapshot(context: FamilyContext, actorUserId: number, now = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة حاليًا.");
  const summary = await getDashboardSummary(context);
  const componentRows = await db.select({
    snapshot: valuationSnapshots,
    provenance: valuationProvenance,
  }).from(valuationSnapshots)
    .innerJoin(valuationProvenance, eq(valuationSnapshots.provenanceId, valuationProvenance.id))
    .where(and(eq(valuationSnapshots.workspaceId, context.workspace.id), eq(valuationProvenance.workspaceId, context.workspace.id)))
    .orderBy(desc(valuationSnapshots.capturedAt))
    .limit(500);

  const latestComponents = new Map<string, typeof componentRows[number]>();
  componentRows.forEach(row => {
    const key = `${row.snapshot.subjectType}:${row.snapshot.subjectId ?? "none"}`;
    if (!latestComponents.has(key)) latestComponents.set(key, row);
  });
  const components = Array.from(latestComponents.values());
  const qualities: ExternalQuality[] = [];
  const warnings: string[] = [];
  const sourceCounts = new Map<string, number>();
  const componentSnapshotIds: number[] = [];
  components.forEach(({ snapshot, provenance }) => {
    const quality = qualityForAsOf(snapshot.quality, snapshot.asOf, now);
    qualities.push(quality);
    componentSnapshotIds.push(snapshot.id);
    sourceCounts.set(provenance.provider, (sourceCounts.get(provenance.provider) ?? 0) + 1);
    if (quality === "stale") warnings.push(`تقييم متقادم: ${provenance.normalizedSymbol || provenance.source}`);
    if (quality === "unavailable") warnings.push(`تقييم غير متاح: ${provenance.normalizedSymbol || provenance.source}`);
  });
  summary.unvaluedCurrencies.forEach(currency => warnings.push(`عملة بلا تحويل إلى عملة الأساس: ${currency}`));
  summary.staleFxCurrencies.forEach(currency => warnings.push(`سعر صرف متقادم: ${currency}`));
  summary.unvaluedInstruments.forEach(instrument => warnings.push(`أداة بلا تقييم: ${instrument}`));

  const qualityFromSummary: ExternalQuality[] = [
    ...summary.accounts.map(account => account.valuationStatus === "stale" ? "stale" : account.valuationStatus === "unvalued" ? "unavailable" : account.valuationStatus === "delayed" ? "delayed" : account.valuationStatus === "manual" ? "manual" : "current" as ExternalQuality),
    ...summary.portfolio.map(position => qualityForAsOf(position.quoteStatus, position.quoteAsOf, now)),
  ];
  qualities.push(...qualityFromSummary);
  const dedupedWarnings = Array.from(new Set(warnings));
  const valuationAsOf = minAsOf([
    ...summary.accounts.map(account => account.rateAsOf),
    ...summary.portfolio.map(position => position.quoteAsOf),
    ...components.map(({ snapshot }) => snapshot.asOf),
  ], now);
  const sourceSummary = {
    providers: Object.fromEntries(sourceCounts),
    componentCount: componentSnapshotIds.length,
    externalComponentCount: qualities.filter(quality => quality !== "current" || componentSnapshotIds.length > 0).length,
    staleCount: qualities.filter(quality => quality === "stale").length,
    unavailableCount: qualities.filter(quality => quality === "unavailable").length,
    delayedCount: qualities.filter(quality => quality === "delayed").length,
    baseCurrency: context.workspace.baseCurrency,
  };
  const candidate = buildOfficialSnapshotCandidate({
    workspaceId: context.workspace.id,
    actorUserId,
    baseCurrency: context.workspace.baseCurrency,
    capturedAt: now,
    qualities,
    valuationAsOf,
    netWorthBase: summary.netWorthBase,
    liquidBalanceBase: summary.liquidBalanceBase,
    investmentValueBase: summary.investmentValueBase,
    liabilityBalanceBase: summary.liabilityBalanceBase,
    unrealizedPnlBase: summary.unrealizedPnlBase,
    componentSnapshotIds,
    sourceSummary,
    warnings: dedupedWarnings,
    hasValuedData: summary.accountCount > 0 || summary.portfolio.length > 0,
  });
  const inserted = await db.insert(officialValuationSnapshots).values(candidate);
  invalidateReadModelCache(`wealth-health:score:${context.workspace.id}`);
  invalidateReadModelCache(`stress-testing:${context.workspace.id}:`);
  return { id: Number(inserted[0].insertId), ...candidate };
}

export async function getLatestOfficialValuationSnapshot(context: FamilyContext) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة حاليًا.");
  const [row] = await db.select().from(officialValuationSnapshots)
    .where(eq(officialValuationSnapshots.workspaceId, context.workspace.id))
    .orderBy(desc(officialValuationSnapshots.capturedAt), desc(officialValuationSnapshots.id))
    .limit(1);
  return row ?? null;
}

export async function listOfficialValuationSnapshots(context: FamilyContext, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة حاليًا.");
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  return db.select().from(officialValuationSnapshots)
    .where(eq(officialValuationSnapshots.workspaceId, context.workspace.id))
    .orderBy(desc(officialValuationSnapshots.capturedAt), desc(officialValuationSnapshots.id))
    .limit(safeLimit);
}

export function compareOfficialToLive(args: { official: { netWorthBase: string | null }; liveNetWorthBase: string }) {
  if (args.official.netWorthBase === null) return null;
  return new Decimal(args.liveNetWorthBase).minus(args.official.netWorthBase).toFixed(2);
}
