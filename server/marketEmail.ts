import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { instruments, marketEmailDeliveries, marketEmailPreferences, positions, priceQuotes, users, workspaces } from "../drizzle/schema";
import { getDb } from "./db";
import { buildMarketSignals, type MarketSignal } from "./investmentSignals";
import { getSmtpConfiguration, isSmtpSendingEnabled, sendMarketReviewEmail } from "./mailer";

const MARKET_EMAIL_RETRY_COOLDOWN_MS = 60 * 60 * 1000;

export function createMarketSignalFingerprint(signals: Pick<MarketSignal, "id" | "kind">[]) {
  return createHash("sha256").update(signals.map(signal => `${signal.id}:${signal.kind}`).sort().join("|")).digest("hex");
}

export function shouldSendMarketReview(input: { enabled: boolean; configured: boolean; signalCount: number; existingStatus?: "pending" | "sent" | "failed"; lastAttemptAt?: number | null; now: number }) {
  if (!input.enabled) return { send: false, reason: "disabled" as const };
  if (!input.configured) return { send: false, reason: "not_configured" as const };
  if (!input.signalCount) return { send: false, reason: "no_signals" as const };
  if (input.existingStatus === "sent" || input.existingStatus === "pending") return { send: false, reason: "already_claimed" as const };
  if (input.existingStatus === "failed" && input.lastAttemptAt && input.now - input.lastAttemptAt < MARKET_EMAIL_RETRY_COOLDOWN_MS) return { send: false, reason: "cooldown" as const };
  return { send: true, reason: "ready" as const };
}

async function workspaceSignals(workspaceId: number): Promise<MarketSignal[]> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة لإشارات البريد السوقية.");
  const [positionRows, quoteRows] = await Promise.all([
    db.select({ instrumentId: positions.instrumentId, instrumentName: instruments.name, symbol: instruments.symbol, currency: instruments.currency, averageCost: positions.averageCost, quantity: positions.quantity }).from(positions).innerJoin(instruments, eq(positions.instrumentId, instruments.id)).where(eq(positions.workspaceId, workspaceId)),
    db.select().from(priceQuotes).where(eq(priceQuotes.workspaceId, workspaceId)).orderBy(priceQuotes.asOf),
  ]);
  const latestQuote = new Map<number, typeof quoteRows[number]>();
  quoteRows.forEach(quote => latestQuote.set(quote.instrumentId, quote));
  return buildMarketSignals(positionRows.filter(position => Number(position.quantity) > 0).map(position => {
    const quote = latestQuote.get(position.instrumentId);
    return { instrumentId: position.instrumentId, instrumentName: position.instrumentName, symbol: position.symbol, currency: position.currency, averageCost: position.averageCost, marketPrice: quote?.price ?? null, quoteAsOf: quote?.asOf ?? null, quoteStatus: quote?.quoteStatus ?? "unavailable" };
  }));
}

/**
 * Runs only inside the existing project Heartbeat after the Yahoo refresh. It
 * does not create trades, ledger entries, valuations, or automatic advice.
 */
export async function sendEligibleMarketReviewEmails() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة لتنبيهات البريد السوقية.");
  const setup = getSmtpConfiguration();
  const preferences = await db.select({ preferenceId: marketEmailPreferences.id, workspaceId: marketEmailPreferences.workspaceId, origin: marketEmailPreferences.origin, enabled: marketEmailPreferences.enabled, recipient: users.email }).from(marketEmailPreferences).innerJoin(users, eq(marketEmailPreferences.userId, users.id)).innerJoin(workspaces, eq(marketEmailPreferences.workspaceId, workspaces.id)).where(eq(marketEmailPreferences.enabled, "yes")).limit(100);
  const result = { considered: preferences.length, sent: 0, skipped: 0, failed: 0 };
  for (const preference of preferences) {
    const now = Date.now();
    if (!preference.recipient) { result.skipped += 1; continue; }
    const signals = await workspaceSignals(preference.workspaceId);
    const fingerprint = createMarketSignalFingerprint(signals);
    const [existing] = signals.length ? await db.select().from(marketEmailDeliveries).where(and(eq(marketEmailDeliveries.preferenceId, preference.preferenceId), eq(marketEmailDeliveries.signalFingerprint, fingerprint))).limit(1) : [];
    const decision = shouldSendMarketReview({ enabled: preference.enabled === "yes", configured: setup.configured && isSmtpSendingEnabled(), signalCount: signals.length, existingStatus: existing?.status, lastAttemptAt: existing?.attemptedAt, now });
    if (!decision.send) { result.skipped += 1; continue; }
    try {
      if (existing?.status === "failed") await db.update(marketEmailDeliveries).set({ status: "pending", attemptedAt: now, updatedAt: now }).where(eq(marketEmailDeliveries.id, existing.id));
      else await db.insert(marketEmailDeliveries).values({ preferenceId: preference.preferenceId, workspaceId: preference.workspaceId, signalFingerprint: fingerprint, status: "pending", attemptedAt: now, sentAt: null, createdAt: now, updatedAt: now });
    } catch {
      result.skipped += 1;
      continue;
    }
    const delivery = await sendMarketReviewEmail({ recipient: preference.recipient, origin: preference.origin });
    const updatedAt = Date.now();
    await db.update(marketEmailDeliveries).set({ status: delivery.delivered ? "sent" : "failed", sentAt: delivery.delivered ? updatedAt : null, updatedAt }).where(and(eq(marketEmailDeliveries.preferenceId, preference.preferenceId), eq(marketEmailDeliveries.signalFingerprint, fingerprint)));
    if (delivery.delivered) result.sent += 1;
    else result.failed += 1;
  }
  return result;
}
