/**
 * Paper Trading Simulation Engine & Real Portfolio Side-by-Side Audit
 * Strictly Simulation & Advisory: Zero broker execution.
 * Allows users to simulate trades (BUY/SELL), manage virtual positions,
 * and compare simulated returns vs. actual family wealth portfolio performance.
 */

export interface VirtualPosition {
  ticker: string;
  nameAr: string;
  assetCategory: "EGX_STOCK" | "GOLD" | "MUTUAL_FUND";
  quantity: number;
  averageEntryPrice: number;
  currentMarketPrice: number;
  investedCostEGP: number;
  currentValueEGP: number;
  unrealizedPnLEGP: number;
  unrealizedPnLPercent: number;
  lastUpdated: string;
}

export interface VirtualOrder {
  id: string;
  ticker: string;
  action: "BUY" | "SELL";
  assetCategory: "EGX_STOCK" | "GOLD" | "MUTUAL_FUND";
  quantity: number;
  executionPrice: number;
  totalCostEGP: number;
  timestamp: string;
  notes?: string;
}

export interface PaperPortfolioState {
  initialCapitalEGP: number;
  virtualCashEGP: number;
  positionsValueEGP: number;
  totalEquityEGP: number;
  totalRealizedPnLEGP: number;
  totalUnrealizedPnLEGP: number;
  totalReturnPercent: number;
  positions: VirtualPosition[];
  orderHistory: VirtualOrder[];
}

export interface PortfolioAuditComparison {
  metric: string;
  metricAr: string;
  paperPortfolioValue: string;
  realPortfolioValue: string;
  varianceDescriptionAr: string;
  evaluationAr: string;
}

/**
 * In-memory / Database-backed state manager for Paper Trading
 */
export class PaperTradingManager {
  private static DEFAULT_INITIAL_CASH = 1000000; // 1 Million EGP virtual fund

