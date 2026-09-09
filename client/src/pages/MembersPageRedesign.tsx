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
          title="الأعضاء ومساحات FAMILY"
          description="العضوية والصلاحية تُفرضان من الخادم. يُقبل البريد المدعو عند تسجيل صاحبه الدخول، ولا تمنح الدعوة الوصول قبل ذلك."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والتحليل", href: "/members" },
            { label: "الأعضاء ومساحات FAMILY" },
          ]}
          badge={{ text: "إدارة الوصول", variant: "institutional" }}
          icon={UsersRound}
          actions={
            user?.role === "admin" ? (
              <Link
                href="/admin/users"
                className="inline-flex h-10 items-center rounded-lg border border-primary/25 bg-primary/5 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                إدارة مستخدمي المنصة
              </Link>
            ) : undefined
          }
        />

        <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <Card className="fintech-surface-card">
            <CardHeader>
              <CardTitle>مساحة العمل النشطة</CardTitle>
              <CardDescription>يمكنك التنقل فقط بين المساحات التي تملك عضوية فعالة فيها.</CardDescription>
            </CardHeader>
            <CardContent>
              {workspaces.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل المساحات…</p>
              ) : (
                <div className="space-y-3">
                  {workspaces.data?.map((space) => (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => setActive.mutate({ workspaceId: space.id })}
                      disabled={setActive.isPending || bootstrap.data?.workspace.id === space.id}
                      className={`members-workspace-row ${
                        bootstrap.data?.workspace.id === space.id ? "is-active" : ""
                      }`}
                    >
                      <span>
                        <strong>{space.name}</strong>
                        <small>
                          عملة الأساس: {space.baseCurrency}
                          {bootstrap.data?.workspace.id === space.id ? " · نشطة الآن" : ""}
                        </small>
                      </span>
                      <Badge variant="outline">{roleLabel[space.role] || space.role}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="fintech-surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="size-5 text-primary" />
                أعضاء النطاق
              </CardTitle>
              <CardDescription>
                المالك فقط يستطيع إنشاء دعوات. تتطلب الدعوة تسجيل الدخول بالبريد نفسه خلال سبعة أيام.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {members.isLoading || bootstrap.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل الأعضاء…</p>
              ) : members.error ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {errorText(members.error)}
                </p>
              ) : (
                <>
                  {isOwner && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        invite.mutate({ email, role });
                      }}
                      className="grid gap-3 rounded-xl border bg-muted/35 p-4 sm:grid-cols-[1fr_150px_auto]"
                    >
                      <div className="grid gap-2">
                        <Label htmlFor="member-email">البريد الإلكتروني</Label>
                        <Input
                          id="member-email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="email@example.com"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>الدور</Label>
                        <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="advisor">مستشار</SelectItem>
                            <SelectItem value="editor">محرر</SelectItem>
                            <SelectItem value="viewer">مشاهد</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="self-end" type="submit" disabled={invite.isPending}>
                        {invite.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}دعوة عضو
                      </Button>
                    </form>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="p-3">العضو</th>
                          <th className="p-3">البريد</th>
                          <th className="p-3">الدور</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {members.data?.activeMembers.map((member) => (
                          <tr key={member.id}>
                            <td className="p-3 font-semibold">{member.name || "عضو FAMILY"}</td>
                            <td className="p-3 text-slate-600" dir="ltr">
                              {member.email || "بريد غير متاح"}
                            </td>
                            <td className="p-3">
                              <Badge variant="secondary">{roleLabel[member.role] || member.role}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {members.data?.invitations.length ? (
                    <div>
                      <h2 className="mb-3 text-sm font-bold">الدعوات</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-right text-sm">
                          <thead className="bg-slate-50 text-xs text-slate-600">
                            <tr>
                              <th className="p-3">البريد</th>
                              <th className="p-3">الدور</th>
                              <th className="p-3">الحالة</th>
                              <th className="p-3">إجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {members.data.invitations.map((invitation) => (
                              <tr key={invitation.id}>
                                <td className="p-3" dir="ltr">
                                  {invitation.email}
                                </td>
                                <td className="p-3">{roleLabel[invitation.role] || invitation.role}</td>
                                <td className="p-3">
                                  <Badge
                                    variant={invitation.status === "pending" ? "outline" : "secondary"}
                                  >
                                    {invitationLabel[invitation.status] || invitation.status}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  {isOwner && invitation.status === "pending" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-700 hover:text-red-800"
                                      disabled={cancelInvitation.isPending}
                                      onClick={() => setPendingCancelId(invitation.id)}
                                    >
                                      إلغاء
                                    </Button>
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
            </CardContent>
          </Card>
        </section>

        {/* Phase 13: Auditor / Tax Advisor Tokens Section */}
        {isAdvisorOrOwner && (
          <Card className="fintech-surface-card border-primary/20">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      رموز وصول المدقق المالي والمستشار الضريبي (Auditor Access Tokens)
                    </CardTitle>
                    <CardDescription>
                      إصدار رموز وصول مؤقتة، محددة النطاق، ومقيدة بالقراءة فقط لتمكين التدقيق الخارجي دون منح صلاحيات تشغيلية.
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary self-start sm:self-center">
                  قراءة وتدقيق فقط
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Newly Issued Token Display Banner */}
              {newlyIssuedToken && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تم إصدار الرمز بنجاح: {newlyIssuedToken.label}</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    انسخ هذا الرمز أو رابط البوابة المباشر وشاركه عبر قناة آمنة. لن يُعرض الرمز الخام مرة أخرى.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input
                      readOnly
                      dir="ltr"
                      value={newlyIssuedToken.token}
                      className="font-mono text-xs bg-white dark:bg-slate-900 select-all"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => copyToClipboard(newlyIssuedToken.token, "رمز الوصول")}
                      className="shrink-0"
                    >
                      <Copy className="w-4 h-4 ml-1" />
                      نسخ الرمز
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/auditor-portal?token=${encodeURIComponent(
                            newlyIssuedToken.token
                          )}`,
                          "رابط بوابة التدقيق"
                        )
                      }
                      className="shrink-0"
                    >
                      <ExternalLink className="w-4 h-4 ml-1" />
                      نسخ الرابط المباشر
                    </Button>
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
                className="grid gap-4 rounded-xl border bg-muted/20 p-4"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="aud-label" className="text-xs font-semibold">
                      وصف الرمز / المرجع <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="aud-label"
                      placeholder="مثال: مراجعة الربع الأول 2026"
                      value={auditorLabel}
                      onChange={(e) => setAuditorLabel(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="aud-target" className="text-xs font-semibold">
                      اسم المدقق أو الجهة <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="aud-target"
                      placeholder="مثال: مكتب المراجع القانوني المستقل"
                      value={targetAuditor}
                      onChange={(e) => setTargetAuditor(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">مدة الصلاحية</Label>
                    <Select value={auditorHours} onValueChange={setAuditorHours}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 ساعة (يوم عمل واحد)</SelectItem>
                        <SelectItem value="72">72 ساعة (3 أيام)</SelectItem>
                        <SelectItem value="168">7 أيام (أسبوع)</SelectItem>
                        <SelectItem value="720">30 يومًا (شهر)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="aud-purpose" className="text-xs font-semibold">
                    الغرض من التدقيق والملاحظات الإلزامية <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="aud-purpose"
                    placeholder="مثال: التدقيق الدوري على القوائم المالية السنوية والامتثال الزكوي"
                    value={auditorPurpose}
                    onChange={(e) => setAuditorPurpose(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    النطاقات والتقارير المصرح للمدقق بالاطلاع عليها:
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <label
                        key={scope.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border bg-background text-xs cursor-pointer hover:bg-muted/40 transition-colors"
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

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={issueAuditorTokenMutation.isPending}
                    className="gap-2"
                  >
                    {issueAuditorTokenMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4" />
                    )}
                    إصدار رمز وصول المدقق
                  </Button>
                </div>
              </form>

              {/* Existing Tokens Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">سجل رموز الوصول الصادرة:</h3>
                {auditorTokens.isLoading ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">جارٍ تحميل الرموز…</p>
                ) : auditorTokens.data?.length ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[640px] text-right text-xs">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="p-2.5">المعرف / الوصف</th>
                          <th className="p-2.5">الجهة المراجعة</th>
                          <th className="p-2.5">النطاقات المصرح بها</th>
                          <th className="p-2.5">تاريخ الانتهاء</th>
                          <th className="p-2.5">الحالة</th>
                          <th className="p-2.5 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {auditorTokens.data.map((tok) => (
                          <tr key={tok.tokenId} className="hover:bg-muted/20">
                            <td className="p-2.5">
                              <div className="font-semibold text-foreground">{tok.label}</div>
                              <div className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                                {tok.tokenId}
                              </div>
                            </td>
                            <td className="p-2.5 font-medium">{tok.targetAuditor}</td>
                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1">
                                {tok.allowedScopes.map((sc) => (
                                  <Badge key={sc} variant="outline" className="text-[10px] py-0">
                                    {sc}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="p-2.5 text-muted-foreground" dir="ltr">
                              {new Date(tok.expiresAt).toLocaleDateString("ar-SA")}
                            </td>
                            <td className="p-2.5">
                              <Badge
                                variant={
                                  tok.status === "active"
                                    ? "default"
                                    : tok.status === "expired"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="text-[10px]"
                              >
                                {tok.status === "active"
                                  ? "نشط"
                                  : tok.status === "expired"
                                  ? "منتهي"
                                  : "ملغى"}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-center">
                              {tok.status === "active" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 h-7 text-xs px-2"
                                  disabled={revokeAuditorTokenMutation.isPending}
                                  onClick={() => setPendingRevokeId(tok.tokenId)}
                                >
                                  إلغاء الصلاحية
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                    لا توجد رموز وصول للمدققين حاليًا في هذه المساحة.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
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
    </DashboardLayout>
  );
}
