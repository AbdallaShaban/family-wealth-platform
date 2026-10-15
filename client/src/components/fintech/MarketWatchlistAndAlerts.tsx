import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/financialDisplay";
import {
  Bell,
  BellRing,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Eye,
} from "lucide-react";

export function MarketWatchlistAndAlerts({ onSelectSymbol }: { onSelectSymbol?: (symbol: string) => void }) {
  const utils = trpc.useUtils();
  const watchlistQuery = trpc.family.marketAlerts.getWatchlist.useQuery();
  const alertsQuery = trpc.family.marketAlerts.listAlertRules.useQuery();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [alertType, setAlertType] = useState<"price_above" | "price_below" | "rsi_oversold" | "rsi_overbought">("price_above");
  const [threshold, setThreshold] = useState("");
  const [notifyTelegram, setNotifyTelegram] = useState(true);

  const createAlertMutation = trpc.family.marketAlerts.createAlertRule.useMutation({
    onSuccess: () => {
      toast.success("تم تفعيل قاعدة التنبيه بنجاح.");
      setCreateModalOpen(false);
      setThreshold("");
      void utils.family.marketAlerts.listAlertRules.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر إنشاء التنبيه.");
    },
  });

  const deleteAlertMutation = trpc.family.marketAlerts.deleteAlertRule.useMutation({
    onSuccess: () => {
      toast.success("تم حذف التنبيه.");
      void utils.family.marketAlerts.listAlertRules.invalidate();
    },
  });

  const evaluateMutation = trpc.family.marketAlerts.evaluateAlerts.useMutation({
    onSuccess: (res) => {
      if (res.triggeredEvents.length > 0) {
        toast.info(`تم إطلاق ${res.triggeredEvents.length} تنبيه(ات) جديدة.`);
      } else {
        toast.success(`تم فحص ${res.evaluatedCount} قاعدة تنبيه؛ جميع الأسعار ضمن الحدود المحددة.`);
      }
      void utils.family.marketAlerts.listAlertRules.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر فحص التنبيهات.");
    },
  });

  const handleOpenCreate = (item: { symbol: string; name: string; latestPrice: number }) => {
    setSelectedSymbol(item.symbol);
    setSelectedName(item.name);
    setThreshold(item.latestPrice > 0 ? String(item.latestPrice) : "");
    setCreateModalOpen(true);
  };

  const watchlist = watchlistQuery.data ?? [];
  const alertRules = alertsQuery.data ?? [];

  return (
    <div className="space-y-6" dir="rtl">
      {/* SECTION 1: Active Alert Rules Strip */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                <BellRing className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>تنبيهات الأسعار والمؤشرات الفنية (Price & Tech Alerts)</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {alertRules.length} قاعدة
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5 text-slate-500">
                  تنبيهات لحظية مؤمنة ضد التكرار العشوائي (Anti-Spam) ومتكاملة مع بوت تيليجرام
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => evaluateMutation.mutate()}
                disabled={evaluateMutation.isPending || alertRules.length === 0}
                className="h-8 text-xs font-semibold rounded-xl gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${evaluateMutation.isPending ? "animate-spin" : ""}`} />
                <span>فحص التنبيهات الآن</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {alertsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : alertRules.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              لا توجد تنبيهات نشطة حالياً. انقر على أي سهم في قائمة المتابعة أدناه لإضافة تنبيه فوري.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {alertRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-[#121826]/40 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                        <span className="font-mono">{rule.symbol}</span>
                        <span className="text-xs text-slate-400 font-normal">({rule.instrumentName})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {rule.alertType === "price_above" && `السعر يتجاوز ${rule.threshold}`}
                        {rule.alertType === "price_below" && `السعر يهبط دون ${rule.threshold}`}
                        {rule.alertType === "rsi_overbought" && `مؤشر RSI يتجاوز ${rule.threshold}`}
                        {rule.alertType === "rsi_oversold" && `مؤشر RSI يهبط دون ${rule.threshold}`}
                      </div>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        rule.status === "triggered"
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {rule.status === "triggered" ? "تم الإطلاق" : "نشط ومترقب"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      {rule.notifyTelegram && <Send className="size-3 text-sky-500" />}
                      {rule.lastTriggeredAt
                        ? `آخر تفعيل: ${new Date(rule.lastTriggeredAt).toLocaleDateString("ar-EG")}`
                        : "لم يُفعل بعد"}
                    </span>
                    <button
                      onClick={() => deleteAlertMutation.mutate({ ruleId: rule.id })}
                      disabled={deleteAlertMutation.isPending}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title="حذف التنبيه"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: Watchlist Table */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="size-4 text-sky-600" />
                <span>قائمة المتابعة والأسعار المعتمدة (Market Watchlist)</span>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5 text-slate-500">
                الأسعار الرسمية من مباشر مصر والسجلات المسجلة مع إمكانية التحليل الفني وضبط التنبيهات
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {watchlistQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : watchlist.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              لا توجد أدوات مالية مسجلة في قائمة المتابعة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#121826]/40 text-slate-500 font-semibold">
                    <th className="py-3 px-4">الأداة / السهم</th>
                    <th className="py-3 px-4">النوع</th>
                    <th className="py-3 px-4">السعر المعتمد</th>
                    <th className="py-3 px-4">مصدر السعر</th>
                    <th className="py-3 px-4">حالة التحديث</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {watchlist.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{item.symbol}</span>
                          <span className="text-xs text-slate-400 font-normal">({item.name})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500">
                        {item.assetType}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white" dir="ltr">
                        {item.latestPrice > 0 ? `${item.latestPrice.toFixed(2)} ${item.currency}` : "—"}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500">
                        {item.source}
                      </td>
                      <td className="py-3 px-4">
                        {item.isStale ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200">
                            <Clock className="size-3 ml-1" />
                            {item.freshnessLabel}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200">
                            <CheckCircle2 className="size-3 ml-1" />
                            {item.freshnessLabel}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {onSelectSymbol && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelectSymbol(item.symbol)}
                              className="h-7 text-xs px-2 rounded-lg font-sans text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                              title="عرض الشارت الفني"
                            >
                              عرض الشارت
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCreate(item)}
                            className="h-7 text-xs px-2.5 rounded-lg font-sans gap-1"
                          >
                            <Plus className="size-3" />
                            <span>تنبيه</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Create Alert Rule */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0E1420] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Bell className="size-4 text-amber-600" />
              <span>إضافة تنبيه جديد ({selectedSymbol})</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              سيقوم النظام بمراقبة حركة السعر وإشعارك لحظياً عبر المنصة وتيليجرام بمجرد تحقق الشرط.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label>نوع التنبيه</Label>
              <Select value={alertType} onValueChange={(val: any) => setAlertType(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="price_above">السعر أعلى من أو يساوي (Price ≥ Target)</SelectItem>
                  <SelectItem value="price_below">السعر أدنى من أو يساوي (Price ≤ Target)</SelectItem>
                  <SelectItem value="rsi_overbought">مؤشر القوة النسبية تشبع شرائي (RSI ≥ Target)</SelectItem>
                  <SelectItem value="rsi_oversold">مؤشر القوة النسبية تشبع بيعي (RSI ≤ Target)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>قيمة الحد المستهدف (Threshold)</Label>
              <Input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="أدخل القيمة المستهدفة..."
                className="font-mono text-left"
                dir="ltr"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-[#121826]">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200">إشعار فوري عبر تيليجرام</span>
                <p className="text-[11px] text-slate-400">إرسال رسالة فورية إلى محادثة تيليجرام المرتبطة بمساحة العمل</p>
              </div>
              <input
                type="checkbox"
                checked={notifyTelegram}
                onChange={(e) => setNotifyTelegram(e.target.checked)}
                className="size-4 rounded accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-row-reverse">
            <Button
              type="button"
              onClick={() => {
                const num = parseFloat(threshold);
                if (isNaN(num) || num <= 0) {
                  toast.error("يرجى إدخال قيمة حد رقمية صالحة أكبر من صفر.");
                  return;
                }
                createAlertMutation.mutate({
                  symbol: selectedSymbol,
                  instrumentName: selectedName,
                  alertType,
                  threshold: num,
                  notifyTelegram,
                });
              }}
              disabled={createAlertMutation.isPending}
              className="text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              حفظ وتفعيل التنبيه
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="text-xs rounded-xl"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
