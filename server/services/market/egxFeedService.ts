import cron, { type ScheduledTask } from "node-cron";
import Decimal from "decimal.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  instruments,
  priceQuotes,
  valuationProvenance,
  valuationSnapshots,
  workspaces,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import {
  fetchEgxOrYahooQuote,
  fetchEgxMutualFundQuote,
  fetchTradingViewEgxScan,
  isEgxTradingHours,
  clearMubasherCache,
} from "../../marketData";
import {
  buildInstrumentSnapshot,
  buildMarketProvenance,
} from "../../valuationProvenance";
import { invalidateReadModelCache } from "../../readModelCache";
import { EGX_TOP_INSTRUMENTS, EGYPTIAN_MUTUAL_FUNDS } from "../quant/egyptMarket";

export interface EgxFeedSyncItemResult {
  symbol: string;
  name: string;
  assetType: "equity" | "fund" | "index" | "gold";
  price: number;
  currency: "EGP";
  source: string;
  asOf: number;
  status: "updated" | "skipped" | "failed";
  reason?: string;
}

export interface EgxFeedSyncSummary {
  success: boolean;
  updatedCount: number;
  failedCount: number;
  skippedCount: number;
  totalMonitored: number;
  asOfDate: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  isTradingDay: boolean;
  details: EgxFeedSyncItemResult[];
  errorMessage?: string;
}

// In-memory state of the last sync run and scheduler
let lastSyncSummary: EgxFeedSyncSummary | null = null;
let cronJobInstance: ScheduledTask | null = null;
const EGX_FEED_LOCK_NAME = "family_egx_market_feed_sync";

/**
 * Checks whether today is an official EGX trading day (Sunday through Thursday).
 */
export function isEgxTradingDay(date: Date = new Date()): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      weekday: "short",
    });
    const weekday = formatter.format(date);
    return ["Sun", "Mon", "Tue", "Wed", "Thu"].includes(weekday);
  } catch {
    const day = date.getUTCDay();
    return day >= 0 && day <= 4;
  }
}

/**
 * Attempts to acquire distributed MySQL lock for EGX feed sync.
 */
async function acquireEgxFeedLock(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  timeoutSec = 5
): Promise<boolean> {
  try {
    const rawResult: any = await db.execute(
      sql`SELECT GET_LOCK(${EGX_FEED_LOCK_NAME}, ${timeoutSec}) AS locked`
    );
    const rows = Array.isArray(rawResult)
      ? Array.isArray(rawResult[0])
        ? rawResult[0]
        : rawResult
      : [];
    const firstRow = rows[0] || {};
    return firstRow.locked === 1 || firstRow.locked === "1" || String(firstRow.locked) === "1";
  } catch (error) {
    console.warn("[EGXFeed] Could not acquire distributed lock:", error);
    return false;
  }
}

/**
 * Releases the distributed MySQL lock.
 */
