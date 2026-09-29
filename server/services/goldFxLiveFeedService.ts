import YahooFinance from "yahoo-finance2";
import Decimal from "decimal.js";
import { getDb } from "../db";
import { priceQuotes, fxRates, instruments, valuationProvenance, valuationSnapshots, workspaces } from "../../drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { quoteWithFastTimeout, calculateGold24kGramEgp, YahooQuoteClient } from "../marketData";
import { invalidateReadModelCache } from "../readModelCache";
import { buildInstrumentSnapshot, buildMarketProvenance, buildFxProvenance } from "../valuationProvenance";

export interface GoldPuritesLiveResult {
  karat24: number;
  karat21: number;
  karat18: number;
  sovereignEgp: number; // 8g of 21k
  goldOunceUsd: number;
  usdEgpRate: number;
  eurEgpRate: number;
  nisab85gEgp: number;
  asOf: number;
  source: string;
  isLive: boolean;
  isFallback: boolean;
  lastUpdatedFormattedAr: string;
}

const TROY_OUNCE_GRAMS = new Decimal("31.1034768");
const FEED_CACHE_TTL_MS = 60_000; // 60 seconds memory cache

let cachedGoldFxResult: {
  data: GoldPuritesLiveResult;
  cachedAt: number;
} | null = null;

// Institutional fallback baseline
const INSTITUTIONAL_BASELINE = {
  goldOunceUsd: 2650.0,
  usdEgpRate: 49.50,
  eurEgpRate: 53.20,
  gold24kEgp: 4218.0,
};

