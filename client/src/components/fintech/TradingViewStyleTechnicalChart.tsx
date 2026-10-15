import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";

interface Props {
  symbol?: string;
  defaultTimeframe?: "1h" | "4h" | "1d" | "1w";
}

export function TradingViewStyleTechnicalChart({
  symbol = "COMI",
  defaultTimeframe = "1d",
}: Props) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const [timeframe, setTimeframe] = useState<"1h" | "4h" | "1d" | "1w">(defaultTimeframe);
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(true);
  const [showRsi, setShowRsi] = useState(true);

  const query = trpc.family.marketAlerts.getTechnicalAnalysis.useQuery(
    { symbol: selectedSymbol, timeframe },
    { staleTime: 30_000, refetchOnWindowFocus: false }
  );

  const data = query.data;
  const isLoading = query.isLoading;

  // SVG Chart Geometry calculations
  const chartMetrics = useMemo(() => {
    if (!data || !data.candles || data.candles.length === 0) return null;
    const candles = data.candles;
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const minPrice = Math.min(...lows) * 0.98;
    const maxPrice = Math.max(...highs) * 1.02;
    const priceRange = maxPrice - minPrice || 1;

    const width = 800;
    const mainHeight = 260;
    const rsiHeight = 90;
    const candleWidth = Math.max(4, Math.min(22, (width / candles.length) * 0.65));
    const stepX = width / Math.max(candles.length, 1);

    return {
      width,
      mainHeight,
      rsiHeight,
      minPrice,
      maxPrice,
      priceRange,
      candleWidth,
      stepX,
      candles,
    };
  }, [data]);

  const priceToY = (price: number) => {
    if (!chartMetrics) return 0;
    const norm = (price - chartMetrics.minPrice) / chartMetrics.priceRange;
    return chartMetrics.mainHeight - norm * (chartMetrics.mainHeight - 20) - 10;
  };

  const rsiToY = (val: number) => {
    if (!chartMetrics) return 0;
    const norm = Math.max(0, Math.min(100, val)) / 100;
    return chartMetrics.rsiHeight - norm * (chartMetrics.rsiHeight - 20) - 10;
  };

  return (
    <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs overflow-hidden" dir="rtl">
      {/* Header & Controls */}
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-800/60 flex items-center justify-center shrink-0">
              <BarChart2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                  {data?.symbol || selectedSymbol}
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono px-2 py-0.5">
                  {timeframe.toUpperCase()}
                </Badge>
                {data?.isStale && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200">
                    <Clock className="size-3 ml-1" />
                    سعر متقادم
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-0.5 text-slate-500">
                مخطط الشموع اليابانية (OHLCV) والمؤشرات الفنية الكمية المستقلة
              </CardDescription>
            </div>
          </div>

          {/* Quick Timeframe & Indicators Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-[#121826]">
              {(["1d", "1w"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md font-semibold transition-colors ${
                    timeframe === tf
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSma20(!showSma20)}
              className={`h-7 text-xs px-2 rounded-lg font-mono ${
                showSma20 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" : "text-slate-400"
              }`}
            >
              SMA 20
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSma50(!showSma50)}
              className={`h-7 text-xs px-2 rounded-lg font-mono ${
                showSma50 ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30" : "text-slate-400"
              }`}
            >
              SMA 50
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRsi(!showRsi)}
              className={`h-7 text-xs px-2 rounded-lg font-mono ${
                showRsi ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30" : "text-slate-400"
              }`}
            >
              RSI (14)
            </Button>
          </div>
        </div>

        {/* Current Technical KPI Strip */}
        {data && data.status === "available" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">آخر إغلاق:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                {data.latestPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">RSI (14):</span>
              <span
                className={`font-mono font-bold ${
                  data.indicators.rsiCondition === "oversold"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : data.indicators.rsiCondition === "overbought"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-700 dark:text-slate-300"
                }`}
                dir="ltr"
              >
                {data.indicators.rsi14 ? data.indicators.rsi14.toFixed(1) : "—"}
                {data.indicators.rsiCondition === "oversold" && " (تشبع بيعي)"}
                {data.indicators.rsiCondition === "overbought" && " (تشبع شرائي)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">SMA 20:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400" dir="ltr">
                {data.indicators.sma20 ? data.indicators.sma20.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">الاتجاه الفني:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {data.indicators.trend === "bullish_cross"
                  ? "تقاطع ذهبي إيجابي"
                  : data.indicators.trend === "bearish_cross"
                  ? "تقاطع هبوطي"
                  : data.indicators.trend === "bullish_trend"
                  ? "مسار صاعد"
                  : data.indicators.trend === "bearish_trend"
                  ? "مسار هابط"
                  : "حيادي"}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Chart Canvas Area */}
      <CardContent className="p-4 sm:p-5">
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : !data || data.status === "insufficient_data" || data.status === "invalid_candles" ? (
          <div className="py-16 text-center space-y-2">
            <Info className="size-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {data?.message || "بيانات الشموع التاريخية غير كافية لحساب المؤشرات الفنية."}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              تتطلب مؤشرات RSI والمتوسطات المتحركة 14 شمعة تداول موثقة على الأقل. التزاماً بالمعايير المؤسسية، لا يتم توليد شموع أو مؤشرات تقديرية وهمية.
            </p>
          </div>
        ) : chartMetrics ? (
          <div className="space-y-3">
            {/* Main Candlestick Panel */}
            <div className="relative border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-[#070A10] p-2 overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartMetrics.width} ${chartMetrics.mainHeight}`}
                className="w-full h-64 select-none overflow-visible"
              >
                {/* Gridlines */}
                {[0.25, 0.5, 0.75].map((ratio) => {
                  const y = chartMetrics.mainHeight * ratio;
                  const priceLabel = (chartMetrics.maxPrice - ratio * chartMetrics.priceRange).toFixed(1);
                  return (
                    <g key={ratio}>
                      <line
                        x1={0}
                        y1={y}
                        x2={chartMetrics.width}
                        y2={y}
                        stroke="#94a3b8"
                        strokeOpacity={0.15}
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartMetrics.width - 5}
                        y={y - 4}
                        fill="#94a3b8"
                        fontSize={10}
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {priceLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Candlesticks */}
                {chartMetrics.candles.map((candle, idx) => {
                  const x = idx * chartMetrics.stepX + chartMetrics.stepX / 2;
                  const isUp = candle.close >= candle.open;
                  const topBodyPrice = isUp ? candle.close : candle.open;
                  const bottomBodyPrice = isUp ? candle.open : candle.close;
                  const yTop = priceToY(topBodyPrice);
                  const yBottom = priceToY(bottomBodyPrice);
                  const bodyHeight = Math.max(2, yBottom - yTop);
                  const yHigh = priceToY(candle.high);
                  const yLow = priceToY(candle.low);
                  const color = isUp ? "#10B981" : "#EF4444";

                  return (
                    <g key={candle.timestamp}>
                      {/* High-Low Wick */}
                      <line
                        x1={x}
                        y1={yHigh}
                        x2={x}
                        y2={yLow}
                        stroke={color}
                        strokeWidth={1.5}
                      />
                      {/* Real Body */}
                      <rect
                        x={x - chartMetrics.candleWidth / 2}
                        y={yTop}
                        width={chartMetrics.candleWidth}
                        height={bodyHeight}
                        fill={color}
                        rx={1}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Separate RSI Sub-Panel */}
            {showRsi && data.indicators.rsi14 !== null && (
              <div className="relative border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-[#070A10] p-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1 px-1">
                  <span>RSI (14 Wilder)</span>
                  <span className="font-bold">{data.indicators.rsi14.toFixed(1)}</span>
                </div>
                <svg
                  viewBox={`0 0 ${chartMetrics.width} ${chartMetrics.rsiHeight}`}
                  className="w-full h-20 select-none overflow-visible"
                >
                  {/* 70 Overbought dashed boundary */}
                  <line
                    x1={0}
                    y1={rsiToY(70)}
                    x2={chartMetrics.width}
                    y2={rsiToY(70)}
                    stroke="#EF4444"
                    strokeOpacity={0.4}
                    strokeDasharray="3 3"
                  />
                  {/* 30 Oversold dashed boundary */}
                  <line
                    x1={0}
                    y1={rsiToY(30)}
                    x2={chartMetrics.width}
                    y2={rsiToY(30)}
                    stroke="#10B981"
                    strokeOpacity={0.4}
                    strokeDasharray="3 3"
                  />
                  {/* 50 Center reference */}
                  <line
                    x1={0}
                    y1={rsiToY(50)}
                    x2={chartMetrics.width}
                    y2={rsiToY(50)}
                    stroke="#94a3b8"
                    strokeOpacity={0.15}
                  />

                  {/* RSI Current Indicator Needle / Dot */}
                  <circle
                    cx={chartMetrics.width - 20}
                    cy={rsiToY(data.indicators.rsi14)}
                    r={4}
                    fill="#6366F1"
                  />
                </svg>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
