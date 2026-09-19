import type { Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sdk } from "./_core/sdk";
import { assertRole, ensurePersonalFamilyContext } from "./familyAccess";
import { createFamilyAccount } from "./familyLedger";
import { listAccountSnapshots } from "./familyRead";

const createAccountSchema = z.object({
  name: z.string().trim().min(2, "اسم الحساب يجب أن يتكون من حرفين على الأقل.").max(160, "اسم الحساب طويل جدًا."),
  accountType: z.enum(["cash", "bank", "brokerage", "wallet", "credit", "loan", "asset"], {
    message: "نوع الحساب المالي المحدد غير صالح.",
  }),
  currency: z.string().trim().min(3).max(3, "رمز العملة يجب أن يتكون من 3 أحرف.").toUpperCase(),
  institution: z.string().trim().max(160).optional().nullable(),
  openingBalance: z.union([z.string(), z.number()]).optional().nullable(),
  occurredAt: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

/**
 * Express REST route handler for POST /api/accounts
 * Authenticates via session cookie or Bearer token, enforces access roles,
 * validates financial inputs, and inserts account and opening balance into TiDB Cloud.
 */
export async function handleCreateAccount(req: Request, res: Response) {
  // 1. Session authentication
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (err: any) {
    return res.status(401).json({
      error: "unauthorized",
      message: "جلسة المستخدم غير صالحة أو غير مسجلة. يرجى تسجيل الدخول.",
    });
  }

  if (!user) {
    return res.status(401).json({
      error: "unauthorized",
      message: "جلسة المستخدم غير صالحة أو غير مسجلة. يرجى تسجيل الدخول.",
    });
  }

  // 2. Validate request payload
  const parseResult = createAccountSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "bad_request",
      message: parseResult.error.issues[0]?.message || "بيانات الحساب غير مكتملة أو غير صالحة.",
      details: parseResult.error.issues,
    });
  }

  const input = parseResult.data;

  try {
    // 3. Resolve personal workspace context and assert permissions
    const family = await ensurePersonalFamilyContext(user);
    assertRole(family, "editor");

    // 4. Create account and record opening balance journal entries in TiDB Cloud
    const openingBalanceStr =
      input.openingBalance !== undefined &&
      input.openingBalance !== null &&
      String(input.openingBalance).trim().length > 0
        ? String(input.openingBalance).trim()
        : null;

    const result = await createFamilyAccount({
      context: family,
      actorUserId: user.id,
      name: input.name,
      accountType: input.accountType,
      currency: input.currency,
      institution: input.institution || null,
      openingBalance: openingBalanceStr,
      occurredAt: input.occurredAt || Date.now(),
      idempotencyKey: input.idempotencyKey || randomUUID(),
    });

    return res.status(201).json({
      success: true,
      data: {
        accountId: result.accountId,
        openingEventId: result.openingEventId,
      },
    });
  } catch (error: any) {
    console.error("[API accounts] Error creating account in TiDB:", error);

    const isBadRequest =
      error.code === "BAD_REQUEST" ||
      error.message?.includes("يجب") ||
      error.message?.includes("غير صالح");

    const isForbidden = error.code === "FORBIDDEN" || error.code === "UNAUTHORIZED";
    const statusCode = isForbidden ? 403 : isBadRequest ? 400 : 500;

    return res.status(statusCode).json({
      error: error.code || "server_error",
      message: error.message || "حدث خطأ أثناء معالجة إنشاء الحساب في دفتر الأستاذ.",
    });
  }
}

/**
 * Express REST route handler for GET /api/accounts
 */
export async function handleListAccounts(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      return res.status(401).json({
        error: "unauthorized",
        message: "جلسة المستخدم غير صالحة أو غير مسجلة.",
      });
    }

    const family = await ensurePersonalFamilyContext(user);
    const accounts = await listAccountSnapshots(family);
    return res.status(200).json({ success: true, data: accounts });
  } catch (error: any) {
    return res.status(401).json({
      error: "unauthorized",
      message: error.message || "جلسة المستخدم غير مصرح بها.",
    });
  }
}
