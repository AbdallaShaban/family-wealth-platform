import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../../_core/trpc";
import { assertRole, ensurePersonalFamilyContext } from "../../familyAccess";
import { getDb } from "../../db";
import { instruments, priceQuotes, marketCandles } from "../../../drizzle/schema";
import {
  computeTechnicalAnalysis,
  loadWorkspaceAlertRules,
  addWorkspaceAlertRule,
  deleteWorkspaceAlertRule,
  evaluateAlertRules,
  type RealCandle,
} from "../../services/marketTechnicalService";

function notAvailable() {
  return new Error("قاعدة البيانات غير متاحة حالياً.");
}

export const familyMarketAlertsRouter = router({
  getWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    const db = await getDb();
    if (!db) throw notAvailable();

    const instList = await db
      .select()
      .from(instruments)
      .where(eq(instruments.workspaceId, family.workspace.id));

    const now = Date.now();
    const watchlist = await Promise.all(
      instList.map(async (inst: any) => {
        // Fetch latest quote
        const [latestQuote] = await db
          .select()
          .from(priceQuotes)
          .where(
            and(
              eq(priceQuotes.workspaceId, family.workspace.id),
              eq(priceQuotes.instrumentId, inst.id)
            )
          )
          .orderBy(desc(priceQuotes.asOf))
          .limit(1);

        const price = latestQuote ? Number(latestQuote.price) : 0;
        const asOf = latestQuote ? latestQuote.asOf : 0;
        const ageHours = asOf > 0 ? (now - asOf) / (1000 * 60 * 60) : 999;
        const isStale = ageHours > 48;

        return {
          id: inst.id,
          symbol: inst.symbol || inst.name,
          name: inst.name,
          currency: inst.currency,
          assetType: inst.assetType,
          latestPrice: price,
          source: latestQuote ? latestQuote.source : "غير محدد",
          asOf,
          isStale,
          freshnessLabel: isStale ? "سعر متقادم (>48 ساعة)" : "محدث حديثاً",
        };
      })
    );

    return watchlist;
  }),

  getTechnicalAnalysis: protectedProcedure
    .input(
      z.object({
        symbol: z.string().trim().min(1),
        timeframe: z.enum(["1h", "4h", "1d", "1w"]).default("1d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      const db = await getDb();
      if (!db) throw notAvailable();

      // Find instrument by symbol
      const [inst] = await db
        .select()
        .from(instruments)
        .where(
          and(
            eq(instruments.workspaceId, family.workspace.id),
            eq(instruments.symbol, input.symbol.toUpperCase().trim())
          )
        )
        .limit(1);

      if (!inst) {
        return {
          symbol: input.symbol,
          timeframe: input.timeframe,
          candleCount: 0,
          latestPrice: 0,
          latestTimestamp: 0,
          isStale: false,
          status: "insufficient_data" as const,
          message: `الأداة المالية (${input.symbol}) غير مسجلة في مساحة العمل الحالية.`,
          indicators: {
            rsi14: null,
            rsiCondition: null,
            sma20: null,
            sma50: null,
            trend: null,
          },
          candles: [],
        };
      }

      // Query market candles from DB
      const dbCandles = await db
        .select()
        .from(marketCandles)
        .where(
          and(
            eq(marketCandles.instrumentId, inst.id),
            eq(marketCandles.timeframe, input.timeframe)
          )
        )
        .orderBy(marketCandles.timestamp);

      const realCandles: RealCandle[] = dbCandles.map((c: any) => ({
        timestamp: c.timestamp,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
      }));

      // If no candles in marketCandles table, fallback to historical priceQuotes
      if (realCandles.length === 0) {
        const quotes = await db
          .select()
          .from(priceQuotes)
          .where(
            and(
              eq(priceQuotes.workspaceId, family.workspace.id),
              eq(priceQuotes.instrumentId, inst.id)
            )
          )
          .orderBy(priceQuotes.asOf);

        if (quotes.length >= 14) {
          // Construct daily candles from quotes
          for (const q of quotes as any[]) {
            const p = Number(q.price);
            realCandles.push({
              timestamp: q.asOf,
              open: p,
              high: p,
              low: p,
              close: p,
              volume: 0,
            });
          }
        }
      }

      return computeTechnicalAnalysis(inst.symbol || inst.name, realCandles, {
        timeframe: input.timeframe,
      });
    }),

  listAlertRules: protectedProcedure.query(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    return loadWorkspaceAlertRules(family.workspace.id);
  }),

  createAlertRule: protectedProcedure
    .input(
      z.object({
        symbol: z.string().trim().min(1),
        instrumentName: z.string().trim().min(1),
        alertType: z.enum(["price_above", "price_below", "rsi_oversold", "rsi_overbought"]),
        threshold: z.number().positive("قيمة الحد يجب أن تكون أكبر من صفر"),
        notifyTelegram: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      return addWorkspaceAlertRule(family.workspace.id, family.profile.id, input);
    }),

  deleteAlertRule: protectedProcedure
    .input(z.object({ ruleId: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const family = await ensurePersonalFamilyContext(ctx.user);
      assertRole(family, "editor");
      const success = deleteWorkspaceAlertRule(family.workspace.id, input.ruleId);
      return { success };
    }),

  evaluateAlerts: protectedProcedure.mutation(async ({ ctx }) => {
    const family = await ensurePersonalFamilyContext(ctx.user);
    assertRole(family, "editor");
    const db = await getDb();
    if (!db) throw notAvailable();

    // Fetch latest prices for all instruments
    const instList = await db
      .select()
      .from(instruments)
      .where(eq(instruments.workspaceId, family.workspace.id));

    const quotes: Array<{ symbol: string; price: number; rsi?: number | null }> = [];

    for (const inst of instList as any[]) {
      const [latestQuote] = await db
        .select()
        .from(priceQuotes)
        .where(
          and(
            eq(priceQuotes.workspaceId, family.workspace.id),
            eq(priceQuotes.instrumentId, inst.id)
          )
        )
        .orderBy(desc(priceQuotes.asOf))
        .limit(1);

      if (latestQuote && inst.symbol) {
        quotes.push({
          symbol: inst.symbol,
          price: Number(latestQuote.price),
        });
      }
    }

    return evaluateAlertRules(family.workspace.id, quotes);
  }),
});
