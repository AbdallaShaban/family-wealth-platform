/**
 * Quantitative Rule-Based Advisory Signals Engine
 * Strictly Advisory & Simulation: Analyzes multi-factor indicators (RSI, MACD, Bollinger Bands, ATR, Dynamic Pivots)
 * and generates actionable entry/profit-taking zones, confidence scores, and clear Arabic explanations.
 */

import {
  CandleInput,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateEMA,
  detectDynamicPivots,
} from "./indicators";

export type AdvisoryAction =
  | "STRONG_ACCUMULATE" // تجميع قوي (فرصة شراء ممتازة)
  | "ACCUMULATE"        // تجميع تدريجي (شراء على دفعات)
  | "HOLD"              // احتفاظ ومراقبة
  | "TAKE_PROFIT_PARTIAL" // جني أرباح جزئي (تخفيف مراكز)
  | "TAKE_PROFIT_FULL"   // جني أرباح كامل وخروج
  | "WAIT";             // انتظار وتريث (سيولة في الملاذات)

export interface AdvisorySignalResult {
  ticker: string;
  action: AdvisoryAction;
  actionAr: string;
  confidenceScore: number; // 0 to 100%
  currentPrice: number;
  entryZone: {
    min: number;
    max: number;
  };
  targets: {
    t1: number; // Conservative profit-taking target
    t2: number; // Aggressive target
  };
  stopLoss: number; // Trailing or ATR-based stop level
  riskRewardRatio: number;
  indicators: {
    rsi: number | null;
    macdHistogram: number | null;
    macdTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
    bollingerPosition: "OVERSOLD" | "OVERBOUGHT" | "NORMAL";
    bollingerPercentB: number | null;
    trendEMA: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
    volatilityATR: number | null;
    immediateSupport: number | null;
    immediateResistance: number | null;
  };
  arabicAnalysis: {
    headline: string;
    keyPoints: string[];
    riskWarning: string;
  };
  generatedAt: string;
}

/**
 * Generate Multi-Factor Quantitative Advisory Signal
 */