  /**
   * Execute a simulated trade on a paper portfolio state
   */
  public static executeSimulatedOrder(
    currentState: PaperPortfolioState,
    order: {
      ticker: string;
      nameAr: string;
      action: "BUY" | "SELL";
      assetCategory: "EGX_STOCK" | "GOLD" | "MUTUAL_FUND";
      quantity: number;
      marketPrice: number;
      notes?: string;
    }
  ): {
    success: boolean;
    updatedState: PaperPortfolioState;
    errorMessageAr?: string;
  } {
    const qty = Math.max(0, order.quantity);
    const price = Math.max(0.01, order.marketPrice);
    const tradeAmount = Number((qty * price).toFixed(2));

    if (qty <= 0) {
      return { success: false, updatedState: currentState, errorMessageAr: "الكمية المطلوبة يجب أن تكون أكبر من الصفر." };
    }

    const state: PaperPortfolioState = JSON.parse(JSON.stringify(currentState));
    const existingPosIndex = state.positions.findIndex((p) => p.ticker.toUpperCase() === order.ticker.toUpperCase());

    if (order.action === "BUY") {
      if (state.virtualCashEGP < tradeAmount) {
        return {
          success: false,
          updatedState: currentState,
          errorMessageAr: `رصيد المحفظة الافتراضية غير كافٍ. المتاح (${state.virtualCashEGP.toLocaleString("ar-EG")} ج.م) والمطلوب (${tradeAmount.toLocaleString("ar-EG")} ج.م).`,
        };
      }

      state.virtualCashEGP = Number((state.virtualCashEGP - tradeAmount).toFixed(2));

      if (existingPosIndex >= 0) {
        const p = state.positions[existingPosIndex];
        const newTotalCost = p.investedCostEGP + tradeAmount;
        const newQty = p.quantity + qty;
        p.quantity = newQty;
        p.averageEntryPrice = Number((newTotalCost / newQty).toFixed(4));
        p.currentMarketPrice = price;
        p.investedCostEGP = Number(newTotalCost.toFixed(2));
        p.currentValueEGP = Number((newQty * price).toFixed(2));
        p.unrealizedPnLEGP = Number((p.currentValueEGP - p.investedCostEGP).toFixed(2));
        p.unrealizedPnLPercent = Number(((p.unrealizedPnLEGP / p.investedCostEGP) * 100).toFixed(2));
        p.lastUpdated = new Date().toISOString();
      } else {
        state.positions.push({
          ticker: order.ticker.toUpperCase(),
          nameAr: order.nameAr,
          assetCategory: order.assetCategory,
          quantity: qty,
          averageEntryPrice: price,
          currentMarketPrice: price,
          investedCostEGP: tradeAmount,
          currentValueEGP: tradeAmount,
          unrealizedPnLEGP: 0,
          unrealizedPnLPercent: 0,
          lastUpdated: new Date().toISOString(),
        });
      }
    } else if (order.action === "SELL") {
      if (existingPosIndex < 0 || state.positions[existingPosIndex].quantity < qty) {
        const availableQty = existingPosIndex >= 0 ? state.positions[existingPosIndex].quantity : 0;
        return {
          success: false,
          updatedState: currentState,
          errorMessageAr: `لا تملك كمية كافية للبيع في المحفظة الافتراضية. المتاح (${availableQty}) والمطلوب بيعه (${qty}).`,
        };
      }

      const p = state.positions[existingPosIndex];
      const soldFraction = qty / p.quantity;
      const costOfSoldShares = p.investedCostEGP * soldFraction;
      const realizedPnL = tradeAmount - costOfSoldShares;

      state.virtualCashEGP = Number((state.virtualCashEGP + tradeAmount).toFixed(2));
      state.totalRealizedPnLEGP = Number(((state.totalRealizedPnLEGP || 0) + realizedPnL).toFixed(2));

      p.quantity = Number((p.quantity - qty).toFixed(4));
      p.investedCostEGP = Number((p.investedCostEGP - costOfSoldShares).toFixed(2));

      if (p.quantity <= 0.0001) {
        state.positions.splice(existingPosIndex, 1);
      } else {
        p.currentMarketPrice = price;
        p.currentValueEGP = Number((p.quantity * price).toFixed(2));
        p.unrealizedPnLEGP = Number((p.currentValueEGP - p.investedCostEGP).toFixed(2));
        p.unrealizedPnLPercent = Number(((p.unrealizedPnLEGP / p.investedCostEGP) * 100).toFixed(2));
        p.lastUpdated = new Date().toISOString();
      }
    }

    // Recompute aggregate totals
    state.positionsValueEGP = Number(
      state.positions.reduce((sum, pos) => sum + pos.currentValueEGP, 0).toFixed(2)
    );
    state.totalUnrealizedPnLEGP = Number(
      state.positions.reduce((sum, pos) => sum + pos.unrealizedPnLEGP, 0).toFixed(2)
    );
    state.totalEquityEGP = Number((state.virtualCashEGP + state.positionsValueEGP).toFixed(2));
    const initCapital = state.initialCapitalEGP || this.DEFAULT_INITIAL_CASH;
    state.totalReturnPercent = Number((((state.totalEquityEGP - initCapital) / initCapital) * 100).toFixed(2));

    // Record order in audit history
    state.orderHistory.unshift({
      id: "sim-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      ticker: order.ticker.toUpperCase(),
      action: order.action,
      assetCategory: order.assetCategory,
      quantity: qty,
      executionPrice: price,
      totalCostEGP: tradeAmount,
      timestamp: new Date().toISOString(),
      notes: order.notes,
    });

    return {
      success: true,
      updatedState: state,
    };
  }

