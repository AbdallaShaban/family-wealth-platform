import { describe, expect, it } from "vitest";
import {
  BCRYPT_SALT_ROUNDS,
  comparePassword,
  getFamilyInviteCode,
  hashPassword,
  verifyFamilyInviteCode,
} from "./localAuth";

describe("Local Authentication & Family Invite Code Invariants", () => {
  describe("Password Hashing with bcrypt (Salt Rounds = 12)", () => {
    it("exports BCRYPT_SALT_ROUNDS as 12", () => {
      expect(BCRYPT_SALT_ROUNDS).toBe(12);
    });

    it("hashes password with 12 salt rounds", async () => {
      const plain = "SuperSecretPassword123!";
      const hash = await hashPassword(plain);

      // bcrypt hashes with 12 rounds start with $2a$12$ or $2b$12$
      expect(hash).toMatch(/^\$2[ab]\$12\$/);
    });

    it("correctly compares matching plaintext password with hash", async () => {
      const plain = "CorrectFamilyPassword2026";
      const hash = await hashPassword(plain);

      const isMatch = await comparePassword(plain, hash);
      expect(isMatch).toBe(true);
    });

    it("rejects non-matching plaintext password", async () => {
      const plain = "CorrectFamilyPassword2026";
      const hash = await hashPassword(plain);

      const isMatch = await comparePassword("WrongPassword123", hash);
      expect(isMatch).toBe(false);
    });

    it("rejects passwords shorter than 8 characters", async () => {
      await expect(hashPassword("short")).rejects.toThrow(
        "كلمة المرور يجب أن لا تقل عن 8 أحرف."
      );
    });

    it("gracefully returns false on null/undefined input to comparePassword", async () => {
      expect(await comparePassword("", "$2b$12$somehash")).toBe(false);
      expect(await comparePassword("pass", null)).toBe(false);
      expect(await comparePassword("pass", undefined)).toBe(false);
    });
  });

  describe("Family Invite Code Verification (Closed Family Gate)", () => {
    it("returns default invite code when FAMILY_INVITE_CODE env is unset", () => {
      const originalEnv = process.env.FAMILY_INVITE_CODE;
      delete process.env.FAMILY_INVITE_CODE;

      expect(getFamilyInviteCode()).toBe("FAMILY-WEALTH-SECRET-2026");

      process.env.FAMILY_INVITE_CODE = originalEnv;
    });

    it("accepts valid family invite code", () => {
      const defaultCode = getFamilyInviteCode();
      expect(verifyFamilyInviteCode(defaultCode)).toBe(true);
    });

    it("accepts custom invite code from process.env", () => {
      const originalEnv = process.env.FAMILY_INVITE_CODE;
      process.env.FAMILY_INVITE_CODE = "CUSTOM-FAMILY-PASS-2026";

      expect(verifyFamilyInviteCode("CUSTOM-FAMILY-PASS-2026")).toBe(true);
      expect(verifyFamilyInviteCode("WRONG-CODE")).toBe(false);

      process.env.FAMILY_INVITE_CODE = originalEnv;
    });

    it("rejects incorrect or empty invite codes", () => {
      expect(verifyFamilyInviteCode("invalid-code")).toBe(false);
      expect(verifyFamilyInviteCode("")).toBe(false);
      expect(verifyFamilyInviteCode(null)).toBe(false);
      expect(verifyFamilyInviteCode(undefined)).toBe(false);
    });
  });
});