export function generateAdvisorySignal(
  ticker: string,
  candles: CandleInput[],
  options?: { assetType?: "EGX_STOCK" | "GOLD" | "MUTUAL_FUND" }
): AdvisorySignalResult {
  if (!candles || candles.length < 15) {
    const fallbackPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : 100;
    return {
      ticker,
      action: "HOLD",
      actionAr: "بيانات تاريخية غير كافية - يوصى بالمراقبة",
      confidenceScore: 30,
      currentPrice: fallbackPrice,
      entryZone: { min: Number((fallbackPrice * 0.97).toFixed(2)), max: Number((fallbackPrice * 0.99).toFixed(2)) },
      targets: { t1: Number((fallbackPrice * 1.05).toFixed(2)), t2: Number((fallbackPrice * 1.1).toFixed(2)) },
      stopLoss: Number((fallbackPrice * 0.93).toFixed(2)),
      riskRewardRatio: 1.5,
      indicators: {
        rsi: null,
        macdHistogram: null,
        macdTrend: "NEUTRAL",
        bollingerPosition: "NORMAL",
        bollingerPercentB: null,
        trendEMA: "SIDEWAYS",
        volatilityATR: null,
        immediateSupport: null,
        immediateResistance: null,
      },
      arabicAnalysis: {
        headline: `تحليل رمزي لـ ${ticker}: عدد الشموع المتاحة قليل جداً لتوليد إشارة كمية موثوقة`,
        keyPoints: ["يلزم توفر 15 شمعة على الأقل لحساب مؤشرات RSI وMACD بدقة."],
        riskWarning: "تنبيه إرشادي: لا تقم بأي تداولات حقيقية بناء على بيانات ناقصة.",
      },
      generatedAt: new Date().toISOString(),
    };
  }

  const closePrices = candles.map((c) => c.close);
  const currentPrice = closePrices[closePrices.length - 1];

  // 1. Calculate Core Indicators
  const rsiSeries = calculateRSI(closePrices, 14);
  const currentRSI = rsiSeries.filter((v) => !isNaN(v)).pop() ?? 50;

  const macdResult = calculateMACD(closePrices, 12, 26, 9);
  const validHist = macdResult.histogram.filter((v) => !isNaN(v));
  const currentHist = validHist.length > 0 ? validHist[validHist.length - 1] : 0;
  const prevHist = validHist.length > 1 ? validHist[validHist.length - 2] : 0;

  let macdTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (currentHist > 0 && currentHist >= prevHist) macdTrend = "BULLISH";
  else if (currentHist < 0 && currentHist <= prevHist) macdTrend = "BEARISH";

  const bbResult = calculateBollingerBands(closePrices, 20, 2);
  const validUpper = bbResult.upper.filter((v) => !isNaN(v));
  const validLower = bbResult.lower.filter((v) => !isNaN(v));
  const validPercentB = bbResult.percentB.filter((v) => !isNaN(v));

  const currentUpperBB = validUpper.length > 0 ? validUpper[validUpper.length - 1] : currentPrice * 1.05;
  const currentLowerBB = validLower.length > 0 ? validLower[validLower.length - 1] : currentPrice * 0.95;
  const currentPercentB = validPercentB.length > 0 ? validPercentB[validPercentB.length - 1] : 0.5;

  let bollingerPosition: "OVERSOLD" | "OVERBOUGHT" | "NORMAL" = "NORMAL";
  if (currentPercentB <= 0.1 || currentPrice <= currentLowerBB) {
    bollingerPosition = "OVERSOLD";
  } else if (currentPercentB >= 0.9 || currentPrice >= currentUpperBB) {
    bollingerPosition = "OVERBOUGHT";
  }

  // Trend determination using EMA 20 & EMA 50
  const ema20 = calculateEMA(closePrices, 20).filter((v) => !isNaN(v)).pop() ?? currentPrice;
  const ema50 = calculateEMA(closePrices, 50).filter((v) => !isNaN(v)).pop() ?? currentPrice;

  let trendEMA: "UPTREND" | "DOWNTREND" | "SIDEWAYS" = "SIDEWAYS";
  if (currentPrice > ema20 && ema20 > ema50) {
    trendEMA = "UPTREND";
  } else if (currentPrice < ema20 && ema20 < ema50) {
    trendEMA = "DOWNTREND";
  }

  // Volatility & Stops (ATR)
  const atrSeries = calculateATR(candles, 14);
  const currentATR = atrSeries.filter((v) => !isNaN(v)).pop() || currentPrice * 0.025;

  // Dynamic Pivots
  const pivots = detectDynamicPivots(candles, 3);
  const immediateSupport = pivots.supports.length > 0 ? pivots.supports[pivots.supports.length - 1] : Number((currentPrice - currentATR * 1.5).toFixed(2));
  const immediateResistance = pivots.resistances.length > 0 ? pivots.resistances[0] : Number((currentPrice + currentATR * 2).toFixed(2));

  // 2. Quantitative Multi-Factor Scoring (-100 to +100)
  let score = 0;

  // RSI Factors
  if (currentRSI <= 30) score += 35; // Heavily oversold
  else if (currentRSI <= 40) score += 20; // Moderate dip
  else if (currentRSI >= 75) score -= 35; // Heavily overbought
  else if (currentRSI >= 65) score -= 20; // Entering froth

  // MACD Factors
  if (macdTrend === "BULLISH") score += 25;
  else if (macdTrend === "BEARISH") score -= 25;

  // Bollinger Bands Factors
  if (bollingerPosition === "OVERSOLD") score += 20;
  else if (bollingerPosition === "OVERBOUGHT") score -= 25;

  // Trend EMA Factors
  if (trendEMA === "UPTREND") score += 20;
  else if (trendEMA === "DOWNTREND") score -= 15;

  // 3. Classify Action & Confidence
  let action: AdvisoryAction = "HOLD";
  let actionAr = "احتفاظ ومراقبة";

  if (score >= 50) {
    action = "STRONG_ACCUMULATE";
    actionAr = "تجميع قوي (شراء في مناطق قاع ممتازة)";
  } else if (score >= 20) {
    action = "ACCUMULATE";
    actionAr = "تجميع تدريجي (توزيع الشراء على دفعات)";
  } else if (score <= -50) {
    action = "TAKE_PROFIT_FULL";
    actionAr = "جني أرباح كامل وتصفية المركز";
  } else if (score <= -20) {
    action = "TAKE_PROFIT_PARTIAL";
    actionAr = "جني أرباح جزئي (تخفيف 30% إلى 50%)";
  } else {
    action = "HOLD";
    actionAr = "احتفاظ بالسهم وانتظار وضوح الاتجاه";
  }

  const confidenceScore = Math.min(95, Math.max(45, Math.round(50 + Math.abs(score) * 0.45)));

  // 4. Target Zones & Risk-Reward
  const stopLoss = Math.max(0.1, Number((currentPrice - currentATR * 1.6).toFixed(2)));
  const entryMin = Number((Math.min(currentPrice, immediateSupport)).toFixed(2));
  const entryMax = Number(currentPrice.toFixed(2));

  const t1 = Number((currentPrice + currentATR * 1.8).toFixed(2));
  const t2 = Number((Math.max(t1 * 1.05, immediateResistance)).toFixed(2));

  const riskPerShare = Math.max(0.01, currentPrice - stopLoss);
  const rewardPerShare = Math.max(0.01, t1 - currentPrice);
  const riskRewardRatio = Number((rewardPerShare / riskPerShare).toFixed(2));

  // 5. Arabic Explanatory Insights
  const keyPoints: string[] = [];
  if (currentRSI <= 35) {
    keyPoints.push(`مؤشر القوة النسبية RSI عند (${currentRSI.toFixed(1)}) يشير إلى تشبع بيعي حاد مما يدعم ارتداداً سعرياً إيجابياً.`);
  } else if (currentRSI >= 65) {
    keyPoints.push(`مؤشر RSI عند (${currentRSI.toFixed(1)}) يقترب من ذروة الشراء، مما يزيد احتمالية حدوث تصحيح هابط لجني الأرباح.`);
  } else {
    keyPoints.push(`مؤشر RSI متوازن ومحايد عند (${currentRSI.toFixed(1)}).`);
  }

  if (macdTrend === "BULLISH") {
    keyPoints.push("مؤشر MACD يعطي تسارعاً إيجابياً (زخم صاعد متزايد فوق خط الإشارة).");
  } else if (macdTrend === "BEARISH") {
    keyPoints.push("مؤشر MACD سلبي مع استمرار ضغط بيعي على حركة السعر.");
  }

  if (bollingerPosition === "OVERSOLD") {
    keyPoints.push(`السعر يلامس النطاق السفلي لبولينجر باند (${currentLowerBB.toFixed(2)}) مع ارتداد إحصائي متوقع.`);
  } else if (bollingerPosition === "OVERBOUGHT") {
    keyPoints.push(`السعر يتجاوز النطاق العلوي لبولينجر باند (${currentUpperBB.toFixed(2)}) محققاً تمدداً سعرياً مرتفعاً.`);
  }

  keyPoints.push(`نقطة الدعم الفنية المحورية: ${immediateSupport.toFixed(2)} جنيه، ومستوى المقاومة المستهدف: ${immediateResistance.toFixed(2)} جنيه.`);

  const headline =
    action === "STRONG_ACCUMULATE" || action === "ACCUMULATE"
      ? `إشارة تراكمية داعمة لشراء ${ticker} بنسبة ثقة ${confidenceScore}%`
      : action.startsWith("TAKE_PROFIT")
      ? `إشارة جني أرباح استباقية لـ ${ticker} بنسبة ثقة ${confidenceScore}%`
      : `حالة ترقب ومراقبة هادئة لـ ${ticker}`;

  const riskWarning =
    "تنويه هام: هذه الإشارات مبنية على نماذج كمية رياضية استرشادية بحتة ومخصصة للمحاكاة والتخطيط المالي للعائلة، وليست أمراً تنفيذياً ملزماً.";

  return {
    ticker,
    action,
    actionAr,
    confidenceScore,
    currentPrice: Number(currentPrice.toFixed(2)),
    entryZone: { min: entryMin, max: entryMax },
    targets: { t1, t2 },
    stopLoss,
    riskRewardRatio,
    indicators: {
      rsi: Number(currentRSI.toFixed(1)),
      macdHistogram: Number(currentHist.toFixed(4)),
      macdTrend,
      bollingerPosition,
      bollingerPercentB: Number(currentPercentB.toFixed(3)),
      trendEMA,
      volatilityATR: Number(currentATR.toFixed(2)),
      immediateSupport: Number(immediateSupport.toFixed(2)),
      immediateResistance: Number(immediateResistance.toFixed(2)),
    },
    arabicAnalysis: {
      headline,
      keyPoints,
      riskWarning,
    },
    generatedAt: new Date().toISOString(),
  };
}
