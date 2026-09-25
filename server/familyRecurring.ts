import { and, eq } from "drizzle-orm";
import { auditEvents, financialProfiles, memberships, recurringRules, workspaces } from "../drizzle/schema";
import type { FamilyContext } from "./familyAccess";
import { getDb } from "./db";
import { postCashEvent } from "./familyLedger";

export type RecurringCadence =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "yearly"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUALLY";

/** A stable key makes retries, concurrent callbacks, and recovery after a crash harmless. */
export function recurringRunKey(ruleId: number, scheduledFor: number) {
  return `RECURRING_RULE:${ruleId}:${scheduledFor}`;
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Advance a rule without JavaScript month-overflow (e.g. 31 Jan -> 28/29 Feb). */
export function nextRecurringRunAt(scheduledFor: number, cadence: RecurringCadence | string) {
  const current = new Date(scheduledFor);
  const result = new Date(scheduledFor);
  const normalized = String(cadence).toLowerCase();
  if (normalized === "weekly") {
    result.setUTCDate(result.getUTCDate() + 7);
    return result.getTime();
  }

  const increment =
    normalized === "monthly"
      ? 1
      : normalized === "quarterly"
      ? 3
      : normalized === "semi_annual" || normalized === "semiannual"
      ? 6
      : 12;
  const originalDay = current.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + increment);
  result.setUTCDate(Math.min(originalDay, daysInUtcMonth(result.getUTCFullYear(), result.getUTCMonth())));
  return result.getTime();
}

type ScheduledRuleRow = {
  rule: typeof recurringRules.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
  profile: typeof financialProfiles.$inferSelect;
  membership: typeof memberships.$inferSelect;
};

/**
 * Runs at most one scheduled occurrence. A later callback processes the next
 * occurrence; a failed ledger posting leaves nextRunAt untouched for a safe retry.
 */
export async function runRecurringRuleByTaskUid(taskUid: string, now = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات FAMILY غير متاحة حاليًا.");

  const rows = await db
    .select({ rule: recurringRules, workspace: workspaces, profile: financialProfiles, membership: memberships })
    .from(recurringRules)
    .innerJoin(workspaces, eq(recurringRules.workspaceId, workspaces.id))
    .innerJoin(financialProfiles, eq(recurringRules.profileId, financialProfiles.id))
    .innerJoin(memberships, and(eq(memberships.workspaceId, recurringRules.workspaceId), eq(memberships.userId, recurringRules.createdByUserId), eq(memberships.status, "active")))
    .where(eq(recurringRules.scheduleCronTaskUid, taskUid))
    .limit(1);
  const row = rows[0] as ScheduledRuleRow | undefined;
  if (!row) return { ok: true, skipped: "orphan_or_inactive_member" as const };
  const { rule, workspace, profile, membership } = row;

  if (rule.status !== "active") return { ok: true, skipped: "inactive" as const, ruleId: rule.id };
  if (rule.endsAt !== null && rule.nextRunAt > rule.endsAt) {
    await db.update(recurringRules).set({ status: "completed", updatedAt: now }).where(and(eq(recurringRules.id, rule.id), eq(recurringRules.nextRunAt, rule.nextRunAt)));
    return { ok: true, skipped: "completed" as const, ruleId: rule.id };
  }
  if (rule.nextRunAt > now) return { ok: true, skipped: "not_due" as const, ruleId: rule.id };

  const context: FamilyContext = { workspace, profile, membership };
  const runKey = recurringRunKey(rule.id, rule.nextRunAt);
  const event = await postCashEvent({
    context,
    actorUserId: rule.createdByUserId,
    eventType: rule.eventType,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    amount: rule.amount,
    currency: rule.currency,
    occurredAt: rule.nextRunAt,
    memo: rule.memo,
    idempotencyKey: runKey,
    source: "system_generated",
  });
  const followingRunAt = nextRecurringRunAt(rule.nextRunAt, rule.cadence);
  const status = rule.endsAt !== null && followingRunAt > rule.endsAt ? "completed" : "active";
  await db.update(recurringRules).set({ nextRunAt: followingRunAt, status, updatedAt: now }).where(and(eq(recurringRules.id, rule.id), eq(recurringRules.nextRunAt, rule.nextRunAt)));
  if (!event.duplicate) {
    await db.insert(auditEvents).values({
      workspaceId: workspace.id,
      actorUserId: rule.createdByUserId,
      action: "recurring_rule.executed",
      targetType: "recurring_rule",
      targetId: String(rule.id),
      beforeState: { scheduledFor: rule.nextRunAt, status: rule.status },
      afterState: { eventId: event.id, nextRunAt: followingRunAt, status },
      requestId: runKey,
      occurredAt: now,
    });
  }
  return { ok: true, ruleId: rule.id, eventId: event.id, duplicate: event.duplicate, nextRunAt: followingRunAt, status };
}
