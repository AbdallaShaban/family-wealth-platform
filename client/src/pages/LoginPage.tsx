import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ShieldCheck, Lock, CheckCircle2, ArrowRight } from "lucide-react";
import { Redirect } from "wouter";

export default function LoginPage() {
  const { loading, isAuthenticated } = useAuth();

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
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo & Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-900/40">
              <ShieldCheck className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">FAMILY</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Private Wealth Control
              </p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed pt-1">
              تسجيل الدخول الموحد للوصول إلى لوحة التحكم وسجل القيود والمحافظ الاستثمارية
            </p>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-slate-800" />

          {/* Login Form / Action */}
          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-semibold shadow-md transition-all duration-200 flex items-center justify-center gap-3 text-base rounded-xl"
              onClick={() => startLogin()}
            >
              {/* Google SVG Logo */}
              <svg className="size-5 shrink-0" viewBox="0 0 24 24">
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
              <span>المتابعة عبر حساب Google</span>
            </Button>

            <p className="text-center text-xs text-slate-500">
              جلسة مصادقة مشفرة عبر معيار OpenID Connect و OAuth 2.0
            </p>
          </div>

          {/* Security Features */}
          <div className="mt-8 rounded-xl bg-slate-950/60 p-4 border border-slate-800/60 space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>بيئة معزولة مخصصة لكل مستخدم</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>دفتر قيود مزدوج محمي ومطابق معيارياً</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Lock className="size-4 text-emerald-400 shrink-0" />
              <span>تشفير كامل لجميع الجلسات والبيانات الحساسة</span>
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
