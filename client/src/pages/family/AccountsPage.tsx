import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Landmark,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import {
  AccountType,
  accountTypeLabel,
  CreateAccountDialog,
  EmptyState,
  InlineError,
  money,
  PageLoading,
  textError,
} from "./familyShared";

export default function AccountsPage() {
  const [, setLocation] = useLocation();
  const query = trpc.family.accounts.list.useQuery();
  const workspace = trpc.family.bootstrap.useQuery();
  const baseCurrency = workspace.data?.workspace.baseCurrency || "EGP";

  const accounts = query.data ?? [];
  const activeAccounts = useMemo(() => accounts.filter(a => a.status !== "archived"), [accounts]);

  const totalLiquidity = useMemo(() => {
    return activeAccounts.reduce((sum, acc) => {
      const val = acc.baseValue !== null ? Number(acc.baseValue) : Number(acc.balance);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [activeAccounts]);

  const bankAccounts = useMemo(() => {
    return activeAccounts.filter(a => a.accountType === "bank");
  }, [activeAccounts]);

  const totalBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, acc) => {
      const val = acc.baseValue !== null ? Number(acc.baseValue) : Number(acc.balance);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [bankAccounts]);

  const cashAccounts = useMemo(() => {
    return activeAccounts.filter(a => ["cash", "wallet"].includes(a.accountType));
  }, [activeAccounts]);

  const totalCashBalance = useMemo(() => {
    return cashAccounts.reduce((sum, acc) => {
      const val = acc.baseValue !== null ? Number(acc.baseValue) : Number(acc.balance);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [cashAccounts]);

  const activeCount = activeAccounts.length;

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="الحسابات والأرصدة"
          description="الأرصدة هنا ناتج قيود الدفتر، وليست حقولًا قابلة للتعديل يدويًا."
          breadcrumbs={[
            { label: "الثروة والأصول", href: "/accounts" },
            { label: "الحسابات والأرصدة" },
          ]}
          badge={{ text: "قيود متوازنة", variant: "institutional" }}
          icon={Landmark}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/transfers")}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 transition-all flex items-center gap-1.5"
              >
                <ArrowLeftRight className="size-3.5" />
                تحويل أموال
              </Button>
              <CreateAccountDialog
                compact
                triggerClassName="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent flex items-center gap-1.5"
              />
            </div>
          }
        />

        {query.isLoading ? (
          <PageLoading />
        ) : query.error ? (
          <InlineError message={textError(query.error)} />
        ) : !query.data?.length ? (
          <EmptyState
            icon={Landmark}
            title="لا توجد حسابات ضمن نطاقك"
            description="أضف حسابًا نقديًا أو مصرفيًا أو استثماريًا. يمكنك إدخال رصيد افتتاحي وسيُسجل بقيد مالي متوازن."
            action={
              <CreateAccountDialog
                triggerClassName="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all border border-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-transparent flex items-center gap-2"
              />
            }
          />
        ) : (
          <>
            {/* Executive Top Metric Strip */}
            <section className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6 overflow-hidden">
              {/* Cell 1: إجمالي السيولة النقدية */}
              <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    إجمالي السيولة النقدية
                  </span>
                  <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30">
                    <WalletCards className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block overflow-hidden text-ellipsis whitespace-nowrap">
                    <SensitiveValue>{formatMoney(totalLiquidity, baseCurrency, 2)}</SensitiveValue>
                  </strong>
                </div>
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
                  مجموع أرصدة الحسابات النشطة
                </span>
              </div>

              {/* Cell 2: أرصدة البنوك المصرفية */}
              <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    أرصدة البنوك المصرفية
                  </span>
                  <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/30">
                    <Building2 className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block overflow-hidden text-ellipsis whitespace-nowrap">
                    <SensitiveValue>{formatMoney(totalBankBalance, baseCurrency, 2)}</SensitiveValue>
                  </strong>
                </div>
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
                  {bankAccounts.length} {bankAccounts.length === 1 ? "حساب مصرفي" : "حسابات مصرفية"}
                </span>
              </div>

              {/* Cell 3: النقد السائل والخزينة */}
              <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b sm:border-b-0 lg:border-b-0 lg:border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    النقد السائل والخزينة
                  </span>
                  <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30">
                    <Wallet className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block overflow-hidden text-ellipsis whitespace-nowrap">
                    <SensitiveValue>{formatMoney(totalCashBalance, baseCurrency, 2)}</SensitiveValue>
                  </strong>
                </div>
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
                  {cashAccounts.length} {cashAccounts.length === 1 ? "خزينة نقدية" : "خزائن ومحافظ"}
                </span>
              </div>

              {/* Cell 4: الحسابات النشطة */}
              <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    الحسابات النشطة
                  </span>
                  <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-500/30">
                    <CheckCircle2 className="size-3.5 sm:size-4" />
                  </div>
                </div>
                <div className="mt-2.5 mb-1">
                  <strong className="text-slate-900 dark:text-white font-bold font-mono text-xl sm:text-2xl tabular-nums block overflow-hidden text-ellipsis whitespace-nowrap">
                    {activeCount}
                  </strong>
                </div>
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">
                  حسابات مالية قيد التشغيل
                </span>
              </div>
            </section>

            {/* Table Container */}
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">
                        الحساب
                      </th>
                      <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">
                        النوع
                      </th>
                      <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">
                        الجهة
                      </th>
                      <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">
                        الرصيد الحقيقي
                      </th>
                      <th className="bg-slate-100/80 dark:bg-[#0E1420] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 text-right">
                        التقييم / العملة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {query.data.map(account => {
                      const isBank = account.accountType === "bank";
                      const isCash = ["cash", "wallet"].includes(account.accountType);
                      const isBrokerage = account.accountType === "brokerage";
                      return (
                        <tr
                          key={account.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${isBank
                                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/30"
                                  : isCash
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30"
                                    : isBrokerage
                                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-500/30"
                                      : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 dark:border-slate-700/50"
                                  }`}
                              >
                                {isBank ? (
                                  <Building2 className="size-4" />
                                ) : isCash ? (
                                  <Wallet className="size-4" />
                                ) : isBrokerage ? (
                                  <TrendingUp className="size-4" />
                                ) : (
                                  <Landmark className="size-4" />
                                )}
                              </div>
                              <div>
                                <span className="text-slate-900 dark:text-slate-100 font-bold text-sm block">
                                  {account.name}
                                </span>
                                <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 block mt-0.5">
                                  {account.currency}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200/60 dark:border-slate-700/60">
                              {accountTypeLabel[account.accountType as AccountType] || account.accountType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium text-xs">
                            {account.institution || "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className="text-slate-900 dark:text-white font-bold font-mono text-sm sm:text-base tabular-nums block"
                              dir="ltr"
                            >
                              {money(account.balance, account.currency)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {account.baseValue !== null ? (
                              <div className="flex items-center gap-1.5" dir="ltr">
                                <span className="text-slate-900 dark:text-white font-bold font-mono text-sm sm:text-base tabular-nums">
                                  {money(account.baseValue, baseCurrency)}
                                </span>
                                {account.currency !== baseCurrency && (
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                    {baseCurrency}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 px-2.5 py-1 rounded-full">
                                يتطلب سعر صرف
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
export { AccountsPage };
