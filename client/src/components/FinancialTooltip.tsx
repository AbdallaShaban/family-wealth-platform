import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const FINANCIAL_DEFINITIONS: Record<
  string,
  { title: string; definition: string; tag?: string }
> = {
  TWR: {
    title: "العائد المرجح زمنياً (TWR)",
    definition:
      "يقيس الأداء الاستثماري المحض لمدير المحفظة أو الأصول باستبعاد أثر توقيت وحجم التدفقات النقدية الداخلة والخارجة، وهو معيار GIPS المعتمد دوليًا.",
    tag: "GIPS Standard",
  },
  MWR: {
    title: "العائد المرجح بالتدفقات النقدية (MWR / IRR)",
    definition:
      "يعكس العائد الفعلي للمستثمر شاملاً أثر توقيت وحجم الإيداعات والسحوبات النقدية الفعلية ومعدل العائد الداخلي على رأس المال المستثمر.",
    tag: "Investor Yield",
  },
  FIFO: {
    title: "محاسبة الحصص (FIFO Lot Accounting)",
    definition:
      "قاعدة الوارد أولاً يُصرف أولاً: الحصص المكتسبة أولاً هي التي تُقابَل صفقات البيع بها، لتوثيق أساس التكلفة وحساب الربح أو الخسارة المحققة بدقة.",
    tag: "Accounting Rule",
  },
  VaR: {
    title: "القيمة المعرضة للمخاطر (Value at Risk)",
    definition:
      "تقدير إحصائي لأقصى خسارة مالية متوقعة خلال فترة زمنية محددة (شهر أو سنة) عند مستوى ثقة معين (مثل 95% أو 99%) استناداً لنمذجة مونت كارلو.",
    tag: "Risk Metric",
  },
  CVaR: {
    title: "القيمة الشرطية المعرضة للمخاطر (CVaR / Expected Shortfall)",
    definition:
      "متوسط الخسارة المالية في حال تحقق سيناريو أسوأ من حد VaR؛ أي قياس عمق الخسارة في ذيل التوزيع الإحصائي.",
    tag: "Tail Risk",
  },
  BALANCED_JOURNAL: {
    title: "دفتر القيود المتوازن (Double-Entry Balanced Journal)",
    definition:
      "نظام محاسبي لا يقبل إلا قيوداً متساوية في جانبي المدين والدائن. لا يتم تغيير رصيد أي حساب دون قيد مالي معتمد وأثر تدقيقي كامل.",
    tag: "Core Accounting",
  },
  FIRE_SCORE: {
    title: "مؤشر الاستقلال المالي (FIRE Readiness Score)",
    definition:
      "مقياس رقمي موحد (0-100) يقيس مدى تغطية الأصول الاستثمارية والمصادر المستدامة للنفقات السنوية الأساسية وفق معدل سحب آمن واحتياطي سيولة.",
    tag: "Wealth Resilience",
  },
  ALLOCATION_DRIFT: {
    title: "انحراف التخصيص (Allocation Drift)",
    definition:
      "الفارق النسبي بين التوزيع الفعلي المقيم لفئة الأصول والتوزيع المستهدف في الاستراتيجية، لتنبيه المستشار بضرورة إعادة التوازن دون أوامر آلية.",
    tag: "Portfolio Strategy",
  },
  CHOLESKY: {
    title: "الترابط المالي ومصفوفة شوليسكي (Cholesky Correlation)",
    definition:
      "معادلة جبرية تضمن عدم توليد عوائد عشوائية مستقلة لكل أصل، بل محاكاة حركة الأسواق مع احترام الترابط الإحصائي التاريخي بين الأسهم والسندات والذهب والسيولة.",
    tag: "Quantitative Modeling",
  },
};

export interface FinancialTooltipProps {
  term: keyof typeof FINANCIAL_DEFINITIONS | string;
  customTitle?: string;
  customDefinition?: string;
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

export function FinancialTooltip({
  term,
  customTitle,
  customDefinition,
  children,
  className,
  showIcon = true,
}: FinancialTooltipProps) {
  const info = FINANCIAL_DEFINITIONS[term];
  const title = customTitle || info?.title || term;
  const definition = customDefinition || info?.definition || "";
  const tag = info?.tag;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 transition hover:text-foreground",
              className
            )}
          >
            {children || term}
            {showIcon && <Info className="size-3 text-muted-foreground/70 shrink-0" />}
          </span>
        </TooltipTrigger>
        <TooltipContent
          dir="rtl"
          side="top"
          align="center"
          className="max-w-xs space-y-1.5 p-3 text-right bg-slate-900 text-slate-100 border-slate-800 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <strong className="text-xs font-semibold text-emerald-400">{title}</strong>
            {tag && (
              <span className="text-[10px] rounded-sm bg-slate-800 px-1.5 py-0.5 text-slate-300 font-mono">
                {tag}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-300">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default FinancialTooltip;
