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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
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
                  <Input
                    id="token"
                    type="text"
                    dir="ltr"
                    placeholder="faud.ey..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-white font-mono text-sm"
                  />
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      معرف المساحة: #{payload.workspaceId}
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      الجهة: {payload.targetAuditor}
                    </Badge>
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
                      <CardTitle className="text-white text-base">حزمة القوائم المالية المعتمدة</CardTitle>
                      <CardDescription className="text-slate-400">
                        استعراض وتصدير المركز المالي، الدخل الشامل، التدفقات النقدية وشهادات المطابقة.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">الوصول الكامل إلى شاشة التقارير الرسمية:</span>
                          <Link
                            href="/reports"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg border border-emerald-500/30 text-xs font-semibold"
                          >
                            فتح مركز التقارير المالية
                          </Link>
                        </div>
                        <p className="text-xs text-slate-500">
                          ملاحظة تدقيقية: يتم تسجيل كافة عمليات التوليد والتحميل تلقائيًا في سجل التدقيق المالي مع بصمة المعرف {payload.tokenId}.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Zakat Tab */}
              {allowedScopes.includes("zakat") && (
                <TabsContent value="zakat" className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base">تقييمات الزكاة والالتزام الضريبي</CardTitle>
                      <CardDescription className="text-slate-400">
                        مراجعة الوعاء الزكوي، النصاب، الحول المكتمل ومطابقة السندات الشرعية والنظامية.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">الوصول إلى سجل تقييمات الزكاة:</span>
                          <Link
                            href="/reports"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg border border-emerald-500/30 text-xs font-semibold"
                          >
                            استعراض التقييمات الزكوية
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Reconciliation Tab */}
              {allowedScopes.includes("reconciliation") && (
                <TabsContent value="reconciliation" className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base">تسوية ومطابقة الحسابات المصرفية والاستثمارية</CardTitle>
                      <CardDescription className="text-slate-400">
                        التحقق من توازن الأستاذ المالي (Double-Entry Ledger Invariance) ومطابقة الحسابات الحقيقية.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">سجل المطابقة والتسوية:</span>
                          <Link
                            href="/reconciliation"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg border border-emerald-500/30 text-xs font-semibold"
                          >
                            فتح سجل المطابقة
                          </Link>
                        </div>
                      </div>
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
                        التدقيق في لوتات الشراء والبيع، الأرباح المحققة وغير المحققة وتوزيعات الأرباح النقدية.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">سجل محاسبة اللوتات:</span>
                          <Link
                            href="/lot-accounting"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg border border-emerald-500/30 text-xs font-semibold"
                          >
                            استعراض تفاصيل اللوتات
                          </Link>
                        </div>
                      </div>
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
