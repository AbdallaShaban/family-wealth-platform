/**
 * Design: Executive Decision Ledger — an RTL institutional audit dossier.
 * Palette: ink navy, warm paper, signature emerald, and controlled amber/red risk signals.
 * Layout: a fixed evidence rail with an asymmetric reading column; interactions clarify evidence, not decorate it.
 */
import { useMemo, useState } from "react";
import {
  AlertOctagon,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Blocks,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Code2,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  LockKeyhole,
  Network,
  PlugZap,
  RefreshCw,
  ScrollText,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TableProperties,
  TestTube2,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type Severity = "حرج" | "عالٍ" | "متوسط";

const HERO_IMAGE = "/manus-storage/family-assessment-hero_83147e6f.png";
const LOGO_IMAGE = "/manus-storage/family-assessment-logo_31f00366.png";
const EVIDENCE_IMAGE = "/manus-storage/family-assessment-evidence_1cd5f937.png";
const ROADMAP_IMAGE = "/manus-storage/family-assessment-roadmap_912d51d0.png";

const maturity = [
  { layer: "الواجهة", score: 60, fill: "#0f766e" },
  { layer: "الأساس التقني", score: 55, fill: "#0f766e" },
  { layer: "البيانات", score: 15, fill: "#d97706" },
  { layer: "المعاملات", score: 15, fill: "#d97706" },
  { layer: "الأمن والعزل", score: 0, fill: "#b42318" },
  { layer: "التوسّع", score: 10, fill: "#b42318" },
];

const riskFindings: Array<{
  id: number;
  severity: Severity;
  title: string;
  proof: string;
  consequence: string;
  action: string;
  icon: typeof LockKeyhole;
}> = [
  {
    id: 1,
    severity: "حرج",
    title: "لا توجد هوية أو جلسة مستخدم",
    proof: "لا توجد طبقة auth أو session أو middleware أو user context ضمن المصدر المفحوص.",
    consequence: "لا يوجد حد فعلي بين قارئ أو محرّر أو مدير؛ لا يصلح لاستخدام عائلي حقيقي.",
    action: "إدخال المصادقة، المستخدمين، الأدوار، وسياسات الوصول أولًا.",
    icon: UserRoundCheck,
  },
  {
    id: 2,
    severity: "حرج",
    title: "عزل المستخدمين غير ممثل في البيانات",
    proof: "المخطط يحوي 4 جداول مجال فقط، من دون users أو families أو membership أو owner_id.",
    consequence: "لا يمكن إثبات استقلال أموال كل مستخدم أو فصل حساب Owner الإداري عن حسابه المالي.",
    action: "إعادة بناء نموذج الملكية وفرض العزل على مستوى الصف أو policy layer.",
    icon: Network,
  },
  {
    id: 3,
    severity: "حرج",
    title: "الرصيد والحيازة قابلان للتحرير المباشر",
    proof: "تغيّر Server Actions عمود accounts.balance، وتعدل quantity وaverage_cost مباشرة.",
    consequence: "تفقد إمكانية التسوية وإعادة البناء والتدقيق؛ المعاملة ليست مصدر الحقيقة.",
    action: "استبدال ذلك بدفتر قيود وأحداث Posted قابلة للعكس والمراجعة.",
    icon: Banknote,
  },
  {
    id: 4,
    severity: "حرج",
    title: "التحويل غير ذري وغير محمي من السباقات",
    proof: "التحويل يقرأ ويحدّث حسابين ويسجل صفين من دون BEGIN/COMMIT أو row locks.",
    consequence: "أرصدة جزئية أو سحب زائد محتملان عند الفشل أو التزامن.",
    action: "استخدام DB transaction واحدة، idempotency، والتحقق الخادمي من القيمة والنطاق.",
    icon: RefreshCw,
  },
  {
    id: 5,
    severity: "حرج",
    title: "النسخة الاحتياطية تسحب كل البيانات بلا تفويض",
    proof: "getDatabaseBackup ينفذ SELECT * على الجداول ثم يرسل JSON إلى المتصفح.",
    consequence: "مسار تسريب كامل للبيانات المالية وسجل التدقيق.",
    action: "استبدالها بخدمة مؤمنة ومحددة النطاق مع تشفير وسياسات استعادة.",
    icon: ShieldAlert,
  },
  {
    id: 6,
    severity: "حرج",
    title: "التحقق الخادمي والقيود المالية غائبان",
    proof: "لا يوجد schema validation أو CHECK constraints أو منع قيم سالبة في الإجراءات الأساسية.",
    consequence: "يمكن تمرير مبالغ أو كميات أو أنواع معاملات غير منطقية إلى الطبقة المالية.",
    action: "إضافة validation صريح، enum/domain types وقيود DB قبل توسيع أي واجهة.",
    icon: CircleAlert,
  },
  {
    id: 7,
    severity: "حرج",
    title: "سجل التدقيق ليس سجلاً موثوقًا",
    proof: "ينشأ الجدول لحظيًا، الفاعل ثابت، وأخطاء التسجيل يتم ابتلاعها.",
    consequence: "لا يمكن استخدامه للمساءلة أو التحقيق أو التحقق من التغييرات الحساسة.",
    action: "بناء audit_events append-only مع actor وtarget وbefore/after وrequest correlation.",
    icon: ScrollText,
  },
  {
    id: 8,
    severity: "عالٍ",
    title: "الأسعار المعروضة كحياتية عشوائية",
    proof: "refreshMarketPrices يولد تغيرات عشوائية من أسعار أساس ثابتة ثم يكتبها في القاعدة.",
    consequence: "تضليل المستخدم وتلويث قيمة المحفظة وP&L والقرارات اللاحقة.",
    action: "إيقاف الادعاء وربط quotes موثقة بالمصدر والوقت والعملة والحالة.",
    icon: Gauge,
  },
  {
    id: 9,
    severity: "عالٍ",
    title: "تشغيل ونشر غير مكتملين",
    proof: "Dockerfile يتوقع .next/standalone دون تفعيله، وcompose لا يثبت init.sql، وlint يفشل.",
    consequence: "قد ينجح التجميع المحلي لكن مسار الحاوية وقابلية الصيانة غير موثوقين.",
    action: "إصلاح standalone وmigrations وESLint وCI واختبارات الإطلاق.",
    icon: Server,
  },
];

const modules = [
  ["الحسابات والحيازات", "محدود", "CRUD فعلي جزئي؛ بلا ملكية أو دفتر قيود."],
  ["المعاملات والتحويلات", "خطر", "كتابة فعلية، لكنها لا تحقق الاتساق المحاسبي."],
  ["البيانات التاريخية والأسعار", "Demo", "سعر واحد قابل للكتابة وتحديث عشوائي."],
  ["الأهداف والخطة والمخاطر", "Demo", "حسابات محلية وأرقام عرض ثابتة."],
  ["الضرائب والرسوم والزكاة", "Demo", "نسب ثابتة في الواجهة، لا محرك قابل للتحكم."],
  ["العائلة والحوكمة والإرث", "Demo", "لا بيانات أعضاء ولا صلاحيات أو نموذج تركة."],
  ["التنبيهات وAI والـWatchlist", "Demo", "لا route أو integration أو مصدر بيانات."],
  ["التقارير والاستعادة", "جزئي / خطر", "CSV سطحي ومسار backup غير مفوض."],
] as const;

const roadmap = [
  {
    phase: "P0",
    title: "حدود الحقيقة والأمان",
    timing: "3–5 شخص-أسبوع",
    focus: "هوية، RBAC، عزل، secrets، validation، audit قابل للمساءلة، وإيقاف الادعاءات المضللة.",
  },
  {
    phase: "P1–P2",
    title: "نواة مالية قابلة للتدقيق",
    timing: "6–10 شخص-أسبوع",
    focus: "migrations، ledger، معاملات ذرية، عملات وFX، positions/lots، رسوم وضرائب، واختبارات التزامن.",
  },
  {
    phase: "P3",
    title: "Dashboard وتقارير حقيقية",
    timing: "3–5 شخص-أسبوع",
    focus: "تفكيك الشاشة وربط Net Worth وCash Flow وP&L وAllocation بمصدر بيانات موحد.",
  },
  {
    phase: "P4–P5",
    title: "الوحدات والتكاملات المتقدمة",
    timing: "10–17 شخص-أسبوع",
    focus: "Budget، Debt، Goals، أسعار موثقة، Alerts، عقار وذهب وتأمين، ثم Advisor مقيد بالصلاحيات.",
  },
];

const targetLayers = [
  {
    id: "01",
    title: "تجربة مقسّمة حسب الغرض",
    description: "Routes واضحة لـ Dashboard وAccounts وLedger وPlanning وReports؛ لا شاشة عملاقة تحمل كل القواعد.",
    items: ["Dashboard", "Accounts", "Ledger", "Planning", "Reports"],
    icon: Blocks,
    tone: "emerald",
  },
  {
    id: "02",
    title: "بوابة الهوية والسياسة",
    description: "تثبت الهوية والجلسة والدور والنطاق قبل قراءة أي مورد أو كتابة أي حدث مالي.",
    items: ["Auth", "Session", "RBAC", "Scope", "Owner policy"],
    icon: LockKeyhole,
    tone: "navy",
  },
  {
    id: "03",
    title: "وحدات مجال قابلة للاختبار",
    description: "خدمات typed تفصل Identity وLedger وPortfolio وPlanning وReporting وAudit بعقود صريحة.",
    items: ["Identity", "Ledger", "Portfolio", "Planning", "Audit"],
    icon: Layers3,
    tone: "amber",
  },
  {
    id: "04",
    title: "مصدر حقيقة مالي محكوم",
    description: "migrations وconstraints وقيود متوازنة وaudit append-only؛ الأرصدة والحيازات مشتقات لا حقول يدوية.",
    items: ["PostgreSQL", "Migrations", "Journal", "Constraints", "Audit events"],
    icon: Database,
    tone: "ink",
  },
  {
    id: "05",
    title: "تكاملات خلف حدود موثقة",
    description: "أسعار واستيراد وتنبيهات عبر adapters مع مصدر ووقت وصلاحية وإعادة محاولة؛ لا كتابة مباشرة في ledger.",
    items: ["Quotes", "Imports", "Alerts", "Provenance", "Retry"],
    icon: PlugZap,
    tone: "slate",
  },
];

const nonNegotiables = [
  "كل رقم يظهر في Dashboard يمكن تفسيره بقيود أو أحداث مصدرية.",
  "كل query أو export يمر عبر نطاق هوية وتفويض قابل للتدقيق.",
  "كل posting مالي ذري وقابل للعكس، لا تعديل تاريخي صامت.",
  "كل سعر أو import يحمل مصدره ووقته وحالته قبل استخدامه في قرار.",
];

const navItems = [
  ["overview", "الحكم التنفيذي"],
  ["evidence", "أدلة الفحص"],
  ["risk", "سجل المخاطر"],
  ["coverage", "تغطية المواصفات"],
  ["roadmap", "خارطة التنفيذ"],
  ["target", "المعمارية المقترحة"],
  ["verdict", "الرأي الهندسي"],
] as const;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`severity severity-${severity}`}>{severity}</span>;
}

