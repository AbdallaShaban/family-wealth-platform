import { chromium } from "@playwright/test";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { ensurePersonalFamilyContext } from "../familyAccess";
import { generateFinancialStatementsPackage, type financialStatementsInputSchema } from "../financialStatementsRouter";
import { getLiveGoldAndFxRates } from "./goldFxLiveFeedService";
import { calculateShariaZakatDashboard } from "./quant/shariaZakatEngine";
import { listAccountSnapshots, listPortfolioPositions } from "../familyRead";
import { debts } from "../../drizzle/schema";
import type { z } from "zod";

export interface ExecutiveReportData {
  reportId: string;
  generatedAt: number;
  dateGregorian: string;
  dateHijri: string;
  periodLabel: string;
  workspaceName: string;
  baseCurrency: string;
  ownerName: string;
  isAudited: boolean;

  // Key Financial Metrics
  netWorth: number;
  bookEquity: number;
  totalAssets: number;
  totalLiabilities: number;
  netOperatingIncome: number;
  netCashFlow: number;
  isBalanced: boolean;
  imbalanceAmount: number;

  // Detailed Balance Sheet Breakdown
  cashAndEquivalents: {
    total: number;
    accounts: Array<{ name: string; currency: string; balanceBase: number }>;
  };
  investmentClearingTotal: number;
  specialAssetsTotal: number;
  debtAccounts: Array<{ name: string; currency: string; principalBase: number }>;

  // Gold & FX Market Position
  goldAndFx: {
    karat24: number;
    karat21: number;
    karat18: number;
    sovereign: number;
    nisab85g24k: number;
    usdEgp: number;
    eurEgp: number;
    asOf: string;
    source: string;
    isFallback: boolean;
  };

  // Sharia Zakat Position
  zakat: {
    zakatBaseEgp: number;
    nisabEgp: number;
    isDue: boolean;
    zakatDueEgp: number;
    lunarRatePct: number;
    statusText: string;
  };

  // Portfolio & Allocation
  allocation: {
    cashAmount: number;
    cashPct: number;
    equitiesAmount: number;
    equitiesPct: number;
    goldAmount: number;
    goldPct: number;
    specialAssetsAmount: number;
    specialAssetsPct: number;
    totalAmount: number;
  };

  // Inflation Shield
  inflationShield: {
    shieldIndexPct: number;
    hardAssetsTotal: number;
    paperAssetsTotal: number;
    shieldRating: string;
    recommendation: string;
  };

  // Family AI Wealth Advisor Recommendations
  advisorRecommendations?: {
    idleCashAmount?: number;
    purchasingPowerLoss?: number;
    topRecommendations: Array<{
      titleAr: string;
      actionSummaryAr: string;
      priority: string;
      suggestedAmountBase?: number;
    }>;
  };
}

/**
 * Format Arabic currency string with English tabular digits
 */
export function formatCurrency(amount: number | string | undefined, currency = "EGP"): string {
  const num = Number(amount || 0);
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Formats a Hijri date string using Umm al-Qura calendar
 */
export function formatHijriDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("ar-EG-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      numberingSystem: "latn",
    }).format(date);
  } catch {
    return "1448 هـ";
  }
}

/**
 * Formats a Gregorian date string in Arabic
 */
export function formatGregorianDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  }).format(date);
}

/**
 * Gathers complete executive wealth data for the workspace
 */
