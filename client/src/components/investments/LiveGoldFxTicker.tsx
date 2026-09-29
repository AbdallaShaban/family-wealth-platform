import React from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Coins, DollarSign, Euro, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

export function LiveGoldFxTicker() {
  const utils = trpc.useUtils();
  const liveQuery = trpc.family.market.liveGoldAndFx.useQuery(undefined, {
    refetchInterval: 60_000, // Auto-poll every 60s
    staleTime: 30_000,
  });

  const refreshMutation = trpc.family.market.refreshLiveFeed.useMutation({
    onSuccess: (res) => {
      toast.success("تم تحديث أسعار الذهب والعملات وإعادة تقييم المحفظة بنجاح");
      utils.family.market.liveGoldAndFx.invalidate();
      utils.family.portfolio.list.invalidate();
      utils.quant.getShariaZakat.invalidate();
      utils.quant.getEgyptMarket.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر تحديث الأسعار لحظياً، يتم استخدام آخر تسعير مسجل.");
    },
  });

  const data = liveQuery.data;

  const handleManualRefresh = () => {
    refreshMutation.mutate();
  };

  const isRefreshing = liveQuery.isFetching || refreshMutation.isPending;

  return (
    <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Coins className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                تغذية أسعار الذهب والعملات اللحظية (Live Gold & FX Feed)
              </h3>
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold gap-1.5 px-2 py-0.5 rounded-full ${
                  data?.isLive
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    data?.isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span>{data?.isLive ? "بث لحظي مباشر" : "آخر تسعير مسجل"}</span>
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>المصدر: {data?.source || "سوق الصاغة والبورصة العالمية"}</span>
              <span>·</span>
              <Clock className="size-3" />
              <span>آخر تحديث: {data?.lastUpdatedFormattedAr || "جارٍ الجلب..."}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="text-xs h-8 px-3 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            <span>{isRefreshing ? "جارٍ التحديث..." : "تحديث فوري"}</span>
          </Button>
        </div>
      </div>

      {/* Grid of 6 Rate Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Gold 24k */}
        <div className="bg-slate-50/70 dark:bg-[#0B0F17] rounded-xl p-3 border border-slate-200/70 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span>ذهب عيار 24</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">سبائك</span>
          </div>
          <div className="text-base font-black font-mono text-slate-950 dark:text-white tabular-nums" dir="ltr">
            {data?.karat24 ? `${data.karat24.toLocaleString("en-US")} EGP` : "—"}
          </div>
          <div className="text-[10px] text-slate-400">لجرام السبيكة</div>
        </div>

        {/* 2. Gold 21k */}
        <div className="bg-slate-50/70 dark:bg-[#0B0F17] rounded-xl p-3 border border-slate-200/70 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span>ذهب عيار 21</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">مصاغ/جنيه</span>
          </div>
          <div className="text-base font-black font-mono text-slate-950 dark:text-white tabular-nums" dir="ltr">
            {data?.karat21 ? `${data.karat21.toLocaleString("en-US")} EGP` : "—"}
          </div>
          <div className="text-[10px] text-slate-400">لجرام المشغولات</div>
        </div>

        {/* 3. Gold 18k */}
        <div className="bg-slate-50/70 dark:bg-[#0B0F17] rounded-xl p-3 border border-slate-200/70 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span>ذهب عيار 18</span>
            <span className="text-[10px] text-slate-400 font-mono">حلي</span>
          </div>
          <div className="text-base font-black font-mono text-slate-950 dark:text-white tabular-nums" dir="ltr">
            {data?.karat18 ? `${data.karat18.toLocaleString("en-US")} EGP` : "—"}
          </div>
          <div className="text-[10px] text-slate-400">لجرام الحلي</div>
        </div>

        {/* 4. Gold Sovereign */}
        <div className="bg-slate-50/70 dark:bg-[#0B0F17] rounded-xl p-3 border border-slate-200/70 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span>الجنيه الذهب</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">8 جرام 21k</span>
          </div>
          <div className="text-base font-black font-mono text-slate-950 dark:text-white tabular-nums" dir="ltr">
            {data?.sovereignEgp ? `${data.sovereignEgp.toLocaleString("en-US")} EGP` : "—"}
          </div>
          <div className="text-[10px] text-slate-400">وزن 8 جرامات</div>
        </div>

        {/* 5. USD / EGP */}
        <div className="bg-slate-50/70 dark:bg-[#0B0F17] rounded-xl p-3 border border-slate-200/70 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <DollarSign className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>USD / EGP</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">سعر الصرف</span>
          </div>
          <div className="text-base font-black font-mono text-slate-950 dark:text-white tabular-nums" dir="ltr">
            {data?.usdEgpRate ? `${data.usdEgpRate.toFixed(2)} EGP` : "—"}
          </div>
          <div className="text-[10px] text-slate-400">لكل 1 دولار أمريكي</div>
        </div>

        {/* 6. EUR / EGP */}
        <div className="bg-slate-50/70 dark:bg-[#0B0F17] rounded-xl p-3 border border-slate-200/70 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <Euro className="size-3 text-sky-600 dark:text-sky-400" />
              <span>EUR / EGP</span>
            </span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">سعر الصرف</span>
          </div>
          <div className="text-base font-black font-mono text-slate-950 dark:text-white tabular-nums" dir="ltr">
            {data?.eurEgpRate ? `${data.eurEgpRate.toFixed(2)} EGP` : "—"}
          </div>
          <div className="text-[10px] text-slate-400">لكل 1 يورو أوروبي</div>
        </div>
      </div>
    </div>
  );
}