  /**
   * Compare Paper Portfolio vs Real Family Portfolio
   */
  public static compareAuditMatrix(params: {
    paperState: PaperPortfolioState;
    realTotalNetWorthEGP: number;
    realCashEGP: number;
    realInvestmentsEGP: number;
    realDebtsEGP: number;
  }): PortfolioAuditComparison[] {
    const { paperState, realTotalNetWorthEGP, realCashEGP, realInvestmentsEGP, realDebtsEGP } = params;

    const paperTotal = paperState.totalEquityEGP;
    const paperCash = paperState.virtualCashEGP;
    const paperInvestments = paperState.positionsValueEGP;

    const paperReturn = paperState.totalReturnPercent;
    const paperCashRatio = paperTotal > 0 ? (paperCash / paperTotal) * 100 : 0;
    const realCashRatio = realTotalNetWorthEGP > 0 ? (realCashEGP / realTotalNetWorthEGP) * 100 : 0;

    return [
      {
        metric: "TOTAL_VALUE",
        metricAr: "إجمالي القيمة الصافية",
        paperPortfolioValue: `${paperTotal.toLocaleString("ar-EG")} ج.م`,
        realPortfolioValue: `${realTotalNetWorthEGP.toLocaleString("ar-EG")} ج.م`,
        varianceDescriptionAr: "المحفظة الافتراضية بدأت برأس مال محاكاة قدره 1,000,000 ج.م لاختبار الاستراتيجيات.",
        evaluationAr: "مقياس مقارنة الحجم والقدرة التوسعية",
      },
      {
        metric: "CASH_ALLOCATION",
        metricAr: "نسبة السيولة النقدية غير المستثمرة",
        paperPortfolioValue: `${paperCashRatio.toFixed(1)}% (${paperCash.toLocaleString("ar-EG")} ج.م)`,
        realPortfolioValue: `${realCashRatio.toFixed(1)}% (${realCashEGP.toLocaleString("ar-EG")} ج.م)`,
        varianceDescriptionAr:
          paperCashRatio > realCashRatio
            ? "المحفظة الافتراضية تحتفظ بسيولة أكبر لاقتناص الفرص السعرية."
            : "المحفظة الحقيقية تملك سيولة نقدية أعلى تحسباً للطوارئ.",
        evaluationAr: "إدارة مخاطر السيولة وفرص الشراء",
      },
      {
        metric: "INVESTMENTS_EXPOSURE",
        metricAr: "الأصول المستثمرة النشطة",
        paperPortfolioValue: `${paperInvestments.toLocaleString("ar-EG")} ج.م (${paperState.positions.length} مراكز افتراضية)`,
        realPortfolioValue: `${realInvestmentsEGP.toLocaleString("ar-EG")} ج.م`,
        varianceDescriptionAr: `تحتوي محفظة المحاكاة على مراكز موزعة بين الأسهم والذهب وصناديق الاستثمار.`,
        evaluationAr: "كفاءة نشر رأس المال",
      },
      {
        metric: "LEVERAGE_AND_DEBT",
        metricAr: "الرافعة المالية والالتزامات",
        paperPortfolioValue: "0 ج.م (تداول نقدي بنسبة 100% بدون رافعة)",
        realPortfolioValue: `${realDebtsEGP.toLocaleString("ar-EG")} ج.م مديونيات حقيقية`,
        varianceDescriptionAr: "المحفظة الافتراضية خالية من الديون لضمان قياس العائد الصافي النقي للأصول.",
        evaluationAr: "الأمان المالي وعدم التعرض لمخاطر الفائدة",
      },
      {
        metric: "PERFORMANCE_RETURN",
        metricAr: "العائد التراكمي المحقق",
        paperPortfolioValue: `${paperReturn >= 0 ? "+" : ""}${paperReturn.toFixed(2)}%`,
        realPortfolioValue: "مبني على التدفقات الفعلية والتقييمات الرسمية",
        varianceDescriptionAr: `العائد الافتراضي يشمل الأرباح المحققة (${paperState.totalRealizedPnLEGP.toLocaleString("ar-EG")} ج.م) وغير المحققة (${paperState.totalUnrealizedPnLEGP.toLocaleString("ar-EG")} ج.م).`,
        evaluationAr: "تقييم جدوى النماذج الكمية قبل التطبيق العملي",
      },
    ];
  }
}
