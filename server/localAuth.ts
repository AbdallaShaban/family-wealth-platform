import bcrypt from "bcryptjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "./db";
import { userRegistrationInvites } from "../drizzle/schema";

export const BCRYPT_SALT_ROUNDS = 12;

export function getFamilyInviteCode(): string {
  return (process.env.FAMILY_INVITE_CODE || "FAMILY-WEALTH-SECRET-2026").trim();
}

/**
 * Validates the provided invite code against the configured FAMILY_INVITE_CODE
 * using constant-time buffer comparison to prevent timing side-channel attacks.
 */
export function verifyFamilyInviteCode(providedCode: string | undefined | null): boolean {
  if (!providedCode) return false;
  const expected = getFamilyInviteCode();
  const actual = providedCode.trim();
  if (!actual || !expected) return false;

  const bufActual = Buffer.from(actual, "utf8");
  const bufExpected = Buffer.from(expected, "utf8");
  if (bufActual.length !== bufExpected.length) return false;

  return timingSafeEqual(bufActual, bufExpected);
}

/**
 * Hashes a plaintext password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "كلمة المرور مطلوبة.",
    });
  }

  if (password.length < 8) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "كلمة المرور يجب أن لا تقل عن 8 أحرف.",
    });
  }

  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("[Auth] Password comparison error:", error);
    return false;
  }
}

const INVITE_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateRandomAlphanumeric(length: number): string {
  const bytes = randomBytes(length);
  let segment = "";
  for (let i = 0; i < length; i++) {
    segment += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return segment;
}

/**
 * Generates a clean, readable single-use invite code string (e.g. INV-A1B2-C3D4)
 */
export function generateInviteCodeString(): string {
  const segment1 = generateRandomAlphanumeric(4);
  const segment2 = generateRandomAlphanumeric(4);
  return `INV-${segment1}-${segment2}`;
}

/**
 * Validates an invite code against both master code and database single-use invites.
 * If userId is provided, consumes the invite code atomically.
 */
export async function verifyAndConsumeInviteCode(
  providedCode: string | undefined | null,
  userId?: number
): Promise<{ valid: boolean; reason?: string }> {
  if (!providedCode) return { valid: false, reason: "رمز الدعوة مطلوب للتسجيل." };
  const trimmed = providedCode.trim();
  if (!trimmed) return { valid: false, reason: "رمز الدعوة مطلوب للتسجيل." };

  // 1. Check Master / Environment Family Invite Code
  if (verifyFamilyInviteCode(trimmed)) {
    return { valid: true };
  }

  // 2. Check Database Single-Use Invite Code
  try {
    const db = await getDb();
    if (!db) {
      return { valid: false, reason: "رمز دعوة العائلة غير صحيح." };
    }

    const [invite] = await db
      .select()
      .from(userRegistrationInvites)
      .where(eq(userRegistrationInvites.code, trimmed.toUpperCase()))
      .limit(1);

    if (!invite) {
      return { valid: false, reason: "رمز دعوة العائلة غير صحيح أو غير مسجل." };
    }

    if (invite.status === "revoked") {
      return { valid: false, reason: "تم إلغاء رمز الدعوة هذا بواسطة الإدارة." };
    }

    const now = Date.now();
    if (invite.expiresAt && invite.expiresAt <= now) {
      return { valid: false, reason: "انتهت صلاحية رمز الدعوة هذا." };
    }

    if (invite.usedCount >= invite.maxUses || invite.status === "used") {
      return { valid: false, reason: "تم استخدام رمز الدعوة هذا من قبل (صالح للاستخدام مرة واحدة فقط)." };
    }

    // If userId provided, mark as consumed atomically
    if (userId) {
      const nextCount = invite.usedCount + 1;
      const isNowUsed = nextCount >= invite.maxUses;
      const updateResult = await db
        .update(userRegistrationInvites)
        .set({
          usedCount: nextCount,
          usedByUserId: userId,
          status: isNowUsed ? "used" : "active",
          usedAt: now,
        })
        .where(
          and(
            eq(userRegistrationInvites.id, invite.id),
            lt(userRegistrationInvites.usedCount, userRegistrationInvites.maxUses)
          )
        );
      const affectedRows = Number(
        (updateResult as any)?.[0]?.affectedRows ?? (updateResult as any)?.rowsAffected ?? 1
      );
      if (affectedRows === 0) {
        return { valid: false, reason: "تم استخدام رمز الدعوة هذا من قبل (صالح للاستخدام مرة واحدة فقط)." };
      }
    }

    return { valid: true };
  } catch (err: any) {
    console.error("[Auth] Invite code database check error:", err?.message || err);
    return { valid: false, reason: "رمز دعوة العائلة غير صحيح." };
  }
}

