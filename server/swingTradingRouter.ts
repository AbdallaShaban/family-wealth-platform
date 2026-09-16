import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { getDb } from "./db";
import { ensurePersonalFamilyContext } from "./familyAccess";
import { protectedProcedure, router } from "./_core/trpc";
import {
  accounts,
  instruments,
  marketCandles,
  priceQuotes,
  swingTrades,
  type InsertMarketCandle,
  type InsertSwingTrade,
} from "../drizzle/schema";
import { postTrade } from "./familyLedger";
import {
  calculateEMA,
  calculateRSI,
  detectSupportResistance,
  calculateRiskReward,
  calculateRecommendedPositionSize,
  calculateExitTimeline,
  type CandleInput,
} from "./swingTradingMath";

function dbUnavailable() {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "قاعدة بيانات التداول غير متاحة حالياً.",
  });
}

export const swingTradingRouter = router({
  /**
   * Lists all swing trades for the active workspace, enriched with live quote & P&L.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          filterCategory: z
            .enum(["ALL", "EGX_STOCK", "NBE_MUTUAL_FUND", "TELDA_LIQUIDITY", "GOLD", "CRYPTO_OTHER"])
            .default("ALL"),
          status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL"),
          isPaperTrading: z.boolean().optional(),
        })
        .default({ filterCategory: "ALL", status: "ALL" })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const { workspace } = await ensurePersonalFamilyContext(ctx.user);

      // Build conditions
      const conditions = [eq(swingTrades.workspaceId, workspace.id)];
      if (input.filterCategory !== "ALL") {
        conditions.push(eq(swingTrades.assetCategory, input.filterCategory));
      }
      if (input.status === "OPEN") {
        conditions.push(eq(swingTrades.status, "OPEN"));
      } else if (input.status === "CLOSED") {
        conditions.push(
          inArray(swingTrades.status, [
            "TARGET_HIT",
            "STOPPED_OUT",
            "CLOSED_MANUALLY",
            "TIME_EXPIRED",
            "CANCELLED",
          ])
        );
      }
      if (input.isPaperTrading !== undefined) {
        conditions.push(eq(swingTrades.isPaperTrading, input.isPaperTrading));
      }

      const trades = await db
        .select({
          trade: swingTrades,
          instrument: instruments,
          account: accounts,
        })
        .from(swingTrades)
        .leftJoin(instruments, eq(swingTrades.instrumentId, instruments.id))
        .leftJoin(accounts, eq(swingTrades.fundingAccountId, accounts.id))
        .where(and(...conditions))
        .orderBy(desc(swingTrades.entryDate), desc(swingTrades.id));

      if (trades.length === 0) {
        return [];
      }

      // Fetch latest quotes for instruments
      const instrumentIds = Array.from(
        new Set(trades.map(t => t.trade.instrumentId).filter(Boolean))
      );

      const latestQuotesMap = new Map<number, { price: number; asOf: number; status: string }>();

      if (instrumentIds.length > 0) {
        const quotes = await db
          .select()
          .from(priceQuotes)
          .where(
            and(
              eq(priceQuotes.workspaceId, workspace.id),
              inArray(priceQuotes.instrumentId, instrumentIds)
            )
          )
          .orderBy(desc(priceQuotes.asOf));

        for (const q of quotes) {
          if (!latestQuotesMap.has(q.instrumentId)) {
            latestQuotesMap.set(q.instrumentId, {
              price: Number(q.price),
              asOf: q.asOf,
              status: q.quoteStatus,
            });
          }
        }
      }

      const now = Date.now();

      return trades.map(({ trade, instrument, account }) => {
        const entryPrice = Number(trade.entryPrice);
        const quantity = Number(trade.quantity);
        const stopLoss = trade.stopLossPrice ? Number(trade.stopLossPrice) : null;
        const takeProfit = trade.takeProfitPrice ? Number(trade.takeProfitPrice) : null;

        const latestQuote = latestQuotesMap.get(trade.instrumentId);
        const currentPrice =
          trade.status === "OPEN"
            ? latestQuote?.price ?? entryPrice
            : trade.exitPrice
            ? Number(trade.exitPrice)
            : entryPrice;

        // P&L calculation
        const isLong = trade.direction === "LONG";
        const priceDiff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
        const pnlAmount = Number((priceDiff * quantity).toFixed(2));
        const pnlPercent = entryPrice > 0 ? Number(((priceDiff / entryPrice) * 100).toFixed(2)) : 0;

        // Holding days calculation (elapsed trading days)
        const entryDate = new Date(trade.entryDate);
        const endDate = trade.exitDate ? new Date(trade.exitDate) : new Date(now);

        let elapsedTradingDays = 0;
        const cur = new Date(entryDate.getTime());
        while (cur < endDate) {
          cur.setDate(cur.getDate() + 1);
          const day = cur.getDay();
          if (day !== 5 && day !== 6) {
            elapsedTradingDays++;
          }
        }

        // Timeline projection
        const timeline = calculateExitTimeline(
          trade.entryDate,
          trade.targetHoldingDays || 10
        );

        const remainingTradingDays = Math.max(
          0,
          (trade.targetHoldingDays || 10) - elapsedTradingDays
        );

        // Risk / Reward
        const rr = calculateRiskReward(entryPrice, stopLoss, takeProfit, trade.direction);

        return {
          id: trade.id,
          workspaceId: trade.workspaceId,
          instrumentId: trade.instrumentId,
          instrumentSymbol: instrument?.symbol ?? "UNKNOWN",
          instrumentName: instrument?.name ?? "أداة مالية",
          instrumentCurrency: instrument?.currency ?? "EGP",
          assetCategory: trade.assetCategory,
          fundingAccountId: trade.fundingAccountId,
          fundingAccountName: account?.name ?? null,
          isPaperTrading: trade.isPaperTrading,
          direction: trade.direction,
          quantity,
          entryPrice,
          stopLossPrice: stopLoss,
          takeProfitPrice: takeProfit,
          entryDate: trade.entryDate,
          exitDeadline: trade.exitDeadline ?? timeline.deadline.getTime(),
          settlementDate: timeline.settlementDate.getTime(),
          targetHoldingDays: trade.targetHoldingDays || 10,
          elapsedTradingDays,
          remainingTradingDays,
          status: trade.status,
          exitPrice: trade.exitPrice ? Number(trade.exitPrice) : null,
          exitDate: trade.exitDate ?? null,
          strategyTag: trade.strategyTag ?? "SWING",
          notes: trade.notes ?? "",
          currentPrice,
          pnlAmount,
          pnlPercent,
          riskRewardRatio: rr.riskRewardRatio,
          isFavorableRR: rr.isFavorable,
          riskAmount: rr.riskAmount,
          rewardAmount: rr.rewardAmount,
          quoteStatus: latestQuote?.status ?? "delayed",
          quoteAsOf: latestQuote?.asOf ?? null,
        };
      });
    }),

  /**
   * Registers a new swing trade.
   * Advisory Co-Pilot: Never blocks creation even if SL, TP, or fundingAccountId is missing.
   */
  create: protectedProcedure
    .input(
      z.object({
        instrumentId: z.number().int().positive("يجب اختيار الأداة المالية"),
        assetCategory: z
          .enum(["EGX_STOCK", "NBE_MUTUAL_FUND", "TELDA_LIQUIDITY", "GOLD", "CRYPTO_OTHER"])
          .default("EGX_STOCK"),
        fundingAccountId: z.number().int().positive().nullish(),
        isPaperTrading: z.boolean().default(false),
        direction: z.enum(["LONG", "SHORT"]).default("LONG"),
        quantity: z.number().positive("الكمية يجب أن تكون أكبر من صفر"),
        entryPrice: z.number().positive("سعر الدخول يجب أن يكون أكبر من صفر"),
        stopLossPrice: z.number().positive().nullish(),
        takeProfitPrice: z.number().positive().nullish(),
        entryDate: z.number().int().positive().default(() => Date.now()),
        targetHoldingDays: z.number().int().min(1).max(365).default(10),
        strategyTag: z.string().trim().max(100).nullish(),
        notes: z.string().trim().max(1000).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const familyContext = await ensurePersonalFamilyContext(ctx.user);
      const { workspace } = familyContext;

      // If user selected Option B (Official Funded Ledger Trade), record in double-entry ledger first
      let financialEventId: number | null = null;
      if (!input.isPaperTrading && input.fundingAccountId) {
        try {
          const tradeEvent = await postTrade({
            context: familyContext,
            actorUserId: ctx.user.id,
            side: input.direction === "SHORT" ? "sell" : "buy",
            accountId: input.fundingAccountId,
            instrumentId: input.instrumentId,
            quantity: String(input.quantity),
            unitPrice: String(input.entryPrice),
            occurredAt: input.entryDate,
            memo: input.notes
              ? `صفقة سوينج ممولة: ${input.notes}`
              : `صفقة سوينج ممولة عبر مستشار التداول — ${input.direction}`,
            idempotencyKey: `SWING_TRADE_FUNDED_${workspace.id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          });
          financialEventId = tradeEvent.id;
        } catch (err: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `تعذر ترحيل الصفقة في الدفاتر المحاسبية: ${err.message || "الرصيد غير كافٍ أو الحساب غير متاح"}`,
          });
        }
      }

      // Calculate exit timeline (EGX trading days)
      const timeline = calculateExitTimeline(input.entryDate, input.targetHoldingDays);

      const [result] = await db.insert(swingTrades).values({
        workspaceId: workspace.id,
        instrumentId: input.instrumentId,
        assetCategory: input.assetCategory,
        fundingAccountId: input.fundingAccountId ?? null,
        isPaperTrading: input.isPaperTrading,
        direction: input.direction,
        quantity: String(input.quantity),
        entryPrice: String(input.entryPrice),
        stopLossPrice: input.stopLossPrice ? String(input.stopLossPrice) : null,
        takeProfitPrice: input.takeProfitPrice ? String(input.takeProfitPrice) : null,
        entryDate: input.entryDate,
        exitDeadline: timeline.deadline.getTime(),
        targetHoldingDays: input.targetHoldingDays,
        status: "OPEN",
        strategyTag: input.strategyTag ?? "SWING",
        notes: input.notes ?? null,
      });

      return {
        success: true,
        tradeId: (result as any)?.insertId ?? 0,
        deadline: timeline.deadline.getTime(),
        settlementDate: timeline.settlementDate.getTime(),
        financialEventId,
      };
    }),

  /**
   * Closes a swing trade with exit metrics.
   */
  close: protectedProcedure
    .input(
      z.object({
        tradeId: z.number().int().positive(),
        exitPrice: z.number().positive("سعر الخروج يجب أن يكون أكبر من صفر"),
        exitDate: z.number().int().positive().default(() => Date.now()),
        status: z.enum([
          "TARGET_HIT",
          "STOPPED_OUT",
          "CLOSED_MANUALLY",
          "TIME_EXPIRED",
          "CANCELLED",
        ]),
        notes: z.string().trim().max(1000).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const { workspace } = await ensurePersonalFamilyContext(ctx.user);

      const [trade] = await db
        .select()
        .from(swingTrades)
        .where(
          and(eq(swingTrades.id, input.tradeId), eq(swingTrades.workspaceId, workspace.id))
        );

      if (!trade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "الصفقة غير موجودة أو لا تملك صلاحية الوصول إليها.",
        });
      }

      const updatedNotes = input.notes
        ? trade.notes
          ? `${trade.notes}\n[إغلاق]: ${input.notes}`
          : input.notes
        : trade.notes;

      await db
        .update(swingTrades)
        .set({
          status: input.status,
          exitPrice: String(input.exitPrice),
          exitDate: input.exitDate,
          notes: updatedNotes,
        })
        .where(eq(swingTrades.id, input.tradeId));

      return { success: true };
    }),

  /**
   * Calculates comprehensive swing trading performance analytics and behavioral advisory tips.
   */
  diagnostics: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const { workspace } = await ensurePersonalFamilyContext(ctx.user);

    const trades = await db
      .select()
      .from(swingTrades)
      .where(eq(swingTrades.workspaceId, workspace.id));

    let activeCapital = 0;
    let totalRealizedPnl = 0;
    let winningTradesCount = 0;
    let losingTradesCount = 0;
    let grossProfits = 0;
    let grossLosses = 0;
    let totalHoldingDaysSum = 0;
    let closedTradesCount = 0;

    const strategyMap = new Map<
      string,
      { count: number; wins: number; totalPnl: number }
    >();

    const openTradesWithoutSL: string[] = [];
    const openTradesExpired: string[] = [];
    const now = Date.now();

    for (const t of trades) {
      const qty = Number(t.quantity);
      const entryPrice = Number(t.entryPrice);
      const strategy = t.strategyTag || "عام";

      if (!strategyMap.has(strategy)) {
        strategyMap.set(strategy, { count: 0, wins: 0, totalPnl: 0 });
      }
      const stratStat = strategyMap.get(strategy)!;
      stratStat.count++;

      if (t.status === "OPEN") {
        activeCapital += qty * entryPrice;
        if (!t.stopLossPrice) {
          openTradesWithoutSL.push(`صفقة #${t.id}`);
        }
        if (t.exitDeadline && now > t.exitDeadline) {
          openTradesExpired.push(`صفقة #${t.id}`);
        }
      } else if (t.exitPrice) {
        closedTradesCount++;
        const exitPrice = Number(t.exitPrice);
        const isLong = t.direction === "LONG";
        const pnl = isLong ? (exitPrice - entryPrice) * qty : (entryPrice - exitPrice) * qty;

        totalRealizedPnl += pnl;
        stratStat.totalPnl += pnl;

        if (pnl > 0) {
          winningTradesCount++;
          stratStat.wins++;
          grossProfits += pnl;
        } else if (pnl < 0) {
          losingTradesCount++;
          grossLosses += Math.abs(pnl);
        }

        if (t.exitDate && t.entryDate) {
          const days = Math.max(
            1,
            Math.round((t.exitDate - t.entryDate) / (1000 * 60 * 60 * 24))
          );
          totalHoldingDaysSum += days;
        }
      }
    }

    const winRate =
      closedTradesCount > 0
        ? Number(((winningTradesCount / closedTradesCount) * 100).toFixed(1))
        : 0;

    const profitFactor =
      grossLosses > 0
        ? Number((grossProfits / grossLosses).toFixed(2))
        : grossProfits > 0
        ? 999
        : 1;

    const avgHoldingDays =
      closedTradesCount > 0 ? Math.round(totalHoldingDaysSum / closedTradesCount) : 0;

    const strategyAttribution = Array.from(strategyMap.entries()).map(
      ([strategy, data]) => ({
        strategy,
        count: data.count,
        winRate: data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0,
        totalPnl: Number(data.totalPnl.toFixed(2)),
      })
    );

    // Advisory behavioral alerts
    const behavioralTips: string[] = [];
    if (openTradesWithoutSL.length > 0) {
      behavioralTips.push(
        `تنبيه مخاطر: لديك ${openTradesWithoutSL.length} صفقة بدون وقف خسارة مسجل. حدد مستوى وقف الخسارة لحماية رأس المال.`
      );
    }
    if (openTradesExpired.length > 0) {
      behavioralTips.push(
        `تنبيه انضباط زمني: هناك ${openTradesExpired.length} صفقة تجاوزت الأجل المستهدف للاحتفاظ. راجع التقييم لإغلاقها أو تمديد الهدف.`
      );
    }
    if (winRate >= 60 && closedTradesCount >= 5) {
      behavioralTips.push(
        `أداء ممتاز: نسبة نجاح الصفقات تبلغ ${winRate}% بمعدل ربح إلى خسارة متوازن.`
      );
    }

    return {
      totalTradesCount: trades.length,
      openTradesCount: trades.filter(t => t.status === "OPEN").length,
      closedTradesCount,
      activeCapital: Number(activeCapital.toFixed(2)),
      totalRealizedPnl: Number(totalRealizedPnl.toFixed(2)),
      winRate,
      profitFactor,
      avgHoldingDays,
      strategyAttribution,
      behavioralTips,
    };
  }),

  /**
   * Fetches candlestick OHLCV data with EMA, RSI, and Support/Resistance calculations.
   * Synthesizes realistic historical data if table contains few records so charting is immediate.
   */
  getCandles: protectedProcedure
    .input(
      z.object({
        instrumentId: z.number().int().positive(),
        timeframe: z.enum(["1h", "4h", "1d", "1w"]).default("1d"),
        limit: z.number().int().min(10).max(200).default(60),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const { workspace } = await ensurePersonalFamilyContext(ctx.user);

      // Fetch instrument info & latest quote
      const [instrument] = await db
        .select()
        .from(instruments)
        .where(
          and(eq(instruments.id, input.instrumentId), eq(instruments.workspaceId, workspace.id))
        );

      const [latestQuote] = await db
        .select()
        .from(priceQuotes)
        .where(
          and(
            eq(priceQuotes.workspaceId, workspace.id),
            eq(priceQuotes.instrumentId, input.instrumentId)
          )
        )
        .orderBy(desc(priceQuotes.asOf))
        .limit(1);

      // Fetch existing candles
      const existingCandles = await db
        .select()
        .from(marketCandles)
        .where(
          and(
            eq(marketCandles.instrumentId, input.instrumentId),
            eq(marketCandles.timeframe, input.timeframe)
          )
        )
        .orderBy(marketCandles.timestamp)
        .limit(input.limit);

      let candles: CandleInput[] = [];

      if (existingCandles.length >= 15) {
        candles = existingCandles.map(c => ({
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
          timestamp: c.timestamp,
        }));
      } else {
        // Synthesize realistic historical daily candles leading up to current price
        const basePrice = latestQuote ? Number(latestQuote.price) : 85.0;
        const totalPoints = Math.max(40, input.limit);
        const dayMs = 24 * 60 * 60 * 1000;
        const startTs = Date.now() - totalPoints * dayMs;

        let currentClose = basePrice * 0.9; // started 10% lower
        for (let i = 0; i < totalPoints; i++) {
          const ts = startTs + i * dayMs;
          // Sine wave trend with small random walk
          const cycle = Math.sin(i / 6) * (basePrice * 0.03);
          const noise = (Math.random() - 0.48) * (basePrice * 0.025);
          const open = currentClose;
          const close = Number(Math.max(1, open + cycle + noise).toFixed(2));
          const high = Number((Math.max(open, close) + Math.random() * (basePrice * 0.015)).toFixed(2));
          const low = Number((Math.min(open, close) - Math.random() * (basePrice * 0.015)).toFixed(2));
          const volume = Math.round(150000 + Math.random() * 300000);

          candles.push({
            open,
            high,
            low,
            close,
            volume,
            timestamp: ts,
          });
          currentClose = close;
        }

        // Anchor the final candle close to latest quote price
        if (candles.length > 0 && latestQuote) {
          const last = candles[candles.length - 1];
          last.close = Number(latestQuote.price);
          last.high = Math.max(last.high, last.close);
          last.low = Math.min(last.low, last.close);
        }
      }

      // Compute technical indicators
      const closePrices = candles.map(c => c.close);
      const ema20 = calculateEMA(closePrices, 20);
      const ema50 = calculateEMA(closePrices, 50);
      const rsi14 = calculateRSI(closePrices, 14);
      const srLevels = detectSupportResistance(candles, 4);

      return {
        instrumentSymbol: instrument?.symbol ?? "ASSET",
        instrumentName: instrument?.name ?? "الأداة المالية",
        timeframe: input.timeframe,
        candles,
        ema20,
        ema50,
        rsi14,
        supports: srLevels.supports,
        resistances: srLevels.resistances,
      };
    }),

  /**
   * Seeds demo swing trading positions and candles so the advisory co-pilot is immediately testable.
   */
  seedDemoData: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const { workspace } = await ensurePersonalFamilyContext(ctx.user);

    // 1. Ensure test instruments exist for the active workspace
    let [cib] = await db
      .select()
      .from(instruments)
      .where(and(eq(instruments.workspaceId, workspace.id), eq(instruments.symbol, "COMI.CA")))
      .limit(1);

    if (!cib) {
      await db.insert(instruments).values({
        workspaceId: workspace.id,
        symbol: "COMI.CA",
        name: "البنك التجاري الدولي (مصر)",
        assetType: "equity",
        currency: "EGP",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      [cib] = await db
        .select()
        .from(instruments)
        .where(and(eq(instruments.workspaceId, workspace.id), eq(instruments.symbol, "COMI.CA")))
        .limit(1);
    }

    let [swdy] = await db
      .select()
      .from(instruments)
      .where(and(eq(instruments.workspaceId, workspace.id), eq(instruments.symbol, "SWDY.CA")))
      .limit(1);

    if (!swdy) {
      await db.insert(instruments).values({
        workspaceId: workspace.id,
        symbol: "SWDY.CA",
        name: "السويدي إليكتريك",
        assetType: "equity",
        currency: "EGP",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      [swdy] = await db
        .select()
        .from(instruments)
        .where(and(eq(instruments.workspaceId, workspace.id), eq(instruments.symbol, "SWDY.CA")))
        .limit(1);
    }

    if (!cib || !swdy) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "تعذر إعداد الأدوات المالية التجريبية.",
      });
    }

    // 2. Insert fresh price quotes
    await db.insert(priceQuotes).values([
      {
        workspaceId: workspace.id,
        instrumentId: cib.id,
        price: "88.50000000",
        currency: "EGP",
        source: "Yahoo Finance",
        quoteStatus: "live",
        asOf: Date.now(),
        createdAt: Date.now(),
      },
      {
        workspaceId: workspace.id,
        instrumentId: swdy.id,
        price: "47.25000000",
        currency: "EGP",
        source: "Yahoo Finance",
        quoteStatus: "live",
        asOf: Date.now(),
        createdAt: Date.now(),
      },
    ]);

    // 3. Seed market candles for CIB and Elsewedy if empty
    const cibCandles = await db
      .select()
      .from(marketCandles)
      .where(eq(marketCandles.instrumentId, cib.id))
      .limit(1);

    if (cibCandles.length === 0) {
      const dayMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const candlesToInsert: InsertMarketCandle[] = [];
      let basePrice = 78.0;

      for (let i = 40; i >= 0; i--) {
        const ts = now - i * dayMs;
        const cycle = Math.sin(i / 5) * 2.0;
        const noise = (Math.random() - 0.48) * 1.5;
        const open = basePrice;
        const close = Number(Math.max(1, open + cycle + noise).toFixed(2));
        const high = Number((Math.max(open, close) + Math.random() * 1.5).toFixed(2));
        const low = Number((Math.min(open, close) - Math.random() * 1.5).toFixed(2));
        const volume = String(Math.round(180000 + Math.random() * 300000));

        candlesToInsert.push({
          instrumentId: cib.id,
          timeframe: "1d",
          timestamp: ts,
          open: String(open),
          high: String(high),
          low: String(low),
          close: String(close),
          volume,
        });
        basePrice = close;
      }
      candlesToInsert[candlesToInsert.length - 1].close = "88.50";
      await db.insert(marketCandles).values(candlesToInsert);
    }

    // 4. Insert representative demo swing trades
    const dayMs = 24 * 60 * 60 * 1000;
    const t1Timeline = calculateExitTimeline(Date.now() - 4 * dayMs, 10);
    const t2Timeline = calculateExitTimeline(Date.now() - 14 * dayMs, 7);

    await db.insert(swingTrades).values([
      {
        workspaceId: workspace.id,
        instrumentId: cib.id,
        assetCategory: "EGX_STOCK",
        isPaperTrading: true,
        direction: "LONG",
        quantity: "500",
        entryPrice: "82.0000",
        stopLossPrice: "79.0000",
        takeProfitPrice: "92.0000",
        entryDate: Date.now() - 4 * dayMs,
        exitDeadline: t1Timeline.deadline.getTime(),
        targetHoldingDays: 10,
        status: "OPEN",
        strategyTag: "EMA_PULLBACK",
        notes: "ارتداد إيجابي من متوسط 20 يوم بعد جني أرباح طفيف.",
      },
      {
        workspaceId: workspace.id,
        instrumentId: swdy.id,
        assetCategory: "EGX_STOCK",
        isPaperTrading: true,
        direction: "LONG",
        quantity: "800",
        entryPrice: "42.5000",
        stopLossPrice: "40.0000",
        takeProfitPrice: "48.0000",
        entryDate: Date.now() - 14 * dayMs,
        exitDeadline: t2Timeline.deadline.getTime(),
        targetHoldingDays: 7,
        status: "TARGET_HIT",
        exitPrice: "48.2000",
        exitDate: Date.now() - 6 * dayMs,
        strategyTag: "BREAKOUT",
        notes: "اختراق مستوى المقاومة 44 جنيه بحجم تداول مرتفع.",
      },
    ]);

    return { success: true };
  }),
});
