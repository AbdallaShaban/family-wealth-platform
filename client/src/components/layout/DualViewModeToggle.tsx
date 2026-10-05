import React from "react";
import { useViewMode } from "@/contexts/ViewModeContext";
import { Users, LineChart, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DualViewModeToggle({ className }: { className?: string }) {
  const { isFamilyMode, toggleViewMode } = useViewMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleViewMode}
          className={
            className ||
            `fintech-topbar-button flex items-center gap-1.5 px-2.5 transition-all text-xs font-bold rounded-lg border shadow-xs ${
              isFamilyMode
                ? "bg-emerald-500/15 border-emerald-500/35 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300"
                : "bg-blue-500/15 border-blue-500/35 hover:bg-blue-500/25 text-blue-800 dark:text-blue-300"
            }`
          }
          aria-label={
            isFamilyMode
              ? "الوضع العائلي البسيط مفعل، انقر للتحويل إلى الوضع المتقدم"
              : "الوضع المتقدم مفعل، انقر للتحويل إلى الوضع العائلي"
          }
        >
          {isFamilyMode ? (
            <>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <Users className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-[11px]">عائلي بسيط</span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-blue-500" />
              <LineChart className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-bold text-[11px]">متقدم Pro</span>
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" dir="rtl" className="text-xs max-w-xs p-2.5">
        <div className="font-bold mb-1">
          {isFamilyMode ? "🟢 الوضع العائلي البسيط (Family Mode)" : "🔵 وضع المستشار المتقدم (Pro Mode)"}
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {isFamilyMode
            ? "يركز على الكاش المتاح للصرف اليومي، مصروفات البيت، ومدخرات الذهب والديون بلغة واضحة دون تعقيد محاسبي. انقر للتبديل للمتقدم."
            : "يتيح كافة تفاصيل القيود الدفترية، التحليل الكمي، واختبارات الضغط والمخاطر. انقر للتبديل للعائلي."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function DualViewModeDrawerItem() {
  const { isFamilyMode, toggleViewMode } = useViewMode();

  return (
    <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3 text-right">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
          {isFamilyMode ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Users className="size-3.5" />
              الوضع العائلي البسيط
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <LineChart className="size-3.5" />
              وضع المستشار المتقدم
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {isFamilyMode ? "عرض مريح يركز على الكاش ومصاريف البيت" : "عرض مالي متكامل للتحليل والقيود الدفترية"}
        </div>
      </div>
      <button
        onClick={toggleViewMode}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border ${
          isFamilyMode
            ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
            : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
        }`}
      >
        {isFamilyMode ? "تفعيل Pro" : "تفعيل العائلي"}
      </button>
    </div>
  );
}
