import React, { useState } from "react";
import { Download, Smartphone, Sparkles } from "lucide-react";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { Button } from "@/components/ui/button";
import { PwaInstallModal } from "./PwaInstallModal";

export function PwaInstallButton({
  className,
  onOpenModal,
}: {
  className?: string;
  onOpenModal?: () => void;
}) {
  const [localModalOpen, setLocalModalOpen] = useState(false);

  const handleClick = () => {
    if (onOpenModal) {
      onOpenModal();
    } else {
      setLocalModalOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={
          className ||
          "fintech-topbar-button flex items-center gap-1.5 px-2.5 bg-emerald-500/15 border border-emerald-500/35 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold transition-all text-xs rounded-lg"
        }
        title="تثبيت منصة FAMILY كتطبيق ويب مستقل (PWA) أو اختصار مباشر"
        aria-label="تثبيت تطبيق المنصة"
      >
        <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline text-[11px]">تثبيت التطبيق</span>
      </button>

      {!onOpenModal && (
        <PwaInstallModal open={localModalOpen} onOpenChange={setLocalModalOpen} />
      )}
    </>
  );
}

export function PwaInstallSidebarBanner({ onOpenModal }: { onOpenModal?: () => void }) {
  const [localModalOpen, setLocalModalOpen] = useState(false);

  const handleClick = () => {
    if (onOpenModal) {
      onOpenModal();
    } else {
      setLocalModalOpen(true);
    }
  };

  return (
    <>
      <div className="mx-3 my-2 p-3 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-zinc-900 border border-emerald-500/30 text-right space-y-2">
        <div className="flex items-center justify-between text-emerald-400 font-bold text-xs">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4" />
            <span>تطبيق الهاتف والشاشة</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md">
            PWA
          </span>
        </div>
        <p className="text-[11px] text-zinc-300 leading-relaxed">
          ثبّت المنصة كاختصار مباشر أو تطبيق PWA سريع مع دعم كامل للعمل دون إنترنت.
        </p>
        <Button
          size="sm"
          onClick={handleClick}
          className="w-full h-7 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-xl shadow-xs"
        >
          <Download className="size-3" />
          تثبيت واختصار الهاتف
        </Button>
      </div>

      {!onOpenModal && (
        <PwaInstallModal open={localModalOpen} onOpenChange={setLocalModalOpen} />
      )}
    </>
  );
}

export function PwaInstallDrawerItem({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <button
      onClick={onOpenModal}
      className="w-full flex items-center justify-between p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 text-xs font-bold transition-all text-right cursor-pointer"
    >
      <div className="flex items-center gap-2.5">
        <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <Download className="size-4" />
        </span>
        <div>
          <div className="font-bold">تثبيت المنصة على الهاتف</div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal">
            إضافة للشاشة الرئيسية / تخطي Play Protect
          </div>
        </div>
      </div>
      <Sparkles className="size-4 text-emerald-500 shrink-0" />
    </button>
  );
}