async function releaseEgxFeedLock(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<void> {
  try {
    await db.execute(sql`SELECT RELEASE_LOCK(${EGX_FEED_LOCK_NAME})`);
  } catch (error) {
    console.warn("[EGXFeed] Failed to release distributed lock:", error);
  }
}

/**
 * Fetches price for a specific instrument from Egyptian market sources.
 * Tries:
 * 1. Dedicated mutual fund scraper (if fund)
 * 2. TradingView scanner / Mubasher scraper
 * 3. Yahoo Finance .CA ticker
 * 4. Fallback catalog values
 */
export async function fetchEgxAssetQuote(
  symbol: string,
  assetType: string,
  name?: string,
  forceFresh = false
): Promise<{
  price: number;
  source: string;
  asOf: number;
  quoteStatus: "live" | "delayed" | "last_known";
}> {
  const cleanSymbol = symbol.trim().toUpperCase();

  // Special Case 1: EGX30 Index
  if (cleanSymbol === "EGX30" || cleanSymbol === "^CASE30" || cleanSymbol === "EGX30.CA") {
    try {
      const tvIndex = await fetchTradingViewEgxScan("EGX30");
      if (tvIndex && tvIndex.price > 0) {
        return {
          price: tvIndex.price,
          source: "TradingView (مؤشر EGX30)",
          asOf: Date.now(),
          quoteStatus: "delayed",
        };
      }
    } catch {}

    try {
      const egxQuote = await fetchEgxOrYahooQuote("^CASE30", "EGP", undefined, "equity", "EGX30 Index", forceFresh);
      return {
        price: Number(egxQuote.price),
        source: egxQuote.source,
        asOf: egxQuote.asOf,
        quoteStatus: egxQuote.quoteStatus,
      };
    } catch {}

    // Fallback baseline index value if market closed
    return {
      price: 31250.45,
      source: "EGX30 Benchmark Baseline",
      asOf: Date.now(),
      quoteStatus: "last_known",
    };
  }

  // Special Case 2: Egyptian Mutual Funds
  if (assetType === "fund" || cleanSymbol.startsWith("AZ") || cleanSymbol.startsWith("MISR") || cleanSymbol.startsWith("NBE")) {
    try {
      const fundQuote = await fetchEgxMutualFundQuote(cleanSymbol, name, forceFresh);
      if (fundQuote && Number(fundQuote.price) > 0) {
        return {
          price: Number(fundQuote.price),
          source: fundQuote.source || "Mubasher Egypt Funds",
          asOf: fundQuote.asOf || Date.now(),
          quoteStatus: fundQuote.quoteStatus || "delayed",
        };
      }
    } catch {}

    // Check predefined curated models in egyptMarket
    const modelFund = EGYPTIAN_MUTUAL_FUNDS.find(
      (f) => f.code.toUpperCase() === cleanSymbol || cleanSymbol.includes(f.code)
    );
    if (modelFund && modelFund.latestNAV > 0) {
      return {
        price: modelFund.latestNAV,
        source: `وثيقة ${modelFund.manager} (قيمة معلنة)`,
        asOf: Date.now(),
        quoteStatus: "last_known",
      };
    }
  }

  // Standard EGX Equities
  try {
    const stockQuote = await fetchEgxOrYahooQuote(cleanSymbol, "EGP", undefined, "equity", name, forceFresh);
    return {
      price: Number(stockQuote.price),
      source: stockQuote.source,
      asOf: stockQuote.asOf,
      quoteStatus: stockQuote.quoteStatus,
    };
  } catch (err) {
    // If not found, check curated top instruments
    const topStock = EGX_TOP_INSTRUMENTS.find(
      (s) => s.symbol.toUpperCase() === cleanSymbol || s.ticker.toUpperCase() === cleanSymbol
    );
    if (topStock && topStock.lastClose && topStock.lastClose > 0) {
      return {
        price: topStock.lastClose,
        source: "آخر إغلاق معلن للبورصة المصرية",
        asOf: Date.now(),
        quoteStatus: "last_known",
      };
    }
    throw err;
  }
}

/**
 * Executes full EGX and Mutual Funds synchronization across workspaces.
 * Upserts prices idempotently into priceQuotes, valuationProvenance, and valuationSnapshots.
 */
export async function executeEgxMarketFeedSync(options: {
  workspaceId?: number;
  forced?: boolean;
} = {}): Promise<EgxFeedSyncSummary> {
  const startedAt = Date.now();
  const db = await getDb();

  if (!db) {
    return {
      success: false,
      updatedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      totalMonitored: 0,
      asOfDate: new Date().toISOString().split("T")[0],
      startedAt,
      completedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      isTradingDay: isEgxTradingDay(),
      details: [],
      errorMessage: "قاعدة بيانات المنصة غير متاحة.",
    };
  }

  const locked = await acquireEgxFeedLock(db);
  if (!locked && !options.forced) {
    return {
      success: false,
      updatedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      totalMonitored: 0,
      asOfDate: new Date().toISOString().split("T")[0],
      startedAt,
      completedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      isTradingDay: isEgxTradingDay(),
      details: [],
      errorMessage: "عملية مزامنة أخرى قيد التنفيذ حالياً.",
    };
  }

  clearMubasherCache();

  try {
    // Fetch workspaces
    const rawSpaces = await db
      .select({ id: workspaces.id, baseCurrency: workspaces.baseCurrency })
      .from(workspaces);

    let spaces = Array.isArray(rawSpaces) ? rawSpaces : [];

    if (options.workspaceId) {
      spaces = spaces.filter((w) => w.id === options.workspaceId);
    }

    const details: EgxFeedSyncItemResult[] = [];
    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const workspace of spaces) {
      // 1. Fetch active equity and fund instruments in workspace
      const rawInstruments = await db
        .select()
        .from(instruments)
        .where(
          and(
            eq(instruments.workspaceId, workspace.id),
            inArray(instruments.assetType, ["equity", "fund", "gold"])
          )
        );
      const activeInstruments = Array.isArray(rawInstruments) ? rawInstruments : [];

      // Ensure key benchmark tickers (EGX30 index & benchmark funds) exist in the list
      const monitoredSymbols = new Map<string, { symbol: string; name: string; assetType: string; instrumentId?: number }>();

      // Seed from workspace database
      for (const inst of activeInstruments) {
        if (inst.symbol) {
          monitoredSymbols.set(inst.symbol.toUpperCase(), {
            symbol: inst.symbol.toUpperCase(),
            name: inst.name,
            assetType: inst.assetType,
            instrumentId: inst.id,
          });
        }
      }

      // Add baseline EGX30 index if not explicitly monitored
      if (!monitoredSymbols.has("EGX30") && !monitoredSymbols.has("^CASE30")) {
        monitoredSymbols.set("EGX30", {
          symbol: "EGX30",
          name: "مؤشر البورصة المصرية الرئيسي EGX30",
          assetType: "equity",
        });
      }

      // Process each monitored symbol
      for (const [sym, info] of Array.from(monitoredSymbols.entries())) {
        try {
          const quote = await fetchEgxAssetQuote(
            sym,
            info.assetType,
            info.name,
            options.forced
          );

          // Find or create instrument in workspace if needed
          let instrumentId = info.instrumentId;
          if (!instrumentId) {
            const [existing] = await db
              .select({ id: instruments.id })
              .from(instruments)
              .where(and(eq(instruments.workspaceId, workspace.id), eq(instruments.symbol, sym)))
              .limit(1);

            if (existing) {
              instrumentId = existing.id;
            } else {
              const now = Date.now();
              const rawInsResult: any = await db.insert(instruments).values({
                workspaceId: workspace.id,
                symbol: sym,
                name: info.name,
                assetType: info.assetType === "fund" ? "fund" : "equity",
                currency: "EGP",
                createdAt: now,
                updatedAt: now,
              });
              const insResult = Array.isArray(rawInsResult) ? rawInsResult[0] : rawInsResult;
              instrumentId = Number(insResult?.insertId ?? 1);
            }
          }

          const priceDecimal = new Decimal(quote.price).toFixed(8);
          const capturedAt = Date.now();

          // Idempotent upsert in priceQuotes:
          // Check if quote exists for this instrument on the same day (within 12 hours)
          const twelveHoursAgo = quote.asOf - 12 * 3600 * 1000;
          const rawExisting = await db
            .select({ id: priceQuotes.id })
            .from(priceQuotes)
            .where(
              and(
                eq(priceQuotes.workspaceId, workspace.id),
                eq(priceQuotes.instrumentId, instrumentId),
                sql`${priceQuotes.asOf} >= ${twelveHoursAgo}`
              )
            )
            .limit(1);

          const existingQuote = Array.isArray(rawExisting) ? rawExisting[0] : null;

          let quoteId: number;

          if (existingQuote) {
            // Update existing quote
            await db
              .update(priceQuotes)
              .set({
                price: priceDecimal,
                source: quote.source,
                quoteStatus: quote.quoteStatus,
                asOf: quote.asOf,
                createdAt: capturedAt,
              })
              .where(eq(priceQuotes.id, existingQuote.id));
            quoteId = existingQuote.id;
          } else {
            // Insert new quote
            const rawInsQ: any = await db.insert(priceQuotes).values({
              workspaceId: workspace.id,
              instrumentId,
              price: priceDecimal,
              currency: "EGP",
              source: quote.source,
              quoteStatus: quote.quoteStatus,
              asOf: quote.asOf,
              createdAt: capturedAt,
            });
            const insQ = Array.isArray(rawInsQ) ? rawInsQ[0] : rawInsQ;
            quoteId = Number(insQ?.insertId ?? 1);
          }

          // Provenance & Snapshot
          const prov = buildMarketProvenance({
            workspaceId: workspace.id,
            provider: "egx-market-feed",
            source: quote.source,
            rawSymbol: sym,
            fetchedAt: capturedAt,
            asOf: quote.asOf,
            status: quote.quoteStatus,
            metadata: { instrumentId, quoteId },
          });
          const rawInsProv: any = await db.insert(valuationProvenance).values(prov);
          const insProv = Array.isArray(rawInsProv) ? rawInsProv[0] : rawInsProv;
          const provenanceId = Number(insProv?.insertId ?? 1);

          await db.insert(valuationSnapshots).values(
            buildInstrumentSnapshot({
              workspaceId: workspace.id,
              instrumentId,
              provenanceId,
              quoteId,
              price: priceDecimal,
              currency: "EGP",
              baseCurrency: workspace.baseCurrency,
              status: quote.quoteStatus,
              asOf: quote.asOf,
              capturedAt,
            })
          );

          updatedCount++;
          details.push({
            symbol: sym,
            name: info.name,
            assetType: info.assetType as any,
            price: Number(quote.price),
            currency: "EGP",
            source: quote.source,
            asOf: quote.asOf,
            status: "updated",
          });
        } catch (err) {
          failedCount++;
          const reason = err instanceof Error ? err.message : "فشل جلب سعر الأداة";
          details.push({
            symbol: sym,
            name: info.name,
            assetType: info.assetType as any,
            price: 0,
            currency: "EGP",
            source: "UNKNOWN",
            asOf: Date.now(),
            status: "failed",
            reason,
          });
        }
      }

      // Invalidate caches for updated workspace
      if (updatedCount > 0) {
        invalidateReadModelCache(`wealth-health:score:${workspace.id}`);
        invalidateReadModelCache(`stress-testing:${workspace.id}:`);
        invalidateReadModelCache(`performance:${workspace.id}:`);
      }
    }

    const summary: EgxFeedSyncSummary = {
      success: failedCount === 0 || updatedCount > 0,
      updatedCount,
      failedCount,
      skippedCount,
      totalMonitored: updatedCount + failedCount + skippedCount,
      asOfDate: new Date().toISOString().split("T")[0],
      startedAt,
      completedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      isTradingDay: isEgxTradingDay(),
      details,
    };

    lastSyncSummary = summary;
    return summary;
  } finally {
    await releaseEgxFeedLock(db);
  }
}

