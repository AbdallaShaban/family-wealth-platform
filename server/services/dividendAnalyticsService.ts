import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import type { FamilyContext } from "../familyAccess";
import { getDb } from "../db";
import { financialEvents, instruments, investmentLots, priceQuotes } from "../../drizzle/schema";
import { EGX_DIVIDEND_CALENDAR } from "./quant/egyptMarket";
import { EGX_MASTER_CATALOG } from "./quant/egxCatalog";

export interface DividendCalendarEvent {
  id: string;
  ticker: string;
  instrumentName: string;
  exDate: string;
  paymentDate: string;
  amountPerShare: number;
  userShares: number;
  totalAmount: number;
  currency: string;
  baseAmount: number;
  status: "paid" | "declared" | "projected";
  isLedgerConfirmed: boolean;
  notes?: string;
}

export interface HoldingYieldInfo {
  instrumentId: number;
  symbol: string;
  name: string;
  sharesCount: number;
  costBasisBase: number;
  currentMarketValueBase: number;
  annualDividendPerShare: number;
  projectedAnnualIncomeBase: number;
  dividendYieldPct: number;
  yieldOnCostPct: number;
  dataQuality: "confirmed" | "estimated" | "no_dividend_data";
}

export interface DividendAnalyticsSummary {
  baseCurrency: string;
  totalPaidDividendsBase: number;
  projectedAnnualDividendsBase: number;
  portfolioDividendYieldPct: number;
  portfolioYieldOnCostPct: number;
  paidCount: number;
  projectedCount: number;
  lastUpdated: number;
}

/**
 * Service providing advanced, read-only dividend analytics, yield calculations, and calendar tracking.
 * Strictly maintains read-model purity: NEVER generates journal entries or accounting mutations.
 */
