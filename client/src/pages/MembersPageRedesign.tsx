import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  UsersRound,
  ShieldCheck,
  KeyRound,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

const roleLabel: Record<string, string> = { owner: "مالك", advisor: "مستشار", editor: "محرر", viewer: "مشاهد" };
const invitationLabel: Record<string, string> = { pending: "معلق", accepted: "مقبولة", cancelled: "ملغاة", expired: "منتهية" };
const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");

const AVAILABLE_SCOPES = [
  { id: "reports", label: "التقارير المالية الموسعة" },
  { id: "financial_statements", label: "القوائم المالية المعتمدة" },
  { id: "reconciliation", label: "مطابقة وتسوية الدفاتر" },
  { id: "zakat", label: "الزكاة والالتزامات الضريبية" },
  { id: "lot_accounting", label: "سجل اللوتات وتكلفة الأصول" },
] as const;

export default function MembersPageRedesign() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const bootstrap = trpc.family.bootstrap.useQuery();
  const members = trpc.family.members.list.useQuery();
  const workspaces = trpc.family.workspaces.list.useQuery();
  const auditorTokens = trpc.family.auditor.listTokens.useQuery(undefined, {
    enabled: Boolean(bootstrap.data?.membership.role === "owner" || bootstrap.data?.membership.role === "advisor"),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"advisor" | "editor" | "viewer">("viewer");
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null);

  // Auditor Token State
  const [auditorLabel, setAuditorLabel] = useState("");
  const [targetAuditor, setTargetAuditor] = useState("");
  const [auditorPurpose, setAuditorPurpose] = useState("");
  const [auditorHours, setAuditorHours] = useState("72");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "reports",
    "financial_statements",
    "reconciliation",
  ]);
  const [newlyIssuedToken, setNewlyIssuedToken] = useState<{ token: string; label: string } | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  const invite = trpc.family.members.invite.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تسجيل دعوة ${data.email}. تُقبل عند دخول صاحب البريد.`);
      void utils.family.members.list.invalidate();
      setEmail("");
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const cancelInvitation = trpc.family.members.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء الدعوة وتسجيل الإجراء في التدقيق.");
      setPendingCancelId(null);
      void utils.family.members.list.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const setActive = trpc.family.workspaces.setActive.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير مساحة FAMILY النشطة.");
      void utils.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const issueAuditorTokenMutation = trpc.family.auditor.issueToken.useMutation({
    onSuccess: (data) => {
      toast.success("تم إصدار رمز وصول المدقق المالي بنجاح.");
      setNewlyIssuedToken({ token: data.token, label: data.label || "رمز تدقيق مالي" });
      setAuditorLabel("");
      setTargetAuditor("");
      setAuditorPurpose("");
      void auditorTokens.refetch();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const revokeAuditorTokenMutation = trpc.family.auditor.revokeToken.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء رمز وصول المدقق المالي فورًا.");
      setPendingRevokeId(null);
      void auditorTokens.refetch();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const isOwner = bootstrap.data?.membership.role === "owner";
  const isAdvisorOrOwner = isOwner || bootstrap.data?.membership.role === "advisor";

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label} إلى الحافظة.`);
  };

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-6" dir="rtl">
        <PageHeader
          title="الأعضاء ومساحات العمل (Workspaces & Members)"
          description="العضوية والصلاحية تُفرضان من الخادم. يُقبل البريد المدعو عند تسجيل صاحبه الدخول، ولا تمنح الدعوة الوصول قبل ذلك."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والإدارة", href: "/members" },
            { label: "الأعضاء ومساحات العمل" },
          ]}
          badge={{ text: "إدارة الوصول والصلاحيات", variant: "institutional" }}
          icon={UsersRound}
          actions={
            user?.role === "admin" ? (
              <Link
                href="/admin/users"
                className="inline-flex h-9 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs"
              >
                إدارة مستخدمي المنصة
              </Link>
            ) : undefined
          }
        />

        <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <p className="text-slate-900 dark:text-white font-bold text-sm mb-0.5">مساحات العمل النشطة</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">يمكنك التنقل فقط بين المساحات التي تملك عضوية فعالة فيها.</p>
            {workspaces.isLoading ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">جارىّ تحميل المساحات…</p>
            ) : (
              <div className="space-y-2">
                {workspaces.data?.map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => setActive.mutate({ workspaceId: space.id })}
                    disabled={setActive.isPending || bootstrap.data?.workspace.id === space.id}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-right transition-all ${bootstrap.data?.workspace.id === space.id
                      ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20"
                      : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0E1420] hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                  >
                    <span>
                      <strong className="block text-slate-900 dark:text-white text-xs font-bold">{space.name}</strong>
                      <small className="text-slate-500 dark:text-slate-400 text-[11px]">
                        عملة الأساس: {space.baseCurrency}
                        {bootstrap.data?.workspace.id === space.id ? " · نشطة الآن" : ""}
                      </small>
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs px-2.5 py-0.5 rounded-md">
                      {roleLabel[space.role] || space.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-0.5">
              <UsersRound className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-slate-900 dark:text-white font-bold text-sm">دعوة عضو جديد</p>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-5">المالك فقط يستطيع إنشاء دعوات. تتطلب الدعوة تسجيل الدخول بالبريد نفسه خلال سبعة أيام.</p>
            {members.isLoading || bootstrap.isLoading ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">جارىّ تحميل الأعضاء…</p>
            ) : members.error ? (
              <div className="rounded-xl border border-rose-200/80 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300">
                {errorText(members.error)}
              </div>
            ) : (
              <>
                {isOwner && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      invite.mutate({ email, role });
                    }}
                    className="grid gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1420] p-4 sm:grid-cols-[1fr_150px_auto] mb-5"
                  >
                    <div className="grid gap-1.5">
                      <label htmlFor="member-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">البريد الإلكتروني</label>
                      <input
                        id="member-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="email@example.com"
                        required
                        dir="ltr"
                        className="h-9 bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs py-2 px-3 font-medium w-full focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">الدور</label>
                      <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                        <SelectTrigger className="h-9 text-xs bg-white dark:bg-[#0E1420] border-slate-300 dark:border-slate-700/80 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="advisor" className="text-xs">مستشار</SelectItem>
                          <SelectItem value="editor" className="text-xs">محرر</SelectItem>
                          <SelectItem value="viewer" className="text-xs">مشاهد</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <button
                      type="submit"
                      disabled={invite.isPending}
                      className="self-end bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {invite.isPending && <Loader2 className="size-3.5 animate-spin" />}
                      دعوة عضو
                    </button>
                  </form>
                )}

                {/* Members table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full min-w-[520px] text-right text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                        <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">العضو</th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">البريد</th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الدور</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {members.data?.activeMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-50/60 dark:hover:bg-[#111827]/40 transition-colors">
                          <td className="py-3 px-4 text-xs font-bold text-slate-900 dark:text-white">{member.name || "عضو FAMILY"}</td>
                          <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                            {member.email || "بريد غير متاح"}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs px-2.5 py-0.5 rounded-md">
                              {roleLabel[member.role] || member.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invitations */}
                {members.data?.invitations.length ? (
                  <div className="mt-4">
                    <p className="mb-3 text-xs font-bold text-slate-800 dark:text-slate-200">الدعوات</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <table className="w-full min-w-[520px] text-right text-sm">
                        <thead>
                          <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                            <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">البريد</th>
                            <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الدور</th>
                            <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">الحالة</th>
                            <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {members.data.invitations.map((invitation) => (
                            <tr key={invitation.id} className="hover:bg-slate-50/60 dark:hover:bg-[#111827]/40 transition-colors">
                              <td className="py-3 px-4 text-xs" dir="ltr">{invitation.email}</td>
                              <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{roleLabel[invitation.role] || invitation.role}</td>
                              <td className="py-3 px-4 text-xs">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${invitation.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700"
                                  }`}>
                                  {invitationLabel[invitation.status] || invitation.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs">
                                {isOwner && invitation.status === "pending" ? (
                                  <button
                                    type="button"
                                    disabled={cancelInvitation.isPending}
                                    onClick={() => setPendingCancelId(invitation.id)}
                                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                                  >
                                    إلغاء
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

        </section>


        {/* Phase 13: Auditor / Tax Advisor Tokens Section */}
        {isAdvisorOrOwner && (
          <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-4" />
                </div>
                <p className="text-slate-900 dark:text-white font-bold text-sm">رموز وصول المدقق المالي (Auditor Access Tokens)</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">قراءة وتدقيق فقط</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-5 leading-5">
              إصدار رموز وصول مؤقتة، محددة النطاق، ومقيدة بالقراءة فقط لتمكين التدقيق الخارجي دون منح صلاحيات تشغيلية.
            </p>

            {/* Newly Issued Token Display Banner */}
            {newlyIssuedToken && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl space-y-3 mb-4">
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>تم إصدار الرمز بنجاح: {newlyIssuedToken.label}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  انسخ هذا الرمز أو رابط البوابة المباشر وشاركه عبر قناة آمنة. لن يُعرض الرمز الخام مرة أخرى.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    readOnly
                    dir="ltr"
                    value={newlyIssuedToken.token}
                    className="h-9 flex-1 font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 select-all text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newlyIssuedToken.token, "رمز الوصول")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs border border-slate-900 dark:border-transparent shrink-0"
                  >
                    <Copy className="size-3.5" />
                    نسخ الرمز
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/auditor-portal?token=${encodeURIComponent(newlyIssuedToken.token)}`,
                        "رابط بوابة التدقيق"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs border border-slate-200 dark:border-slate-700 shrink-0"
                  >
                    <ExternalLink className="size-3.5" />
                    نسخ الرابط المباشر
                  </button>
                </div>
              </div>
            )}

            {/* Token Issuance Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!auditorLabel.trim() || !targetAuditor.trim() || !auditorPurpose.trim()) {
                  toast.error("يرجى ملء جميع الحقول الإلزامية لإصدار الرمز.");
                  return;
                }
                if (selectedScopes.length === 0) {
                  toast.error("يرجى اختيار نطاق تدقيقي واحد على الأقل.");
                  return;
                }
                issueAuditorTokenMutation.mutate({
                  label: auditorLabel,
                  targetAuditor,
                  purpose: auditorPurpose,
                  durationHours: Number(auditorHours),
                  allowedScopes: selectedScopes as any,
                });
              }}
              className="grid gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#0E1420] p-4 mb-5"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <label htmlFor="aud-label" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    وصف الرمز / المرجع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="aud-label"
                    placeholder="مثال: مراجعة الربع الأول 2026"
                    value={auditorLabel}
                    onChange={(e) => setAuditorLabel(e.target.value)}
                    required
                    className="h-9 bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs py-2 px-3 font-medium w-full focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="aud-target" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    اسم المدقق أو الجهة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="aud-target"
                    placeholder="مثال: مكتب المراجع القانوني المستقل"
                    value={targetAuditor}
                    onChange={(e) => setTargetAuditor(e.target.value)}
                    required
                    className="h-9 bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs py-2 px-3 font-medium w-full focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">مدة الصلاحية</label>
                  <Select value={auditorHours} onValueChange={setAuditorHours}>
                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-[#0E1420] border-slate-300 dark:border-slate-700/80 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24" className="text-xs">24 ساعة (يوم عمل واحد)</SelectItem>
                      <SelectItem value="72" className="text-xs">72 ساعة (3 أيام)</SelectItem>
                      <SelectItem value="168" className="text-xs">7 أيام (أسبوع)</SelectItem>
                      <SelectItem value="720" className="text-xs">30 يومًا (شهر)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="aud-purpose" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الغرض من التدقيق <span className="text-rose-500">*</span>
                </label>
                <input
                  id="aud-purpose"
                  placeholder="مثال: التدقيق الدوري على القوائم المالية السنوية"
                  value={auditorPurpose}
                  onChange={(e) => setAuditorPurpose(e.target.value)}
                  required
                  className="h-9 bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs py-2 px-3 font-medium w-full focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Scope checkboxes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  النطاقات والتقارير المصرح للمدقق بالاطلاع عليها:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-[#0E1420]/40 text-slate-700 dark:text-slate-300 text-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <Checkbox
                        checked={selectedScopes.includes(scope.id)}
                        onCheckedChange={() => toggleScope(scope.id)}
                      />
                      <span>{scope.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={issueAuditorTokenMutation.isPending}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-3 px-4 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {issueAuditorTokenMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <KeyRound className="size-3.5" />
                )}
                إصدار رمز وصول المدقق
              </button>
            </form>

            {/* Existing Tokens Table */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">سجل رموز الوصول الصادرة:</p>
              {auditorTokens.isLoading ? (
                <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">جارىّ تحميل الرموز…</p>
              ) : auditorTokens.data?.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full min-w-[640px] text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 dark:bg-[#0E1420] border-b border-slate-200/90 dark:border-slate-800/80">
                        <th className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400">المعرف / الوصف</th>
                        <th className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400">الجهة المراجعة</th>
                        <th className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400">النطاقات</th>
                        <th className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400">تاريخ الانتهاء</th>
                        <th className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400">الحالة</th>
                        <th className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {auditorTokens.data.map((tok) => (
                        <tr key={tok.tokenId} className="hover:bg-slate-50/60 dark:hover:bg-[#111827]/40 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{tok.label}</div>
                            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400" dir="ltr">{tok.tokenId}</div>
                          </td>
                          <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{tok.targetAuditor}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {tok.allowedScopes.map((sc) => (
                                <span key={sc} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {sc}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400" dir="ltr">
                            <span className="font-mono tabular-nums text-xs">{new Date(tok.expiresAt).toISOString().slice(0, 10)}</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${tok.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : tok.status === "expired"
                                ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              }`}>
                              {tok.status === "active" ? "نشط" : tok.status === "expired" ? "منتهي" : "ملغى"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {tok.status === "active" ? (
                              <button
                                type="button"
                                disabled={revokeAuditorTokenMutation.isPending}
                                onClick={() => setPendingRevokeId(tok.tokenId)}
                                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                              >
                                إلغاء الصلاحية
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-[#0E1420]/30">
                  <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-2.5">
                    <Lock className="size-5" />
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-bold text-xs mb-1">سجل رموز الوصول فارغ</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">لا توجد رموز وصول للمدققين حاليًا في هذه المساحة.</p>
                </div>
              )}
            </div>
          </div>
        )}


        <ConfirmDialog
          open={Boolean(pendingCancelId)}
          onOpenChange={(open) => {
            if (!open) setPendingCancelId(null);
          }}
          title="إلغاء دعوة عضو"
          description="هل أنت متأكد من رغبتك في إلغاء هذه الدعوة؟ لن يتمكن المدعو من استخدامها للوصول إلى مساحة FAMILY."
          confirmLabel="تأكيد الإلغاء"
          cancelLabel="تراجع"
          variant="destructive"
          isLoading={cancelInvitation.isPending}
          onConfirm={() => {
            if (pendingCancelId) cancelInvitation.mutate({ invitationId: pendingCancelId });
          }}
        />

        <ConfirmDialog
          open={Boolean(pendingRevokeId)}
          onOpenChange={(open) => {
            if (!open) setPendingRevokeId(null);
          }}
          title="إلغاء رمز وصول المدقق المالي فورًا"
          description="هل أنت متأكد من رغبتك في إلغاء هذا الرمز؟ سيتم إنهاء جلسة التدقيق المالي فورًا ومنع أي استعراض إضافي للبيانات."
          confirmLabel="تأكيد الإلغاء الفوري"
          cancelLabel="تراجع"
          variant="destructive"
          isLoading={revokeAuditorTokenMutation.isPending}
          onConfirm={() => {
            if (pendingRevokeId) revokeAuditorTokenMutation.mutate({ tokenId: pendingRevokeId });
          }}
        />
      </main>
    </DashboardLayout >
  );
}
