import React from "react";

interface HealthRadialGaugeProps {
  score: number;
  tierLabel?: string;
  ratingTier?: string;
}

export const HealthRadialGauge: React.FC<HealthRadialGaugeProps> = ({
  score,
  tierLabel,
  ratingTier,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // 5 Health Tiers
  const getTierConfig = (s: number) => {
    if (s >= 90) {
      return {
        label: tierLabel || "مرونة استثنائية",
        badge: "استثنائي",
        startColor: "#06B6D4",
        endColor: "#38BDF8",
        glow: "rgba(6, 182, 212, 0.35)",
        badgeBg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
      };
    }
    if (s >= 75) {
      return {
        label: tierLabel || "قوي ومتماسك",
        badge: "قوي",
        startColor: "#10B981",
        endColor: "#34D399",
        glow: "rgba(16, 185, 129, 0.35)",
        badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      };
    }
    if (s >= 60) {
      return {
        label: tierLabel || "نمو متوازن",
        badge: "متوازن",
        startColor: "#F59E0B",
        endColor: "#FBBF24",
        glow: "rgba(245, 158, 11, 0.35)",
        badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      };
    }
    if (s >= 40) {
      return {
        label: tierLabel || "تحت المراقبة",
        badge: "هش",
        startColor: "#F97316",
        endColor: "#FB923C",
        glow: "rgba(249, 115, 22, 0.35)",
        badgeBg: "bg-orange-500/10 border-orange-500/30 text-orange-400",
      };
    }
    return {
      label: tierLabel || "حرج ويتطلب تدخلاً",
      badge: "حرج",
      startColor: "#EF4444",
      endColor: "#F87171",
      glow: "rgba(239, 68, 68, 0.35)",
      badgeBg: "bg-rose-500/10 border-rose-500/30 text-rose-400",
    };
  };

  const config = getTierConfig(clampedScore);

  // SVG Geometry:
  // Center = (140, 135), Radius = 100
  // Semicircle from (40, 135) to (240, 135)
  // Arc Length = PI * 100 = 314.159
  const radius = 100;
  const centerX = 140;
  const centerY = 135;
  const arcLength = Math.PI * radius; // ~314.16
  const strokeOffset = arcLength * (1 - clampedScore / 100);

  // Indicator Needle Dot Position:
  // Angle: 180 deg (score 0) down to 0 deg (score 100)
  const angleRad = Math.PI * (1 - clampedScore / 100);
  const dotX = centerX + radius * Math.cos(angleRad);
  const dotY = centerY - radius * Math.sin(angleRad);

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      {/* Glow Backdrop */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-20 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: config.startColor }}
      />

      <svg
        viewBox="0 0 280 165"
        className="w-full max-w-[280px] overflow-visible drop-shadow-sm select-none"
      >
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={config.startColor} />
            <stop offset="100%" stopColor={config.endColor} />
          </linearGradient>

          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="4"
              floodColor={config.startColor}
              floodOpacity="0.4"
            />
          </filter>
        </defs>

        {/* Outer subtle guide arc */}
        <path
          d="M 30 135 A 110 110 0 0 1 250 135"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 6"
          className="text-slate-300 dark:text-slate-700/60"
        />

        {/* Background Track */}
        <path
          d="M 40 135 A 100 100 0 0 1 240 135"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          className="text-slate-200 dark:text-slate-800/80"
        />

        {/* Active Progress Arc */}
        <path
          d="M 40 135 A 100 100 0 0 1 240 135"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeOffset}
          filter="url(#gaugeGlow)"
          className="transition-all duration-1000 ease-out"
        />

        {/* Glowing sweep dot on arc */}
        {clampedScore > 0 && clampedScore < 100 && (
          <g className="transition-all duration-1000 ease-out">
            <circle
              cx={dotX}
              cy={dotY}
              r="9"
              fill={config.endColor}
              className="animate-pulse"
              opacity="0.4"
            />
            <circle
              cx={dotX}
              cy={dotY}
              r="6"
              fill="#FFFFFF"
              stroke={config.endColor}
              strokeWidth="2.5"
            />
          </g>
        )}

        {/* Tick labels */}
        <text
          x="36"
          y="155"
          textAnchor="middle"
          className="text-[10px] font-mono font-medium fill-slate-400 dark:fill-slate-500 select-none"
        >
          0
        </text>
        <text
          x="140"
          y="26"
          textAnchor="middle"
          className="text-[10px] font-mono font-medium fill-slate-400 dark:fill-slate-500 select-none"
        >
          50
        </text>
        <text
          x="244"
          y="155"
          textAnchor="middle"
          className="text-[10px] font-mono font-medium fill-slate-400 dark:fill-slate-500 select-none"
        >
          100
        </text>
      </svg>

      {/* Numerical score and tier badge positioned in the semi-circle center */}
      <div className="-mt-16 flex flex-col items-center justify-center text-center z-10">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {clampedScore}
          </span>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            / 100
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${config.badgeBg}`}
          >
            {config.badge}
          </span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {config.label}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HealthRadialGauge;
