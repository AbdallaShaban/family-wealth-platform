import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";

export { DashboardLayout, PageHeader };
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { CircleAlert, Landmark, Loader2, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

export type AccountType = "cash" | "bank" | "brokerage" | "wallet" | "credit" | "loan" | "asset";
export type CashEvent = "deposit" | "withdrawal" | "income" | "expense";

export const accountTypeLabel: Record<AccountType, string> = {
  cash: "نقدي",
  bank: "مصرفي",
  brokerage: "وساطة",
  wallet: "محفظة",
  credit: "بطاقة ائتمان",
  loan: "قرض",
  asset: "أصل",
};

export const eventLabel: Record<string, string> = {
  opening_balance: "رصيد افتتاحي",
  deposit: "إيداع",
  withdrawal: "سحب",
  transfer: "تحويل",
  buy: "شراء",
  sell: "بيع",
  dividend: "توزيع نقدي",
  income: "دخل",
  expense: "مصروف",
  fee: "رسوم",
  tax: "ضريبة",
  adjustment: "تسوية",
  reversal: "عكس عملية",
};

export function textError(error: unknown): string {
  return error instanceof Error ? error.message : "حدث خطأ غير متوقع. حاول مجددًا.";
}

export function money(value: string | null | undefined, currency: string) {
  return <SensitiveValue>{formatMoney(value, currency, 2)}</SensitiveValue>;
}

export function dateTime(timestamp: number) {
  const d = new Date(timestamp);
  const iso = d.toISOString();
  return <span dir="ltr" className="inline-flex items-center font-mono tabular-nums text-xs">{iso.slice(0, 10)} • {iso.slice(11, 16)}</span>;
}

export function PageLoading() {
  return (
    <div className="fintech-page-loading" dir="rtl">
      <Skeleton className="fintech-loading-title" />
      <div className="fintech-loading-cards">
        <Skeleton /><Skeleton /><Skeleton />
      </div>
      <Skeleton className="fintech-loading-panel" />
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <Card className="fintech-inline-error">
      <CardContent className="flex gap-3 p-5 text-sm">
        <CircleAlert className="mt-0.5 size-5 shrink-0" />
        {message}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Landmark;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fintech-empty-state">
      <Icon className="fintech-empty-state-icon" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function useFamilyPermissions() {
  const bootstrap = trpc.family.bootstrap.useQuery();
  const role = bootstrap.data?.membership.role ?? "viewer";
  return {
    role,
    canEdit: ["owner", "advisor", "editor"].includes(role),
    canAdvise: ["owner", "advisor"].includes(role),
    isOwner: role === "owner",
  };
}

export function CreateAccountDialog({ compact = false, triggerClassName }: { compact?: boolean; triggerClassName?: string }) {
  const utils = trpc.useUtils();
  const access = useFamilyPermissions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [currency, setCurrency] = useState("EGP");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const create = trpc.family.accounts.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الحساب وتسجيل رصيده الافتتاحي — إن وُجد — بقيد متوازن.");
      void utils.family.dashboard.invalidate();
      void utils.family.accounts.list.invalidate();
      void utils.family.ledger.recent.invalidate();
      setOpen(false);
      setName("");
      setInstitution("");
      setOpeningBalance("");
    },
    onError: error => toast.error(textError(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({
      name,
      accountType,
      currency,
      institution: institution || null,
      openingBalance: openingBalance || null,
      occurredAt: Date.now(),
      idempotencyKey: crypto.randomUUID(),
    });
  };

  if (!access.canEdit) {
    return (
      <Button
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled
        title="تتطلب إضافة حساب صلاحية محرر أو أعلى"
        className="rounded-xl text-xs font-semibold"
      >
        لا تملك صلاحية إضافة حساب
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={compact ? "sm" : "default"}
          className={
            triggerClassName ||
            (compact
              ? "bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent flex items-center gap-1.5"
              : "gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent")
          }
        >
          <Plus className="size-4" />
          إضافة حساب
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-lg bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white font-bold text-lg">إضافة حساب مالي</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400 text-xs font-medium">
            يُحفظ الحساب ضمن نطاقك فقط. الرصيد الافتتاحي اختياري ويُسجل كقيد متوازن قابل للتدقيق؛ أضف القروض والبطاقات من شاشة الديون والالتزامات.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="account-name" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">اسم الحساب</Label>
            <Input id="account-name" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: الحساب الجاري" required minLength={2} className="bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="grid gap-2">
            <Label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">نوع الحساب</Label>
            <Select value={accountType} onValueChange={value => setAccountType(value as AccountType)}>
              <SelectTrigger className="bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                {(["cash", "bank", "brokerage", "wallet", "asset"] as AccountType[]).map(type => (
                  <SelectItem value={type} key={type}>{accountTypeLabel[type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="account-currency" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">العملة</Label>
              <Input id="account-currency" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} minLength={3} required className="bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 uppercase font-mono" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opening-balance" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الرصيد الافتتاحي</Label>
              <Input id="opening-balance" inputMode="decimal" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="اختياري" className="bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 font-mono" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="institution" className="text-slate-700 dark:text-slate-300 font-semibold text-xs">الجهة المالية</Label>
            <Input id="institution" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="اختياري" className="bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-xl">إلغاء</Button>
            <Button type="submit" disabled={create.isPending} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold rounded-xl">
              {create.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
              إنشاء الحساب
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const workspaceRoleLabel: Record<string, string> = {
  owner: "مالك",
  advisor: "مستشار",
  editor: "محرر",
  viewer: "مشاهد",
};

export const invitationStatusLabel: Record<string, string> = {
  pending: "معلق",
  accepted: "مقبولة",
  cancelled: "ملغاة",
  expired: "منتهية",
};

export const auditActionLabel: Record<string, string> = {
  workspace_invitation_created: "إنشاء دعوة مساحة عمل",
  workspace_invitation_cancelled: "إلغاء دعوة مساحة عمل",
  account_created: "إنشاء حساب",
  cash_event_posted: "نشر حركة نقدية",
  transfer_posted: "نشر تحويل",
  trade_posted: "نشر صفقة تداول",
  price_quote_recorded: "تسجيل سعر سوق",
  fx_rate_recorded: "تسجيل سعر صرف",
  approval_requested: "إنشاء طلب اعتماد",
  approval_decided: "تسجيل قرار اعتماد",
  period_closed: "إغلاق فترة",
};

export const auditTargetLabel: Record<string, string> = {
  workspace: "مساحة العمل",
  account: "حساب مالي",
  financial_event: "عملية وقيد مالي",
  price_quote: "سعر سوق",
  fx_rate: "سعر صرف",
  fx_rate_recorded: "سعر صرف",
  approval_request: "طلب اعتماد",
  invitation: "دعوة",
  special_asset: "أصل خاص",
  insurance_policy: "وثيقة تأمين",
  instrument: "أداة استثمارية",
  valuation_snapshot: "لقطة تقييم معتمدة",
  official_valuation_snapshot: "لقطة تقييم معتمدة",
  financial_statements: "قوائم وتقارير مالية",
  financial_statement: "قوائم وتقارير مالية",
  trade: "صفقة تداول",
  transfer: "تحويل مالي",
};

export const humanizeAuditAction = (value: string) => auditActionLabel[value] || value.replaceAll("_", " ");

export const humanizeAuditTarget = (value: string) =>
  auditTargetLabel[value] ??
  auditTargetLabel[value.replace(/[^a-z_]/gi, "_").toLowerCase()] ??
  value.replaceAll("_", " ").replaceAll(".", " ");

export function AuditDetails({ targetType, targetId }: { targetType: string; targetId: number | string | null | undefined }) {
  const label = humanizeAuditTarget(targetType);
  return (
    <span className="flex items-center gap-1 flex-wrap">
      <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
      {targetId != null && (
        <span dir="ltr" className="font-mono tabular-nums text-slate-500 dark:text-slate-400 text-xs">
          #{targetId}
        </span>
      )}
    </span>
  );
}

export const normalizeAction = (action: string = "") =>
  action.toLowerCase().replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim();

export const AUDIT_ACTION_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  "financial event posted": { label: "ترحيل قيد مالي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80" },
  "cash event posted": { label: "ترحيل قيد مالي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80" },
  "transfer posted": { label: "ترحيل تحويل مالي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80" },
  "trade posted": { label: "ترحيل صفقة تداول", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80" },
  "fx rate recorded": { label: "تسجيل سعر صرف", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/80" },
  "price quote recorded": { label: "تسجيل سعر سوق", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/80" },
  "valuation snapshot captured": { label: "لقطة تقييم رسمية", cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/80" },
  "special asset revalued": { label: "إعادة تقييم أصل", cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/80" },
  "financial statements exported": { label: "تصدير قوائم وتقارير", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80" },
  "statements exported": { label: "تصدير قوائم وتقارير", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80" },
  "period closed": { label: "إغلاق فترة محاسبية", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80" },
  "account created": { label: "إنشاء حساب جديد", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80" },
  "instrument created": { label: "إنشاء أداة مالية", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80" },
  "workspace invitation created": { label: "إصدار دعوة عضوية", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60" },
  "workspace invitation cancelled": { label: "إلغاء دعوة عضوية", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60" },
  "approval requested": { label: "طلب اعتماد", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60" },
  "approval decided": { label: "قرار اعتماد مسجل", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60" },
};

export function AuditActionBadge({ action }: { action: string }) {
  const key = normalizeAction(action);
  const match = AUDIT_ACTION_BADGE_MAP[key];
  const label = match?.label ?? (auditActionLabel[action] || action.replaceAll("_", " ").replaceAll(".", " "));
  const cls = match?.cls ?? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60";
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono border shadow-2xs ${cls}`}>{label}</span>;
}