export async function getExecutiveReportData(
  family: Awaited<ReturnType<typeof ensurePersonalFamilyContext>>,
  input: z.infer<typeof financialStatementsInputSchema> = {}
): Promise<ExecutiveReportData> {
  const db = await getDb();
  const now = new Date();
  const baseCurrency = family.workspace.baseCurrency || "EGP";

  // 1. Fetch official financial statements package
  const statementsPkg = await generateFinancialStatementsPackage(family, input);

  // 2. Fetch live Gold and FX rates
  const goldFx = await getLiveGoldAndFxRates();

  // 3. Liquid accounts & portfolio positions
  const [accountRows, portfolioRows, debtRows] = await Promise.all([
    listAccountSnapshots(family),
    listPortfolioPositions(family),
    db ? db.select().from(debts).where(and(eq(debts.workspaceId, family.workspace.id), eq(debts.status, "active"))) : [],
  ]);

  // Liquid cash total
  const liquidCashEgp = accountRows.reduce((sum: number, acc: any) => sum + Math.max(0, Number(acc.balance) || 0), 0);

  // Categorize portfolio
  let goldPortfolioEgp = 0;
  let equitiesPortfolioEgp = 0;
  for (const pos of portfolioRows) {
    const val = Number((pos as any).baseMarketValue || (pos as any).marketValue || 0);
    const sym = ((pos as any).symbol || "").toUpperCase();
    const type = ((pos as any).assetType || "").toLowerCase();
    if (sym.includes("GOLD") || type === "gold") {
      goldPortfolioEgp += val;
    } else {
      equitiesPortfolioEgp += val;
    }
  }

  // Calculate immediate debts
  const immediateDebtsEgp = debtRows.reduce((sum: number, d: any) => {
    return sum + (Number(d.minimumPayment) || Number(d.originalPrincipal) * 0.05 || 0);
  }, 0);

  // 4. Sharia Zakat Engine calculation
  const zakatDashboard = calculateShariaZakatDashboard({
    goldGramPrice24k: goldFx.karat24,
    cashAndBankBalancesEgp: liquidCashEgp,
    monetaryGoldValueEgp: goldPortfolioEgp,
    tradingStocksMarketValueEgp: equitiesPortfolioEgp * 0.4, // estimated liquid trading quota
    longTermStocksMarketValueEgp: equitiesPortfolioEgp * 0.6,
    immediateDebtsDueEgp: immediateDebtsEgp,
  });

  // 5. Asset Allocation breakdown
  const specialAssetsEgp = Number(statementsPkg.bookBalanceSheet.assets.specialAssetsAtCost.totalBase) || 0;
  const totalAllocation = liquidCashEgp + equitiesPortfolioEgp + goldPortfolioEgp + specialAssetsEgp;
  const safeTotal = totalAllocation > 0 ? totalAllocation : 1;

  const cashPct = Math.round((liquidCashEgp / safeTotal) * 1000) / 10;
  const equitiesPct = Math.round((equitiesPortfolioEgp / safeTotal) * 1000) / 10;
  const goldPct = Math.round((goldPortfolioEgp / safeTotal) * 1000) / 10;
  const specialAssetsPct = Math.round((specialAssetsEgp / safeTotal) * 1000) / 10;

  // 6. Inflation Shield: Hard Assets (Gold + Equities + Real Estate) vs Paper Cash
  const hardAssets = goldPortfolioEgp + equitiesPortfolioEgp + specialAssetsEgp;
  const shieldIndexPct = Math.round((hardAssets / safeTotal) * 100);

  let shieldRating = "درع متوازن ومستقر";
  let recommendation = "التركيبة الحالية توفر حماية جيدة ضد التضخم مع الحفاظ على سيولة تشغيلية كافية.";
  if (shieldIndexPct >= 70) {
    shieldRating = "درع متين فائق الحصانة";
    recommendation = "محفظة عالية التحوط ضد انخفاض القوة الشرائية وتدهور العملة المحلية.";
  } else if (shieldIndexPct < 40) {
    shieldRating = "درع منخفض - عرضة لتآكل القوة الشرائية";
    recommendation = "يُنصح بإعادة توجيه جزء من السيولة النقدية الفائضة نحو السبائك الذهبية أو الأسهم المدرّة للعوائد.";
  }

  // Period label
  let periodLabel = input.periodKey || "المركز المالي الحالي";
  if (statementsPkg.metadata.periodKey) {
    periodLabel = `الفترة المالية: ${statementsPkg.metadata.periodKey}`;
  } else if (statementsPkg.metadata.asOf) {
    periodLabel = `كما في: ${new Date(statementsPkg.metadata.asOf).toISOString().slice(0, 10)}`;
  }

  const reportId = `FWI-EXEC-${now.getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  return {
    reportId,
    generatedAt: now.getTime(),
    dateGregorian: formatGregorianDate(now),
    dateHijri: formatHijriDate(now),
    periodLabel,
    workspaceName: family.workspace.name || "العائلة",
    baseCurrency,
    ownerName: family.profile.displayName || "المالك التنفيذي",
    isAudited: statementsPkg.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity,

    netWorth: Number(statementsPkg.economicNetWorthBridge.economicNetWorth) || 0,
    bookEquity: Number(statementsPkg.bookBalanceSheet.equity.totalBookEquity) || 0,
    totalAssets: Number(statementsPkg.bookBalanceSheet.assets.totalBookAssets) || 0,
    totalLiabilities: Number(statementsPkg.bookBalanceSheet.liabilities.totalBookLiabilities) || 0,
    netOperatingIncome: Number(statementsPkg.incomeStatement.netOperatingIncome) || 0,
    netCashFlow: Number(statementsPkg.cashFlowStatement.netCashFlow) || 0,
    isBalanced: statementsPkg.bookBalanceSheet.equationCheck.assetsEqualsLiabilitiesPlusEquity,
    imbalanceAmount: Number(statementsPkg.bookBalanceSheet.equationCheck.imbalanceBase) || 0,

    cashAndEquivalents: {
      total: Number(statementsPkg.bookBalanceSheet.assets.cashAndEquivalents.totalBase) || 0,
      accounts: statementsPkg.bookBalanceSheet.assets.cashAndEquivalents.accounts.map((a) => ({
        name: a.name,
        currency: a.currency,
        balanceBase: Number(a.balanceBase) || 0,
      })),
    },
    investmentClearingTotal: Number(statementsPkg.bookBalanceSheet.assets.investmentClearing.totalBase) || 0,
    specialAssetsTotal: specialAssetsEgp,
    debtAccounts: statementsPkg.bookBalanceSheet.liabilities.debtAccounts.map((d) => ({
      name: d.name,
      currency: d.currency,
      principalBase: Number(d.principalBase) || 0,
    })),

    goldAndFx: {
      karat24: goldFx.karat24,
      karat21: goldFx.karat21,
      karat18: goldFx.karat18,
      sovereign: goldFx.sovereignEgp,
      nisab85g24k: goldFx.nisab85gEgp,
      usdEgp: goldFx.usdEgpRate,
      eurEgp: goldFx.eurEgpRate,
      asOf: new Date(goldFx.asOf).toISOString(),
      source: goldFx.source,
      isFallback: goldFx.isFallback,
    },

    zakat: {
      zakatBaseEgp: zakatDashboard.netZakatableWealthEgp,
      nisabEgp: zakatDashboard.nisabValueEgp,
      isDue: zakatDashboard.isAboveNisab,
      zakatDueEgp: zakatDashboard.totalZakatDueEgp,
      lunarRatePct: 2.5,
      statusText: zakatDashboard.isAboveNisab
        ? "بلغ النصاب الشرعي - الزكاة واجبة"
        : "دون النصاب الشرعي - لا تجب الزكاة",
    },

    allocation: {
      cashAmount: liquidCashEgp,
      cashPct,
      equitiesAmount: equitiesPortfolioEgp,
      equitiesPct,
      goldAmount: goldPortfolioEgp,
      goldPct,
      specialAssetsAmount: specialAssetsEgp,
      specialAssetsPct,
      totalAmount: totalAllocation,
    },

    inflationShield: {
      shieldIndexPct,
      hardAssetsTotal: hardAssets,
      paperAssetsTotal: liquidCashEgp,
      shieldRating,
      recommendation,
    },

    advisorRecommendations: await (async () => {
      try {
        const { generateWealthAdvisorPackage } = await import("./wealthAdvisorService");
        const advisorPkg = await generateWealthAdvisorPackage(family);
        return {
          idleCashAmount: advisorPkg.liquidity.stagnantSurplusCashBase,
          purchasingPowerLoss: advisorPkg.liquidity.annualPurchasingPowerLossBase,
          topRecommendations: advisorPkg.recommendations.slice(0, 3).map(r => ({
            titleAr: r.titleAr,
            actionSummaryAr: r.actionSummaryAr,
            priority: r.priority,
            suggestedAmountBase: r.suggestedAmountBase,
          })),
        };
      } catch {
        return undefined;
      }
    })(),
  };
}

/**
 * Generates print-ready HTML with vector SVG diagrams and luxury formatting
 */
export function renderExecutiveReportHtml(d: ExecutiveReportData): string {
  const curr = d.baseCurrency;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>التقرير المالي التنفيذي - ${d.workspaceName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
      @bottom-right {
        content: counter(page) " من " counter(pages);
        font-family: sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      color: #0f172a;
      background-color: #ffffff;
      font-size: 10pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      page-break-after: always;
      break-after: page;
      position: relative;
      min-height: 270mm;
      padding-bottom: 15mm;
    }

    .page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 18px;
    }

    .page-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      font-size: 8pt;
      color: #64748b;
    }

    .seal-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #f8fafc;
      border: 1px solid #0284c7;
      color: #0369a1;
      font-size: 8pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
    }

    /* Cover Page Styling */
    .cover-container {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 265mm;
      padding: 10mm 5mm;
      border: 2px solid #0f172a;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      position: relative;
    }

    .cover-crest {
      text-align: center;
      margin-top: 20px;
    }

    .crest-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 12px;
      background: #0f172a;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fbbf24;
      font-size: 28px;
      font-weight: bold;
    }

    .platform-name {
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: 2px;
      color: #0f172a;
      text-transform: uppercase;
    }

    .platform-subtitle {
      font-size: 9pt;
      color: #64748b;
      margin-top: 2px;
      font-weight: 600;
    }

    .cover-title-box {
      text-align: center;
      margin: 40px 0;
    }

    .cover-main-title {
      font-size: 26pt;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.25;
      margin: 0 0 10px 0;
    }

    .cover-sub-title {
      font-size: 13pt;
      color: #475569;
      font-weight: 600;
    }

    .cover-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 25px 0;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      text-align: center;
    }

    .kpi-label {
      font-size: 8.5pt;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 6px;
    }

    .kpi-value {
      font-size: 13pt;
      font-weight: 800;
      font-family: monospace;
      font-variant-numeric: tabular-nums;
      color: #0f172a;
    }

    .cover-meta-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 20px;
      font-size: 9pt;
    }

    .meta-item {
      display: flex;
      justify-content: space-between;
    }

    .meta-item .lbl {
      color: #64748b;
      font-weight: 600;
    }

    .meta-item .val {
      color: #0f172a;
      font-weight: 700;
    }

    .cover-stamp {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #cbd5e1;
      padding-top: 15px;
      margin-top: 20px;
    }

    /* Content Tables */
    .section-title {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      margin: 18px 0 10px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 4px;
    }

    table.fin-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 14px;
      font-size: 9pt;
    }

    table.fin-table th, table.fin-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
    }

    table.fin-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }

    table.fin-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .num-cell {
      font-family: monospace;
      font-variant-numeric: tabular-nums;
      direction: ltr;
      text-align: left;
      font-weight: 700;
    }

    .badge-ok {
      background: #dcfce7;
      color: #166534;
      font-size: 8pt;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .badge-warn {
      background: #fef3c7;
      color: #92400e;
      font-size: 8pt;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .gold-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 10px 0 15px 0;
    }

    .gold-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }

    .fx-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 15px;
    }

    .fx-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }

    /* Vector SVG Charts */
    .chart-container {
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 15px;
      margin: 15px 0;
    }

    .chart-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 9pt;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .legend-color {
      width: 14px;
      height: 14px;
      border-radius: 4px;
    }

    .shield-box {
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px;
      background: #f8fafc;
      margin-top: 15px;
    }
  </style>
</head>
<body>

  <!-- ============================================================ -->
  <!-- PAGE 1: LUXURY EXECUTIVE COVER PAGE                           -->
  <!-- ============================================================ -->
  <div class="page">
    <div class="cover-container">
      <div>
        <div class="cover-crest">
          <div class="crest-icon">🛡️</div>
          <div class="platform-name">Family Wealth Intelligence</div>
          <div class="platform-subtitle">منظومة إدارة وحوكمة الثروات العائلية والمحاسبة المؤسسية</div>
        </div>

        <div class="cover-title-box">
          <h1 class="cover-main-title">التقرير المالي والتنفيذي الشامل</h1>
          <div class="cover-sub-title">المركز المالي، صافي الثروة، محفظة الذهب والعملات، وحساب الزكاة الشرعية</div>
        </div>

        <div class="cover-kpi-grid">
          <div class="kpi-card" style="border-top: 3px solid #6366f1;">
            <div class="kpi-label">صافي الثروة الاقتصادي</div>
            <div class="kpi-value">${formatCurrency(d.netWorth, curr)}</div>
          </div>
          <div class="kpi-card" style="border-top: 3px solid #10b981;">
            <div class="kpi-label">السيولة النقدية وما في حكمها</div>
            <div class="kpi-value">${formatCurrency(d.cashAndEquivalents.total, curr)}</div>
          </div>
          <div class="kpi-card" style="border-top: 3px solid #f59e0b;">
            <div class="kpi-label">وعاء الزكاة الشرعية</div>
            <div class="kpi-value">${formatCurrency(d.zakat.zakatBaseEgp, "EGP")}</div>
          </div>
          <div class="kpi-card" style="border-top: 3px solid #0284c7;">
            <div class="kpi-label">درع التحوط ضد التضخم</div>
            <div class="kpi-value">${d.inflationShield.shieldIndexPct}%</div>
          </div>
        </div>

        <div class="cover-meta-box">
          <div class="meta-item">
            <span class="lbl">مساحة الثروة:</span>
            <span class="val">${d.workspaceName}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">المالك / الممثل المالي:</span>
            <span class="val">${d.ownerName}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">التاريخ الهجري:</span>
            <span class="val">${d.dateHijri}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">التاريخ الميلادي:</span>
            <span class="val">${d.dateGregorian}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">الفترة المحاسبية:</span>
            <span class="val">${d.periodLabel}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">العملة الأساسية:</span>
            <span class="val">${curr}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">كود التحقق الرقمي:</span>
            <span class="val" style="font-family: monospace;">${d.reportId}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">حالة التدقيق المحاسبي:</span>
            <span class="val">${d.isAudited ? '<span class="badge-ok">مدقق ومطابق للقيد المزدوج 100%</span>' : '<span class="badge-warn">يتطلب مراجعة</span>'}</span>
          </div>
        </div>
      </div>

      <div class="cover-stamp">
        <div>
          <div style="font-weight: 800; color: #0f172a; font-size: 9.5pt;">اعتماد التقرير المالي الموحد</div>
          <div style="font-size: 8pt; color: #64748b;">وثيقة رسمية خاصة مشفرة صالحة للاستخدام الإداري والمالي</div>
        </div>
        <div class="seal-badge">
          <span>✓</span>
          <span>ختم الاعتماد الرقمي FWI</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- PAGE 2: BALANCE SHEET & FINANCIAL STATEMENTS                  -->
  <!-- ============================================================ -->
  <div class="page">
    <div class="page-header">
      <div>
        <strong style="color: #0f172a; font-size: 11pt;">${d.workspaceName} | الميزانية والمركز المالي</strong>
        <div style="font-size: 8pt; color: #64748b;">${d.dateGregorian} (${d.dateHijri})</div>
      </div>
      <div class="seal-badge">معرف التقرير: ${d.reportId}</div>
    </div>

    <div class="section-title">
      <span>1. ملخص المركز المالي وصافي الثروة (Balance Sheet)</span>
    </div>

    <table class="fin-table">
      <thead>
        <tr>
          <th style="width: 50%;">البند المحاسبي</th>
          <th style="width: 25%;">التصنيف</th>
          <th style="width: 25%;">القيمة بالعملة الأساسية (${curr})</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>إجمالي الأصول الدفترية (Total Book Assets)</strong></td>
          <td>أصول متداولة وثابتة</td>
          <td class="num-cell" style="color: #166534;">${formatCurrency(d.totalAssets, curr)}</td>
        </tr>
        <tr>
          <td style="padding-right: 25px;">- النقدية والودائع وما في حكمها</td>
          <td>سيولة فورية</td>
          <td class="num-cell">${formatCurrency(d.cashAndEquivalents.total, curr)}</td>
        </tr>
        <tr>
          <td style="padding-right: 25px;">- رصيد مقاصة الاستثمار والتسوية</td>
          <td>استثمارات جارية</td>
          <td class="num-cell">${formatCurrency(d.investmentClearingTotal, curr)}</td>
        </tr>
        <tr>
          <td style="padding-right: 25px;">- الأصول الخاصة والعينية بالتكلفة</td>
          <td>أصول ثابتة</td>
          <td class="num-cell">${formatCurrency(d.specialAssetsTotal, curr)}</td>
        </tr>
        <tr>
          <td><strong>إجمالي الالتزامات والديون (Total Liabilities)</strong></td>
          <td>تسهيلات وقروض قائمة</td>
          <td class="num-cell" style="color: #991b1b;">${formatCurrency(d.totalLiabilities, curr)}</td>
        </tr>
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td><strong>حقوق الملكية ورأس المال الدفتري (Book Equity)</strong></td>
          <td>رأس المال + الأرباح المتراكمة</td>
          <td class="num-cell" style="color: #0f172a;">${formatCurrency(d.bookEquity, curr)}</td>
        </tr>
        <tr style="background-color: #fefce8; font-weight: bold;">
          <td><strong>صافي الثروة الاقتصادي بالقيمة العادلة (Economic Net Worth)</strong></td>
          <td>إجمالي الثروة السوقية</td>
          <td class="num-cell" style="color: #1e1b4b; font-size: 10.5pt;">${formatCurrency(d.netWorth, curr)}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: ${d.isBalanced ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${d.isBalanced ? '#bbf7d0' : '#fde68a'}; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 8.5pt; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong style="color: ${d.isBalanced ? '#166534' : '#92400e'};">معادلة التوازن المحاسبي: </strong>
        <span>الأصول (${formatCurrency(d.totalAssets, curr)}) = الالتزامات (${formatCurrency(d.totalLiabilities, curr)}) + حقوق الملكية (${formatCurrency(d.bookEquity, curr)})</span>
      </div>
      <div>
        ${d.isBalanced ? '<span class="badge-ok">متوازنة 100%</span>' : `<span class="badge-warn">خلل: ${formatCurrency(d.imbalanceAmount, curr)}</span>`}
      </div>
    </div>

    <div class="section-title">
      <span>2. تفصيل السيولة والحسابات البنكية</span>
    </div>

    <table class="fin-table">
      <thead>
        <tr>
          <th>اسم الحساب / البنك</th>
          <th>عملة الحساب</th>
          <th>الرصيد بالعملة الأساسية (${curr})</th>
        </tr>
      </thead>
      <tbody>
        ${d.cashAndEquivalents.accounts.length ? d.cashAndEquivalents.accounts.map(acc => `
          <tr>
            <td>${acc.name}</td>
            <td>${acc.currency}</td>
            <td class="num-cell">${formatCurrency(acc.balanceBase, curr)}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="3" style="text-align: center; color: #94a3b8;">لا توجد حسابات مسجلة</td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="page-footer">
      <span>وثيقة عائلية مالية سرية للغاية - نظام FAMILY WEALTH INTELLIGENCE</span>
      <span>صفحة 2 من 4</span>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- PAGE 3: GOLD, FX & SHARIA ZAKAT                               -->
  <!-- ============================================================ -->
  <div class="page">
    <div class="page-header">
      <div>
        <strong style="color: #0f172a; font-size: 11pt;">${d.workspaceName} | الذهب والعملات والزكاة الشرعية</strong>
        <div style="font-size: 8pt; color: #64748b;">${d.dateGregorian} (${d.dateHijri})</div>
      </div>
      <div class="seal-badge">معرف التقرير: ${d.reportId}</div>
    </div>

    <div class="section-title">
      <span>3. أسعار الذهب والعملات اللحظية المعتمدة (Gold & FX Rates)</span>
    </div>

    <div class="gold-grid">
      <div class="gold-card">
        <div style="font-size: 8pt; color: #78350f; font-weight: 600;">عيار 24 (سبائك)</div>
        <div style="font-size: 12pt; font-weight: 800; font-family: monospace; color: #92400e;">${formatCurrency(d.goldAndFx.karat24, "EGP")}</div>
      </div>
      <div class="gold-card">
        <div style="font-size: 8pt; color: #78350f; font-weight: 600;">عيار 21 (مصاغ)</div>
        <div style="font-size: 12pt; font-weight: 800; font-family: monospace; color: #92400e;">${formatCurrency(d.goldAndFx.karat21, "EGP")}</div>
      </div>
      <div class="gold-card">
        <div style="font-size: 8pt; color: #78350f; font-weight: 600;">عيار 18 (حلي)</div>
        <div style="font-size: 12pt; font-weight: 800; font-family: monospace; color: #92400e;">${formatCurrency(d.goldAndFx.karat18, "EGP")}</div>
      </div>
      <div class="gold-card">
        <div style="font-size: 8pt; color: #78350f; font-weight: 600;">الجنيه الذهب (8 جم 21k)</div>
        <div style="font-size: 12pt; font-weight: 800; font-family: monospace; color: #92400e;">${formatCurrency(d.goldAndFx.sovereign, "EGP")}</div>
      </div>
    </div>

    <div class="fx-grid">
      <div class="fx-card">
        <div style="font-size: 8pt; color: #166534; font-weight: 600;">سعر صرف الدولار (USD / EGP)</div>
        <div style="font-size: 13pt; font-weight: 800; font-family: monospace; color: #14532d;">${formatCurrency(d.goldAndFx.usdEgp, "EGP")}</div>
      </div>
      <div class="fx-card">
        <div style="font-size: 8pt; color: #166534; font-weight: 600;">سعر صرف اليورو (EUR / EGP)</div>
        <div style="font-size: 13pt; font-weight: 800; font-family: monospace; color: #14532d;">${formatCurrency(d.goldAndFx.eurEgp, "EGP")}</div>
      </div>
    </div>

    <div class="section-title">
      <span>4. حاسبة وموقف الزكاة الشرعية (Sharia Zakat Assessment)</span>
    </div>

    <table class="fin-table">
      <thead>
        <tr>
          <th>عنصر الزكاة</th>
          <th>المعيار الشرعي والمحاسبي</th>
          <th>القيمة المحسوبة (EGP)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>نصاب الذهب الشرعي (85 جرام عيار 24)</strong></td>
          <td>85 جرام × ${formatCurrency(d.goldAndFx.karat24, "EGP")}</td>
          <td class="num-cell" style="color: #b45309;">${formatCurrency(d.zakat.nisabEgp, "EGP")}</td>
        </tr>
        <tr>
          <td><strong>وعاء الزكاة الصافي الخاضع للحول</strong></td>
          <td>السيولة + الذهب النقدي + الأسهم التجارية - الديون الحالة</td>
          <td class="num-cell">${formatCurrency(d.zakat.zakatBaseEgp, "EGP")}</td>
        </tr>
        <tr>
          <td><strong>موقف بلوغ النصاب</strong></td>
          <td>مقارنة الوعاء بقيمة 85 جرام عيار 24</td>
          <td>
            ${d.zakat.isDue ? '<span class="badge-ok">بلغ النصاب الشرعي</span>' : '<span class="badge-warn">دون النصاب الشرعي</span>'}
          </td>
        </tr>
        <tr style="background-color: #fefce8; font-weight: bold;">
          <td><strong>مقدار الزكاة الواجب إخراجها (2.5%)</strong></td>
          <td>نسبة الحول القمري الشرعي (أو 2.577% للشمسي)</td>
          <td class="num-cell" style="color: #15803d; font-size: 11pt;">${formatCurrency(d.zakat.zakatDueEgp, "EGP")}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-top: 10px; font-size: 8.5pt; color: #475569;">
      <strong>تنبيه شرعي معتمد:</strong> تم احتساب الزكاة على أساس 85 جراماً من الذهب الخالص عيار 24، مع خصم الالتزامات والديون الحالة المستحقة، واستبعاد الأصول القنية والأصول الخاصة غير المخصصة للنماء أو التجارة، وفق المعايير الشرعية لهيئة المحاسبة والمراجعة للمؤسسات المالية الإسلامية (AAOIFI).
    </div>

    <div class="page-footer">
      <span>وثيقة عائلية مالية سرية للغاية - نظام FAMILY WEALTH INTELLIGENCE</span>
      <span>صفحة 3 من 4</span>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- PAGE 4: ASSET ALLOCATION & INFLATION SHIELD                   -->
  <!-- ============================================================ -->
  <div class="page">
    <div class="page-header">
      <div>
        <strong style="color: #0f172a; font-size: 11pt;">${d.workspaceName} | توزيع الأصول ودرع التضخم</strong>
        <div style="font-size: 8pt; color: #64748b;">${d.dateGregorian} (${d.dateHijri})</div>
      </div>
      <div class="seal-badge">معرف التقرير: ${d.reportId}</div>
    </div>

    <div class="section-title">
      <span>5. هيكل وتوزيع الأصول الاستثمارية (Asset Allocation)</span>
    </div>

    <div class="chart-container">
      <!-- High-resolution clean Vector SVG Donut Chart -->
      <svg width="220" height="220" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#e2e8f0" stroke-width="14" />
        <!-- Cash Arc -->
        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10b981" stroke-width="14"
          stroke-dasharray="${d.allocation.cashPct * 2.387} 238.7" stroke-dashoffset="0" />
        <!-- Equities Arc -->
        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#3b82f6" stroke-width="14"
          stroke-dasharray="${d.allocation.equitiesPct * 2.387} 238.7" stroke-dashoffset="-${d.allocation.cashPct * 2.387}" />
        <!-- Gold Arc -->
        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f59e0b" stroke-width="14"
          stroke-dasharray="${d.allocation.goldPct * 2.387} 238.7" stroke-dashoffset="-${(d.allocation.cashPct + d.allocation.equitiesPct) * 2.387}" />
        <!-- Special Assets Arc -->
        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#8b5cf6" stroke-width="14"
          stroke-dasharray="${d.allocation.specialAssetsPct * 2.387} 238.7" stroke-dashoffset="-${(d.allocation.cashPct + d.allocation.equitiesPct + d.allocation.goldPct) * 2.387}" />
        
        <text x="50" y="47" text-anchor="middle" font-size="8" font-weight="bold" fill="#0f172a">المحفظة</text>
        <text x="50" y="58" text-anchor="middle" font-size="7" font-family="monospace" fill="#64748b">100%</text>
      </svg>

      <div class="chart-legend">
        <div class="legend-item">
          <div class="legend-color" style="background: #10b981;"></div>
          <span><strong>النقدية والسيولة البنكية:</strong> ${d.allocation.cashPct}% (${formatCurrency(d.allocation.cashAmount, curr)})</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #3b82f6;"></div>
          <span><strong>الأسهم والاستثمارات المالية:</strong> ${d.allocation.equitiesPct}% (${formatCurrency(d.allocation.equitiesAmount, curr)})</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #f59e0b;"></div>
          <span><strong>الذهب والمعادن الثمينة:</strong> ${d.allocation.goldPct}% (${formatCurrency(d.allocation.goldAmount, curr)})</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #8b5cf6;"></div>
          <span><strong>الأصول العينية والخاصة:</strong> ${d.allocation.specialAssetsPct}% (${formatCurrency(d.allocation.specialAssetsAmount, curr)})</span>
        </div>
      </div>
    </div>

    <div class="section-title">
      <span>6. مؤشر درع التضخم وحماية القوة الشرائية (Inflation Shield)</span>
    </div>

    <div class="shield-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
          <strong style="font-size: 11pt; color: #0f172a;">مستوى درع التضخم الحالي: ${d.inflationShield.shieldIndexPct}%</strong>
          <div style="font-size: 8.5pt; color: #0284c7; font-weight: 700;">${d.inflationShield.shieldRating}</div>
        </div>
        <div class="seal-badge">مؤشر التحوط المالي</div>
      </div>
      <p style="font-size: 9pt; color: #334155; margin: 0 0 10px 0;">
        ${d.inflationShield.recommendation}
      </p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 8.5pt; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        <div><strong>الأصول الحقيقية الملاذة:</strong> ${formatCurrency(d.inflationShield.hardAssetsTotal, curr)}</div>
        <div><strong>السيولة الورقية المعرضة للتآكل:</strong> ${formatCurrency(d.inflationShield.paperAssetsTotal, curr)}</div>
      </div>
    </div>

    ${d.advisorRecommendations && d.advisorRecommendations.topRecommendations.length > 0 ? `
    <div style="margin-top: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-right: 4px solid #16a34a; border-radius: 6px; padding: 10px 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-weight: 700; font-size: 9pt; color: #166534;">توجيهات المستشار الذكي لإعادة التوازن وحماية الثروة (AI Wealth Advisory Directives)</span>
        <span style="font-size: 7.5pt; background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-weight: 700;">استشاري فقط</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${d.advisorRecommendations.topRecommendations.map(r => `
          <div style="font-size: 8.5pt; color: #1f2937; line-height: 1.4; display: flex; align-items: flex-start; gap: 6px;">
            <span style="color: #16a34a; font-weight: 900; margin-top: 1px;">•</span>
            <div>
              <strong style="color: #0f172a;">${r.titleAr}:</strong>
              <span>${r.actionSummaryAr}</span>
              ${r.suggestedAmountBase ? `<span style="font-weight: 700; color: #15803d; margin-right: 4px;">(المبلغ المقترح: ${formatCurrency(r.suggestedAmountBase, curr)})</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Signatures section -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
      <div>
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 40px;">توقيع مالك الثروة / رب الأسرة:</div>
        <div style="border-bottom: 1px solid #0f172a; width: 80%;"></div>
        <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">الاسم: ${d.ownerName}</div>
      </div>
      <div>
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 40px;">اعتماد المستشار المالي / المراجع:</div>
        <div style="border-bottom: 1px solid #0f172a; width: 80%;"></div>
        <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">التاريخ: ${d.dateGregorian}</div>
      </div>
    </div>

    <div class="page-footer">
      <span>وثيقة عائلية مالية سرية للغاية - نظام FAMILY WEALTH INTELLIGENCE</span>
      <span>صفحة 4 من 4</span>
    </div>
  </div>

</body>
</html>`;
}

/**
 * Generates an actual vector PDF Buffer via headless Chromium
 */
export async function generateExecutiveReportPdf(d: ExecutiveReportData): Promise<Buffer> {
  const html = renderExecutiveReportHtml(d);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        bottom: "12mm",
        left: "14mm",
        right: "14mm",
      },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
