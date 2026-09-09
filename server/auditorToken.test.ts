import { describe, expect, it, vi } from "vitest";
import {
  signAuditorToken,
  parseAndVerifyToken,
  isRouteAllowedForAuditor,
  type AuditorTokenPayload,
  type AuditorScope,
} from "./auditorTokenService";

describe("auditorTokenService", () => {
  const samplePayload: AuditorTokenPayload = {
    tokenId: "aud_test_12345678",
    workspaceId: 101,
    label: "تدقيق القوائم المالية الربعية 2026",
    targetAuditor: "مكتب المراجع الخارجي المستقل",
    purpose: "مراجعة واعتماد القوائم المالية للربع الأول",
    allowedScopes: ["reports", "financial_statements", "reconciliation"],
    issuedAt: Date.now(),
    expiresAt: Date.now() + 72 * 3600 * 1000,
  };

  it("should create a valid signed token and parse it back successfully", async () => {
    const token = signAuditorToken(samplePayload);
    expect(token).toMatch(/^faud\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const parsed = await parseAndVerifyToken(token);
    expect(parsed.valid).toBe(true);
    expect(parsed.payload?.tokenId).toBe(samplePayload.tokenId);
    expect(parsed.payload?.workspaceId).toBe(101);
    expect(parsed.payload?.targetAuditor).toBe(samplePayload.targetAuditor);
    expect(parsed.payload?.allowedScopes).toEqual(["reports", "financial_statements", "reconciliation"]);
  });

  it("should reject tampered token signatures", async () => {
    const token = signAuditorToken(samplePayload);
    const parts = token.split(".");
    // Tamper with the signature
    const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature_xyz`;

    const parsed = await parseAndVerifyToken(tamperedToken);
    expect(parsed.valid).toBe(false);
    expect(parsed.error).toContain("توقيع الرمز غير صالح");
  });

  it("should reject expired auditor tokens", async () => {
    const expiredPayload: AuditorTokenPayload = {
      ...samplePayload,
      tokenId: "aud_expired_999",
      issuedAt: Date.now() - 100 * 3600 * 1000,
      expiresAt: Date.now() - 1000, // Expired in the past
    };
    const expiredToken = signAuditorToken(expiredPayload);

    const parsed = await parseAndVerifyToken(expiredToken);
    expect(parsed.valid).toBe(false);
    expect(parsed.error).toContain("رمز الوصول منتهي الصلاحية");
  });

  it("should enforce strict route scope boundaries", () => {
    const scopes: AuditorScope[] = ["reports", "reconciliation"];

    // Allowed routes under the granted scopes
    expect(isRouteAllowedForAuditor("/reports", scopes)).toBe(true);
    expect(isRouteAllowedForAuditor("/reports/balance-sheet", scopes)).toBe(true);
    expect(isRouteAllowedForAuditor("/reconciliation", scopes)).toBe(true);

    // Disallowed routes not in scopes
    expect(isRouteAllowedForAuditor("/zakat", scopes)).toBe(false);
    expect(isRouteAllowedForAuditor("/lot-accounting", scopes)).toBe(false);

    // Strictly forbidden operational / ledger routes
    expect(isRouteAllowedForAuditor("/accounts", scopes)).toBe(false);
    expect(isRouteAllowedForAuditor("/trades", scopes)).toBe(false);
    expect(isRouteAllowedForAuditor("/transfers", scopes)).toBe(false);
    expect(isRouteAllowedForAuditor("/ledger", scopes)).toBe(false);
    expect(isRouteAllowedForAuditor("/vault", scopes)).toBe(false);
    expect(isRouteAllowedForAuditor("/members", scopes)).toBe(false);
  });

  it("should reject malformed or non-faud token prefixes", async () => {
    const parsed = await parseAndVerifyToken("invalid.token.here");
    expect(parsed.valid).toBe(false);
    expect(parsed.error).toContain("بادئة غير صالحة");
  });
});
