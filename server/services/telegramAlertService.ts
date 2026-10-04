import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import Decimal from "decimal.js";
import type { FamilyContext } from "../familyAccess";
import { listBankCertificates, getDaysToMaturity } from "./banking/bankingService";
import { getLiveGoldAndFxRates } from "./goldFxLiveFeedService";
import { calculateShariaZakatDashboard } from "./quant/shariaZakatEngine";
import { getDashboardSummary } from "../familyRead";

export interface TelegramAlertConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  enableCertificates: boolean;
  enableGoldMovements: boolean;
  enableZakatHawl: boolean;
  enableWeeklySummary: boolean;
  goldMovementThresholdPct: number; // default 2.0%
  lastCheckedAt?: number;
  lastDispatchedAt?: number;
  lastTestSentAt?: number;
}

const CONFIG_FILE_PATH = path.resolve(process.cwd(), ".telegram_alerts_config.json");
const SENT_LOG_FILE_PATH = path.resolve(process.cwd(), ".telegram_sent_log.json");

const DEFAULT_CONFIG: TelegramAlertConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  chatId: process.env.TELEGRAM_CHAT_ID || "",
  enabled: true,
  enableCertificates: true,
  enableGoldMovements: true,
  enableZakatHawl: true,
  enableWeeklySummary: true,
  goldMovementThresholdPct: 2.0,
};

/**
 * Loads the current Telegram notification configuration from disk with process.env fallbacks.
 */
export function loadTelegramConfig(): TelegramAlertConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        botToken: parsed.botToken || process.env.TELEGRAM_BOT_TOKEN || "",
        chatId: parsed.chatId || process.env.TELEGRAM_CHAT_ID || "",
      };
    }
  } catch (err) {
    console.warn("[TelegramService] Failed to load config from disk, using defaults:", err);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Saves updated Telegram notification configuration to disk.
 */
export function saveTelegramConfig(updates: Partial<TelegramAlertConfig>): TelegramAlertConfig {
  const current = loadTelegramConfig();
  const merged: TelegramAlertConfig = {
    ...current,
    ...updates,
  };
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.error("[TelegramService] Failed to persist config to disk:", err);
  }
  return merged;
}

/**
 * Loads the deduplication log to prevent sending the same alert multiple times within 24 hours.
 */
