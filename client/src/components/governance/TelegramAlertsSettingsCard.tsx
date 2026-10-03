import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bell,
  Coins,
  FileSpreadsheet,
  Receipt,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

export function TelegramAlertsSettingsCard() {
  const utils = trpc.useUtils();
  const configQuery = trpc.family.telegram.getConfig.useQuery();

  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [enableCertificates, setEnableCertificates] = useState(true);
  const [enableGoldMovements, setEnableGoldMovements] = useState(true);
  const [enableZakatHawl, setEnableZakatHawl] = useState(true);
  const [enableWeeklySummary, setEnableWeeklySummary] = useState(true);
  const [thresholdPct, setThresholdPct] = useState(2.0);

  // Sync state when query loads
  useEffect(() => {
    if (configQuery.data) {
      setBotToken(configQuery.data.botTokenMasked || "");
      setChatId(configQuery.data.chatId || "");
      setEnabled(configQuery.data.enabled);
      setEnableCertificates(configQuery.data.enableCertificates);
      setEnableGoldMovements(configQuery.data.enableGoldMovements);
      setEnableZakatHawl(configQuery.data.enableZakatHawl);
      setEnableWeeklySummary(configQuery.data.enableWeeklySummary);
      setThresholdPct(configQuery.data.goldMovementThresholdPct || 2.0);
    }
  }, [configQuery.data]);

  const updateMutation = trpc.family.telegram.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ إعدادات تنبيهات تيليجرام بنجاح");
      void utils.family.telegram.getConfig.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر حفظ إعدادات تيليجرام");
    },
  });

  const testAlertMutation = trpc.family.telegram.sendTestAlert.useMutation({
    onSuccess: (data) => {
      toast.success("تم إرسال التنبيه التجريبي بنجاح إلى تيليجرام! 🚀", {
        description: `رقم الرسالة في تيليجرام: #${data.messageId || "OK"}`,
      });
      void utils.family.telegram.getConfig.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر إرسال التنبيه التجريبي. يرجى مراجعة Token و Chat ID.");
    },
  });

  const runChecksMutation = trpc.family.telegram.runChecks.useMutation({
    onSuccess: (data) => {
      if (data.sentCount > 0) {
        toast.success(`تم إرسال ${data.sentCount} تنبيهات فورية إلى تيليجرام`, {
          description: data.alerts.join(" · "),
        });
      } else {
        toast.info("تم الفحص: لا توجد تنبيهات تستوفي شروط الإرسال حالياً (الشهادات والذهب ضمن الحدود العادية).");
      }
      void utils.family.telegram.getConfig.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر تنفيذ فحص التنبيهات");
    },
  });

  const weeklySummaryMutation = trpc.family.telegram.sendWeeklySummaryNow.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال التقرير المالي الأسبوعي للثروة فوراً عبر تيليجرام!");
      void utils.family.telegram.getConfig.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر إرسال التقرير الأسبوعي");
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      botToken: botToken.includes("•") ? undefined : botToken,
      chatId,
      enabled,
      enableCertificates,
      enableGoldMovements,
      enableZakatHawl,
      enableWeeklySummary,
      goldMovementThresholdPct: Number(thresholdPct),
    });
  };

  const handleTestAlert = () => {
    testAlertMutation.mutate({
      botToken: botToken.includes("•") ? undefined : botToken,
      chatId,
    });
  };

  const isConfigured = configQuery.data?.isConfigured;

  return (
    <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0C1019] shadow-sm rounded-2xl overflow-hidden" dir="rtl">
      <CardHeader className="bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Send className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  محرك التنبيهات المالية الذكية اللحظية (Telegram Bot Engine)
                </CardTitle>
                {isConfigured ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5">
                    متصل ونشط
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] px-2 py-0.5">
                    بانتظار الضبط
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                إرسال إشعارات فورية عبر تيليجرام عند استحقاق الشهادات البنكية، تحركات الذهب، وحول الزكاة الشرعية
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runChecksMutation.mutate()}
              disabled={runChecksMutation.isPending || !isConfigured}
              className="text-xs border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 h-8"
            >
              {runChecksMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin ml-1.5" />
                  جارٍ الفحص...
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5 ml-1.5 text-sky-500" />
                  فحص المشغلات الآن
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleTestAlert}
              disabled={testAlertMutation.isPending || (!chatId && !configQuery.data?.chatId)}
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs h-8 px-3 shadow-xs"
            >
              {testAlertMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin ml-1.5" />
                  جارٍ الإرسال...
                </>
              ) : (
                <>
                  <Send className="size-3.5 ml-1.5" />
                  إرسال تنبيه تجريبي 🚀
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* Credentials Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>رمز بوت تيليجرام (Telegram Bot Token)</span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-normal"
              >
                إنشاء بوت عبر @BotFather
                <ExternalLink className="size-3" />
              </a>
            </Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="مثال: 7891234567:AAFnKj4..."
                className="font-mono text-xs pr-3 pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              يتم حفظ الرمز مشفراً ولا يُعرض بالكامل لضمان الأمان.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>معرّف المحادثة (Telegram Chat ID)</span>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-normal"
              >
                معرفة Chat ID عبر @userinfobot
                <ExternalLink className="size-3" />
              </a>
            </Label>
            <Input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="مثال: 123456789 أو -1001234567890 (للمجموعات)"
              className="font-mono text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              يمكنك استخدام معرف حسابك الشخصي أو معرف مجموعة العائلة لتصل التنبيهات للجميع.
            </p>
          </div>
        </div>

        {/* Triggers Configuration */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              تخصيص مشغلات التنبيه التلقائية (Automated Triggers)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">تفعيل المحرك كاملاً:</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Trigger 1: Certificates */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                    استحقاق الشهادات والودائع
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    تنبيه قبل الاستحقاق بـ 7 أيام + يوم الاستحقاق
                  </span>
                </div>
              </div>
              <Switch checked={enableCertificates} onCheckedChange={setEnableCertificates} />
            </div>

            {/* Trigger 2: Gold Movements */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Coins className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                    تحركات الذهب الحادة بالسوق المصري
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    تنبيه عند تحرك عيار 24 بأكثر من {thresholdPct}%
                  </span>
                </div>
              </div>
              <Switch checked={enableGoldMovements} onCheckedChange={setEnableGoldMovements} />
            </div>

            {/* Trigger 3: Zakat Hawl */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Receipt className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                    حول الزكاة الشرعية وبلوغ النصاب
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    تنبيه بحلول الحول وبلوغ نصاب الـ 85 جرام ذهب
                  </span>
                </div>
              </div>
              <Switch checked={enableZakatHawl} onCheckedChange={setEnableZakatHawl} />
            </div>

            {/* Trigger 4: Weekly Summary */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <BarChart3 className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                    الملخص الأسبوعي للمركز المالي
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    موجز بصافي الثروة، السيولة، والذهب نهاية الأسبوع
                  </span>
                </div>
              </div>
              <Switch checked={enableWeeklySummary} onCheckedChange={setEnableWeeklySummary} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {configQuery.data?.lastDispatchedAt && (
              <span>
                آخر تنبيه مرسل:{" "}
                <strong className="text-slate-700 dark:text-slate-300 font-mono">
                  {new Date(configQuery.data.lastDispatchedAt).toLocaleString("ar-EG")}
                </strong>
              </span>
            )}
            {configQuery.data?.lastTestSentAt && (
              <span>
                آخر اختبار:{" "}
                <strong className="text-slate-700 dark:text-slate-300 font-mono">
                  {new Date(configQuery.data.lastTestSentAt).toLocaleTimeString("ar-EG")}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => weeklySummaryMutation.mutate()}
              disabled={weeklySummaryMutation.isPending || !isConfigured}
              className="text-xs h-8"
            >
              {weeklySummaryMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin ml-1.5" />
                  جارٍ الإرسال...
                </>
              ) : (
                "إرسال الملخص الأسبوعي الآن 📊"
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 px-4"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin ml-1.5" />
                  جارٍ الحفظ...
                </>
              ) : (
                "حفظ الإعدادات"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TelegramAlertsSettingsCard;
