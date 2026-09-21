import { and, eq, inArray } from "drizzle-orm";
import { accounts, fxRates, instruments, priceQuotes, valuationProvenance, valuationSnapshots, workspaces } from "../drizzle/schema";
import { getDb } from "./db";
import { fetchEgxOrYahooQuote, fetchYahooFxQuote } from "./marketData";
import { buildFxProvenance, buildInstrumentSnapshot, buildMarketProvenance } from "./valuationProvenance";
import { invalidateReadModelCache } from "./readModelCache";

export type MarketRefreshResult = {
  refreshedQuotes: number;
  refreshedFx: number;
  skipped: number;
  failures: Array<{ workspaceId: number; item: string; reason: string }>;
};

async function hasQuote(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, instrumentId: number, asOf: number) {
  return Boolean((await db.select({ id: priceQuotes.id }).from(priceQuotes).where(and(eq(priceQuotes.instrumentId, instrumentId), eq(priceQuotes.asOf, asOf))).limit(1))[0]);
}

async function hasFx(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, workspaceId: number, fromCurrency: string, toCurrency: string, asOf: number) {
  return Boolean((await db.select({ id: fxRates.id }).from(fxRates).where(and(eq(fxRates.workspaceId, workspaceId), eq(fxRates.fromCurrency, fromCurrency), eq(fxRates.toCurrency, toCurrency), eq(fxRates.asOf, asOf))).limit(1))[0]);
}

/**
 * Refreshes only data records. It never posts trades, revalues accounts, or
 * changes ledger balances. Rows use the source timestamp as an idempotency key.
 */
export async function refreshYahooMarketData() : Promise<MarketRefreshResult> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة لتحديث الأسعار.");
  const result: MarketRefreshResult = { refreshedQuotes: 0, refreshedFx: 0, skipped: 0, failures: [] };
  const spaces = await db.select({ id: workspaces.id, baseCurrency: workspaces.baseCurrency }).from(workspaces).limit(100);

  for (const workspace of spaces) {
    let workspaceQuotesRefreshed = 0;
    let workspaceFxRefreshed = 0;

    const activeInstruments = await db.select().from(instruments).where(and(eq(instruments.workspaceId, workspace.id), inArray(instruments.assetType, ["equity", "fund", "gold"]))).limit(100);
    for (const instrument of activeInstruments) {
      if (!instrument.symbol) { result.skipped += 1; continue; }
      try {
        const quote = await fetchEgxOrYahooQuote(instrument.symbol, instrument.currency, undefined, instrument.assetType, instrument.name);
        if (quote.currency !== instrument.currency) throw new Error("عملة المصدر لا تطابق عملة الأداة المسجلة.");
        if (await hasQuote(db, instrument.id, quote.asOf)) { result.skipped += 1; continue; }
        const capturedAt = Date.now();
        const quoteInsert = await db.insert(priceQuotes).values({ workspaceId: workspace.id, instrumentId: instrument.id, price: quote.price, currency: quote.currency, source: quote.source, quoteStatus: quote.quoteStatus, asOf: quote.asOf, createdAt: capturedAt });
        const quoteId = Number(quoteInsert[0].insertId);
        const providerName = quote.source.includes("NBE") ? "nbe-funds" : quote.source.includes("Mubasher") ? "mubasher" : "market-feed";
        const provenanceInsert = await db.insert(valuationProvenance).values(buildMarketProvenance({ workspaceId: workspace.id, provider: providerName, source: quote.source, rawSymbol: instrument.symbol, fetchedAt: capturedAt, asOf: quote.asOf, status: quote.quoteStatus, metadata: { instrumentId: instrument.id, quoteId } }));
        await db.insert(valuationSnapshots).values(buildInstrumentSnapshot({ workspaceId: workspace.id, instrumentId: instrument.id, provenanceId: Number(provenanceInsert[0].insertId), quoteId, price: quote.price, currency: quote.currency, baseCurrency: workspace.baseCurrency, status: quote.quoteStatus, asOf: quote.asOf, capturedAt }));
        result.refreshedQuotes += 1;
        workspaceQuotesRefreshed += 1;
      } catch (error) {
        result.failures.push({ workspaceId: workspace.id, item: instrument.symbol, reason: error instanceof Error ? error.message : "فشل مزود السوق." });
      }
    }

    const currencies = await db.select({ currency: accounts.currency }).from(accounts).where(and(eq(accounts.workspaceId, workspace.id), eq(accounts.status, "active"))).limit(100);
    const uniqueCurrencies = Array.from(new Set(currencies.map(item => item.currency)));
    for (const currency of uniqueCurrencies) {
      if (currency === workspace.baseCurrency) continue;
      try {
        const quote = await fetchYahooFxQuote(currency, workspace.baseCurrency);
        if (await hasFx(db, workspace.id, currency, workspace.baseCurrency, quote.asOf)) { result.skipped += 1; continue; }
        const capturedAt = Date.now();
        const fxInsert = await db.insert(fxRates).values({ workspaceId: workspace.id, fromCurrency: currency, toCurrency: workspace.baseCurrency, rate: quote.price, source: quote.source, rateStatus: quote.quoteStatus, asOf: quote.asOf, createdAt: capturedAt });
        await db.insert(valuationProvenance).values(buildFxProvenance({ workspaceId: workspace.id, provider: "yahoo-finance2", source: quote.source, rawSymbol: quote.symbol, fromCurrency: currency, toCurrency: workspace.baseCurrency, fetchedAt: capturedAt, asOf: quote.asOf, status: quote.quoteStatus, fxRateId: Number(fxInsert[0].insertId) }));
        result.refreshedFx += 1;
        workspaceFxRefreshed += 1;
      } catch (error) {
        result.failures.push({ workspaceId: workspace.id, item: `${currency}/${workspace.baseCurrency}`, reason: error instanceof Error ? error.message : "فشل مزود الصرف." });
      }
    }

    if (workspaceQuotesRefreshed > 0 || workspaceFxRefreshed > 0) {
      invalidateReadModelCache(`wealth-health:score:${workspace.id}`);
      invalidateReadModelCache(`stress-testing:${workspace.id}:`);
      if (workspaceFxRefreshed > 0) {
        invalidateReadModelCache(`fx:${workspace.id}`);
      }
    }
  }
  return result;
}
