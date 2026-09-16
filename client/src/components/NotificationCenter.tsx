import React, { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, ExternalLink, Info, ShieldAlert, Sparkles, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatMoney, formatDateTime } from "@/lib/financialDisplay";
import { useLocation } from "wouter";
import { toast } from "sonner";

export type SmartNotification = {
  id: string;
  type: "dip_buy" | "take_profit" | "governance" | "market_signal";
  title: string;
  detail: string;
  severity: "info" | "warning" | "success" | "critical";
  occurredAt: number;
  actionUrl?: string;
  instrumentId?: number;
};

const STORAGE_KEY = "family_notifications_state_v1";

interface StoredState {
  readIds: string[];
  dismissedIds: string[];
}

function getStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
        dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
      };
    }
  } catch {
    // Ignore storage parse errors
  }
  return { readIds: [], dismissedIds: [] };
}

function saveStoredState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write errors
  }
}

export default function NotificationCenter() {
  const [_, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [storedState, setStoredState] = useState<StoredState>(getStoredState);

  const dashboardQuery = trpc.family.dashboard.useQuery();
  const triggersQuery = trpc.family.market.getPriceTriggers.useQuery();
  const signalsQuery = trpc.family.planning.marketSignals.useQuery();

  const portfolio = dashboardQuery.data?.portfolio ?? [];
  const triggers = triggersQuery.data ?? {};
  const baseCurrency = dashboardQuery.data?.workspace.baseCurrency || "EGP";

  // Build real-time smart alerts
  const notifications: SmartNotification[] = useMemo(() => {
    const list: SmartNotification[] = [];

    // 1. Portfolio Rules Engine (Dip Buy & Take Profit)
    for (const pos of portfolio) {
      const currentPrice = Number(pos.marketPrice || 0);
      const avgCost = Number(pos.averageCost || 0);
      const instrumentTriggers = triggers[pos.instrumentId];
      const targetBuy = instrumentTriggers?.targetBuyPrice ? Number(instrumentTriggers.targetBuyPrice) : null;
      const targetSell = instrumentTriggers?.targetTakeProfitPrice ? Number(instrumentTriggers.targetTakeProfitPrice) : null;

      const pnlPercent = avgCost > 0 && currentPrice > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

      // Rule: Dip Buy Trigger
      if (targetBuy && currentPrice > 0 && currentPrice <= targetBuy) {
        list.push({
          id: `dip-buy-${pos.instrumentId}-${Math.round(currentPrice)}`,
          type: "dip_buy",
          title: `فرصة تعزيز شراء: ${pos.instrumentName}`,
          detail: `سعر السوق (${formatMoney(currentPrice, pos.currency)}) وصل إلى أو هبط عن السعر المستهدف للشراء (${formatMoney(targetBuy, pos.currency)}).`,
          severity: "info",
          occurredAt: pos.quoteAsOf || Date.now(),
          actionUrl: "/investments",
          instrumentId: pos.instrumentId,
        });
      }

      // Rule: Take Profit Trigger (Target Sell Price Hit)
      if (targetSell && currentPrice > 0 && currentPrice >= targetSell) {
        list.push({
          id: `take-profit-target-${pos.instrumentId}-${Math.round(currentPrice)}`,
          type: "take_profit",
          title: `فرصة جني أرباح: ${pos.instrumentName}`,
          detail: `سعر السهم بلغ الهدف المحدد للبيع (${formatMoney(targetSell, pos.currency)}) بربح محقق مقترح.`,
          severity: "success",
          occurredAt: pos.quoteAsOf || Date.now(),
          actionUrl: "/investments",
          instrumentId: pos.instrumentId,
        });
      }

      // Rule: Take Profit Trigger (Exceeds +20% over FIFO cost)
      if (pnlPercent >= 20) {
        list.push({
          id: `take-profit-pct-${pos.instrumentId}-${Math.floor(pnlPercent)}`,
          type: "take_profit",
          title: `عائد استثنائي مرتفع (+${pnlPercent.toFixed(1)}%): ${pos.instrumentName}`,
          detail: `تجاوز العائد غير المحقق حاجز +20% مقارنة بتكلفة الأساس FIFO (${formatMoney(avgCost, pos.currency)}).`,
          severity: "success",
          occurredAt: pos.quoteAsOf || Date.now(),
          actionUrl: "/investments",
          instrumentId: pos.instrumentId,
        });
      }
    }

    // 2. Planning and Governance Signals
    if (signalsQuery.data) {
      for (const sig of signalsQuery.data) {
        list.push({
          id: `signal-${sig.id}`,
          type: "market_signal",
          title: sig.title,
          detail: sig.detail,
          severity: sig.kind === "profit_review" ? "success" : sig.kind === "stale_quote" ? "warning" : "info",
          occurredAt: Date.now(),
          actionUrl: sig.actionPath,
        });
      }
    }

    return list;
  }, [portfolio, triggers, signalsQuery.data]);

  // Filter out dismissed notifications
  const activeNotifications = useMemo(() => {
    return notifications.filter((n) => !storedState.dismissedIds.includes(n.id));
  }, [notifications, storedState.dismissedIds]);

  const unreadCount = useMemo(() => {
    return activeNotifications.filter((n) => !storedState.readIds.includes(n.id)).length;
  }, [activeNotifications, storedState.readIds]);

  // Request browser desktop notification permission
  const requestDesktopPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("متصفحك الحالي لا يدعم إشعارات سطح المكتب.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast.success("تم تفعيل إشعارات سطح المكتب بنجاح.");
      new Notification("نظام تنبيهات الاستثمار الذكي", {
        body: "تم ربط تنبيهات أوامر الشراء وجني الأرباح بسطح المكتب بنجاح.",
        icon: "/favicon.ico",
      });
    } else {
      toast.info("لم يتم منح إذن الإشعارات من المتصفح.");
    }
  };

  const markAllAsRead = () => {
    const allIds = activeNotifications.map((n) => n.id);
    const nextState: StoredState = {
      ...storedState,
      readIds: Array.from(new Set([...storedState.readIds, ...allIds])),
    };
    setStoredState(nextState);
    saveStoredState(nextState);
    toast.success("تم تحديد كافة الإشعارات كمقروءة.");
  };

  const markAsRead = (id: string) => {
    if (storedState.readIds.includes(id)) return;
    const nextState: StoredState = {
      ...storedState,
      readIds: [...storedState.readIds, id],
    };
    setStoredState(nextState);
    saveStoredState(nextState);
  };

  const dismissNotification = (id: string) => {
    const nextState: StoredState = {
      ...storedState,
      dismissedIds: [...storedState.dismissedIds, id],
    };
    setStoredState(nextState);
    saveStoredState(nextState);
    toast.info("تم تجاهل التنبيه.");
  };

  const clearAllNotifications = () => {
    const allIds = activeNotifications.map((n) => n.id);
    const nextState: StoredState = {
      ...storedState,
      dismissedIds: Array.from(new Set([...storedState.dismissedIds, ...allIds])),
    };
    setStoredState(nextState);
    saveStoredState(nextState);
    toast.info("تم مسح كافة التنبيهات.");
  };

  const renderIcon = (type: SmartNotification["type"], severity: SmartNotification["severity"]) => {
    if (type === "dip_buy") {
      return <TrendingDown className="size-4 text-sky-600 dark:text-sky-400" />;
    }
    if (type === "take_profit") {
      return <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (severity === "critical") {
      return <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400" />;
    }
    return <Info className="size-4 text-amber-600 dark:text-amber-400" />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-2xs cursor-pointer"
          aria-label="مركز التنبيهات الذكية"
          title="مركز التنبيهات والإشعارات"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 shadow-2xl border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0E1420] text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">مركز التنبيهات الذكية</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {unreadCount} جديد
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-slate-600 dark:text-slate-400 hover:text-foreground"
                onClick={markAllAsRead}
                title="تحديد الكل كمقروء"
              >
                <CheckCheck className="size-3.5 ml-1" />
                مقروء
              </Button>
            )}
            {activeNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={clearAllNotifications}
                title="مسح الكل"
              >
                <Trash2 className="size-3.5 ml-1" />
                مسح
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {activeNotifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                <Sparkles className="size-5" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">لا توجد تنبيهات نشطة حالياً</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                ستظهر هنا إشارات الشراء عند الهبوط، وأهداف جني الأرباح، وإشعارات الحوكمة فور تحقق قواعدها.
              </p>
            </div>
          ) : (
            activeNotifications.map((notification) => {
              const isRead = storedState.readIds.includes(notification.id);
              return (
                <div
                  key={notification.id}
                  className={`p-3.5 transition-colors flex items-start justify-between gap-3 ${
                    isRead
                      ? "opacity-75 hover:opacity-100 bg-transparent hover:bg-slate-50/60 dark:hover:bg-slate-900/30"
                      : "bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/60"
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 mt-0.5">
                      {renderIcon(notification.type, notification.severity)}
                    </div>
                    <div className="min-w-0 space-y-0.5 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                          {notification.title}
                        </strong>
                        {!isRead && (
                          <span className="size-1.5 rounded-full bg-rose-500 shrink-0" title="غير مقروء" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {notification.detail}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                          {formatDateTime(notification.occurredAt)}
                        </span>
                        {notification.actionUrl && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                              setOpen(false);
                              if (notification.actionUrl) setLocation(notification.actionUrl);
                            }}
                          >
                            <span>الانتقال</span>
                            <ExternalLink className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 shrink-0 rounded transition-colors"
                    title="تجاهل"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotification(notification.id);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 rounded-b-2xl flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-foreground h-8"
            onClick={requestDesktopPermission}
          >
            تفعيل إشعارات سطح المكتب للأسعار
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
