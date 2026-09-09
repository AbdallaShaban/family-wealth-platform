import nodemailer, { type SendMailOptions } from "nodemailer";

export type SmtpEnvironment = Partial<Record<"SMTP_USER" | "SMTP_PASS" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_SECURE" | "SMTP_SEND_ENABLED", string | undefined>>;

export type SmtpConfig = {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
};

export type MailDeliveryResult =
  | { delivered: true; status: "sent"; messageId: string | null }
  | { delivered: false; status: "not_configured" | "failed"; reason: string };

export type MailTransport = {
  sendMail: (options: SendMailOptions) => Promise<{ messageId?: string }>;
  verify?: () => Promise<unknown>;
};

export type MailerDependencies = {
  environment?: SmtpEnvironment;
  createTransport?: (config: SmtpConfig) => MailTransport;
};

const DEFAULT_ENVIRONMENT: SmtpEnvironment = {
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_SEND_ENABLED: process.env.SMTP_SEND_ENABLED,
};

function normalize(value: string | undefined) {
  return value?.trim() ?? "";
}

function publicFailure(reason: string): MailDeliveryResult {
  return { delivered: false, status: "failed", reason };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function getSmtpConfiguration(environment: SmtpEnvironment = DEFAULT_ENVIRONMENT): { configured: true; config: SmtpConfig } | { configured: false; reason: string } {
  const user = normalize(environment.SMTP_USER);
  const pass = normalize(environment.SMTP_PASS);
  const host = normalize(environment.SMTP_HOST);
  const rawPort = normalize(environment.SMTP_PORT);
  if (!user || !pass || !host || !rawPort) return { configured: false, reason: "إعداد SMTP غير مكتمل. أضف SMTP_USER وSMTP_PASS وSMTP_HOST وSMTP_PORT إلى أسرار المشروع." };
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return { configured: false, reason: "قيمة SMTP_PORT غير صالحة." };
  const secureSetting = normalize(environment.SMTP_SECURE).toLowerCase();
  if (secureSetting && !["true", "false"].includes(secureSetting)) return { configured: false, reason: "SMTP_SECURE يجب أن يكون true أو false عند تحديده." };
  return { configured: true, config: { user, pass, host, port, secure: secureSetting ? secureSetting === "true" : port === 465 } };
}

export function isSmtpSendingEnabled(environment: SmtpEnvironment = DEFAULT_ENVIRONMENT) {
  return normalize(environment.SMTP_SEND_ENABLED).toLowerCase() === "yes";
}

function disabledResult(): MailDeliveryResult {
  return { delivered: false, status: "not_configured", reason: "إرسال SMTP معطّل مؤقتًا. فعّل SMTP_SEND_ENABLED بعد تهيئة Gmail واختبار الاتصال." };
}

function createNodemailerTransport(config: SmtpConfig): MailTransport {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

function safeOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !isLocalHttp) || url.origin !== origin.replace(/\/$/, "")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function sendWithSmtp(options: SendMailOptions, dependencies: MailerDependencies = {}): Promise<MailDeliveryResult> {
  const environment = dependencies.environment ?? DEFAULT_ENVIRONMENT;
  const setup = getSmtpConfiguration(environment);
  if (!setup.configured) return { delivered: false, status: "not_configured", reason: setup.reason };
  if (!isSmtpSendingEnabled(environment)) return disabledResult();
  try {
    const transporter = (dependencies.createTransport ?? createNodemailerTransport)(setup.config);
    const info = await transporter.sendMail(options);
    return { delivered: true, status: "sent", messageId: info.messageId ?? null };
  } catch (error) {
    console.warn("[Mailer] SMTP delivery failed", { category: "family", errorType: error instanceof Error ? error.name : "unknown" });
    return publicFailure("تعذر تسليم الرسالة عبر SMTP. راجع إعدادات Gmail وكلمة مرور التطبيق ثم أعد المحاولة.");
  }
}

export async function verifySmtpConnection(dependencies: MailerDependencies = {}): Promise<MailDeliveryResult> {
  const environment = dependencies.environment ?? DEFAULT_ENVIRONMENT;
  const setup = getSmtpConfiguration(environment);
  if (!setup.configured) return { delivered: false, status: "not_configured", reason: setup.reason };
  if (!isSmtpSendingEnabled(environment)) return disabledResult();
  try {
    const transporter = (dependencies.createTransport ?? createNodemailerTransport)(setup.config);
    if (!transporter.verify) return publicFailure("لا يدعم ناقل SMTP الحالي اختبار الاتصال.");
    await transporter.verify();
    return { delivered: true, status: "sent", messageId: null };
  } catch (error) {
    console.warn("[Mailer] SMTP verification failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return publicFailure("تعذر التحقق من اتصال SMTP. راجع المضيف والمنفذ وكلمة مرور التطبيق.");
  }
}

function baseMessage(from: string, to: string, subject: string, text: string, html: string, type: "admin-invitation" | "market-review"): SendMailOptions {
  return { from, to, subject, text, html, headers: { "X-FAMILY-Message-Type": type, "X-Auto-Response-Suppress": "All" } };
}

export async function sendAdminInvitationEmail(input: { recipient: string; origin: string; expiresAt: number }, dependencies: MailerDependencies = {}): Promise<MailDeliveryResult> {
  const environment = dependencies.environment ?? DEFAULT_ENVIRONMENT;
  const setup = getSmtpConfiguration(environment);
  if (!setup.configured) return { delivered: false, status: "not_configured", reason: setup.reason };
  if (!isSmtpSendingEnabled(environment)) return disabledResult();
  const origin = safeOrigin(input.origin);
  if (!origin) return publicFailure("رابط المنصة المرسل للدعوة غير صالح.");
  const expiry = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(input.expiresAt));
  const url = `${origin}/`;
  const text = `تمت دعوتك لمراجعة دور مدير عام في منصة FAMILY. افتح ${url} وسجل الدخول عبر Google باستخدام Gmail نفسه (${input.recipient}) قبل ${expiry} بتوقيت UTC. لا تمنح هذه الرسالة وصولًا تلقائيًا؛ يلزم تحقق Google ثم موافقة مدير عام آخر.`;
  const html = `<main dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><h1>دعوة مدير عام في FAMILY</h1><p>تمت دعوتك لمراجعة دور مدير عام في منصة FAMILY.</p><p>افتح المنصة وسجل الدخول عبر Google باستخدام بريد Gmail نفسه:</p><p><a href="${escapeHtml(url)}">فتح منصة FAMILY</a></p><p><strong>${escapeHtml(input.recipient)}</strong></p><p>تنتهي الدعوة في ${escapeHtml(expiry)} بتوقيت UTC. لا تمنح هذه الرسالة وصولًا تلقائيًا؛ يلزم تحقق Google ثم موافقة مدير عام آخر.</p></main>`;
  return sendWithSmtp(baseMessage(setup.config.user, input.recipient, "FAMILY — دعوة مراجعة دور مدير عام", text, html, "admin-invitation"), dependencies);
}

export async function sendMarketReviewEmail(input: { recipient: string; origin: string }, dependencies: MailerDependencies = {}): Promise<MailDeliveryResult> {
  const environment = dependencies.environment ?? DEFAULT_ENVIRONMENT;
  const setup = getSmtpConfiguration(environment);
  if (!setup.configured) return { delivered: false, status: "not_configured", reason: setup.reason };
  if (!isSmtpSendingEnabled(environment)) return disabledResult();
  const origin = safeOrigin(input.origin);
  if (!origin) return publicFailure("رابط المنصة المرسل للتنبيه غير صالح.");
  const url = `${origin}/investments`;
  const text = `توجد إشارة أو أكثر تحتاج مراجعة في بيانات السوق داخل منصة FAMILY. افتح ${url} بعد تسجيل الدخول لمراجعة المصدر وحداثة البيانات. هذه الرسالة لا تتضمن أسعارًا أو أرصدة أو توصيات شخصية، ولا تنشئ أي صفقة أو قيد.`;
  const html = `<main dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><h1>إشارة مراجعة سوقية في FAMILY</h1><p>توجد إشارة أو أكثر تحتاج مراجعة في بيانات السوق.</p><p><a href="${escapeHtml(url)}">مراجعة بيانات السوق</a></p><p>لا تتضمن هذه الرسالة أسعارًا أو أرصدة أو توصيات شخصية، ولا تنشئ أي صفقة أو قيد.</p></main>`;
  return sendWithSmtp(baseMessage(setup.config.user, input.recipient, "FAMILY — إشارة مراجعة سوقية", text, html, "market-review"), dependencies);
}
