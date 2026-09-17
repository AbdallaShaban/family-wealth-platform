import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  UserPlus,
  LogIn,
} from "lucide-react";
import { Redirect, useLocation } from "wouter";
import { toast } from "sonner";

export default function LoginPage() {
  const { loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if Google OAuth is configured on the backend
  const authStatus = trpc.auth.status.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("تم تسجيل الدخول بنجاح.");
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (error) => {
      setErrorMessage(error.message || "حدث خطأ أثناء تسجيل الدخول.");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      toast.success("تم إنشاء الحساب بنجاح، مرحباً بك في مساحتك العائلية.");
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (error) => {
      setErrorMessage(error.message || "حدث خطأ أثناء إنشاء الحساب.");
    },
  });

  const isSubmitting = loginMutation.isPending || registerMutation.isPending;

  if (loading) {
    return (
      <div className="fintech-route-loading" role="status" aria-label="جارٍ التحقق من بيانات الدخول">
        <i /><i /><i />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (mode === "login") {
      if (!email.trim() || !password) {
        setErrorMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
        return;
      }
      loginMutation.mutate({
        email: email.trim(),
        password,
      });
    } else {
      if (!name.trim() || !email.trim() || !password || !inviteCode.trim()) {
        setErrorMessage("جميع الحقول مطلوبة بما فيها رمز دعوة العائلة.");
        return;
      }
      if (password.length < 8) {
        setErrorMessage("كلمة المرور يجب أن لا تقل عن 8 أحرف.");
        return;
      }
      registerMutation.mutate({
        name: name.trim(),
        email: email.trim(),
        password,
        inviteCode: inviteCode.trim(),
      });
    }
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 selection:bg-emerald-500 selection:text-white relative overflow-hidden"
    >
      {/* Subtle background ambient gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 right-1/4 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 size-96 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main Authentication Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex size-13 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-900/40">
              <ShieldCheck className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">FAMILY</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Private Wealth Control
              </p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {mode === "login"
                ? "تسجيل الدخول الموحد للوصول إلى الدفتر المالي والمحافظ الاستثمارية"
                : "تسجيل عضوية عائلية جديدة محمية برمز دعوة العائلة"}
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === "login"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="size-4" />
              <span>تسجيل الدخول</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === "register"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserPlus className="size-4" />
              <span>حساب جديد</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
              <AlertCircle className="size-4 shrink-0 text-red-400" />
              <p className="leading-snug">{errorMessage}</p>
            </div>
          )}

          {/* Primary Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-slate-300">
                  الاسم بالكامل
                </Label>
                <div className="relative">
                  <User className="absolute right-3 top-3 size-4 text-slate-500 pointer-events-none" />
                  <Input
                    id="name"
                    type="text"
                    required
                    placeholder="مثال: طارق الرشيد"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="pr-9 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500/40"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                البريد الإلكتروني
              </Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 size-4 text-slate-500 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="pr-9 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500/40 text-left font-sans"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 size-4 text-slate-500 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder={mode === "register" ? "8 أحرف على الأقل" : "••••••••"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="pr-9 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500/40 text-left font-sans"
                  dir="ltr"
                />
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inviteCode" className="text-xs font-medium text-emerald-300">
                    رمز دعوة العائلة (Invite Code)
                  </Label>
                  <span className="text-[10px] text-slate-500">حماية النطاق المغلق</span>
                </div>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-3 size-4 text-emerald-500 pointer-events-none" />
                  <Input
                    id="inviteCode"
                    type="password"
                    required
                    placeholder="أدخل رمز الدعوة المعتمد"
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="pr-9 bg-slate-950/60 border-emerald-800/40 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500/40 text-left font-mono"
                    dir="ltr"
                  />
                </div>
                <p className="text-[11px] text-slate-400 pt-0.5 leading-relaxed">
                  يمنع التسجيل بدون رمز دعوة العائلة المعتمد لحظر أي زوار عموميين غير مصرح لهم.
                </p>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition-all duration-200 mt-2 rounded-xl flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>جارٍ المعالجة...</span>
                </>
              ) : mode === "login" ? (
                <>
                  <LogIn className="size-4" />
                  <span>تسجيل الدخول</span>
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  <span>إنشاء الحساب ودخول المنظومة</span>
                </>
              )}
            </Button>
          </form>

          {/* Google OAuth Section (Gracefully disabled/hidden unless credentials exist) */}
          {authStatus.data?.googleConfigured && (
            <div className="mt-6">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">أو عبر المزود الخارجي</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-11 border-slate-700 bg-slate-950/40 hover:bg-slate-800 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-3 text-sm"
                onClick={() => startLogin()}
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>المتابعة بحساب Google Workspace</span>
              </Button>
            </div>
          )}

          {/* Security Guarantee Footnote */}
          <div className="mt-6 rounded-xl bg-slate-950/60 p-3.5 border border-slate-800/60 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>تشفير كلمات المرور عبر معيار bcrypt (12 جولة تعمية)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>نطاق مغلق محمي برمز دعوة العائلة المعتمد</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Lock className="size-4 text-emerald-400 shrink-0" />
              <span>جلسات مشفرة وموقعة برمز JWT عبر خادم النظام</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-600 mt-6">
          FAMILY Wealth Assessment Platform &copy; {new Date().getFullYear()} &bull; جميع الحقوق محفوظة
        </p>
      </div>
    </main>
  );
}