function formatArabicTimestamp(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
      timeZone: "Africa/Cairo",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

/**
 * Calculates all gold purities and sovereign quote from 24K price per gram.
 */
export function deriveGoldAndSovereignPrices(
  gold24kPerGram: number,
  goldOunceUsd: number,
  usdEgpRate: number,
  eurEgpRate: number,
  source: string,
  asOf: number,
  isLive: boolean,
  isFallback: boolean
): GoldPuritesLiveResult {
  const p24 = Math.max(100, Math.round(gold24kPerGram * 100) / 100);
  const p21 = Math.round(((p24 * 21) / 24) * 100) / 100;
  const p18 = Math.round(((p24 * 18) / 24) * 100) / 100;
  const sovereign = Math.round(8 * p21 * 100) / 100;
  const nisab = Math.round(85 * p24 * 100) / 100;

  return {
    karat24: p24,
    karat21: p21,
    karat18: p18,
    sovereignEgp: sovereign,
    goldOunceUsd: Math.round(goldOunceUsd * 100) / 100,
    usdEgpRate: Math.round(usdEgpRate * 10000) / 10000,
    eurEgpRate: Math.round(eurEgpRate * 10000) / 10000,
    nisab85gEgp: nisab,
    asOf,
    source,
    isLive,
    isFallback,
    lastUpdatedFormattedAr: formatArabicTimestamp(asOf),
  };
}

/**
 * Fetches real-time Gold and FX rates with database fallback.
 */
export async function getLiveGoldAndFxRates(
  forceFresh = false,
  client: YahooQuoteClient = new YahooFinance()
): Promise<GoldPuritesLiveResult> {
  const now = Date.now();

  // 1. Fast in-memory cache check
  if (!forceFresh && cachedGoldFxResult && now - cachedGoldFxResult.cachedAt < FEED_CACHE_TTL_MS) {
    return cachedGoldFxResult.data;
  }

  // 2. Attempt real-time fetch from global feeds
  try {
    const [goldSpot, usdEgpQuote, eurEgpQuote] = await Promise.all([
      quoteWithFastTimeout(client, "GC=F", 3000),
      quoteWithFastTimeout(client, "USDEGP=X", 3000),
      quoteWithFastTimeout(client, "EUREGP=X", 3000),
    ]);

    const ounceUsd = goldSpot?.regularMarketPrice;
    const usdRate = usdEgpQuote?.regularMarketPrice;
    const eurRate = eurEgpQuote?.regularMarketPrice || (usdRate ? usdRate * 1.08 : INSTITUTIONAL_BASELINE.eurEgpRate);

    if (ounceUsd && ounceUsd > 0 && usdRate && usdRate > 0) {
      const calc = calculateGold24kGramEgp({
        goldOunceUsd: ounceUsd,
        usdEgpRate: usdRate,
      });

      const gold24k = parseFloat(calc.pricePerGramEgp);
      const asOf = Date.now();

      const liveResult = deriveGoldAndSovereignPrices(
        gold24k,
        ounceUsd,
        usdRate,
        eurRate,
        "Yahoo Finance (GC=F + USDEGP=X + EUREGP=X)",
        asOf,
        true,
        false
      );

      cachedGoldFxResult = { data: liveResult, cachedAt: now };
      return liveResult;
    }
  } catch (err: any) {
    console.warn("[GoldFxLiveFeed] Network feed unavailable, attempting database fallback:", err?.message || err);
  }

  // 3. Database Fallback (Last-Known-Good recorded price)
  try {
    const db = await getDb();
    if (db) {
      // Find latest gold quote from priceQuotes
      const lastGoldQuote = await db
        .select({
          price: priceQuotes.price,
          asOf: priceQuotes.asOf,
          source: priceQuotes.source,
        })
        .from(priceQuotes)
        .innerJoin(instruments, eq(priceQuotes.instrumentId, instruments.id))
        .where(eq(instruments.assetType, "gold"))
        .orderBy(desc(priceQuotes.asOf))
        .limit(1);

      // Find latest USD and EUR rates from fxRates
      const lastUsdRate = await db
        .select({ rate: fxRates.rate, asOf: fxRates.asOf })
        .from(fxRates)
        .where(and(eq(fxRates.fromCurrency, "USD"), eq(fxRates.toCurrency, "EGP")))
        .orderBy(desc(fxRates.asOf))
        .limit(1);

      const lastEurRate = await db
        .select({ rate: fxRates.rate, asOf: fxRates.asOf })
        .from(fxRates)
        .where(and(eq(fxRates.fromCurrency, "EUR"), eq(fxRates.toCurrency, "EGP")))
        .orderBy(desc(fxRates.asOf))
        .limit(1);

      if (lastGoldQuote.length > 0 && Number(lastGoldQuote[0].price) > 0) {
        const dbPrice24k = Number(lastGoldQuote[0].price);
        const dbUsd = lastUsdRate.length > 0 ? Number(lastUsdRate[0].rate) : INSTITUTIONAL_BASELINE.usdEgpRate;
        const dbEur = lastEurRate.length > 0 ? Number(lastEurRate[0].rate) : INSTITUTIONAL_BASELINE.eurEgpRate;
        const dbAsOf = lastGoldQuote[0].asOf || now;

        const dbResult = deriveGoldAndSovereignPrices(
          dbPrice24k,
          INSTITUTIONAL_BASELINE.goldOunceUsd,
          dbUsd,
          dbEur,
          "قاعدة البيانات (آخر سعر مسجل ومعتمد)",
          dbAsOf,
          false,
          true
        );

        cachedGoldFxResult = { data: dbResult, cachedAt: now };
        return dbResult;
      }
    }
  } catch (dbErr: any) {
    console.warn("[GoldFxLiveFeed] Database fallback query error:", dbErr?.message || dbErr);
  }

  // 4. Ultimate Institutional Graceful Baseline
  const baselineResult = deriveGoldAndSovereignPrices(
    INSTITUTIONAL_BASELINE.gold24kEgp,
    INSTITUTIONAL_BASELINE.goldOunceUsd,
    INSTITUTIONAL_BASELINE.usdEgpRate,
    INSTITUTIONAL_BASELINE.eurEgpRate,
    "المعيار الاسترشادي الاستثماري المعتمد",
    now,
    false,
    true
  );

  cachedGoldFxResult = { data: baselineResult, cachedAt: now };
  return baselineResult;
}

/**
 * Background worker task: Refreshes and persists Gold & FX quotes across workspaces,
 * revaluing gold instruments and updating valuation snapshots.
 */
export async function executeAutomatedGoldFxRefresh(): Promise<{
  success: boolean;
  rates: GoldPuritesLiveResult;
  updatedWorkspaces: number;
  revaluedInstruments: number;
}> {
  const rates = await getLiveGoldAndFxRates(true);
  const db = await getDb();
  if (!db) {
    return { success: false, rates, updatedWorkspaces: 0, revaluedInstruments: 0 };
  }

  let updatedWorkspaces = 0;
  let revaluedInstruments = 0;

  try {
    const spaces = await db.select({ id: workspaces.id, baseCurrency: workspaces.baseCurrency }).from(workspaces).limit(50);

    for (const workspace of spaces) {
      let wsModified = false;

      // 1. Revalue gold instruments (Gold bullion 24k, coins 21k, scrap)
      const goldInstruments = await db
        .select()
        .from(instruments)
        .where(and(eq(instruments.workspaceId, workspace.id), eq(instruments.assetType, "gold")))
        .limit(50);

      for (const inst of goldInstruments) {
        const sym = (inst.symbol || "").toUpperCase();
        const name = inst.name || "";
        const is21k = sym.includes("21") || name.includes("21") || name.includes("جنيه");
        const is18k = sym.includes("18") || name.includes("18");
        const priceToApply = is18k ? rates.karat18 : is21k ? rates.karat21 : rates.karat24;

        const capturedAt = Date.now();
        const quoteInsert = await db.insert(priceQuotes).values({
          workspaceId: workspace.id,
          instrumentId: inst.id,
          price: priceToApply.toFixed(2),
          currency: "EGP",
          source: rates.source,
          quoteStatus: rates.isLive ? "live" : "delayed",
          asOf: rates.asOf,
          createdAt: capturedAt,
        });

        const quoteId = Number(quoteInsert[0].insertId);
        const provenanceInsert = await db.insert(valuationProvenance).values(
          buildMarketProvenance({
            workspaceId: workspace.id,
            provider: "live-gold-feed",
            source: rates.source,
            rawSymbol: inst.symbol || "GOLD",
            fetchedAt: capturedAt,
            asOf: rates.asOf,
            status: rates.isLive ? "live" : "delayed",
            metadata: { instrumentId: inst.id, quoteId, karat: is18k ? 18 : is21k ? 21 : 24 },
          })
        );

        await db.insert(valuationSnapshots).values(
          buildInstrumentSnapshot({
            workspaceId: workspace.id,
            instrumentId: inst.id,
            provenanceId: Number(provenanceInsert[0].insertId),
            quoteId,
            price: priceToApply.toFixed(2),
            currency: "EGP",
            baseCurrency: workspace.baseCurrency,
            status: rates.isLive ? "live" : "delayed",
            asOf: rates.asOf,
            capturedAt,
          })
        );

        revaluedInstruments += 1;
        wsModified = true;
      }

      // 2. Persist FX Rates for USD and EUR
      const fxPairs = [
        { from: "USD", rate: rates.usdEgpRate },
        { from: "EUR", rate: rates.eurEgpRate },
      ];

      for (const pair of fxPairs) {
        if (pair.from !== workspace.baseCurrency) {
          const capturedAt = Date.now();
          const fxInsert = await db.insert(fxRates).values({
            workspaceId: workspace.id,
            fromCurrency: pair.from,
            toCurrency: workspace.baseCurrency,
            rate: pair.rate.toFixed(4),
            source: rates.source,
            rateStatus: rates.isLive ? "live" : "delayed",
            asOf: rates.asOf,
            createdAt: capturedAt,
          });

          await db.insert(valuationProvenance).values(
            buildFxProvenance({
              workspaceId: workspace.id,
              provider: "live-fx-feed",
              source: rates.source,
              rawSymbol: `${pair.from}${workspace.baseCurrency}=X`,
              fromCurrency: pair.from,
              toCurrency: workspace.baseCurrency,
              fetchedAt: capturedAt,
              asOf: rates.asOf,
              status: rates.isLive ? "live" : "delayed",
              fxRateId: Number(fxInsert[0].insertId),
            })
          );
          wsModified = true;
        }
      }

      if (wsModified) {
        updatedWorkspaces += 1;
        invalidateReadModelCache(`wealth-health:score:${workspace.id}`);
        invalidateReadModelCache(`stress-testing:${workspace.id}:`);
        invalidateReadModelCache(`fx:${workspace.id}`);
      }
    }

    return { success: true, rates, updatedWorkspaces, revaluedInstruments };
  } catch (error) {
    console.error("[GoldFxLiveFeed] Automated refresh failed:", error);
    return { success: false, rates, updatedWorkspaces, revaluedInstruments };
  }
}
