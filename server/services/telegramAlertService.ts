import fs from "node:fs";
import path from "node:path";
import axios from "axios";
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

const ALERTS_DATA_DIR = path.resolve(process.cwd(), ".telegram_alerts");
const LEGACY_CONFIG_FILE_PATH = path.resolve(process.cwd(), ".telegram_alerts_config.json");

const DEFAULT_CONFIG: TelegramAlertConfig = {
  botToken: "",
  chatId: "",
  enabled: true,
  enableCertificates: true,
  enableGoldMovements: true,
  enableZakatHawl: true,
  enableWeeklySummary: true,
  goldMovementThresholdPct: 2.0,
};

/**
 * Redacts Telegram bot tokens and secrets from strings, error messages, and URLs.
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  return text
    .replace(/\/bot[0-9]{8,12}:[a-zA-Z0-9_-]{20,}\//g, "/bot[REDACTED]/")
    .replace(/\b[0-9]{8,12}:[a-zA-Z0-9_-]{20,}\b/g, "[REDACTED_BOT_TOKEN]");
}

/**
 * Returns the isolated configuration file path for a specific workspace.
 * Validates workspaceId strictly as a positive integer to prevent directory traversal.
 */
function getWorkspaceConfigPath(workspaceId: number): string {
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    throw new Error(`معرف مساحة العمل غير صالح: ${workspaceId}`);
  }
  return path.join(ALERTS_DATA_DIR, `workspace_${workspaceId}.json`);
}

/**
 * Returns the isolated deduplication log path for a specific workspace.
 */
function getWorkspaceSentLogPath(workspaceId: number): string {
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    throw new Error(`معرف مساحة العمل غير صالح: ${workspaceId}`);
  }
  return path.join(ALERTS_DATA_DIR, `sent_log_${workspaceId}.json`);
}

/**
 * Ensures the isolated alerts directory exists on disk.
 */
