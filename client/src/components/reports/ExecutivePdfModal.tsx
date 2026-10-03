import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  ShieldCheck,
  Coins,
  Scale,
  Landmark,
  TrendingUp,
  Loader2,
  CheckCircle2,
  Calendar,
} from "lucide-react";

interface ExecutivePdfModalProps {
  trigger?: React.ReactNode;
  defaultPeriodKey?: string;
}

export function ExecutivePdfModal({ trigger, defaultPeriodKey = "2026-08" }: ExecutivePdfModalProps) {
  const [open, setOpen] = useState(false);
  const [periodKey, setPeriodKey] = useState<string>(defaultPeriodKey);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStepText, setProgressStepText] = useState("");

  const exportPdfMutation = trpc.family.reports.exportExecutivePdf.useMutation();
  const reportDataQuery = trpc.family.reports.executiveReportData.useQuery(
    { periodKey },
    {
      enabled: open,
      staleTime: 60_000,
    }
  );

  const formatMoney = (val: number | string | undefined, curr = "EGP") => {
    const num = Number(val || 0);
    return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  };

  const handleGeneratePdf = async () => {
    try {
      setIsGenerating(true);
      setProgress(15);
      setProgressStepText("1/5: جلب القيود المحاسبية وميزانية القيد المزدوج...");

      await new Promise((r) => setTimeout(r, 400));
      setProgress(38);
      setProgressStepText("2/5: استدعاء التغذية اللحظية لأسعار الذهب والعملات...");

      await new Promise((r) => setTimeout(r, 400));
      setProgress(65);
      setProgressStepText("3/5: تدقيق نصاب الـ 85 جرام عيار 24 واحتساب الزكاة الشرعية...");

      await new Promise((r) => setTimeout(r, 400));
      setProgress(85);
      setProgressStepText("4/5: بناء المخططات الهندسية ومؤشر درع التضخم...");

      // Execute actual PDF generation on server via headless Chromium
      const result = await exportPdfMutation.mutateAsync({ periodKey });

      setProgress(100);
      setProgressStepText("5/5: تم توليد التقرير وختم المستند بنجاح!");

      // Decode base64 and trigger download
      const byteCharacters = atob(result.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast.success("تم تصدير التقرير التنفيذي المالي بنجاح بصيغة PDF", {
        description: `الملف: ${result.filename} (${(result.sizeBytes / 1024).toFixed(1)} KB)`,
      });

      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        setProgressStepText("");
      }, 1500);
    } catch (err: any) {
      setIsGenerating(false);
      setProgress(0);
      setProgressStepText("");
      toast.error("تعذر توليد تقرير PDF", {
        description: err.message || "حدث خطأ غير متوقع أثناء تجميع التقرير.",
      });
    }
  };

  const data = reportDataQuery.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="default"
            size="sm"
            className="bg-linear-to-r from-amber-600 via-amber-700 to-indigo-900 hover:from-amber-700 hover:to-indigo-950 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer border border-amber-500/30"
          >
            <Sparkles className="size-4 text-amber-300 animate-pulse" />
            <span>تقرير الثروة التنفيذي (PDF)</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        dir="rtl"
        className="max-w-3xl bg-white dark:bg-[#0B0F17] border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl p-6 sm:p-7 shadow-2xl"
      >
        <DialogHeader className="text-right space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-linear-to-br from-amber-500/20 to-indigo-600/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <FileText className="size-5.5" />
              </div>
              <div className="text-right">
                <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>التقرير المالي التنفيذي الموحد</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                    Executive Wealth PDF
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  توليد مستند طباعي رسمي عالي الدقة يشمل المركز المالي، محفظة الذهب والعملات، وموقف الزكاة الشرعية.
                </DialogDescription>
              </div>
            </div>
            <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>ختم رقمي معتمد FWI</span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Period Selector */}
          <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-500" />
                <span>الفترة المالية المراد إغلاقها وتصديرها:</span>
              </label>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                {data ? `${data.dateGregorian} (${data.dateHijri})` : "3 أكتوبر 2026 (22 ربيع الآخر 1448 هـ)"}
              </span>
            </div>

            <Select value={periodKey} onValueChange={setPeriodKey} disabled={isGenerating}>
              <SelectTrigger className="w-full bg-white dark:bg-[#161F30] border-slate-300 dark:border-slate-700 text-xs font-bold rounded-lg py-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#161F30] border-slate-200 dark:border-slate-700 text-xs">
                <SelectItem value="2026-08">أغسطس 2026 (2026-08) - الإغلاق المالي الحالي</SelectItem>
                <SelectItem value="2026-07">يوليو 2026 (2026-07) - الشهر السابق</SelectItem>
                <SelectItem value="2026-Q3">الربع الثالث 2026 (2026-Q3)</SelectItem>
                <SelectItem value="2026-Q2">الربع الثاني 2026 (2026-Q2)</SelectItem>
                <SelectItem value="2026-Q1">الربع الأول 2026 (2026-Q1)</SelectItem>
                <SelectItem value="2026-FY">السنة المالية 2026 (2026-FY)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Metrics Preview */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 font-semibold block">صافي الثروة</span>
                <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                  {formatMoney(data.netWorth, data.baseCurrency)}
                </p>
              </div>

              <div className="bg-white dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 font-semibold block">السيولة النقدية</span>
                <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                  {formatMoney(data.cashAndEquivalents.total, data.baseCurrency)}
                </p>
              </div>

              <div className="bg-white dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 font-semibold block">ذهب عيار 24</span>
                <p className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                  {formatMoney(data.goldAndFx.karat24, "EGP")}
                </p>
              </div>

              <div className="bg-white dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 font-semibold block">الزكاة الواجبة</span>
                <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                  {formatMoney(data.zakat.zakatDueEgp, "EGP")}
                </p>
              </div>
            </div>
          )}

          {/* Progress Indicator during generation */}
          {isGenerating && (
            <div className="bg-slate-50 dark:bg-[#0E1420] border border-amber-500/30 rounded-xl p-4 space-y-2.5 animate-in fade-in-50 duration-300">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-amber-600" />
                  <span>{progressStepText}</span>
                </span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-200 dark:bg-slate-800" />
            </div>
          )}

          {/* Specifications Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-[#0B0F17] p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>غلاف تنفيذي فاخر وتاريخ مزدوج (هجري وميلادي)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>ميزانية عمومية مدققة ومطابقة للقيد المزدوج 100%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>أسعار الذهب اللحظية ونصاب الـ 85 جرام عيار 24</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>رسم بياني لتوزيع الأصول ومؤشر درع التضخم</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isGenerating}
            className="w-full sm:w-auto text-xs font-semibold rounded-xl"
          >
            إلغاء
          </Button>

          <Button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGenerating || reportDataQuery.isLoading}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>جاري معالجة وتوليد التقرير...</span>
              </>
            ) : (
              <>
                <Download className="size-4 text-amber-500" />
                <span>تحميل التقرير التنفيذي (PDF)</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
