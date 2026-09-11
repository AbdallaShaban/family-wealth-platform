import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  FileCheck2,
  Calendar,
  AlertCircle,
  Clock,
  UserCheck,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  Receipt,
  Scale,
  Eye,
  EyeOff,
  ClipboardPaste,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const SCOPE_LABELS: Record<string, string> = {
  reports: "التقارير المالية الموسعة",
  financial_statements: "القوائم المالية المعتمدة",
  reconciliation: "مطابقة وتسوية الدفاتر",
  zakat: "تقييم الزكاة والالتزامات الضريبية",
  lot_accounting: "سجل اللوتات وتكلفة الأصول",
};

export default function AuditorPortalPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [activeToken, setActiveToken] = useState<string>("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");
    if (tokenFromUrl) {
      setActiveToken(tokenFromUrl);
      setTokenInput(tokenFromUrl);
    }
  }, []);

  const validateQuery = trpc.family.auditor.validateToken.useQuery(
    { token: activeToken },
    {
      enabled: Boolean(activeToken),
      retry: false,
    }
  );

  const recordAccessMutation = trpc.family.auditor.recordAccess.useMutation();

  useEffect(() => {
    if (validateQuery.data?.valid && activeToken) {
      recordAccessMutation.mutate({
        token: activeToken,
        accessedRoute: "/auditor-portal",
      });
    }
  }, [validateQuery.data?.valid, activeToken]);

  const handleApplyToken = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      toast.error("يرجى إدخال رمز الوصول للمدقق المالي.");
      return;
    }
    setActiveToken(cleanToken);
    window.history.replaceState({}, "", `?token=${encodeURIComponent(cleanToken)}`);
  };

  const session = validateQuery.data?.valid === true ? validateQuery.data : null;
  const isExpired = Boolean(session && session.expiresAt <= Date.now());
  const payload = session && !isExpired ? session : null;
  const allowedScopes = payload ? payload.allowedScopes : [];
  const expiresAt = payload ? payload.expiresAt : 0;

  const statementsQuery = trpc.family.auditor.getAuditorFinancialStatements.useQuery(
    { token: activeToken },
    { enabled: Boolean(activeToken && payload && (allowedScopes.includes("financial_statements") || allowedScopes.includes("reports"))) }
  );

  const reconQuery = trpc.family.auditor.getAuditorReconciliation.useQuery(
    { token: activeToken },
    { enabled: Boolean(activeToken && payload && allowedScopes.includes("reconciliation")) }
  );

  const zakatQuery = trpc.family.auditor.getAuditorZakat.useQuery(
    { token: activeToken },
    { enabled: Boolean(activeToken && payload && allowedScopes.includes("zakat")) }
  );

  const lotsQuery = trpc.family.auditor.getAuditorLotAccounting.useQuery(
    { token: activeToken },
    { enabled: Boolean(activeToken && payload && allowedScopes.includes("lot_accounting")) }
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Dedicated Auditor Top Banner */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>واجهة وصول مخصصة للمراجعين المستقلين — تدقيق خارجي فقط</span>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shrink-0">
            تدقيق مستقل (External Audit Only)
          </Badge>
        </div>

        {/* Institutional Top Bar */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  بوابة التدقيق المالي والاستشارة الضريبية
                </h1>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/5">
                  جلسة مراجعة مقيدة (Read-Only)
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                وصول مراجع خارجي موثق تشفيريًا وفق ضوابط الحوكمة المؤسسية لمكاتب العائلات الاستثمارية (FAMILY).
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg px-3 py-1.5 transition-colors"
          >
            العودة للمنصة الرئيسية
          </Link>
        </header>

        {/* Token Input Card if no valid token */}
        {(!payload || isExpired) && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                التحقق من رمز وصول المدقق المالي (Auditor Access Token)
              </CardTitle>
              <CardDescription className="text-slate-400">
                أدخل رمز الوصول الممنوح لك من قبل مكتب العائلة (يبدأ بـ faud.) لبدء جلسة التدقيق المعتمدة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleApplyToken} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-slate-300">
                    رمز الوصول (Access Token)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="token"
                      type={showToken ? "text" : "password"}
                      dir="ltr"
                      placeholder="faud.ey..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="bg-slate-950 border-slate-700 text-white font-mono text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowToken(!showToken)}
                      className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 h-10 px-3 shrink-0"
                      title={showToken ? "إخفاء الرمز" : "إظهار الرمز"}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setTokenInput(text.trim());
                            toast.success("تم لصق الرمز من الحافظة");
                          }
                        } catch {
                          toast.error("تعذر الوصول إلى الحافظة");
                        }
                      }}
                      className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 h-10 px-3 shrink-0"
                      title="لصق من الحافظة"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {validateQuery.data && !validateQuery.data.valid && (
                  <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg flex items-center gap-2 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{validateQuery.data.error || "رمز الوصول غير صالح أو تم إلغاؤه."}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={validateQuery.isFetching}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {validateQuery.isFetching ? "جارٍ التحقق..." : "تفعيل الجلسة واستعراض البيانات"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Valid Session Overview Card */}
        {payload && !isExpired && (
          <>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      جلسة التدقيق النشطة: {payload.label}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      الغرض من التدقيق: {payload.purpose}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      معرف المساحة: #{payload.workspaceId}
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      الجهة: {payload.targetAuditor}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveToken("");
                        setTokenInput("");
                        window.history.replaceState({}, "", window.location.pathname);
                        toast.info("تم إنهاء جلسة التدقيق");
                      }}
                      className="border-red-800/50 text-red-300 hover:text-red-100 hover:bg-red-950/50 h-8 gap-1.5 text-xs"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      إنهاء الجلسة
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-300">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>المدقق المعتمد:</span>
                    <strong className="text-white">{payload.targetAuditor}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>صالح حتى:</span>
                    <strong className="text-white" dir="ltr">
                      {new Date(expiresAt).toLocaleString("ar-SA")}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Lock className="w-4 h-4 text-sky-400" />
                    <span>مستوى الصلاحية:</span>
                    <strong className="text-white">قراءة وتدقيق فقط (Read-Only)</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2">النطاقات والتقارير المصرح بها:</h4>
                  <div className="flex flex-wrap gap-2">
                    {allowedScopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="secondary"
                        className="bg-slate-800 text-emerald-300 border border-slate-700"
                      >
                        {SCOPE_LABELS[scope] || scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Read-Only Tabs for Authorized Scopes */}
            <Tabs defaultValue={allowedScopes[0] || "reports"} className="space-y-4">
              <TabsList className="bg-slate-900 border border-slate-800 text-slate-400">
                {(allowedScopes.includes("reports") || allowedScopes.includes("financial_statements")) && (
                  <TabsTrigger value="financial_statements" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                    <FileSpreadsheet className="w-4 h-4 ml-1.5" />
                    القوائم والتقارير المالية
                  </TabsTrigger>
                )}
                {allowedScopes.includes("zakat") && (
                  <TabsTrigger value="zakat" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                    <Receipt className="w-4 h-4 ml-1.5" />
                    الزكاة والالتزامات الضريبية
                  </TabsTrigger>
                )}
                {allowedScopes.includes("reconciliation") && (
                  <TabsTrigger value="reconciliation" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                    <Scale className="w-4 h-4 ml-1.5" />
                    تسوية ومطابقة الدفاتر
                  </TabsTrigger>
                )}
                {allowedScopes.includes("lot_accounting") && (
                  <TabsTrigger value="lot_accounting" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                    <Building2 className="w-4 h-4 ml-1.5" />
                    تكلفة اللوتات والمخزون
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Financial Statements Tab */}
              {(allowedScopes.includes("reports") || allowedScopes.includes("financial_statements")) && (
                <TabsContent value="financial_statements" className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base">حزمة القوائم المالية المعتمدة (قراءة وتدقيق فقط)</CardTitle>
                      <CardDescription className="text-slate-400">
                        البيانات المستخرجة مباشرة من الأستاذ المالي وفق ضوابط التدقيق المؤسسي.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {statementsQuery.isLoading ? (
                        <p className="text-slate-400 text-sm">جارٍ تحميل القوائم المالية...</p>
                      ) : statementsQuery.error ? (
                        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-sm">
                          {statementsQuery.error.message}
                        </div>
                      ) : statementsQuery.data ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500">إجمالي الأصول (Book Assets)</p>
                              <p className="text-lg font-bold text-emerald-400 mt-1">
                                {statementsQuery.data.statements.bookBalanceSheet.assets.totalBookAssets} {statementsQuery.data.workspace.baseCurrency}
                              </p>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500">إجمالي الالتزامات (Liabilities)</p>
                              <p className="text-lg font-bold text-amber-400 mt-1">
                                {statementsQuery.data.statements.bookBalanceSheet.liabilities.totalBookLiabilities} {statementsQuery.data.workspace.baseCurrency}
                              </p>
                            </div>
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500">صافي حقوق الملكية (Net Book Equity)</p>
                              <p className="text-lg font-bold text-sky-400 mt-1">
                                {statementsQuery.data.statements.bookBalanceSheet.equity.totalBookEquity} {statementsQuery.data.workspace.baseCurrency}
                              </p>
                            </div>
                          </div>
                          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                            <span>حالة توازن المركز المالي: {statementsQuery.data.statements.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity ? "متوازن ومطابق ✓" : "غير متوازن ⚠"}</span>
                            <span>تاريخ القوائم: {statementsQuery.data.statements.metadata.asOf}</span>
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Zakat Tab */}
              {allowedScopes.includes("zakat") && (
                <TabsContent value="zakat" className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base">تقييمات الزكاة والالتزام الشرعي (قراءة فقط)</CardTitle>
                      <CardDescription className="text-slate-400">
                        سجل التقييمات الزكوية المعتمدة لمساحة العمل #{payload.workspaceId}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {zakatQuery.isLoading ? (
                        <p className="text-slate-400 text-sm">جارٍ تحميل تقييمات الزكاة...</p>
                      ) : zakatQuery.error ? (
                        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-sm">
                          {zakatQuery.error.message}
                        </div>
                      ) : zakatQuery.data ? (
                        zakatQuery.data.assessments.length === 0 ? (
                          <p className="text-slate-500 text-sm">لا توجد تقييمات زكاة مسجلة حتى الآن.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-right border-collapse">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-400">
                                  <th className="p-2">تاريخ التقييم</th>
                                  <th className="p-2">الوعاء الزكوي الخاضع</th>
                                  <th className="p-2">حد النصاب</th>
                                  <th className="p-2">الزكاة المستحقة</th>
                                  <th className="p-2">الحالة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {zakatQuery.data.assessments.map((item) => (
                                  <tr key={item.id} className="border-b border-slate-800/50">
                                    <td className="p-2 text-white font-mono" dir="ltr">
                                      {new Date(item.assessedAt).toLocaleDateString("ar-SA")}
                                    </td>
                                    <td className="p-2 text-slate-300">{item.eligibleBase} {item.currency}</td>
                                    <td className="p-2 text-slate-400">{item.nisabBase} {item.currency}</td>
                                    <td className="p-2 text-emerald-400 font-semibold">{item.zakatDueBase} {item.currency}</td>
                                    <td className="p-2">
                                      <Badge variant="outline" className="text-xs">
                                        {item.status}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : null}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Reconciliation Tab */}
              {allowedScopes.includes("reconciliation") && (
                <TabsContent value="reconciliation" className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base">تسوية ومطابقة الحسابات (قراءة فقط)</CardTitle>
                      <CardDescription className="text-slate-400">
                        التحقق من توازن الأستاذ المالي (Double-Entry Invariants) والأحداث المنشورة.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {reconQuery.isLoading ? (
                        <p className="text-slate-400 text-sm">جارٍ تحميل تقرير المطابقة...</p>
                      ) : reconQuery.error ? (
                        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-sm">
                          {reconQuery.error.message}
                        </div>
                      ) : reconQuery.data ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-2">
                              {reconQuery.data.report.status === "healthy" ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-400" />
                              )}
                              <span className="font-semibold text-white">
                                حالة الدفتر: {reconQuery.data.report.status === "healthy" ? "متوازن وسليم" : "يتطلب تدقيق"}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400" dir="ltr">
                              {new Date(reconQuery.data.report.generatedAt).toLocaleString("ar-SA")}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500">إجمالي المدين</p>
                              <p className="text-base font-bold text-slate-200 mt-1">
                                {reconQuery.data.report.trialBalance.totalDebitBase} {reconQuery.data.workspace.baseCurrency}
                              </p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500">إجمالي الدائن</p>
                              <p className="text-base font-bold text-slate-200 mt-1">
                                {reconQuery.data.report.trialBalance.totalCreditBase} {reconQuery.data.workspace.baseCurrency}
                              </p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                              <p className="text-xs text-slate-500">الفرق (Difference)</p>
                              <p className={`text-base font-bold mt-1 ${reconQuery.data.report.trialBalance.differenceBase === "0.000000" ? "text-emerald-400" : "text-amber-400"}`}>
                                {reconQuery.data.report.trialBalance.differenceBase} {reconQuery.data.workspace.baseCurrency}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Lot Accounting Tab */}
              {allowedScopes.includes("lot_accounting") && (
                <TabsContent value="lot_accounting" className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base">سجل اللوتات وتكلفة الأساس (FIFO Cost Basis)</CardTitle>
                      <CardDescription className="text-slate-400">
                        لوتات الاستثمار المفتوحة والمغلقة وأسعار التكلفة الفعلية.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {lotsQuery.isLoading ? (
                        <p className="text-slate-400 text-sm">جارٍ تحميل سجل اللوتات...</p>
                      ) : lotsQuery.error ? (
                        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-sm">
                          {lotsQuery.error.message}
                        </div>
                      ) : lotsQuery.data ? (
                        lotsQuery.data.lots.length === 0 ? (
                          <p className="text-slate-500 text-sm">لا توجد لوتات استثمارية مسجلة.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-right border-collapse">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-400">
                                  <th className="p-2">الأداة</th>
                                  <th className="p-2">تاريخ الفتح</th>
                                  <th className="p-2">الكمية الأصلية</th>
                                  <th className="p-2">الكمية المتبقية</th>
                                  <th className="p-2">تكلفة الوحدة</th>
                                  <th className="p-2">الحالة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lotsQuery.data.lots.slice(0, 20).map((lot) => {
                                  const inst = lotsQuery.data?.instruments.find((i) => i.id === lot.instrumentId);
                                  return (
                                    <tr key={lot.id} className="border-b border-slate-800/50">
                                      <td className="p-2 text-white font-semibold">{inst?.symbol || `#${lot.instrumentId}`}</td>
                                      <td className="p-2 text-slate-400" dir="ltr">
                                        {new Date(lot.acquiredAt).toLocaleDateString("ar-SA")}
                                      </td>
                                      <td className="p-2 text-slate-300">{lot.originalQuantity}</td>
                                      <td className="p-2 text-emerald-400 font-semibold">{lot.remainingQuantity}</td>
                                      <td className="p-2 text-slate-300">{lot.unitCost}</td>
                                      <td className="p-2">
                                        <Badge variant="outline" className="text-xs">
                                          {lot.status}
                                        </Badge>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : null}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