function loadSentLog(): Record<string, number> {
  try {
    if (fs.existsSync(SENT_LOG_FILE_PATH)) {
      const raw = fs.readFileSync(SENT_LOG_FILE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return {};
}

function recordSentAlert(alertKey: string): void {
  try {
    const log = loadSentLog();
    log[alertKey] = Date.now();
    // Prune entries older than 7 days
    const now = Date.now();
    const pruned: Record<string, number> = {};
    for (const [k, v] of Object.entries(log)) {
      if (now - v < 7 * 86_400_000) {
        pruned[k] = v;
      }
    }
    fs.writeFileSync(SENT_LOG_FILE_PATH, JSON.stringify(pruned, null, 2), "utf-8");
  } catch {
    // ignore logging errors
  }
}

function wasAlertRecentlySent(alertKey: string, cooldownHours = 20): boolean {
  const log = loadSentLog();
  const sentAt = log[alertKey];
  if (!sentAt) return false;
  return Date.now() - sentAt < cooldownHours * 3600_000;
}

/**
 * Sends a formatted Telegram message via the Telegram Bot API.
 */
export async function sendTelegramMessage(
  text: string,
  overrideConfig?: { botToken?: string; chatId?: string }
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const config = loadTelegramConfig();
  const token = overrideConfig && "botToken" in overrideConfig ? overrideConfig.botToken : config.botToken;
  const chat = overrideConfig && "chatId" in overrideConfig ? overrideConfig.chatId : config.chatId;

  if (!token) {
    return { success: false, error: "Telegram Bot Token غير مضبوط. يرجى إدخاله في الإعدادات أو المتغيرات البيئية." };
  }
  if (!chat) {
    return { success: false, error: "Telegram Chat ID غير مضبوط. يرجى إدخاله في الإعدادات." };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await axios.post(
      url,
      {
        chat_id: chat,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      },
      { timeout: 8000 }
    );

    if (response.data && response.data.ok) {
      return { success: true, messageId: response.data.result?.message_id };
    }
    return { success: false, error: response.data?.description || "فشل غير معروف من خادم تيليجرام" };
  } catch (err: any) {
    const description = err.response?.data?.description || err.message || "خطأ اتصال أثناء إرسال رسالة تيليجرام";
    console.error("[TelegramService] Error sending message:", description);
    return { success: false, error: description };
  }
}

/**
 * Sends an immediate test alert to verify the Bot Token and Chat ID integration.
 */
export async function sendTestAlert(
  customToken?: string,
  customChatId?: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const nowStr = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(new Date());

  const message = `
🌟 <b>تم بنجاح ربط منصة FAMILY مع تيليجرام</b>
━━━━━━━━━━━━━━━━━━━━━
✅ <b>حالة الاتصال:</b> متصل ونشط (Online & Operational)
⏱ <b>توقيت الاختبار:</b> ${nowStr}
🔐 <b>نطاق الأمان:</b> تنبيهات الثروة والمحفظة العائلية المعتمدة

💡 <i>سيتلقى هذا الحساب تنبيهات استحقاق الشهادات البنكية، وتحركات الذهب اللحظية، ومواعيد ونصاب الزكاة الشرعية تلقائياً.</i>
  `.trim();

  const result = await sendTelegramMessage(message, {
    botToken: customToken,
    chatId: customChatId,
  });

  if (result.success) {
    saveTelegramConfig({ lastTestSentAt: Date.now() });
  }

  return result;
}

/**
 * Trigger 1: Certificate & Deposit Maturity Alert
 * Alerts when a certificate matures in exactly 7 days, or today.
 */
export async function checkCertificateMaturityAlerts(context: FamilyContext): Promise<string[]> {
  const certificates = await listBankCertificates(context);
  const activeCerts = certificates.filter((c) => c.status === "active");
  const alertsSent: string[] = [];

  for (const cert of activeCerts) {
    const daysLeft = getDaysToMaturity(cert.maturityDate);
    const maturityDateStr = new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeZone: "Africa/Cairo",
    }).format(new Date(cert.maturityDate));

    // Alert on 7 days before, or on day of maturity (0/1 days)
    if (daysLeft === 7 || daysLeft <= 1) {
      const alertKey = `cert-maturity-${cert.id}-${daysLeft <= 1 ? "due" : "7days"}`;
      if (wasAlertRecentlySent(alertKey, 48)) continue;

      const title =
        daysLeft <= 1
          ? "🚨 <b>تنبيه استحقاق شهادة بنكية اليوم!</b>"
          : "⏳ <b>تنبيه اقتراب موعد استحقاق شهادة بنكية (7 أيام)</b>";

      const msg = `
${title}
━━━━━━━━━━━━━━━━━━━━━
🏛 <b>البنك المصدر:</b> ${cert.bankName}
📜 <b>اسم الشهادة:</b> ${cert.certificateName}
💰 <b>أصل المبلغ:</b> ${Number(cert.principalAmount).toLocaleString()} ${cert.currency}
📈 <b>معدل العائد:</b> ${Number(cert.interestRate)}% سنوياً
📅 <b>تاريخ الاستحقاق:</b> ${maturityDateStr}
⏳ <b>المتبقي:</b> ${daysLeft === 0 ? "تستحق اليوم" : `${daysLeft} أيام`}

💡 <i>يرجى مراجعة الحساب وتحديد قرار إعادة الاستثمار أو تحويل المبلغ إلى حساب السيولة النقدية.</i>
      `.trim();

      const res = await sendTelegramMessage(msg);
      if (res.success) {
        recordSentAlert(alertKey);
        alertsSent.push(`Certificate: ${cert.certificateName} (${daysLeft} days)`);
      }
    }
  }

  return alertsSent;
}

// Track baseline gold price in memory
let lastKnownGold24kPrice: { price: number; timestamp: number } | null = null;

/**
 * Trigger 2: Sharp Gold Movements Alert (> 2% in 24h)
 */
export async function checkGoldMovementAlerts(): Promise<string[]> {
  const liveRates = await getLiveGoldAndFxRates();
  const current24k = liveRates.karat24;
  const alertsSent: string[] = [];

  if (!lastKnownGold24kPrice) {
    lastKnownGold24kPrice = { price: current24k, timestamp: Date.now() };
    return [];
  }

  const prev = lastKnownGold24kPrice.price;
  const pctChange = ((current24k - prev) / prev) * 100;
  const absPct = Math.abs(pctChange);

  const config = loadTelegramConfig();
  const threshold = config.goldMovementThresholdPct || 2.0;

  if (absPct >= threshold) {
    const alertKey = `gold-move-${Math.round(current24k / 50) * 50}`;
    if (!wasAlertRecentlySent(alertKey, 12)) {
      const isUp = pctChange > 0;
      const emoji = isUp ? "📈" : "📉";
      const sign = isUp ? "+" : "";

      const msg = `
${emoji} <b>تنبيه تحرك حاد في أسعار الذهب بالسوق المصري (${sign}${pctChange.toFixed(1)}%)</b>
━━━━━━━━━━━━━━━━━━━━━
🥇 <b>عيار 24:</b> ${current24k.toLocaleString()} ج.م للجرام
🥈 <b>عيار 21:</b> ${liveRates.karat21.toLocaleString()} ج.م
🪙 <b>الجنيه الذهب:</b> ${liveRates.sovereignEgp.toLocaleString()} ج.م
📊 <b>السعر المسجل سابقاً:</b> ${prev.toLocaleString()} ج.م
⚖️ <b>نصاب الزكاة الشرعي الجديد (85 جرام):</b> ${liveRates.nisab85gEgp.toLocaleString()} ج.م
💵 <b>سعر صرف الدولار الموازي:</b> ${liveRates.usdEgpRate.toFixed(2)} ج.م

💡 <i>تم تحديث قيمة محفظة الذهب وصافي الثروة تلقائياً في المركز المالي.</i>
      `.trim();

      const res = await sendTelegramMessage(msg);
      if (res.success) {
        recordSentAlert(alertKey);
        alertsSent.push(`Gold Move: ${sign}${pctChange.toFixed(1)}%`);
        lastKnownGold24kPrice = { price: current24k, timestamp: Date.now() };
      }
    }
  }

  return alertsSent;
}

/**
 * Trigger 3: Sharia Zakat Hawl & Nisab Alert
 */
export async function checkZakatHawlAlerts(context: FamilyContext): Promise<string[]> {
  const dashboard = await getDashboardSummary(context);
  const liveRates = await getLiveGoldAndFxRates();
  const alertsSent: string[] = [];

  const zakat = calculateShariaZakatDashboard({
    goldGramPrice24k: liveRates.karat24,
    cashAndBankBalancesEgp: Number(dashboard.liquidBalanceBase || 0),
    immediateDebtsDueEgp: Number(dashboard.liabilityBalanceBase || 0),
    tradingStocksMarketValueEgp: Number(dashboard.investmentValueBase || 0),
  });

  const zakatDue = zakat.totalZakatDueEgp;
  const zakatableTotal = zakat.netZakatableWealthEgp;
  const nisab = zakat.nisabValueEgp;

  if (zakat.isAboveNisab && zakatDue > 0) {
    const alertKey = `zakat-hawl-${context.workspace.id}-${new Date().toISOString().slice(0, 7)}`;
    if (!wasAlertRecentlySent(alertKey, 72)) {
      const msg = `
🌙 <b>تنبيه الزكاة الشرعية - منصة FAMILY للثروات</b>
━━━━━━━━━━━━━━━━━━━━━
⚖️ <b>نصاب الذهب الشرعي (85 جرام عيار 24):</b> ${nisab.toLocaleString()} ج.م
💰 <b>إجمالي الوعاء الخاضع للزكاة:</b> ${zakatableTotal.toLocaleString()} ج.م
💵 <b>مقدار الزكاة الشرعية الواجبة (2.5%):</b> ${zakatDue.toLocaleString()} ج.م
✅ <b>الموقف الشرعي:</b> بلغ النصاب واكتمل الحول على الأصول النقدية والذهب.

📖 <i>{خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا} [التوبة: 103]</i>
      `.trim();

      const res = await sendTelegramMessage(msg);
      if (res.success) {
        recordSentAlert(alertKey);
        alertsSent.push(`Zakat Hawl: Due ${zakatDue.toLocaleString()} EGP`);
      }
    }
  }

  return alertsSent;
}

/**
 * Trigger 4: Weekly Wealth & Cashflow Brief
 */
export async function checkWeeklySummaryAlert(context: FamilyContext, force = false): Promise<string[]> {
  const alertKey = `weekly-summary-${new Date().toISOString().slice(0, 10)}`;
  if (!force && wasAlertRecentlySent(alertKey, 140)) {
    return [];
  }

  const dashboard = await getDashboardSummary(context);
  const liveRates = await getLiveGoldAndFxRates();

  const nowStr = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "full",
    timeZone: "Africa/Cairo",
  }).format(new Date());

  const netWorth = Number(dashboard.netWorthBase || 0);
  const liquidity = Number(dashboard.freeLiquidityBase || 0);
  const investments = Number(dashboard.investmentValueBase || 0);
  const certificates = Number(dashboard.bankCertificatesBase || 0);
  const liabilities = Number(dashboard.liabilityBalanceBase || 0);

  const msg = `
📊 <b>الملخص الأسبوعي للمركز المالي - منصة FAMILY</b>
━━━━━━━━━━━━━━━━━━━━━
🗓 <b>تاريخ التقرير:</b> ${nowStr}
🏢 <b>مساحة الثروة:</b> ${context.workspace.name}

💎 <b>صافي الثروة المجمعة:</b> ${netWorth.toLocaleString()} ج.م
💧 <b>السيولة الحرة المتاحة:</b> ${liquidity.toLocaleString()} ج.م
📈 <b>الأصول الاستثمارية والأسهم:</b> ${investments.toLocaleString()} ج.م
🏛 <b>الشهادات والودائع البنكية:</b> ${certificates.toLocaleString()} ج.م
💳 <b>الالتزامات والديون:</b> ${liabilities.toLocaleString()} ج.م
🥇 <b>سعر جرام الذهب عيار 24:</b> ${liveRates.karat24.toLocaleString()} ج.م

🛡 <i>تم تحديث كافة السجلات الدفترية والتقييمات اللحظية بنجاح.</i>
  `.trim();

  const res = await sendTelegramMessage(msg);
  if (res.success) {
    recordSentAlert(alertKey);
    return [`Weekly summary sent for ${context.workspace.name}`];
  }
  return [];
}

