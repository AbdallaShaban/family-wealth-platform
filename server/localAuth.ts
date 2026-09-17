import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";

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
