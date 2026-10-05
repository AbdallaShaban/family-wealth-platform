import React, { useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Clock,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { formatMoney } from "@/lib/financialDisplay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function OfflineStatusBadge({ className }: { className?: string } = {}) {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    pendingTransactions,
    syncPendingNow,
    deletePendingItem,
    clearAllPending,
  } = useOfflineSync();

  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`fintech-topbar-button flex items-center gap-1.5 px-2.5 transition-all text-xs font-medium rounded-lg border ${
          !isOnline
            ? "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 animate-pulse"
            : pendingCount > 0
            ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-800 dark:text-yellow-300"
            : "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
        } ${className || ""}`}
        title={
          !isOnline
            ? `غير متصل بالإنترنت (${pendingCount} عملية معلقة محلياً) - انقر للإدارة`
            : pendingCount > 0
            ? `يوجد ${pendingCount} عملية بانتظار المزامنة`
            : "متصل بالإنترنت وقاعدة البيانات متزامنة"
        }
        aria-label="حالة الاتصال والمزامنة"
      >
        {!isOnline ? (
          <>
            <WifiOff className="size-3.5 text-amber-500" />
            <span className="hidden md:inline font-bold">دون اتصال</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-amber-950 text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="size-3.5 text-yellow-500 animate-spin" />
            <span className="hidden md:inline font-bold">جاري المزامنة...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <RefreshCw className="size-3.5 text-yellow-500" />
            <span className="hidden md:inline font-bold">معلق للمزامنة</span>
            <span className="px-1.5 py-0.2 rounded-full bg-yellow-500 text-yellow-950 text-[10px] font-black">
              {pendingCount}
            </span>
          </>
        ) : (
          <>
            <Wifi className="size-3.5 text-emerald-500" />
            <span className="hidden lg:inline text-[11px] text-emerald-700 dark:text-emerald-400">متصل ومزامن</span>
          </>
        )}
      </button>

      {/* Pending Queue Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent dir="rtl" className="max-w-2xl bg-card border-border text-foreground">
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border ${
                  !isOnline ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                }`}>
                  <Database className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    مركز المزامنة المحلية وقائمة الانتظار (Offline Queue)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    إدارة العمليات المحفوظة في ذاكرة المتصفح (IndexedDB) للترحيل إلى الخادم
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className={!isOnline ? "border-amber-500/40 text-amber-600 dark:text-amber-400" : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"}>
                {!isOnline ? "⚡ وضع عدم الاتصال" : "🌐 متصل بالشبكة"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-4">
            {/* Status summary banner */}
            <div className="p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span>العمليات المعلقة حالياً:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{pendingCount}</span>
              </div>
              {isOnline && pendingCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => syncPendingNow()}
                  disabled={isSyncing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-bold"
                >
                  <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "جاري المزامنة..." : "مزامنة الآن مع السيرفر"}
                </Button>
              )}
            </div>

            {/* List of pending transactions */}
            {pendingTransactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <CheckCircle2 className="size-10 text-emerald-500/50 mx-auto" />
                <p className="text-sm font-medium text-foreground">كافة العمليات مزامنة بالكامل مع السيرفر</p>
                <p className="text-xs text-muted-foreground">
                  لا توجد أي قيود أو حركات مالية معلقة في الذاكرة المحلية لجهازك.
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {pendingTransactions.map((tx) => (
                  <div
                    key={tx.localId}
                    className="p-3 rounded-xl bg-background border border-border flex items-center justify-between gap-3 text-xs hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${
                        tx.type === "expense"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : tx.type === "transfer"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {tx.type === "expense" ? (
                          <ArrowDownLeft className="size-4" />
                        ) : tx.type === "transfer" ? (
                          <ArrowRightLeft className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {tx.type === "expense"
                              ? "مصروف مالي"
                              : tx.type === "transfer"
                              ? "تحويل بين حسابين"
                              : "إيداع / دخل"}
                          </span>
                          <span className="font-mono text-muted-foreground text-[11px]">
                            {new Date(tx.createdAt).toLocaleTimeString("ar-EG")}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] truncate max-w-xs mt-0.5">
                          {tx.memo || "بدون بيان إضافي"}
                        </p>
                        {tx.lastError && (
                          <p className="text-rose-500 dark:text-rose-400 text-[10px] mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            {tx.lastError}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left font-mono font-bold text-sm text-foreground">
                        {formatMoney(tx.amount, tx.currency)}
                      </div>
                      <button
                        onClick={() => deletePendingItem(tx.localId)}
                        className="p-1.5 text-muted-foreground hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="حذف من قائمة الانتظار"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3 flex items-center justify-between sm:justify-between w-full">
            {pendingTransactions.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAllPending()}
                className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10 text-xs h-8 cursor-pointer"
              >
                تفريغ كافة المعلقات
              </Button>
            ) : <div />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              className="border-border text-foreground hover:bg-muted text-xs h-8 cursor-pointer"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
