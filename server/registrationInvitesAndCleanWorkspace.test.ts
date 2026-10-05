import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateInviteCodeString, verifyAndConsumeInviteCode } from "./localAuth";

describe("Registration Invites & Clean Workspace Initialization", () => {
  describe("generateInviteCodeString", () => {
    it("generates invite codes matching INV-XXXX-XXXX format", () => {
      const code1 = generateInviteCodeString();
      const code2 = generateInviteCodeString();

      expect(code1).toMatch(/^INV-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(code2).toMatch(/^INV-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(code1).not.toBe(code2);
    });
  });

  describe("verifyAndConsumeInviteCode Invariants", () => {
    it("accepts master environment invite code for backward compatibility", async () => {
      const result = await verifyAndConsumeInviteCode("FAMILY-WEALTH-SECRET-2026");
      expect(result.valid).toBe(true);
    });

    it("rejects empty or whitespace invite code", async () => {
      const result1 = await verifyAndConsumeInviteCode("");
      expect(result1.valid).toBe(false);

      const result2 = await verifyAndConsumeInviteCode("   ");
      expect(result2.valid).toBe(false);
    });

    it("rejects completely invalid invite code", async () => {
      const result = await verifyAndConsumeInviteCode("INVALID-CODE-9999");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("غير صحيح");
    });
  });
});
