import React, { useMemo, useState } from "react";
import { formatStandardDate } from "@/lib/financialDisplay";

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timestamp?: number;
}

export interface CandlestickChartProps {
  candles: CandleData[];
  ema20?: number[];
  ema50?: number[];
  rsi14?: number[];
  supports?: number[];
  resistances?: number[];
  entryPrice?: number | null;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
  symbol?: string;
  currency?: string;
  timeframe?: string;
  height?: number;
}

export function CandlestickChart({
  candles,
  ema20 = [],
  ema50 = [],
  rsi14 = [],
  supports = [],
  resistances = [],
  entryPrice,
  stopLossPrice,
  takeProfitPrice,
  symbol = "EGX",
  currency = "EGP",
  timeframe = "D1 (يومي)",
  height = 420,
}: CandlestickChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Layout sizing
  const width = 800; // SVG coordinate system
  const priceChartHeight = Math.round(height * 0.65);
  const volumeChartHeight = Math.round(height * 0.15);
  const rsiChartHeight = Math.round(height * 0.20);
  const paddingRight = 65; // Price scale margin on the right
  const paddingLeft = 15;
  const chartWidth = width - paddingRight - paddingLeft;

  // Calculate Price domain (Min Low, Max High)
  const { minPrice, maxPrice, priceRange, maxVolume } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100, maxVolume: 100 };
    }

    let min = Math.min(...candles.map(c => c.low));
    let max = Math.max(...candles.map(c => c.high));

    if (entryPrice) {
      min = Math.min(min, entryPrice);
      max = Math.max(max, entryPrice);
    }
    if (stopLossPrice) {
      min = Math.min(min, stopLossPrice);
      max = Math.max(max, stopLossPrice);
    }
    if (takeProfitPrice) {
      min = Math.min(min, takeProfitPrice);
      max = Math.max(max, takeProfitPrice);
    }

    const padding = (max - min) * 0.08 || 1;
    const boundedMin = Math.max(0, min - padding);
    const boundedMax = max + padding;
    const vol = Math.max(1, ...candles.map(c => c.volume ?? 0));

    return {
      minPrice: boundedMin,
      maxPrice: boundedMax,
      priceRange: boundedMax - boundedMin || 1,
      maxVolume: vol,
    };
  }, [candles, entryPrice, stopLossPrice, takeProfitPrice]);

  const candleWidth = useMemo(() => {
    if (candles.length === 0) return 6;
    const available = chartWidth / candles.length;
    return Math.max(2, Math.min(14, available * 0.7));
  }, [chartWidth, candles.length]);

  const getX = (index: number) => {
    if (candles.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (candles.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    const ratio = (price - minPrice) / priceRange;
    return priceChartHeight - ratio * priceChartHeight;
  };

  const getRsiY = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return priceChartHeight + volumeChartHeight + (1 - clamped / 100) * rsiChartHeight;
  };

  // Build EMA paths
  const ema20Path = useMemo(() => {
    let path = "";
    ema20.forEach((val, i) => {
      if (Number.isNaN(val) || val === null || val === undefined) return;
      const x = getX(i);
      const y = getY(val);
      if (!path) path = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return path;
  }, [ema20, minPrice, priceRange, chartWidth]);

  const ema50Path = useMemo(() => {
    let path = "";
    ema50.forEach((val, i) => {
      if (Number.isNaN(val) || val === null || val === undefined) return;
      const x = getX(i);
      const y = getY(val);
      if (!path) path = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return path;
  }, [ema50, minPrice, priceRange, chartWidth]);

  // Build RSI path
  const rsiPath = useMemo(() => {
    let path = "";
    rsi14.forEach((val, i) => {
      if (Number.isNaN(val) || val === null || val === undefined) return;
      const x = getX(i);
      const y = getRsiY(val);
      if (!path) path = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return path;
  }, [rsi14, chartWidth]);

  const hoveredCandle = hoverIndex !== null && candles[hoverIndex] ? candles[hoverIndex] : null;
  const hoveredEma20 = hoverIndex !== null && ema20[hoverIndex] ? ema20[hoverIndex] : null;
  const hoveredEma50 = hoverIndex !== null && ema50[hoverIndex] ? ema50[hoverIndex] : null;
  const hoveredRsi = hoverIndex !== null && rsi14[hoverIndex] ? rsi14[hoverIndex] : null;

  // Horizontal price grid lines
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const price = minPrice + ratio * priceRange;
    const y = priceChartHeight - ratio * priceChartHeight;
    return { price, y };
  });

  return (
    <div className="relative w-full rounded-xl border border-slate-800 bg-slate-950/90 backdrop-blur-md p-4 text-slate-100 shadow-2xl select-none">
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-base font-bold tracking-wide text-amber-400 font-mono">{symbol}</span>
          <span className="rounded-md bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 text-xs text-slate-200 font-medium font-mono">
            {currency}
          </span>
          <span className="rounded-md bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 text-xs text-slate-200 font-medium">
            {timeframe}
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-mono text-cyan-300 font-medium bg-cyan-950/40 border border-cyan-800/60 px-2 py-0.5 rounded">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              EMA 20 {hoveredEma20 ? `: ${hoveredEma20.toFixed(2)}` : ""}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-purple-300 font-medium bg-purple-950/40 border border-purple-800/60 px-2 py-0.5 rounded">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              EMA 50 {hoveredEma50 ? `: ${hoveredEma50.toFixed(2)}` : ""}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-amber-300 font-medium bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              RSI (14) {hoveredRsi ? `: ${hoveredRsi.toFixed(1)}` : ""}
            </span>
          </div>
        </div>

        {/* OHLC Bar Inspector */}
        {hoveredCandle ? (
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 shadow-md text-white">
            <span className="text-slate-200 font-medium border-l border-slate-700 pl-2.5">
              {hoveredCandle.timestamp ? formatStandardDate(hoveredCandle.timestamp) : "—"}
            </span>
            <span>
              O: <b className="text-white font-bold">{hoveredCandle.open.toFixed(2)}</b>
            </span>
            <span>
              H: <b className="text-emerald-400 font-bold">{hoveredCandle.high.toFixed(2)}</b>
            </span>
            <span>
              L: <b className="text-rose-400 font-bold">{hoveredCandle.low.toFixed(2)}</b>
            </span>
            <span>
              C:{" "}
              <b
                className={
                  hoveredCandle.close >= hoveredCandle.open ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"
                }
              >
                {hoveredCandle.close.toFixed(2)}
              </b>
            </span>
            {hoveredCandle.volume ? (
              <span className="text-slate-300 border-r border-slate-700 pr-2.5">
                Vol: <b className="text-white font-semibold">{hoveredCandle.volume.toLocaleString("en-US")}</b>
              </span>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-slate-200 font-medium flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800">
            مرر المؤشر فوق الشموع لعرض تفاصيل الأسعار
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
        {/* Floating Tooltip Near Cursor */}
        {hoverIndex !== null && hoveredCandle && (
          <div
            className="pointer-events-none absolute top-2 z-20 hidden sm:block rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs font-mono text-white shadow-xl backdrop-blur"
            style={{
              left: ((getX(hoverIndex) / width) * 100) > 65 ? undefined : `${((getX(hoverIndex) / width) * 100) + 2}%`,
              right: ((getX(hoverIndex) / width) * 100) > 65 ? `${100 - ((getX(hoverIndex) / width) * 100) + 2}%` : undefined,
            }}
          >
            <div className="text-[11px] font-sans font-medium text-slate-200 border-b border-slate-700/80 pb-1 mb-1">
              {hoveredCandle.timestamp ? formatStandardDate(hoveredCandle.timestamp) : "—"}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-slate-300">افتتاح:</span>
              <span className="font-bold text-white text-left">{hoveredCandle.open.toFixed(2)}</span>
              <span className="text-slate-300">أعلى:</span>
              <span className="font-bold text-emerald-400 text-left">{hoveredCandle.high.toFixed(2)}</span>
              <span className="text-slate-300">أدنى:</span>
              <span className="font-bold text-rose-400 text-left">{hoveredCandle.low.toFixed(2)}</span>
              <span className="text-slate-300">إغلاق:</span>
              <span
                className={`font-bold text-left ${
                  hoveredCandle.close >= hoveredCandle.open ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {hoveredCandle.close.toFixed(2)}
              </span>
              {hoveredCandle.volume ? (
                <>
                  <span className="text-slate-300">الحجم:</span>
                  <span className="font-bold text-slate-200 text-left">
                    {hoveredCandle.volume.toLocaleString("en-US")}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * width;
            const relativeX = mouseX - paddingLeft;
            const index = Math.round((relativeX / chartWidth) * (candles.length - 1));
            if (index >= 0 && index < candles.length) {
              setHoverIndex(index);
            }
          }}
        >
          <defs>
            <linearGradient id="rsiOverboughtGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rsiOversoldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines & Scale Labels */}
          {gridTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="#1e293b"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={width - paddingRight + 6}
                y={tick.y + 4}
                fill="#64748b"
                fontSize="10"
                fontFamily="monospace"
              >
                {tick.price.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Support and Resistance Horizontal Guides */}
          {supports.map((s, i) => {
            const y = getY(s);
            if (y < 0 || y > priceChartHeight) return null;
            return (
              <g key={`sup-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
                <text
                  x={paddingLeft + 4}
                  y={y - 3}
                  fill="#10b981"
                  fontSize="9"
                  opacity="0.75"
                  fontFamily="monospace"
                >
                  دعم: {s.toFixed(2)}
                </text>
              </g>
            );
          })}

          {resistances.map((r, i) => {
            const y = getY(r);
            if (y < 0 || y > priceChartHeight) return null;
            return (
              <g key={`res-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f43f5e"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
                <text
                  x={paddingLeft + 4}
                  y={y - 3}
                  fill="#f43f5e"
                  fontSize="9"
                  opacity="0.75"
                  fontFamily="monospace"
                >
                  مقاومة: {r.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Active Trade Plan Target Overlays */}
          {entryPrice ? (
            <g>
              <line
                x1={paddingLeft}
                y1={getY(entryPrice)}
                x2={width - paddingRight}
                y2={getY(entryPrice)}
                stroke="#3b82f6"
                strokeWidth="1.5"
              />
              <rect
                x={width - paddingRight + 2}
                y={getY(entryPrice) - 8}
                width={56}
                height={16}
                rx={3}
                fill="#1d4ed8"
              />
              <text
                x={width - paddingRight + 6}
                y={getY(entryPrice) + 4}
                fill="#ffffff"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {entryPrice.toFixed(2)}
              </text>
            </g>
          ) : null}

          {stopLossPrice ? (
            <g>
              <line
                x1={paddingLeft}
                y1={getY(stopLossPrice)}
                x2={width - paddingRight}
                y2={getY(stopLossPrice)}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <rect
                x={width - paddingRight + 2}
                y={getY(stopLossPrice) - 8}
                width={56}
                height={16}
                rx={3}
                fill="#be123c"
              />
              <text
                x={width - paddingRight + 6}
                y={getY(stopLossPrice) + 4}
                fill="#ffffff"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                SL {stopLossPrice.toFixed(2)}
              </text>
            </g>
          ) : null}

          {takeProfitPrice ? (
            <g>
              <line
                x1={paddingLeft}
                y1={getY(takeProfitPrice)}
                x2={width - paddingRight}
                y2={getY(takeProfitPrice)}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <rect
                x={width - paddingRight + 2}
                y={getY(takeProfitPrice) - 8}
                width={56}
                height={16}
                rx={3}
                fill="#047857"
              />
              <text
                x={width - paddingRight + 6}
                y={getY(takeProfitPrice) + 4}
                fill="#ffffff"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                TP {takeProfitPrice.toFixed(2)}
              </text>
            </g>
          ) : null}

          {/* Candlestick Glyphs */}
          {candles.map((c, i) => {
            const x = getX(i);
            const isBullish = c.close >= c.open;
            const candleColor = isBullish ? "#10b981" : "#ef4444";
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            return (
              <g key={`candle-${i}`}>
                {/* Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={candleColor}
                  strokeWidth="1.2"
                />
                {/* Real Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={isBullish ? "#10b981" : "#ef4444"}
                  stroke={candleColor}
                  strokeWidth="1"
                  rx={1}
                />
              </g>
            );
          })}

          {/* EMA Curves */}
          {ema20Path ? (
            <path d={ema20Path} fill="none" stroke="#06b6d4" strokeWidth="1.75" opacity="0.9" />
          ) : null}
          {ema50Path ? (
            <path d={ema50Path} fill="none" stroke="#a855f7" strokeWidth="1.75" opacity="0.9" />
          ) : null}

          {/* Volume Histogram Separator */}
          <line
            x1={paddingLeft}
            y1={priceChartHeight}
            x2={width - paddingRight}
            y2={priceChartHeight}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Volume Bars */}
          {candles.map((c, i) => {
            if (!c.volume) return null;
            const x = getX(i);
            const isBullish = c.close >= c.open;
            const barHeight = (c.volume / maxVolume) * (volumeChartHeight - 6);
            const y = priceChartHeight + volumeChartHeight - barHeight;

            return (
              <rect
                key={`vol-${i}`}
                x={x - candleWidth / 2}
                y={y}
                width={candleWidth}
                height={barHeight}
                fill={isBullish ? "#10b981" : "#ef4444"}
                opacity="0.35"
              />
            );
          })}
          <text
            x={width - paddingRight + 6}
            y={priceChartHeight + 14}
            fill="#64748b"
            fontSize="9"
            fontFamily="monospace"
          >
            VOL
          </text>

          {/* RSI Oscillator Subplot */}
          <line
            x1={paddingLeft}
            y1={priceChartHeight + volumeChartHeight}
            x2={width - paddingRight}
            y2={priceChartHeight + volumeChartHeight}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* RSI Thresholds: 70 Overbought & 30 Oversold */}
          <line
            x1={paddingLeft}
            y1={getRsiY(70)}
            x2={width - paddingRight}
            y2={getRsiY(70)}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeWidth="1"
            opacity="0.6"
          />
          <text
            x={width - paddingRight + 6}
            y={getRsiY(70) + 3}
            fill="#ef4444"
            fontSize="8"
            fontFamily="monospace"
          >
            70
          </text>

          <line
            x1={paddingLeft}
            y1={getRsiY(50)}
            x2={width - paddingRight}
            y2={getRsiY(50)}
            stroke="#64748b"
            strokeDasharray="2 2"
            strokeWidth="1"
            opacity="0.3"
          />

          <line
            x1={paddingLeft}
            y1={getRsiY(30)}
            x2={width - paddingRight}
            y2={getRsiY(30)}
            stroke="#10b981"
            strokeDasharray="3 3"
            strokeWidth="1"
            opacity="0.6"
          />
          <text
            x={width - paddingRight + 6}
            y={getRsiY(30) + 3}
            fill="#10b981"
            fontSize="8"
            fontFamily="monospace"
          >
            30
          </text>

          {/* RSI Curve */}
          {rsiPath ? (
            <path d={rsiPath} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.9" />
          ) : null}

          {/* Crosshair Cursor on Hover */}
          {hoverIndex !== null ? (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={0}
                x2={getX(hoverIndex)}
                y2={height}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.75"
              />
            </g>
          ) : null}
        </svg>
      </div>

      {/* Footer Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200 border-t border-slate-800 pt-2.5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> شمعة صاعدة (شراء)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-200">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> شمعة هابطة (بيع)
          </span>
          <span className="flex items-center gap-1.5 font-mono text-cyan-300 font-medium">
            ─ متوسط 20 يوم (EMA)
          </span>
          <span className="flex items-center gap-1.5 font-mono text-purple-300 font-medium">
            ─ متوسط 50 يوم (EMA)
          </span>
          <span className="flex items-center gap-1.5 font-mono text-amber-300 font-medium">
            ─ مؤشر القوة النسبية (RSI 14)
          </span>
        </div>
        <div className="text-[11px] text-slate-300 font-medium">
          جلسة البورصة المصرية (EGX): الأحد إلى الخميس | إغلاق 02:30 م
        </div>
      </div>
    </div>
  );
}