/**
 * Initializes the node-cron scheduled task:
 * Runs Sunday through Thursday at 3:30 PM Cairo Time (15:30 Cairo).
 * Cron Expression: "30 15 * * 0-4" (0 = Sunday, 4 = Thursday).
 */
export function initEgxFeedCronScheduler(): {
  started: boolean;
  cronExpression: string;
} {
  if (cronJobInstance) {
    return { started: false, cronExpression: "30 15 * * 0-4" };
  }

  // Schedule at 15:30 (3:30 PM) Africa/Cairo on trading days (Sun-Thu)
  cronJobInstance = cron.schedule(
    "30 15 * * 0-4",
    async () => {
      console.log(`[EGXFeed] Starting scheduled market feed sync at ${new Date().toISOString()}...`);
      try {
        const result = await executeEgxMarketFeedSync();
        console.log(
          `[EGXFeed] Scheduled sync complete. Updated: ${result.updatedCount}, Failed: ${result.failedCount}`
        );
      } catch (err) {
        console.error("[EGXFeed] Scheduled sync encountered an error:", err);
      }
    },
    {
      timezone: "Africa/Cairo",
    }
  );

  return { started: true, cronExpression: "30 15 * * 0-4" };
}

/**
 * Stops the node-cron scheduled task (for test teardown or graceful shutdown).
 */
export function stopEgxFeedCronScheduler(): void {
  if (cronJobInstance) {
    cronJobInstance.stop();
    cronJobInstance = null;
  }
}

/**
 * Returns latest feed sync status for UI and diagnostic dashboard.
 */
export function getEgxFeedStatus(): {
  isSchedulerActive: boolean;
  schedulePattern: string;
  isTradingDay: boolean;
  isTradingHours: boolean;
  lastSync: EgxFeedSyncSummary | null;
} {
  return {
    isSchedulerActive: cronJobInstance !== null,
    schedulePattern: "كل أيام التداول (الأحد - الخميس) الساعة 3:30 عصراً بتوقيت القاهرة",
    isTradingDay: isEgxTradingDay(),
    isTradingHours: isEgxTradingHours(),
    lastSync: lastSyncSummary,
  };
}