export async function getDividendAnalytics(context: FamilyContext): Promise<{
  summary: DividendAnalyticsSummary;
  calendar: DividendCalendarEvent[];
  holdingsYield: HoldingYieldInfo[];
}> {
  const db = await getDb();
  const workspaceId = context.workspace.id;
  const baseCurrency = context.workspace.baseCurrency || "EGP";
  const now = Date.now();

  if (!db) {
    return {
      summary: {
        baseCurrency,
        totalPaidDividendsBase: 0,
        projectedAnnualDividendsBase: 0,
        portfolioDividendYieldPct: 0,
        portfolioYieldOnCostPct: 0,
        paidCount: 0,
        projectedCount: 0,
        lastUpdated: now,
      },
      calendar: [],
      holdingsYield: [],
    };
  }

  // 1. Fetch Confirmed Historical Paid Dividends from Financial Events (status = 'posted')
  const postedDividendEvents = await db
    .select({
      id: financialEvents.id,
      instrumentId: financialEvents.instrumentId,
      grossAmount: financialEvents.grossAmount,
      feeAmount: financialEvents.feeAmount,
      taxAmount: financialEvents.taxAmount,
      currency: financialEvents.currency,
      occurredAt: financialEvents.occurredAt,
      memo: financialEvents.memo,
      symbol: instruments.symbol,
      instrumentName: instruments.name,
    })
    .from(financialEvents)
    .innerJoin(instruments, eq(financialEvents.instrumentId, instruments.id))
    .where(
      and(
        eq(financialEvents.workspaceId, workspaceId),
        eq(financialEvents.eventType, "dividend"),
        eq(financialEvents.status, "posted")
      )
    )
    .orderBy(desc(financialEvents.occurredAt));

  const calendarEvents: DividendCalendarEvent[] = [];
  let totalPaidBase = new Decimal(0);

  for (const ev of postedDividendEvents) {
    const gross = new Decimal(ev.grossAmount || 0);
    const fee = new Decimal(ev.feeAmount || 0);
    const tax = new Decimal(ev.taxAmount || 0);
    const net = gross.minus(fee).minus(tax);
    // Base amount fallback is gross/net
    totalPaidBase = totalPaidBase.plus(net);

    const dateStr = new Date(ev.occurredAt).toISOString().slice(0, 10);

    calendarEvents.push({
      id: `paid-${ev.id}`,
      ticker: ev.symbol || "UNKNOWN",
      instrumentName: ev.instrumentName || ev.symbol || "أصل استثماري",
      exDate: dateStr,
      paymentDate: dateStr,
      amountPerShare: 0,
      userShares: 0,
      totalAmount: Number(gross.toFixed(2)),
      currency: ev.currency || baseCurrency,
      baseAmount: Number(net.toFixed(2)),
      status: "paid",
      isLedgerConfirmed: true,
      notes: ev.memo || "توزيع أرباح مؤكد ومقيد في دفتر الأستاذ",
    });
  }

  // 2. Fetch Active Holdings & Lots to calculate Cost Basis & Projected Yields
  const activeLots = await db
    .select({
      id: investmentLots.id,
      instrumentId: investmentLots.instrumentId,
      remainingQuantity: investmentLots.remainingQuantity,
      unitCost: investmentLots.unitCost,
      currency: instruments.currency,
      symbol: instruments.symbol,
      instrumentName: instruments.name,
    })
    .from(investmentLots)
    .innerJoin(instruments, eq(investmentLots.instrumentId, instruments.id))
    .where(
      and(
        eq(investmentLots.workspaceId, workspaceId),
        gt(investmentLots.remainingQuantity, "0"),
        eq(investmentLots.status, "open")
      )
    );

  // Group by instrument
  const holdingsMap = new Map<
    number,
    {
      instrumentId: number;
      symbol: string;
      name: string;
      shares: Decimal;
      costBasis: Decimal;
    }
  >();

  for (const lot of activeLots) {
    const qty = new Decimal(lot.remainingQuantity);
    const unitPrice = new Decimal(lot.unitCost);
    const lotCost = qty.mul(unitPrice);

    const existing = holdingsMap.get(lot.instrumentId);
    if (!existing) {
      holdingsMap.set(lot.instrumentId, {
        instrumentId: lot.instrumentId,
        symbol: lot.symbol || "",
        name: lot.instrumentName || lot.symbol || "أصل",
        shares: qty,
        costBasis: lotCost,
      });
    } else {
      existing.shares = existing.shares.plus(qty);
      existing.costBasis = existing.costBasis.plus(lotCost);
    }
  }

  // Fetch Latest Quotes for active instruments
  const instIds = Array.from(holdingsMap.keys());
  const quoteMap = new Map<number, Decimal>();

  if (instIds.length > 0) {
    const latestQuotes = await db
      .select({
        instrumentId: priceQuotes.instrumentId,
        price: priceQuotes.price,
      })
      .from(priceQuotes)
      .where(
        and(
          eq(priceQuotes.workspaceId, workspaceId),
          inArray(priceQuotes.instrumentId, instIds)
        )
      )
      .orderBy(desc(priceQuotes.asOf));

    for (const q of latestQuotes) {
      if (!quoteMap.has(q.instrumentId)) {
        quoteMap.set(q.instrumentId, new Decimal(q.price));
      }
    }
  }

  // Build Holdings Yield Breakdown and Projected Dividends
  const holdingsYield: HoldingYieldInfo[] = [];
  let totalPortfolioMarketValue = new Decimal(0);
  let totalPortfolioCostBasis = new Decimal(0);
  let totalProjectedAnnualIncome = new Decimal(0);

  for (const [instId, h] of Array.from(holdingsMap.entries())) {
    const sharesNum = h.shares.toNumber();
    const costBasisNum = Number(h.costBasis.toFixed(2));
    const latestPrice = quoteMap.get(instId) || (h.shares.gt(0) ? h.costBasis.div(h.shares) : new Decimal(0));
    const mktVal = h.shares.mul(latestPrice);
    const mktValNum = Number(mktVal.toFixed(2));

    totalPortfolioMarketValue = totalPortfolioMarketValue.plus(mktVal);
    totalPortfolioCostBasis = totalPortfolioCostBasis.plus(h.costBasis);

    // Check EGX dividend calendar and stock catalog
    const tickerClean = h.symbol.replace(/\.CA$/i, "").toUpperCase();
    const calendarItem = EGX_DIVIDEND_CALENDAR.find(
      (c) => c.ticker.replace(/\.CA$/i, "").toUpperCase() === tickerClean
    );
    const catalogItem = EGX_MASTER_CATALOG.find(
      (c) => c.ticker.replace(/\.CA$/i, "").toUpperCase() === tickerClean
    );

    let annualDivPerShare = 0;
    let quality: "confirmed" | "estimated" | "no_dividend_data" = "no_dividend_data";

    if (calendarItem) {
      annualDivPerShare = calendarItem.dividendPerShareEGP;
      quality = calendarItem.status === "CONFIRMED" ? "confirmed" : "estimated";
    } else if (catalogItem && catalogItem.typicalDividendYield) {
      // Estimate from catalog typical dividend yield: yield% * price
      annualDivPerShare = Number((latestPrice.toNumber() * (catalogItem.typicalDividendYield / 100)).toFixed(2));
      quality = "estimated";
    }

    const projectedIncome = Number((annualDivPerShare * sharesNum).toFixed(2));
    totalProjectedAnnualIncome = totalProjectedAnnualIncome.plus(projectedIncome);

    const divYieldPct = mktValNum > 0 ? Number(((projectedIncome / mktValNum) * 100).toFixed(2)) : 0;
    const yocPct = costBasisNum > 0 ? Number(((projectedIncome / costBasisNum) * 100).toFixed(2)) : 0;

    holdingsYield.push({
      instrumentId: instId,
      symbol: h.symbol,
      name: h.name,
      sharesCount: sharesNum,
      costBasisBase: costBasisNum,
      currentMarketValueBase: mktValNum,
      annualDividendPerShare: annualDivPerShare,
      projectedAnnualIncomeBase: projectedIncome,
      dividendYieldPct: divYieldPct,
      yieldOnCostPct: yocPct,
      dataQuality: quality,
    });

    // Add upcoming declared/projected events to calendar if scheduled
    if (calendarItem && sharesNum > 0) {
      calendarEvents.push({
        id: `proj-${instId}-${calendarItem.paymentDate}`,
        ticker: h.symbol,
        instrumentName: h.name,
        exDate: calendarItem.exDividendDate,
        paymentDate: calendarItem.paymentDate,
        amountPerShare: calendarItem.dividendPerShareEGP,
        userShares: sharesNum,
        totalAmount: projectedIncome,
        currency: "EGP",
        baseAmount: projectedIncome,
        status: calendarItem.status === "CONFIRMED" ? "declared" : "projected",
        isLedgerConfirmed: false,
        notes: "توزيع مستحق / متوقع مستقبلي، لا يعتبر قيدًا محاسبيًا حتى استلامه الفعلي",
      });
    }
  }

  // Sort full calendar chronologically (past and future)
  calendarEvents.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  // Compute portfolio weighted metrics
  const portfolioDivYieldPct = totalPortfolioMarketValue.gt(0)
    ? Number(totalProjectedAnnualIncome.div(totalPortfolioMarketValue).mul(100).toFixed(2))
    : 0;

  const portfolioYieldOnCostPct = totalPortfolioCostBasis.gt(0)
    ? Number(totalProjectedAnnualIncome.div(totalPortfolioCostBasis).mul(100).toFixed(2))
    : 0;

  const summary: DividendAnalyticsSummary = {
    baseCurrency,
    totalPaidDividendsBase: Number(totalPaidBase.toFixed(2)),
    projectedAnnualDividendsBase: Number(totalProjectedAnnualIncome.toFixed(2)),
    portfolioDividendYieldPct: portfolioDivYieldPct,
    portfolioYieldOnCostPct: portfolioYieldOnCostPct,
    paidCount: postedDividendEvents.length,
    projectedCount: holdingsYield.filter((h) => h.annualDividendPerShare > 0).length,
    lastUpdated: now,
  };

  return {
    summary,
    calendar: calendarEvents,
    holdingsYield,
  };
}