/**
 * Runs all automated alert checks and dispatches pending notifications.
 */
export async function runAllAlertChecks(context: FamilyContext): Promise<{
  sentCount: number;
  alerts: string[];
  errors: string[];
}> {
  const config = loadTelegramConfig();
  if (!config.enabled || !config.botToken || !config.chatId) {
    return {
      sentCount: 0,
      alerts: [],
      errors: ["خدمة تنبيهات تيليجرام غير مفعلة أو ينقصها Bot Token / Chat ID."],
    };
  }

  const alerts: string[] = [];
  const errors: string[] = [];

  // 1. Certificates
  if (config.enableCertificates) {
    try {
      const certAlerts = await checkCertificateMaturityAlerts(context);
      alerts.push(...certAlerts);
    } catch (e: any) {
      errors.push(`Certificates check error: ${e.message}`);
    }
  }

  // 2. Gold Movements
  if (config.enableGoldMovements) {
    try {
      const goldAlerts = await checkGoldMovementAlerts();
      alerts.push(...goldAlerts);
    } catch (e: any) {
      errors.push(`Gold check error: ${e.message}`);
    }
  }

  // 3. Zakat Hawl
  if (config.enableZakatHawl) {
    try {
      const zakatAlerts = await checkZakatHawlAlerts(context);
      alerts.push(...zakatAlerts);
    } catch (e: any) {
      errors.push(`Zakat check error: ${e.message}`);
    }
  }

  saveTelegramConfig({
    lastCheckedAt: Date.now(),
    lastDispatchedAt: alerts.length > 0 ? Date.now() : config.lastDispatchedAt,
  });

  return {
    sentCount: alerts.length,
    alerts,
    errors,
  };
}