export default function Home() {
  const [riskFilter, setRiskFilter] = useState<"الكل" | Severity>("الكل");
  const [selectedRisk, setSelectedRisk] = useState<number>(1);
  const filteredRisks = useMemo(
    () => riskFindings.filter(item => riskFilter === "الكل" || item.severity === riskFilter),
    [riskFilter]
  );
  const activeRisk = riskFindings.find(item => item.id === selectedRisk) ?? riskFindings[0];
  const ActiveRiskIcon = activeRisk.icon;

  return (
    <div className="assessment-shell" dir="rtl">
      <aside className="evidence-rail" aria-label="فهرس التقرير">
        <div>
          <button className="brand-lockup" onClick={() => scrollToSection("overview")} aria-label="العودة إلى بداية التقرير">
            <img src={LOGO_IMAGE} alt="علامة تقرير FAMILY" className="brand-mark" />
            <span>
              <strong>FAMILY</strong>
              <small>TECHNICAL ASSESSMENT</small>
            </span>
          </button>

          <div className="rail-stamp">
            <span className="stamp-dot" />
            تقييم مستقل
            <small>27 أغسطس 2026</small>
          </div>

          <nav className="report-nav">
            {navItems.map(([id, label], index) => (
              <button key={id} onClick={() => scrollToSection(id)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {label}
                <ChevronLeft size={14} />
              </button>
            ))}
          </nav>
        </div>

        <div className="rail-footer">
          <div className="evidence-chip"><FileCheck2 size={16} /> 18 ملف مصدر/إعداد مفحوص</div>
          <p>المصادر: ZIP، Handoff، Instructions، وتحقق تجميع معزول.</p>
          <button className="print-link" onClick={() => window.print()}><FileText size={15} /> طباعة / حفظ PDF</button>
        </div>
      </aside>

      <main className="report-main">
        <section id="overview" className="hero-dossier scroll-section">
          <div className="hero-archive">
            <img className="hero-image" src={HERO_IMAGE} alt="ملف تدقيق هندسي على مكتب كحلي" />
            <span><FileCheck2 size={13} /> مسند بصري مؤرشف</span>
          </div>
          <div className="hero-overlay" />
          <div className="hero-topline">
            <span>FAMILY WEALTH SYSTEM</span>
            <span>إصدار تقييم — 01</span>
          </div>
          <div className="hero-decision-grid">
            <div className="hero-copy">
              <div className="eyebrow"><Sparkles size={15} /> قرار قبل التنفيذ</div>
              <h1>الواجهة جاهزة للعرض.<br /><em>النواة ليست جاهزة للثقة.</em></h1>
              <p>فحص تقني كامل للمشروع المرفق مقارنة بمواصفات منظومة Family Wealth Intelligence متعددة المستخدمين.</p>
              <div className="hero-facts" aria-label="ملخص الحكم">
                <span><b>9</b><small>مخاطر موثقة</small></span>
                <span><b>0</b><small>حدود هوية أو صلاحيات</small></span>
                <span><b>4</b><small>جداول مجال فقط</small></span>
              </div>
              <div className="hero-actions">
                <button className="primary-action" onClick={() => scrollToSection("verdict")}>اقرأ الرأي الهندسي <ArrowLeft size={17} /></button>
                <button className="quiet-action" onClick={() => scrollToSection("risk")}>سجل المخاطر</button>
              </div>
            </div>
            <div className="decision-seal" aria-label="ختم القرار الهندسي">
              <div className="seal-motif" aria-hidden="true"><i /><i /><b>✓</b></div>
              <span>الختم التنفيذي</span>
              <strong>إعادة تصميم<br />جوهرية</strong>
              <small>احتفظ بالـstack والاتجاه البصري؛ أعد بناء القلب المالي، العزل، والدفتر.</small>
              <div className="seal-proof"><FileCheck2 size={14} /> مبني على مصدر مفحوص</div>
            </div>
          </div>
        </section>

        <section className="summary-band scroll-section" aria-label="الملخص الكمي">
          <div className="metric-card ink"><span>ملف المصدر</span><strong>2,226</strong><small>سطر TS/TSX مفحوص</small></div>
          <div className="metric-card"><span>واجهة واحدة</span><strong>82.3%</strong><small>من الكود داخل DashboardClient</small></div>
          <div className="metric-card alert"><span>حدود الهوية</span><strong>0</strong><small>مصادقة أو session أو middleware</small></div>
          <div className="metric-card"><span>نموذج المجال</span><strong>4</strong><small>جداول مالية فقط في bootstrap</small></div>
          <div className="metric-card alert"><span>شبكة الأمان</span><strong>0</strong><small>اختبارات أو route handlers</small></div>
        </section>

        <section id="evidence" className="section-block evidence-layout scroll-section">
          <div className="section-heading">
            <div className="section-number">01</div>
            <div><p className="kicker">ما فُحص، لا ما افترضناه</p><h2>الأدلة الأساسية</h2></div>
          </div>
          <div className="evidence-intro">
            <p>يوجد مشروع Next.js حديث قابل للتجميع في بيئة إنتاج معيارية. لكن المصدر الفعلي صغير ومتمحور حول شاشة Dashboard واحدة؛ والوظائف المكتوبة لا تغطي المعنى المالي الذي توحي به الواجهة.</p>
            <div className="evidence-labels"><span>ZIP مفهرس كاملًا</span><span>Build ناجح مع NODE_ENV=production</span><span>Lint غير مهيّأ</span></div>
          </div>
          <div className="evidence-photo"><img src={EVIDENCE_IMAGE} alt="أوراق تدقيق ومخططات هندسية" /><div><span>قراءة المصدر</span><strong>الكود يثبت النواة، لا الادعاء.</strong></div></div>
          <div className="evidence-grid">
            <article><Code2 /><strong>Next.js + TypeScript</strong><p>اختيار صالح للبناء المستقبلي، لكنه بلا طبقة domain أو policy واضحة.</p></article>
            <article><Database /><strong>PostgreSQL مباشر</strong><p>Pool واستعلامات مقنّنة في القيم، لكن بلا migrations أو ownership أو constraints كافية.</p></article>
            <article><TableProperties /><strong>8 Server Actions</strong><p>CRUD محدود للحسابات والحيازات والتحويل والمعاملة والتصدير؛ لا REST/API route حاليًا.</p></article>
            <article><TestTube2 /><strong>لا اختبارات</strong><p>لا يوجد script للاختبار، و`npm run lint` يفشل لغياب إعداد ESLint الحديث.</p></article>
          </div>
        </section>

        <section className="section-block maturity-section scroll-section">
          <div className="section-heading">
            <div className="section-number">02</div>
            <div><p className="kicker">قياس النضج حسب الطبقة</p><h2>القوة ليست موزعة بالتساوي</h2></div>
          </div>
          <div className="maturity-copy">
            <p>القالب والتجربة البصرية يعطيان انطباعًا متقدمًا، إلا أن طبقات البيانات والمعاملات والعزل التي تحمل المخاطر الحقيقية في منتج مالي تكاد تكون غير موجودة.</p>
            <div className="maturity-callout"><Gauge size={22} /><span><strong>الحكم:</strong> جاهز كمرجع واجهة ونقطة انطلاق تقنية، غير جاهز كمنظومة مال أو بيانات عائلية.</span></div>
          </div>
          <div className="chart-card">
            <ChartContainer config={{ score: { label: "نضج التنفيذ", color: "#0f766e" } }} className="h-[310px] w-full">
              <BarChart data={maturity} layout="vertical" margin={{ right: 46, left: 16 }}>
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={value => `${value}%`} />
                <YAxis type="category" dataKey="layer" width={102} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={{ fill: "rgba(15,118,110,0.06)" }} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={22}>
                  {maturity.map(item => <Cell key={item.layer} fill={item.fill} />)}
                  <LabelList dataKey="score" position="right" formatter={(value: number) => `${value}%`} className="fill-slate-700 text-xs font-bold" />
                </Bar>
              </BarChart>
            </ChartContainer>
            <p className="chart-note">المقياس تقديري استنادًا إلى التنفيذ المرئي في المصدر، وليس تصنيف امتثال معياريًا.</p>
          </div>
        </section>

        <section id="risk" className="section-block risk-section scroll-section">
          <div className="section-heading">
            <div className="section-number">03</div>
            <div><p className="kicker">قبل تغيير الواجهة</p><h2>سجل المخاطر الهندسي</h2></div>
          </div>
          <div className="risk-header">
            <p>المخاطر أدناه ليست تحسينات تجميلية. هي حدود تمنع إدخال بيانات مالية فعلية أو تمكين المستخدمين قبل حلّها.</p>
            <div className="risk-filters" role="group" aria-label="فلترة المخاطر">
              {(["الكل", "حرج", "عالٍ"] as const).map(filter => <button key={filter} onClick={() => setRiskFilter(filter)} className={riskFilter === filter ? "is-active" : ""}>{filter}</button>)}
            </div>
          </div>
          <div className="risk-workspace">
            <div className="risk-list">
              {filteredRisks.map(item => {
                const Icon = item.icon;
                return <button key={item.id} className={`risk-row ${selectedRisk === item.id ? "is-selected" : ""}`} onClick={() => setSelectedRisk(item.id)}>
                  <span className="risk-icon"><Icon size={17} /></span>
                  <span className="risk-row-copy"><strong>{item.title}</strong><small>{item.proof}</small></span>
                  <SeverityBadge severity={item.severity} />
                </button>;
              })}
            </div>
            <article className="risk-detail">
              <div className="detail-icon"><ActiveRiskIcon size={23} /></div>
              <div className="detail-heading"><SeverityBadge severity={activeRisk.severity} /><h3>{activeRisk.title}</h3></div>
              <div><span>الدليل</span><p>{activeRisk.proof}</p></div>
              <div><span>الأثر</span><p>{activeRisk.consequence}</p></div>
              <div className="action-box"><span>الإجراء الأول</span><strong>{activeRisk.action}</strong></div>
            </article>
          </div>
        </section>

        <section id="coverage" className="section-block coverage-section scroll-section">
          <div className="section-heading">
            <div className="section-number">04</div>
            <div><p className="kicker">مقارنة بالوثائق المعتمدة</p><h2>واجهة واسعة، تغطية تشغيلية ضيقة</h2></div>
          </div>
          <p className="section-lead">المواصفات تطلب مصدرًا ماليًا موحدًا متعدد المستخدمين مع معاملات وموارد وتقارير وتنبيهات متصلة. ما يظهر اليوم هو جزء صغير من حسابات/حيازات فعلية تحيط به وحدات عرض ثابتة أو محاكاة محلية.</p>
          <div className="coverage-table" role="table" aria-label="تغطية وحدات المواصفات">
            <div className="coverage-head" role="row"><span>الوحدة المطلوبة</span><span>الحالة</span><span>الواقع الهندسي</span></div>
            {modules.map(([module, status, note]) => <div className="coverage-row" key={module} role="row"><strong>{module}</strong><span className={`module-status status-${status.replace(" / خطر", "")}`}>{status}</span><p>{note}</p></div>)}
          </div>
        </section>

        <section id="roadmap" className="roadmap-panel scroll-section">
          <img src={ROADMAP_IMAGE} alt="نموذج طبقات يمثل إعادة بناء نواة آمنة" className="roadmap-image" />
          <div className="roadmap-shade" />
          <div className="roadmap-content">
            <div className="section-heading light"><div className="section-number">05</div><div><p className="kicker">تنفيذ مرتب لا ترقيع متتابع</p><h2>خارطة إعادة التصميم</h2></div></div>
            <p>إجمالي الحجم التقديري: <strong>24–41 شخص-أسبوع</strong>. يمكن التوازي بعد تثبيت الهوية والمخطط والدفتر، لكن لا يجوز عكس هذا الترتيب.</p>
            <div className="roadmap-list">
              {roadmap.map(item => <article key={item.phase}><span>{item.phase}</span><div><h3>{item.title}</h3><p>{item.focus}</p></div><small>{item.timing}</small></article>)}
            </div>
          </div>
        </section>

        <section id="target" className="section-block target-section scroll-section">
          <div className="section-heading">
            <div className="section-number">06</div>
            <div><p className="kicker">التعديل الذي يرفع الاحترافية فعليًا</p><h2>معمارية مستهدفة، لا ترقيع واجهات</h2></div>
          </div>
          <div className="target-intro">
            <p>أوصي بـ<strong> Modular Monolith آمن</strong>: تطبيق واحد بإصدار وتشغيل أبسط، لكن بوحدات مجال وحدود تفويض ومعاملة مالية صارمة. لا توجد حاجة إلى microservices قبل ثبوت ضغط تشغيل حقيقي؛ الأولوية لسلامة الحقيقة المالية وقابلية التدقيق.</p>
            <div className="target-stamp"><ShieldCheck size={16} /><span>مبدأ التصميم</span><strong>الحدود قبل الميزات</strong></div>
          </div>
          <div className="target-workbench">
            <div className="architecture-map" aria-label="طبقات المعمارية المستهدفة">
              <div className="architecture-spine"><span>طلب مُفوّض</span><i /><span>خدمة مجال</span><i /><span>قيد ذري</span><i /><span>دليل تدقيق</span></div>
              <div className="architecture-layers">
                {targetLayers.map(layer => {
                  const Icon = layer.icon;
                  return <article className={`architecture-layer layer-${layer.tone}`} key={layer.id}>
                    <div className="layer-id">{layer.id}</div>
                    <div className="layer-icon"><Icon size={20} /></div>
                    <div className="layer-copy"><h3>{layer.title}</h3><p>{layer.description}</p></div>
                    <div className="layer-chips">{layer.items.map(item => <span key={item}>{item}</span>)}</div>
                  </article>;
                })}
              </div>
            </div>
            <aside className="professional-guardrails">
              <div className="guardrails-head"><FileCheck2 size={20} /><div><span>معيار الجاهزية</span><h3>ضوابط لا تفاوض عليها</h3></div></div>
              <p>هذه ليست إضافات لاحقة. هي الشروط التي تفرّق بين prototype جميل ومنتج مالي موثوق.</p>
              <ol>
                {nonNegotiables.map((item, index) => <li key={item}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></li>)}
              </ol>
              <div className="guardrails-note"><span>الإصدار الداخلي الأول</span><strong>هوية + Ledger + حسابات + معاملات أساسية + Audit</strong></div>
            </aside>
          </div>
        </section>

        <section id="verdict" className="verdict-section scroll-section">
          <div className="verdict-mark"><img src={LOGO_IMAGE} alt="" /></div>
          <div className="verdict-copy">
            <p className="kicker">الرأي الهندسي الصريح</p>
            <h2>ابنِ على الـstack،<br />لا على الجوهر المالي الحالي.</h2>
            <p>أحتفظ بـNext.js وTypeScript وPostgreSQL واتجاه RTL وفكرة الواجهة. وأعيد بناء الملكية والصلاحيات والعزل، قاعدة البيانات وmigrations، محرك المعاملات والدفتر، سجل التدقيق، الأسعار والتكاملات، التقارير والاختبارات والتشغيل.</p>
            <p>هذا يقلل المخاطرة والتكلفة المستقبلية مقارنة بترقيع الرصيد المباشر وبيانات العرض التي توحي بوظائف غير موجودة.</p>
          </div>
          <div className="decision-card">
            <span>التوصية</span>
            <strong>إعادة تصميم كبيرة</strong>
            <div><CheckCircle2 size={16} /> احتفظ بالـstack واللغة البصرية</div>
            <div><XCircle size={16} /> لا تعتمد بيانات حقيقية قبل P0 وP1</div>
            <button onClick={() => scrollToSection("overview")}>العودة للملخص <ArrowUpRight size={16} /></button>
          </div>
        </section>

        <footer className="report-footer"><span>FAMILY / TECHNICAL ASSESSMENT</span><span>المصادر: ZIP + Handoff + Instructions + تحقق تجميع ولينت معزول</span></footer>
      </main>
    </div>
  );
}
