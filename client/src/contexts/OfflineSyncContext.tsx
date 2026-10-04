import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  enqueueOfflineTransaction,
  getPendingTransactions,
  getPendingCount,
  updateTransactionStatus,
  removeOfflineTransaction,
  clearAllPendingTransactions,
  cacheAccountsSnapshot,
  getCachedAccounts,
  type OfflineTransaction,
  type OfflineTransactionDraft,
  type CachedAccount,
} from "@/lib/offlineSyncStorage";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  pendingTransactions: OfflineTransaction[];
  cachedAccounts: CachedAccount[];
  canInstallPWA: boolean;
  promptInstallPWA: () => Promise<boolean>;
  recordQuickTransaction: (draft: OfflineTransactionDraft) => Promise<{
    success: boolean;
    queuedOffline: boolean;
    message?: string;
  }>;
  syncPendingNow: () => Promise<number>;
  deletePendingItem: (localId: string) => Promise<void>;
  clearAllPending: () => Promise<void>;
  refreshPending: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingTransactions, setPendingTransactions] = useState<OfflineTransaction[]>([]);
  const [cachedAccounts, setCachedAccounts] = useState<CachedAccount[]>([]);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstallPWA, setCanInstallPWA] = useState<boolean>(false);

  const utils = trpc.useUtils();
  const postCashMutation = trpc.family.ledger.postCash.useMutation();
  const transferMutation = trpc.family.ledger.transfer.useMutation();

  // Watch accounts query to continuously cache accounts for offline selection
  const accountsQuery = trpc.family.accounts.list.useQuery(undefined, {
    enabled: isOnline,
    staleTime: 60_000,
  });

  const syncLockRef = useRef(false);

  // Load and refresh pending items
  const refreshPending = useCallback(async () => {
    try {
      const items = await getPendingTransactions();
      setPendingTransactions(items);
      setPendingCount(items.length);
    } catch (err) {
      console.warn("[OfflineSync] Error reading pending items:", err);
    }
  }, []);

  // Update cached accounts from accountsQuery when available
  useEffect(() => {
    if (accountsQuery.data && accountsQuery.data.length > 0) {
      const accountsToCache: CachedAccount[] = accountsQuery.data.map((acc) => ({
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        type: acc.accountType,
      }));
      setCachedAccounts(accountsToCache);
      void cacheAccountsSnapshot(accountsToCache);
    } else {
      // Fallback: load from offline storage
      void getCachedAccounts().then((cached) => {
        if (cached && cached.length > 0) {
          setCachedAccounts(cached);
        }
      });
    }
  }, [accountsQuery.data]);

  // Handle Online/Offline window events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("تمت استعادة الاتصال بالإنترنت 🌐", {
        description: "جاري التحقق من العمليات المعلقة للمزامنة...",
      });
      void syncPendingNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("أنت تعمل دون اتصال بالإنترنت (Offline Mode) ⚡", {
        description: "يمكنك مواصلة تسجيل المصروفات والتحويلات وسيتم حفظها محلياً بأمان.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    void refreshPending();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshPending]);

  // Handle PWA BeforeInstallPrompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setCanInstallPWA(true);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setCanInstallPWA(false);
      toast.success("تم تثبيت تطبيق FAMILY بنجاح على جهازك! 📲");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Prompt PWA Installation
  const promptInstallPWA = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) {
      toast.info("تطبيق FAMILY مثبت بالفعل أو متصفحك لا يدعم نافذة التثبيت التلقائي.");
      return false;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setCanInstallPWA(false);
      return true;
    }
    return false;
  }, [installPrompt]);

  // Synchronize all pending items to the server
  const syncPendingNow = useCallback(async (): Promise<number> => {
    if (syncLockRef.current) return 0;
    if (!navigator.onLine) {
      toast.error("لا يمكن بدء المزامنة في وضع عدم الاتصال.");
      return 0;
    }

    syncLockRef.current = true;
    setIsSyncing(true);

    let syncedCount = 0;
    try {
      const pendingList = await getPendingTransactions();
      if (pendingList.length === 0) {
        setIsSyncing(false);
        syncLockRef.current = false;
        return 0;
      }

      for (const item of pendingList) {
        await updateTransactionStatus(item.localId, "syncing");

        try {
          if (item.type === "transfer") {
            if (!item.toAccountId) {
              throw new Error("الحساب المحول إليه مفقود في عملية التحويل");
            }
            await transferMutation.mutateAsync({
              fromAccountId: item.accountId,
              toAccountId: item.toAccountId,
              amount: item.amount,
              currency: item.currency,
              occurredAt: item.occurredAt,
              memo: item.memo ?? undefined,
              idempotencyKey: item.idempotencyKey,
            });
          } else {
            // cash event: expense / deposit / income
            const eventType = item.type === "expense" ? "expense" : item.type === "income" ? "income" : "deposit";
            await postCashMutation.mutateAsync({
              eventType,
              accountId: item.accountId,
              amount: item.amount,
              currency: item.currency,
              occurredAt: item.occurredAt,
              categoryId: item.categoryId ?? undefined,
              memo: item.memo ?? undefined,
              idempotencyKey: item.idempotencyKey,
            });
          }

          // Successfully synced -> remove from offline DB
          await removeOfflineTransaction(item.localId);
          syncedCount++;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "خطأ غير معروف في المزامنة";
          // Check if error is idempotency duplicate (already posted)
          if (
            errorMessage.includes("duplicate") ||
            errorMessage.includes("مكرر") ||
            errorMessage.includes("مسجلة مسبقاً")
          ) {
            // Safe to remove as it is already on the server
            await removeOfflineTransaction(item.localId);
            syncedCount++;
          } else {
            await updateTransactionStatus(item.localId, "failed", errorMessage);
          }
        }
      }

      if (syncedCount > 0) {
        toast.success(`تمت مزامنة ${syncedCount} عملية بنجاح مع السيرفر السحابي ✅`);
        // Invalidate queries so UI reflects fresh balances
        void utils.family.bootstrap.invalidate();
        void utils.family.ledger.recent.invalidate();
        void utils.family.dashboard.invalidate();
        void utils.family.accounts.list.invalidate();
      }
    } finally {
      await refreshPending();
      setIsSyncing(false);
      syncLockRef.current = false;
    }

    return syncedCount;
  }, [postCashMutation, transferMutation, utils, refreshPending]);

  // Record a transaction (online instant or offline queued)
  const recordQuickTransaction = useCallback(
    async (
      draft: OfflineTransactionDraft
    ): Promise<{ success: boolean; queuedOffline: boolean; message?: string }> => {
      // If currently offline, enqueue immediately
      if (!navigator.onLine) {
        const enqueued = await enqueueOfflineTransaction(draft);
        await refreshPending();
        toast.warning("تم حفظ العملية محلياً دون اتصال ⚡", {
          description: `المبلغ: ${draft.amount} ${draft.currency} — سيتم ترحيلها فور عودة الإنترنت.`,
        });
        return {
          success: true,
          queuedOffline: true,
          message: `تم الحفظ في قائمة الانتظار المحلية (${enqueued.localId})`,
        };
      }

      // If online, attempt direct mutation
      try {
        const idempotencyKey = `online-${draft.type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        if (draft.type === "transfer") {
          if (!draft.toAccountId) throw new Error("الحساب المحول إليه مطلوب");
          await transferMutation.mutateAsync({
            fromAccountId: draft.accountId,
            toAccountId: draft.toAccountId,
            amount: draft.amount,
            currency: draft.currency,
            occurredAt: draft.occurredAt,
            memo: draft.memo ?? undefined,
            idempotencyKey,
          });
        } else {
          const eventType = draft.type === "expense" ? "expense" : draft.type === "income" ? "income" : "deposit";
          await postCashMutation.mutateAsync({
            eventType,
            accountId: draft.accountId,
            amount: draft.amount,
            currency: draft.currency,
            occurredAt: draft.occurredAt,
            categoryId: draft.categoryId ?? undefined,
            memo: draft.memo ?? undefined,
            idempotencyKey,
          });
        }

        toast.success("تم تسجيل العملية المالية ونشر القيد بنجاح! 🚀");
        void utils.family.bootstrap.invalidate();
        void utils.family.ledger.recent.invalidate();
        void utils.family.dashboard.invalidate();
        void utils.family.accounts.list.invalidate();

        return { success: true, queuedOffline: false };
      } catch (err: unknown) {
        // If failed due to network / fetch error, gracefully fallback to offline queue!
        console.warn("[OfflineSync] Online dispatch failed, falling back to local queue:", err);
        const enqueued = await enqueueOfflineTransaction(draft);
        await refreshPending();
        toast.warning("تعذر الاتصال بالخادم، تم حفظ العملية محلياً بنجاح ⚡", {
          description: "ستتم المزامنة تلقائياً عند استقرار الاتصال.",
        });
        return {
          success: true,
          queuedOffline: true,
          message: `تم الحفظ الاحتياطي محلياً (${enqueued.localId})`,
        };
      }
    },
    [postCashMutation, transferMutation, utils, refreshPending]
  );

  // Delete a specific pending transaction
  const deletePendingItem = useCallback(
    async (localId: string) => {
      await removeOfflineTransaction(localId);
      await refreshPending();
      toast.info("تم حذف العملية المعلقة من الذاكرة المحلية.");
    },
    [refreshPending]
  );

  // Clear all pending items
  const clearAllPending = useCallback(async () => {
    await clearAllPendingTransactions();
    await refreshPending();
    toast.info("تم تفريغ كافة العمليات المعلقة محلياً.");
  }, [refreshPending]);

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        pendingTransactions,
        cachedAccounts,
        canInstallPWA,
        promptInstallPWA,
        recordQuickTransaction,
        syncPendingNow,
        deletePendingItem,
        clearAllPending,
        refreshPending,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSync must be used within an OfflineSyncProvider");
  }
  return ctx;
}