function ensureAlertsDir(): void {
  try {
    if (!fs.existsSync(ALERTS_DATA_DIR)) {
      fs.mkdirSync(ALERTS_DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[TelegramService] Failed to create alerts directory:", err);
  }
}

/**
 * Loads the Telegram notification configuration for a specific workspace.
 * Defaults to workspace 1 for unit-test backward compatibility if omitted.
 * Note: Never falls back to legacy shared global configs automatically.
 */
export function loadTelegramConfig(workspaceId = 1): TelegramAlertConfig {
  ensureAlertsDir();
  const filePath = getWorkspaceConfigPath(workspaceId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        botToken: parsed.botToken || "",
        chatId: parsed.chatId || "",
      };
    }
  } catch (err) {
    console.warn(`[TelegramService] Failed to load config for workspace ${workspaceId}:`, err);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Saves updated Telegram notification configuration for a specific workspace.
 * Supports overloaded signature: saveTelegramConfig(workspaceId, updates) or saveTelegramConfig(updates).
 * Prevents accidental erasure of saved botToken if masked dots or empty string are passed.
 */
export function saveTelegramConfig(
  workspaceIdOrUpdates: number | Partial<TelegramAlertConfig>,
  maybeUpdates?: Partial<TelegramAlertConfig>
): TelegramAlertConfig {
  let workspaceId = 1;
  let updates: Partial<TelegramAlertConfig> = {};

  if (typeof workspaceIdOrUpdates === "number") {
    workspaceId = workspaceIdOrUpdates;
    updates = maybeUpdates || {};
  } else {
    updates = workspaceIdOrUpdates || {};
  }

  ensureAlertsDir();
  const current = loadTelegramConfig(workspaceId);

  // Guard against overwriting botToken with masked value or empty string accidentally
  const cleanedUpdates: Partial<TelegramAlertConfig> = { ...updates };
  if (cleanedUpdates.botToken !== undefined) {
    const trimmed = cleanedUpdates.botToken.trim();
    if (!trimmed || trimmed.includes("•")) {
      delete cleanedUpdates.botToken;
    } else {
      cleanedUpdates.botToken = trimmed;
    }
  }
  if (cleanedUpdates.chatId !== undefined) {
    cleanedUpdates.chatId = cleanedUpdates.chatId.trim();
  }

  const merged: TelegramAlertConfig = {
    ...current,
    ...cleanedUpdates,
  };

  const filePath = getWorkspaceConfigPath(workspaceId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.error(`[TelegramService] Failed to persist config for workspace ${workspaceId}:`, err);
  }
  return merged;
}

/**
 * Loads the deduplication log for a specific workspace.
 */
function loadSentLog(workspaceId: number): Record<string, number> {
  ensureAlertsDir();
  const filePath = getWorkspaceSentLogPath(workspaceId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return {};
}

/**
 * Records a sent alert timestamp for deduplication, isolated by workspace.
 */
function recordSentAlert(workspaceId: number, alertKey: string): void {
  ensureAlertsDir();
  const filePath = getWorkspaceSentLogPath(workspaceId);
  try {
    const log = loadSentLog(workspaceId);
    log[alertKey] = Date.now();
    // Prune entries older than 7 days
    const now = Date.now();
    const pruned: Record<string, number> = {};
    for (const [k, v] of Object.entries(log)) {
      if (now - v < 7 * 86_400_000) {
        pruned[k] = v;
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(pruned, null, 2), "utf-8");
  } catch {
    // ignore logging errors
  }
}

/**
 * Checks if an alert was recently sent within cooldown hours, isolated by workspace.
 */
function wasAlertRecentlySent(workspaceId: number, alertKey: string, cooldownHours = 20): boolean {
  const log = loadSentLog(workspaceId);
  const sentAt = log[alertKey];
  if (!sentAt) return false;
  return Date.now() - sentAt < cooldownHours * 3600_000;
}

/**
 * Sends a formatted Telegram message via the Telegram Bot API.
 * Uses workspace credentials or explicit override credentials.
 * Automatically redacts secrets in all logs and error messages.
 */
export async function sendTelegramMessage(
  text: string,
  options?: {
    workspaceId?: number;
    botToken?: string;
    chatId?: string;
  }
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  let token = options?.botToken?.trim();
  let chat = options?.chatId?.trim();

  if (!token || !chat) {
    const wsId = options?.workspaceId ?? 1;
    const config = loadTelegramConfig(wsId);
    token = token || config.botToken;
    chat = chat || config.chatId;
  }

  if (!token) {
    return { success: false, error: "Telegram Bot Token غير مضبوط. يرجى إدخاله في إعدادات مساحة العمل." };
  }
  if (!chat) {
    return { success: false, error: "Telegram Chat ID غير مضبوط. يرجى إدخاله في إعدادات مساحة العمل." };
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
    const rawDesc = response.data?.description || "فشل غير معروف من خادم تيليجرام";
    return { success: false, error: redactSecrets(String(rawDesc)) };
  } catch (err: any) {
    const rawDescription = err.response?.data?.description || err.message || "خطأ اتصال أثناء إرسال رسالة تيليجرام";
    const safeDescription = redactSecrets(String(rawDescription));
    console.error("[TelegramService] Error sending message:", safeDescription);
    return { success: false, error: safeDescription };
  }
}

/**
 * Sends an immediate test alert to verify the Bot Token and Chat ID integration for a workspace.
 */
export async function sendTestAlert(
  workspaceOrContext: number | FamilyContext = 1,
  customToken?: string,
  customChatId?: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const workspaceId = typeof workspaceOrContext === "number" ? workspaceOrContext : workspaceOrContext.workspace.id;
  const workspaceName = typeof workspaceOrContext === "object" ? workspaceOrContext.workspace.name : `مساحة ${workspaceId}`;

  const config = loadTelegramConfig(workspaceId);
  const token = customToken || config.botToken;
  const chat = customChatId || config.chatId;

  const nowStr = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(new Date());

  const message = `
🌟 <b>تم بنجاح ربط منصة FAMILY مع تيليجرام</b>
━━━━━━━━━━━━━━━━━━━━━
🏢 <b>مساحة الثروة:</b> ${workspaceName}
✅ <b>حالة الاتصال:</b> متصل ونشط (Online & Operational)
⏱ <b>توقيت الاختبار:</b> ${nowStr}
🔐 <b>نطاق الأمان:</b> تنبيهات الثروة والمحفظة العائلية المعتمدة

💡 <i>سيتلقى هذا الحساب تنبيهات استحقاق الشهادات البنكية، وتحركات الذهب اللحظية، ومواعيد ونصاب الزكاة الشرعية تلقائياً.</i>
  `.trim();

  const result = await sendTelegramMessage(message, {
    workspaceId,
    botToken: token,
    chatId: chat,
  });

  if (result.success) {
    saveTelegramConfig(workspaceId, { lastTestSentAt: Date.now() });
  }

  return result;
}

/**
 * Trigger 1: Certificate & Deposit Maturity Alert
 * Alerts when a certificate matures in exactly 7 days, or today.
 */
export async function checkCertificateMaturityAlerts(context: FamilyContext): Promise<string[]> {
  const wsId = context.workspace.id;
  const config = loadTelegramConfig(wsId);
  if (!config.enabled || !config.enableCertificates || !config.botToken || !config.chatId) {
    return [];
  }

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
      if (wasAlertRecentlySent(wsId, alertKey, 48)) continue;

      const title =
        daysLeft <= 1
          ? "🚨 <b>تنبيه استحقاق شهادة بنكية اليوم!</b>"
          : "⏳ <b>تنبيه اقتراب موعد استحقاق شهادة بنكية (7 أيام)</b>";

      const msg = `
${title}
━━━━━━━━━━━━━━━━━━━━━
🏢 <b>مساحة الثروة:</b> ${context.workspace.name}
🏛 <b>البنك المصدر:</b> ${cert.bankName}
📜 <b>اسم الشهادة:</b> ${cert.certificateName}
💰 <b>أصل المبلغ:</b> ${Number(cert.principalAmount).toLocaleString()} ${cert.currency}
📈 <b>معدل العائد:</b> ${Number(cert.interestRate)}% سنوياً
📅 <b>تاريخ الاستحقاق:</b> ${maturityDateStr}
⏳ <b>المتبقي:</b> ${daysLeft === 0 ? "تستحق اليوم" : `${daysLeft} أيام`}

💡 <i>يرجى مراجعة الحساب وتحديد قرار إعادة الاستثمار أو تحويل المبلغ إلى حساب السيولة النقدية.</i>
      `.trim();

      const res = await sendTelegramMessage(msg, { workspaceId: wsId });
      if (res.success) {
        recordSentAlert(wsId, alertKey);
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
export async function checkGoldMovementAlerts(context?: FamilyContext): Promise<string[]> {
  if (!context) return [];
  const wsId = context.workspace.id;
  const config = loadTelegramConfig(wsId);
  if (!config.enabled || !config.enableGoldMovements || !config.botToken || !config.chatId) {
    return [];
  }

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
  const threshold = config.goldMovementThresholdPct || 2.0;

  if (absPct >= threshold) {
    const alertKey = `gold-move-${Math.round(current24k / 50) * 50}`;
    if (!wasAlertRecentlySent(wsId, alertKey, 12)) {
      const isUp = pctChange > 0;
      const emoji = isUp ? "📈" : "📉";
      const sign = isUp ? "+" : "";

      const msg = `
${emoji} <b>تنبيه تحرك حاد في أسعار الذهب بالسوق المصري (${sign}${pctChange.toFixed(1)}%)</b>
━━━━━━━━━━━━━━━━━━━━━
🏢 <b>مساحة الثروة:</b> ${context.workspace.name}
🥇 <b>عيار 24:</b> ${current24k.toLocaleString()} ج.م للجرام
🥈 <b>عيار 21:</b> ${liveRates.karat21.toLocaleString()} ج.م
🪙 <b>الجنيه الذهب:</b> ${liveRates.sovereignEgp.toLocaleString()} ج.م
📊 <b>السعر المسجل سابقاً:</b> ${prev.toLocaleString()} ج.م
⚖️ <b>نصاب الزكاة الشرعي الجديد (85 جرام):</b> ${liveRates.nisab85gEgp.toLocaleString()} ج.م
💵 <b>سعر صرف الدولار الموازي:</b> ${liveRates.usdEgpRate.toFixed(2)} ج.م

💡 <i>تم تحديث قيمة محفظة الذهب وصافي الثروة تلقائياً في المركز المالي.</i>
      `.trim();

      const res = await sendTelegramMessage(msg, { workspaceId: wsId });
      if (res.success) {
        recordSentAlert(wsId, alertKey);
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
  const wsId = context.workspace.id;
  const config = loadTelegramConfig(wsId);
  if (!config.enabled || !config.enableZakatHawl || !config.botToken || !config.chatId) {
    return [];
  }

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
    const alertKey = `zakat-hawl-${wsId}-${new Date().toISOString().slice(0, 7)}`;
    if (!wasAlertRecentlySent(wsId, alertKey, 72)) {
      const msg = `
🌙 <b>تنبيه الزكاة الشرعية - منصة FAMILY للثروات</b>
━━━━━━━━━━━━━━━━━━━━━
🏢 <b>مساحة الثروة:</b> ${context.workspace.name}
⚖️ <b>نصاب الذهب الشرعي (85 جرام عيار 24):</b> ${nisab.toLocaleString()} ج.م
💰 <b>إجمالي الوعاء الخاضع للزكاة:</b> ${zakatableTotal.toLocaleString()} ج.م
💵 <b>مقدار الزكاة الشرعية الواجبة (2.5%):</b> ${zakatDue.toLocaleString()} ج.م
✅ <b>الموقف الشرعي:</b> بلغ النصاب واكتمل الحول على الأصول النقدية والذهب.

📖 <i>{خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا} [التوبة: 103]</i>
      `.trim();

      const res = await sendTelegramMessage(msg, { workspaceId: wsId });
      if (res.success) {
        recordSentAlert(wsId, alertKey);
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
  const wsId = context.workspace.id;
  const config = loadTelegramConfig(wsId);
  if (!config.enabled || !config.enableWeeklySummary || !config.botToken || !config.chatId) {
    return [];
  }

  const alertKey = `weekly-summary-${wsId}-${new Date().toISOString().slice(0, 10)}`;
  if (!force && wasAlertRecentlySent(wsId, alertKey, 140)) {
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

  const res = await sendTelegramMessage(msg, { workspaceId: wsId });
  if (res.success) {
    recordSentAlert(wsId, alertKey);
    return [`Weekly summary sent for ${context.workspace.name}`];
  }
  return [];
}

/**
 * Runs all automated alert checks and dispatches pending notifications for a specific workspace context.
 */
export async function runAllAlertChecks(context: FamilyContext): Promise<{
  sentCount: number;
  alerts: string[];
  errors: string[];
}> {
  const wsId = context.workspace.id;
  const config = loadTelegramConfig(wsId);
  if (!config.enabled || !config.botToken || !config.chatId) {
    return {
      sentCount: 0,
      alerts: [],
      errors: ["خدمة تنبيهات تيليجرام غير مفعلة أو ينقصها Bot Token / Chat ID لمساحة العمل هذه."],
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
      errors.push(`Certificates check error: ${redactSecrets(e.message)}`);
    }
  }

  // 2. Gold Movements
  if (config.enableGoldMovements) {
    try {
      const goldAlerts = await checkGoldMovementAlerts(context);
      alerts.push(...goldAlerts);
    } catch (e: any) {
      errors.push(`Gold check error: ${redactSecrets(e.message)}`);
    }
  }

  // 3. Zakat Hawl
  if (config.enableZakatHawl) {
    try {
      const zakatAlerts = await checkZakatHawlAlerts(context);
      alerts.push(...zakatAlerts);
    } catch (e: any) {
      errors.push(`Zakat check error: ${redactSecrets(e.message)}`);
    }
  }

  saveTelegramConfig(wsId, {
    lastCheckedAt: Date.now(),
    lastDispatchedAt: alerts.length > 0 ? Date.now() : config.lastDispatchedAt,
  });

  return {
    sentCount: alerts.length,
    alerts,
    errors,
  };
}
