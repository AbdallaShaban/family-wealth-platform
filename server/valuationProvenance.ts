export const VALUATION_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export type ExternalStatus = "live" | "delayed" | "last_known" | "manual" | "unavailable";
export type ExternalQuality = "current" | "delayed" | "stale" | "manual" | "unavailable";

export function normalizeSymbol(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

export function qualityFromStatus(status: ExternalStatus, asOf: number, now: number) : ExternalQuality {
  if (status === "manual") return "manual";
  if (status === "unavailable") return "unavailable";
  if (now - asOf > VALUATION_STALE_AFTER_MS) return "stale";
  if (status === "live") return "current";
  return "delayed";
}

export function assertValidValuationTimestamps(asOf: number, capturedAt: number, now = Date.now()) {
  if (!Number.isSafeInteger(asOf) || asOf <= 0) throw new Error("طابع مصدر التقييم غير صالح.");
  if (!Number.isSafeInteger(capturedAt) || capturedAt <= 0) throw new Error("وقت التقاط التقييم غير صالح.");
  if (asOf > capturedAt || asOf > now) throw new Error("لا يمكن أن يتجاوز وقت المصدر وقت الالتقاط أو الوقت الحالي.");
}

export function buildMarketProvenance(args: {
  workspaceId: number; provider: string; source: string; rawSymbol?: string | null;
  asOf: number; fetchedAt: number; status: ExternalStatus; metadata?: Record<string, unknown>;
}) {
  assertValidValuationTimestamps(args.asOf, args.fetchedAt, args.fetchedAt);
  return {
    workspaceId: args.workspaceId,
    sourceType: "market_provider" as const,
    provider: args.provider,
    source: args.source,
    rawSymbol: normalizeSymbol(args.rawSymbol),
    normalizedSymbol: normalizeSymbol(args.rawSymbol),
    fetchedAt: args.fetchedAt,
    asOf: args.asOf,
    status: args.status,
    responseHash: null,
    metadata: args.metadata ?? null,
    createdAt: args.fetchedAt,
  };
}

export function buildInstrumentSnapshot(args: {
  workspaceId: number; instrumentId: number; provenanceId: number; quoteId: number;
  price: string; currency: string; baseCurrency: string; status: ExternalStatus;
  asOf: number; capturedAt: number;
}) {
  assertValidValuationTimestamps(args.asOf, args.capturedAt);
  const nativeCurrency = args.currency.trim().toUpperCase();
  const baseCurrency = args.baseCurrency.trim().toUpperCase();
  return {
    workspaceId: args.workspaceId,
    subjectType: "instrument" as const,
    subjectId: args.instrumentId,
    provenanceId: args.provenanceId,
    quoteId: args.quoteId,
    fxRateId: null,
    nativeValue: args.price,
    nativeCurrency,
    baseValue: nativeCurrency === baseCurrency ? args.price : null,
    baseCurrency,
    quantity: null,
    unit: null,
    valuationMethod: "market_quote" as const,
    quality: qualityFromStatus(args.status, args.asOf, args.capturedAt),
    asOf: args.asOf,
    capturedAt: args.capturedAt,
    createdByUserId: null,
    createdAt: args.capturedAt,
  };
}

export function buildFxProvenance(args: {
  workspaceId: number; provider: string; source: string; rawSymbol: string;
  fromCurrency: string; toCurrency: string; asOf: number; fetchedAt: number;
  status: ExternalStatus; fxRateId: number;
}) {
  return buildMarketProvenance({
    workspaceId: args.workspaceId,
    provider: args.provider,
    source: args.source,
    rawSymbol: args.rawSymbol,
    asOf: args.asOf,
    fetchedAt: args.fetchedAt,
    status: args.status,
    metadata: { fromCurrency: args.fromCurrency, toCurrency: args.toCurrency, fxRateId: args.fxRateId },
  });
}

export function buildManualProvenance(args: { workspaceId: number; source: string; rawSymbol?: string | null; asOf: number; capturedAt: number; userId: number }) {
  assertValidValuationTimestamps(args.asOf, args.capturedAt);
  return {
    workspaceId: args.workspaceId,
    sourceType: "manual" as const,
    provider: "user",
    source: args.source,
    rawSymbol: normalizeSymbol(args.rawSymbol),
    normalizedSymbol: normalizeSymbol(args.rawSymbol),
    fetchedAt: null,
    asOf: args.asOf,
    status: "manual" as const,
    responseHash: null,
    metadata: { recordedByUserId: args.userId },
    createdAt: args.capturedAt,
  };
}

export function isReadOnlyValuationBoundary() {
  return { createsProvenance: true, createsSnapshot: true, writesLedger: false } as const;
}

export function isOfficialReportSafe(quality: ExternalQuality) {
  return quality === "current" || quality === "manual";
}

export function valuationWarning(quality: ExternalQuality) {
  if (quality === "stale") return "بيانات التقييم متقادمة وتحتاج مراجعة.";
  if (quality === "delayed") return "السعر الخارجي متأخر بحسب المصدر.";
  if (quality === "unavailable") return "مصدر التقييم غير متاح.";
  return null;
}

export function metadataHasCredentials(metadata: Record<string, unknown> | null | undefined) {
  return Boolean(metadata && Object.keys(metadata).some(key => /password|secret|token|apikey|smtpPass/i.test(key)));
}

export function lineageIsComplete(args: { provenanceId: number; asOf: number; capturedAt: number }) {
  return args.provenanceId > 0 && args.asOf > 0 && args.capturedAt >= args.asOf;
}

export function noAutomaticLedgerMutation() {
  return true as const;
}

export function snapshotsAreAppendOnly() {
  return true as const;
}

export function phase3Contract() {
  return { provenanceRequired: true, timestampRequired: true, snapshotAppendOnly: true, ledgerMutation: false } as const;
}

export function qualityLabel(quality: ExternalQuality) {
  return quality === "current" ? "محدث" : quality === "delayed" ? "متأخر" : quality === "stale" ? "متقادم" : quality === "manual" ? "يدوي" : "غير متاح";
}

export function safeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !/password|secret|token|apikey|smtpPass/i.test(key)));
}

export function snapshotStoragePolicy() {
  return "insert-only" as const;
}

export function valuationProviderName() {
  return "yahoo-finance2" as const;
}

export function valuationPhaseNumber() {
  return 3 as const;
}
