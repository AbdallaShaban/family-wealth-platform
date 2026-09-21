import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { approvalActionTypes } from "../approvalWorkflowMath";

export const currencySchema = z.string().trim().regex(/^[A-Za-z]{3}$/, "أدخل رمز عملة ISO من ثلاثة أحرف.");
export const currency = currencySchema;

export const idempotencyKeySchema = z.string().trim().min(16).max(160);
export const idempotencyKey = idempotencyKeySchema;

export const moneyInputSchema = z.string().trim().min(1).max(64);
export const money = moneyInputSchema;

export const dateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "تنسيق التاريخ غير صالح (YYYY-MM-DD مطلوب).");

export const occurredAtSchema = z.union([
  z.number().int().positive(),
  z.string().transform((val, ctx) => {
    const d = new Date(val.length === 10 ? `${val}T12:00:00Z` : val);
    if (isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تاريخ غير صالح." });
      return z.NEVER;
    }
    return d.getTime();
  }),
  z.date().transform(d => d.getTime()),
]);
export const occurredAt = occurredAtSchema;

export function parseTradeTimestamp(input: { date?: string | Date | null; occurredAt?: number | string | Date | null }): number {
  if (input.date) {
    if (input.date instanceof Date) return input.date.getTime();
    const d = new Date(input.date.length === 10 ? `${input.date}T12:00:00Z` : input.date);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  if (input.occurredAt !== undefined && input.occurredAt !== null) {
    if (typeof input.occurredAt === "number") return input.occurredAt;
    if (input.occurredAt instanceof Date) return input.occurredAt.getTime();
    const d = new Date(input.occurredAt.length === 10 ? `${input.occurredAt}T12:00:00Z` : input.occurredAt);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return Date.now();
}

export const approvalActionType = z.enum(approvalActionTypes);

export const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function notAvailable() {
  return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة حاليًا." });
}
