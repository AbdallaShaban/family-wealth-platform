import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MailCheck, MailPlus, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال العملية الآن.";
const formatDateTime = (value: Date | number) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const invitationStatusLabel: Record<string, string> = { pending_login: "بانتظار تسجيل Google", awaiting_review: "جاهزة للمراجعة الثانية", approved: "تمت الترقية", rejected: "مرفوضة", cancelled: "ملغاة", expired: "منتهية" };
const deliveryStatusLabel: Record<string, string> = { not_attempted: "لم يُحاول الإرسال", sent: "تم تسليم الطلب إلى SMTP", not_configured: "SMTP غير مهيأ", failed: "تعذر التسليم" };

export default function PlatformAdministrationPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [inviteEmail, setInviteEmail] = useState("");
  const ownership = trpc.platformAdmin.ownership.useQuery(undefined, { enabled: isPlatformAdmin });
  const users = trpc.platformAdmin.users.useQuery(undefined, { enabled: isPlatformAdmin });
  const audit = trpc.platformAdmin.recentAudit.useQuery(undefined, { enabled: isPlatformAdmin });
  const invitations = trpc.platformAdmin.invitations.useQuery(undefined, { enabled: isPlatformAdmin });
  const smtpStatus = trpc.platformAdmin.smtpStatus.useQuery(undefined, { enabled: isPlatformAdmin });
  const refreshAdministration = () => {
    void utils.platformAdmin.invitations.invalidate();
    void utils.platformAdmin.users.invalidate();
    void utils.platformAdmin.recentAudit.invalidate();
  };
  const createInvitation = trpc.platformAdmin.createInvitation.useMutation({
    onSuccess: data => { const message = data.delivery.delivered ? `سُجلت الدعوة وأُرسلت إلى ${data.email}.` : `سُجلت الدعوة، لكن البريد لم يُرسل بعد: ${data.delivery.reason}`; toast[data.delivery.delivered ? "success" : "warning"](message); setInviteEmail(""); refreshAdministration(); },
    onError: error => toast.error(errorText(error)),
  });
  const resendInvitationEmail = trpc.platformAdmin.resendInvitationEmail.useMutation({
    onSuccess: data => { toast[data.delivery.delivered ? "success" : "warning"](data.delivery.delivered ? "تم تسليم طلب إعادة الإرسال إلى SMTP." : `لم يتم الإرسال: ${data.delivery.reason}`); refreshAdministration(); },
    onError: error => toast.error(errorText(error)),
  });
  const verifySmtp = trpc.platformAdmin.verifySmtp.useMutation({
    onSuccess: data => toast[data.delivered ? "success" : "warning"](data.delivered ? "اتصال SMTP جاهز للإرسال." : data.reason),
    onError: error => toast.error(errorText(error)),
  });
  const reviewInvitation = trpc.platformAdmin.reviewInvitation.useMutation({
    onSuccess: data => { toast.success(data.status === "approved" ? "تم اعتماد الترقية وتسجيلها." : "تم رفض الدعوة وتسجيل القرار."); refreshAdministration(); },
    onError: error => toast.error(errorText(error)),
  });
  const cancelInvitation = trpc.platformAdmin.cancelInvitation.useMutation({
    onSuccess: () => { toast.success("تم إلغاء الدعوة وتسجيل الإجراء."); refreshAdministration(); },
    onError: error => toast.error(errorText(error)),
  });
  const [pendingDemote, setPendingDemote] = useState<{ targetUserId: number; name: string | null } | null>(null);
  const demoteUser = trpc.platformAdmin.setUserRole.useMutation({
    onSuccess: result => {
      toast.success(result.changed ? "تم خفض الصلاحية وتسجيل القرار." : "دور المستخدم محدد بالفعل.");
      setPendingDemote(null);
      refreshAdministration();
    },
    onError: error => toast.error(errorText(error)),
  });

  const requestDemotion = (targetUserId: number, name: string | null) => {
    setPendingDemote({ targetUserId, name });
  };

  if (!isPlatformAdmin) {
    return <DashboardLayout><main className="mx-auto max-w-3xl" dir="rtl"><Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />وصول محكوم</CardTitle><CardDescription>إدارة مستخدمي المنصة متاحة للمدير العام فقط، وتبقى عضويات FAMILY وصلاحياتها منفصلة.</CardDescription></CardHeader></Card></main></DashboardLayout>;
  }

  return <DashboardLayout><main className="mx-auto max-w-7xl space-y-6" dir="rtl">
    <PageHeader
      title="إدارة مستخدمي المنصة"
      description="تدير هذه الشاشة أدوار التطبيق العامة فقط. لا تمنح أو تلغي وصولًا إلى سجلات مساحات FAMILY، ولا تعرض أي بيانات مالية."
      breadcrumbs={[
        { label: "الرئيسية", href: "/" },
        { label: "الحوكمة والتحليل", href: "/admin/users" },
        { label: "إدارة مستخدمي المنصة" },
      ]}
      badge={{ text: "إدارة النظام", variant: "destructive" }}
      icon={ShieldCheck}
    />

    <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><Card className="fintech-surface-card"><CardHeader><CardTitle>المالك الرئيس</CardTitle><CardDescription>يُثبت من أول هوية Google/Gmail مؤهلة، ولا يمكن خفض صلاحية حسابه من هذه الشاشة.</CardDescription></CardHeader><CardContent>{ownership.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل سجل الملكية…</p> : ownership.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorText(ownership.error)}</p> : ownership.data ? <div className="space-y-2 rounded-xl bg-muted/45 p-4"><div className="flex items-center justify-between gap-3"><strong>{ownership.data.name || "مالك المنصة"}</strong><Badge>Super Admin</Badge></div><p className="text-sm text-muted-foreground" dir="ltr">{ownership.data.email}</p><p className="text-xs text-muted-foreground">ثُبت في {formatDateTime(ownership.data.claimedAt)}</p></div> : null}</CardContent></Card>
      <Card className="fintech-surface-card"><CardHeader><CardTitle>ضوابط الدور العام</CardTitle><CardDescription>الترقية تمر بدعوة Gmail وتحقق Google ومراجعة مدير عام ثانٍ، وتبقى مقيدة بسجل تدقيق مستقل.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>يُحظر خفض صلاحية المالك الرئيس أو آخر مدير عام نشط أو المستخدم الذي ينفذ الإجراء على نفسه.</p><p>لا تؤدي الترقية أو الخفض هنا إلى تعديل قيود الدفتر أو العضويات أو الملكية المالية.</p></CardContent></Card></section>

    <Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><MailPlus className="size-5 text-primary" />دعوات المدير العام</CardTitle><CardDescription>أدخل بريد Gmail للمدعو. يرسل النظام بريدًا فعليًا عند تهيئة SMTP، ثم يسجل المدعو دخوله عبر Google بالبريد نفسه قبل المراجعة الثانية.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/25 p-4 text-sm"><span className="flex items-center gap-2"><MailCheck className="size-4 text-primary" />{smtpStatus.data?.configured ? `SMTP مهيأ على المنفذ ${smtpStatus.data.port}.` : smtpStatus.data?.reason || "جارٍ فحص إعداد SMTP…"}</span><Button size="sm" variant="outline" disabled={!smtpStatus.data?.configured || verifySmtp.isPending} onClick={() => verifySmtp.mutate()}>{verifySmtp.isPending ? "جارٍ التحقق…" : "تحقق من الاتصال"}</Button></div><form className="flex flex-col gap-3 rounded-xl border bg-muted/25 p-4 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); createInvitation.mutate({ email: inviteEmail, origin: window.location.origin }); }}><div className="grid flex-1 gap-2"><Label htmlFor="platform-admin-email">بريد Gmail للمدعو</Label><Input id="platform-admin-email" type="email" dir="ltr" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="admin@gmail.com" required /></div><Button type="submit" disabled={createInvitation.isPending}>{createInvitation.isPending ? "جارٍ إنشاء الدعوة…" : "إنشاء دعوة"}</Button></form>{invitations.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل الدعوات…</p> : invitations.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorText(invitations.error)}</p> : invitations.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-muted/70 text-xs text-muted-foreground"><tr><th className="p-3">البريد</th><th className="p-3">حالة الدعوة</th><th className="p-3">حالة البريد</th><th className="p-3">انتهاء الدعوة</th><th className="p-3">الإجراء</th></tr></thead><tbody className="divide-y">{invitations.data.map(invitation => <tr key={invitation.id}><td className="p-3" dir="ltr">{invitation.email}</td><td className="p-3"><Badge variant={invitation.status === "awaiting_review" ? "default" : "secondary"}>{invitationStatusLabel[invitation.status] || invitation.status}</Badge></td><td className="p-3"><Badge variant={invitation.emailDeliveryStatus === "sent" ? "default" : "secondary"}>{deliveryStatusLabel[invitation.emailDeliveryStatus] || invitation.emailDeliveryStatus}</Badge></td><td className="p-3 text-muted-foreground">{formatDateTime(invitation.expiresAt)}</td><td className="p-3">{invitation.status === "awaiting_review" ? <div className="flex gap-2"><Button size="sm" disabled={reviewInvitation.isPending} onClick={() => reviewInvitation.mutate({ invitationId: invitation.id, decision: "approved" })}>اعتماد</Button><Button size="sm" variant="outline" disabled={reviewInvitation.isPending} onClick={() => reviewInvitation.mutate({ invitationId: invitation.id, decision: "rejected" })}>رفض</Button></div> : ["pending_login", "awaiting_review"].includes(invitation.status) ? <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={cancelInvitation.isPending} onClick={() => cancelInvitation.mutate({ invitationId: invitation.id })}>إلغاء</Button><Button size="sm" variant="outline" disabled={resendInvitationEmail.isPending} onClick={() => resendInvitationEmail.mutate({ invitationId: invitation.id, origin: window.location.origin })}>إعادة إرسال</Button></div> : "—"}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد دعوات مدير عام حتى الآن.</p>}</CardContent></Card>

    <Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="size-5 text-primary" />الحسابات الموثقة</CardTitle><CardDescription>تظهر الحسابات التي يتوفر لها بريد موثق فقط، مرتبة بحسب آخر تسجيل دخول. لا يمكن الترقية من الجدول مباشرة.</CardDescription></CardHeader><CardContent>{users.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل الحسابات…</p> : users.error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorText(users.error)}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm"><thead className="bg-muted/70 text-xs text-muted-foreground"><tr><th className="p-3">المستخدم</th><th className="p-3">البريد</th><th className="p-3">الدور العام</th><th className="p-3">آخر دخول</th><th className="p-3">إجراء</th></tr></thead><tbody className="divide-y">{users.data?.map(account => { const isOwner = ownership.data?.id === account.id; const canDemote = !isOwner && account.id !== user?.id && account.role === "admin"; return <tr key={account.id}><td className="p-3 font-semibold">{account.name || "مستخدم FAMILY"}{isOwner && <span className="mr-2 text-xs text-emerald-700">(المالك الرئيس)</span>}</td><td className="p-3 text-muted-foreground" dir="ltr">{account.email}</td><td className="p-3"><Badge variant={account.role === "admin" ? "default" : "secondary"}>{account.role === "admin" ? "Super Admin" : "مستخدم"}</Badge></td><td className="p-3 text-muted-foreground">{formatDateTime(account.lastSignedIn)}</td><td className="p-3">{canDemote ? <Button size="sm" variant="outline" disabled={demoteUser.isPending} onClick={() => requestDemotion(account.id, account.name)}>خفض الصلاحية</Button> : <span className="text-xs text-muted-foreground">{isOwner ? "محمي" : account.role === "admin" ? "جلسة المستخدم الحالية" : "الترقية بالدعوة فقط"}</span>}</td></tr>; })}</tbody></table></div>}</CardContent></Card>

    <Card className="fintech-surface-card"><CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="size-5 text-primary" />تدقيق إدارة المستخدمين</CardTitle><CardDescription>آخر 30 تغييرًا لدور عام أو دعوة، مستقلة عن سجل التدقيق المالي لمساحات FAMILY.</CardDescription></CardHeader><CardContent>{audit.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل السجل…</p> : audit.data?.length ? <div className="space-y-2">{audit.data.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/25 px-4 py-3 text-sm"><span><strong>{item.actorName || item.actorEmail || "مدير عام"}</strong> {item.action.replace("platform_admin_invitation.", "دعوة مدير عام: ").replace("platform_owner.", "ملكية المنصة: ").replace("platform_user.", "مستخدم منصة: ")}</span><span className="text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</span></div>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد تغييرات مسجلة على أدوار المنصة حتى الآن.</p>}</CardContent></Card>

    <ConfirmDialog
      open={Boolean(pendingDemote)}
      onOpenChange={(open) => { if (!open) setPendingDemote(null); }}
      title="خفض صلاحية مدير عام"
      description={`هل أنت متأكد من خفض صلاحية ${pendingDemote?.name || "هذا المستخدم"} إلى مستخدم عادي؟ سيُسجل القرار في تدقيق المنصة.`}
      confirmLabel="تأكيد الخفض"
      cancelLabel="تراجع"
      variant="destructive"
      isLoading={demoteUser.isPending}
      onConfirm={() => {
        if (pendingDemote) {
          demoteUser.mutate({ targetUserId: pendingDemote.targetUserId, role: "user" });
        }
      }}
    />
  </main></DashboardLayout>;
}
