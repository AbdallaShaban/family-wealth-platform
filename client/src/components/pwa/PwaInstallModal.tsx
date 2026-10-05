import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Download,
  Share2,
  MoreVertical,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { toast } from "sonner";

interface PwaInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PwaInstallModal({ open, onOpenChange }: PwaInstallModalProps) {
  const { canInstallPWA, promptInstallPWA } = useOfflineSync();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    try {
      void navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      toast.success("تم نسخ رابط المنصة المباشر بنجاح!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("تعذر نسخ الرابط تلقائياً.");
    }
  };

  const handleTriggerInstall = async () => {
    const installed = await promptInstallPWA();
    if (installed) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="sm:max-w-lg p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-card text-foreground"
      >
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-white/10 backdrop-blur-xs">
              <Smartphone className="size-5 text-emerald-200" />
            </span>
            <Badge variant="outline" className="border-white/30 text-white text-[11px] font-mono">
              PWA & Offline Ready
            </Badge>
          </div>
          <DialogTitle className="text-lg font-extrabold text-white tracking-tight">
            تثبيت منصة FAMILY على هاتفك المحمول
          </DialogTitle>
          <DialogDescription className="text-emerald-100 text-xs mt-1 leading-relaxed">
            استمتع بتجربة تطبيق كامل الشاشة وسريع الاستجابة مع إمكانية تسجيل العمليات وإدارتها دون الحاجة للاتصال بالإنترنت.
          </DialogDescription>
        </div>

        <div className="p-5 space-y-4">
          <Tabs defaultValue="shortcut" className="w-full">
            <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="shortcut" className="text-xs font-bold gap-1 rounded-lg">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                اختصار مباشر
              </TabsTrigger>
              <TabsTrigger value="android-apk" className="text-xs font-bold gap-1 rounded-lg">
                <Smartphone className="size-3.5 text-blue-600 dark:text-blue-400" />
                تثبيت PWA
              </TabsTrigger>
              <TabsTrigger value="ios" className="text-xs font-bold gap-1 rounded-lg">
                <Share2 className="size-3.5 text-amber-600 dark:text-amber-400" />
                آيفون (iOS)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Direct Web Shortcut (Safest & Fastest, bypasses Play Protect entirely) */}
            <TabsContent value="shortcut" className="mt-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                  <Sparkles className="size-4 shrink-0" />
                  <span>الطريقة الأسهل والأنظف (بدون أي تحذيرات أمان)</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  إضافة المنصة كـ <strong>اختصار ويب مباشر (Web Shortcut)</strong> ينشئ أيقونة فورية على شاشة هاتفك تعمل بشاشة كاملة وبسرعة فائقة دون أن يستفز ماسح Google Play Protect.
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-foreground bg-muted/30 p-3.5 rounded-xl border border-border">
                <strong className="block text-primary font-bold mb-2">خطوات الإضافة في ثوانٍ:</strong>
                <div className="flex items-start gap-2.5">
                  <span className="size-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <div className="leading-snug">
                    اضغط على <strong>زر قائمة المتصفح</strong> (أيقونة النقاط الثلاث <MoreVertical className="inline size-3.5 mx-0.5 text-muted-foreground" />) أعلى أو أسفل الشاشة.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="size-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <div className="leading-snug">
                    اختر خيار <strong>«الإضافة إلى الشاشة الرئيسية»</strong> أو <strong>«Add to Home screen»</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="size-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <div className="leading-snug">
                    اضغط <strong>«إضافة»</strong>. ستظهر أيقونة المنصة مباشرة بين تطبيقات هاتفك جاهزة للاستخدام الدائم!
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-1 text-xs font-bold gap-1.5"
                >
                  <Copy className="size-3.5" />
                  {copied ? "تم النسخ!" : "نسخ الرابط لفتحه في Chrome"}
                </Button>
                {canInstallPWA && (
                  <Button
                    size="sm"
                    onClick={handleTriggerInstall}
                    className="flex-1 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Download className="size-3.5" />
                    تثبيت مباشر
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: Android PWA & Play Protect guide */}
            <TabsContent value="android-apk" className="mt-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>تنبيه Google Play Protect (إن ظهر لك)</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  إذا ظهرت رسالة <em>«تم حظر تطبيق غير آمن - تم إنشاء هذا التطبيق لإصدار قديم من Android»</em>:
                  هذا إجراء روتيني من أندرويد عند محاولة بناء حزمة WebAPK من نطاقات التوجيه المؤقتة.
                </p>
                <div className="text-[11px] text-foreground bg-background/80 p-2.5 rounded-lg border border-border space-y-1">
                  <strong className="block text-emerald-600 dark:text-emerald-400 font-bold">
                    طريقة المتابعة والتخطي:
                  </strong>
                  <p>
                    1. اضغط على <strong>«مزيد من التفاصيل (More details)»</strong> أسفل رسالة التنبيه.
                  </p>
                  <p>
                    2. اختر <strong>«التثبيت على أي حال (Install anyway)»</strong> للمتابعة بأمان.
                  </p>
                  <p className="text-muted-foreground pt-1">
                    أو بدلاً من ذلك، استخدم تبويب <strong>«اختصار مباشر»</strong> لتفادي هذا الفحص تماماً.
                  </p>
                </div>
              </div>

              {canInstallPWA ? (
                <Button
                  onClick={handleTriggerInstall}
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2"
                >
                  <Download className="size-4" />
                  بدء التثبيت التلقائي الآن
                </Button>
              ) : (
                <p className="text-[11px] text-center text-muted-foreground">
                  (التطبيق مثبت بالفعل على جهازك أو استخدم قائمة المتصفح للإضافة)
                </p>
              )}
            </TabsContent>

            {/* TAB 3: iOS Safari Guide */}
            <TabsContent value="ios" className="mt-4 space-y-3">
              <div className="space-y-2.5 text-xs text-foreground bg-muted/30 p-3.5 rounded-xl border border-border">
                <strong className="block text-primary font-bold mb-2">طريقة التثبيت على آيفون وآيباد:</strong>
                <div className="flex items-start gap-2.5">
                  <span className="size-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <div className="leading-snug">
                    افتح المنصة في متصفح <strong>Safari</strong>، ثم اضغط على زر <strong>المشاركة</strong> (<Share2 className="inline size-3.5 mx-0.5 text-blue-500" /> أسفل الشاشة).
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="size-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <div className="leading-snug">
                    مرر لأسفل القائمة واضغط على <strong>«إضافة إلى الصفحة الرئيسية» (Add to Home Screen)</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="size-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <div className="leading-snug">
                    اضغط <strong>«إضافة (Add)»</strong> في الزاوية العلوية، وستظهر المنصة كتطبيق أصيل على شاشتك.
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="w-full text-xs font-bold gap-1.5"
              >
                <Copy className="size-3.5" />
                {copied ? "تم نسخ الرابط!" : "نسخ الرابط لفتحه في Safari"}
              </Button>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              تشفير TLS كامل 256-bit
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-7 px-3 text-muted-foreground hover:text-foreground"
            >
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
