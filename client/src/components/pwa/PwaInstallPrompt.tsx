import React from "react";
import { Download, Smartphone } from "lucide-react";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { Button } from "@/components/ui/button";

export function PwaInstallButton() {
  const { canInstallPWA, promptInstallPWA } = useOfflineSync();

  if (!canInstallPWA) return null;

  return (
    <button
      onClick={() => void promptInstallPWA()}
      className="fintech-topbar-button flex items-center gap-1.5 px-2.5 bg-emerald-500/15 border border-emerald-500/35 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold transition-all text-xs rounded-lg animate-pulse"
      title="تثبيت منصة FAMILY كتطبيق ويب مستقل (PWA) على جهازك"
      aria-label="تثبيت تطبيق المنصة"
    >
      <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      <span className="hidden sm:inline text-[11px]">تثبيت التطبيق</span>
    </button>
  );
}

export function PwaInstallSidebarBanner() {
  const { canInstallPWA, promptInstallPWA } = useOfflineSync();

  if (!canInstallPWA) return null;

  return (
    <div className="mx-3 my-2 p-3 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-zinc-900 border border-emerald-500/30 text-right space-y-2">
      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
        <Smartphone className="size-4" />
        <span>تطبيق الهاتف والكمبيوتر</span>
      </div>
      <p className="text-[11px] text-zinc-300 leading-relaxed">
        ثبّت المنصة كتطبيق PWA سريع بدون متصفح مع دعم كامل للعمل دون اتصال.
      </p>
      <Button
        size="sm"
        onClick={() => void promptInstallPWA()}
        className="w-full h-7 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-xl shadow-xs"
      >
        <Download className="size-3" />
        تثبيت المنصة الآن
      </Button>
    </div>
  );
}
