import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import {
  Landmark,
  Clock,
  Coins,
  Plus,
  Calendar,
  Percent,
  ShieldCheck,
  Building2,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";

export function BankCertificatesHub() {
  const { isDemoMode } = useDemoMode();
  const utils = trpc.useUtils();
  const certificatesQuery = trpc.family.certificates.list.useQuery(undefined, { enabled: !isDemoMode });
  const accountsQuery = trpc.family.accounts.list.useQuery();
  const createCertMutation = trpc.family.certificates.create.useMutation();
  const collectYieldMutation = trpc.family.certificates.collectYield.useMutation();

  const [addCertModalOpen, setAddCertModalOpen] = useState(false);
  const [certName, setCertName] = useState("");
  const [certBank, setCertBank] = useState("");
  const [certPrincipal, setCertPrincipal] = useState("");
  const [certRate, setCertRate] = useState("23.5");
  const [certFrequency, setCertFrequency] = useState<"monthly" | "quarterly" | "semi_annual" | "annual">("monthly");
  const [certIssueDate, setCertIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [certMaturityDate, setCertMaturityDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [certLinkedAccountId, setCertLinkedAccountId] = useState("");
  const [isSubmittingCert, setIsSubmittingCert] = useState(false);
  const [collectingCertId, setCollectingCertId] = useState<number | null>(null);

  const certificates = certificatesQuery.data ?? [];
  const liquidAccounts = useMemo(() => {
    return (accountsQuery.data ?? []).filter(a => ["bank", "cash", "wallet"].includes(a.accountType) && a.status !== "archived");
  }, [accountsQuery.data]);

  // Aggregate Metrics
  const totalPrincipal = useMemo(() => {
    return certificates.reduce((sum, c) => sum + (Number(c.principalAmount) || 0), 0);
  }, [certificates]);

  const totalAnnualYield = useMemo(() => {
    return certificates.reduce((sum, c) => {
      const p = Number(c.principalAmount) || 0;
      const r = Number(c.interestRate) || 0;
      return sum + (p * r) / 100;
    }, 0);
  }, [certificates]);

  const handleCreateCertificate = async () => {
    const principalNum = parseFloat(certPrincipal);
    const rateNum = parseFloat(certRate);
    if (!certName.trim()) {
      toast.error("يرجى إدخال اسم الشهادة أو الوديعة");
      return;
    }
    if (!certBank.trim()) {
      toast.error("يرجى إدخال اسم البنك المصدر للشهادة");
      return;
    }
    if (!principalNum || principalNum <= 0) {
      toast.error("يرجى إدخال أصل شهادة صحيح");
      return;
    }
    if (isNaN(rateNum) || rateNum < 0) {
      toast.error("يرجى إدخال نسبة فائدة صحيحة");
      return;
    }

    try {
      setIsSubmittingCert(true);
      await createCertMutation.mutateAsync({
        certificateName: certName.trim(),
        bankName: certBank.trim(),
        principalAmount: Number(principalNum).toFixed(6),
        interestRate: Number(rateNum).toFixed(2),
        currency: "EGP",
        payoutFrequency: certFrequency,
        issueDate: new Date(certIssueDate).getTime(),
        maturityDate: new Date(certMaturityDate).getTime(),
        linkedPayoutAccountId: certLinkedAccountId ? parseInt(certLinkedAccountId, 10) : null,
      });

      await utils.family.certificates.list.invalidate();
      await utils.family.dashboard.invalidate();
      toast.success("تم ربط وقيد الشهادة البنكية بنجاح");
      setAddCertModalOpen(false);
      setCertName("");
      setCertBank("");
      setCertPrincipal("");
    } catch (err: any) {
      toast.error(err.message || "تعذر إضافة الشهادة البنكية");
    } finally {
      setIsSubmittingCert(false);
    }
  };

  const handleCollectYield = async (certId: number) => {
    try {
      setCollectingCertId(certId);
      const res = await collectYieldMutation.mutateAsync({ certificateId: certId });
      await utils.family.certificates.list.invalidate();
      await utils.family.dashboard.invalidate();
      await utils.family.accounts.list.invalidate();
      toast.success(`تم قيد تحصيل عائد بمبلغ ${res.collectedAmount} ${res.currency} في الحساب المرتبط بنجاح`);
    } catch (err: any) {
      toast.error(err.message || "تعذر قيد تحصيل العائد");
    } finally {
      setCollectingCertId(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Controls & KPI Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Landmark className="size-5.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              محفظة الشهادات البنكية والودائع لأجل
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة الأصول ذات العائد الثابت، جدول مواعيد الاستحقاق، وتحصيل العوائد بنقرة واحدة
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            if (liquidAccounts[0]) setCertLinkedAccountId(String(liquidAccounts[0].id));
            setAddCertModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <Plus className="size-4" />
          ربط شهادة جديدة
        </Button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">إجمالي أصول الشهادات</span>
          <strong className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 block" dir="ltr">
            <SensitiveValue>{formatMoney(totalPrincipal, "EGP", 0)}</SensitiveValue>
          </strong>
          <span className="text-[11px] text-slate-400 mt-1 block">
            مستبعدة من السيولة الحرة ومدرجة بصافي الثروة
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">إجمالي العائد السنوي المتوقع</span>
          <strong className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block" dir="ltr">
            +<SensitiveValue>{formatMoney(totalAnnualYield, "EGP", 0)}</SensitiveValue>
          </strong>
          <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">
            ~ {formatMoney(totalAnnualYield / 12, "EGP", 0)} شهرياً
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">الشهادات النشطة</span>
          <strong className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
            {certificates.length} {certificates.length === 1 ? "شهادة" : "شهادات"}
          </strong>
          <span className="text-[11px] text-slate-400 mt-1 block">
            عوائد دورية بنكية منتظمة
          </span>
        </div>
      </div>

      {/* Main Certificates Grid */}
      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Building2 className="size-3 ml-1" />
                    {cert.bankName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                      cert.daysToMaturity === 0
                        ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <Clock className="size-3" />
                    {cert.daysToMaturity === 0
                      ? "مستحقة الصرف"
                      : `متبقي ${cert.daysToMaturity} يوماً`}
                  </span>
                </div>

                <strong className="text-slate-900 dark:text-white font-bold text-base block mt-2.5">
                  {cert.certificateName}
                </strong>

                {/* Details Box */}
                <div className="grid grid-cols-2 gap-2 mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0E1420] border border-slate-100 dark:border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10.5px] text-slate-500 block">أصل الشهادة:</span>
                    <b className="font-mono font-bold text-slate-900 dark:text-white text-sm" dir="ltr">
                      <SensitiveValue>{formatMoney(cert.principalAmount, cert.currency, 0)}</SensitiveValue>
                    </b>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-500 block">
                      العائد ({cert.interestRate}%):
                    </span>
                    <b className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                      +<SensitiveValue>{formatMoney(cert.periodicYield, cert.currency, 0)}</SensitiveValue>
                    </b>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {cert.payoutFrequency === "monthly"
                        ? "شهرياً"
                        : cert.payoutFrequency === "quarterly"
                        ? "ربع سنوي"
                        : cert.payoutFrequency === "semi_annual"
                        ? "نصف سنوي"
                        : "سنوياً"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>تاريخ الاستحقاق:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {new Date(cert.maturityDate).toLocaleDateString("ar-EG")}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[170px]" title={cert.linkedAccountName || undefined}>
                  {cert.linkedAccountName ? `يُصرف إلى: ${cert.linkedAccountName}` : "غير محدد حساب الصرف"}
                </span>
                {cert.status === "active" && (
                  <Button
                    size="sm"
                    disabled={collectingCertId === cert.id}
                    onClick={() => handleCollectYield(cert.id)}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white h-7.5 px-3 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Coins className="size-3.5" />
                    {collectingCertId === cert.id ? "جارٍ التحصيل..." : "تحصيل العائد"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0F172A] border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center max-w-xl mx-auto my-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mx-auto mb-3">
            <Landmark className="size-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            لا توجد شهادات بنكية أو ودائع مسجلة حتى الآن
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            قم بربط وتسجيل شهاداتك البنكية ذات العائد الدوري (مثل شهادات البنك الأهلي وبنك مصر وبنك CIB) لحساب عوائدك بدقة وتحصيلها بنقرة واحدة في حسابك البنكي.
          </p>
          <Button
            onClick={() => {
              if (liquidAccounts[0]) setCertLinkedAccountId(String(liquidAccounts[0].id));
              setAddCertModalOpen(true);
            }}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            ربط أول شهادة بنكية
          </Button>
        </div>
      )}

      {/* Modal: Add Bank Certificate */}
      <Dialog open={addCertModalOpen} onOpenChange={setAddCertModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Landmark className="size-5 text-indigo-600" />
              ربط شهادة بنكية أو وديعة لأجل
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              قيد أصل الشهادة كدخل ثابت في صافي الثروة، وتحديد حساب صرف العائد الدوري التلقائي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold mb-1 block">اسم الشهادة</Label>
              <Input
                placeholder="مثال: البلاتينية السنوية 23.5% أو شهادة القمة"
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">اسم البنك المصدر</Label>
                <Input
                  placeholder="مثال: البنك الأهلي المصري"
                  value={certBank}
                  onChange={(e) => setCertBank(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">مبلغ أصل الشهادة (EGP)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="100000"
                  value={certPrincipal}
                  onChange={(e) => setCertPrincipal(e.target.value)}
                  className="text-xs font-mono h-9"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">نسبة الفائدة السنوية (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="23.5"
                  value={certRate}
                  onChange={(e) => setCertRate(e.target.value)}
                  className="text-xs font-mono h-9"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">دورية صرف العائد</Label>
                <Select value={certFrequency} onValueChange={(val: any) => setCertFrequency(val)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">شهرياً</SelectItem>
                    <SelectItem value="quarterly">ربع سنوي (كل 3 شهور)</SelectItem>
                    <SelectItem value="semi_annual">نصف سنوي (كل 6 شهور)</SelectItem>
                    <SelectItem value="annual">سنوياً</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">تاريخ ربط الشهادة</Label>
                <Input
                  type="date"
                  value={certIssueDate}
                  onChange={(e) => setCertIssueDate(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">تاريخ استحقاق الأصل</Label>
                <Input
                  type="date"
                  value={certMaturityDate}
                  onChange={(e) => setCertMaturityDate(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">حساب إيداع وصرف العائد (اختياري)</Label>
              <Select value={certLinkedAccountId} onValueChange={setCertLinkedAccountId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="اختر الحساب البنكي المرتبط بصرف العائد..." />
                </SelectTrigger>
                <SelectContent>
                  {liquidAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.name} ({formatMoney(acc.baseValue ?? acc.balance, acc.currency, 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddCertModalOpen(false)}
              className="text-xs h-9"
            >
              إلغاء
            </Button>
            <Button
              disabled={isSubmittingCert}
              onClick={handleCreateCertificate}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white h-9 px-4"
            >
              {isSubmittingCert ? "جارٍ الحفظ..." : "حفظ وقيد الشهادة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default BankCertificatesHub;
