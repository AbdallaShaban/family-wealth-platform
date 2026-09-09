import { describe, expect, it } from "vitest";
import { computeDossierFingerprint, computePeriodDateRange } from "./periodArchivalService";
import { decryptVaultValue, encryptVaultValue } from "./vaultCrypto";

describe("Period Closure Vault Archival", () => {
  it("calculates exact calendar boundaries for monthly period keys including leap years", () => {
    const june = computePeriodDateRange("2026-06");
    expect(june.startDate).toBe("2026-06-01");
    expect(june.endDate).toBe("2026-06-30");
    expect(june.asOf).toBe("2026-06-30");

    const leapFeb = computePeriodDateRange("2024-02");
    expect(leapFeb.startDate).toBe("2024-02-01");
    expect(leapFeb.endDate).toBe("2024-02-29");

    const nonLeapFeb = computePeriodDateRange("2025-02");
    expect(nonLeapFeb.startDate).toBe("2025-02-01");
    expect(nonLeapFeb.endDate).toBe("2025-02-28");
  });

  it("rejects invalid period key formats", () => {
    expect(() => computePeriodDateRange("invalid")).toThrow("غير صالحة");
    expect(() => computePeriodDateRange("2026-13")).toThrow();
    expect(() => computePeriodDateRange("2026-00")).toThrow();
  });

  it("produces deterministic SHA-256 fingerprints and detects any data tampering", () => {
    const canonicalDossier = JSON.stringify({
      periodKey: "2026-06",
      workspaceId: 1,
      baseCurrency: "SAR",
      balanceSheet: { assets: "1000000.00", liabilities: "200000.00", equity: "800000.00" },
    });

    const hash1 = computeDossierFingerprint(canonicalDossier);
    const hash2 = computeDossierFingerprint(canonicalDossier);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);

    const tamperedDossier = JSON.stringify({
      periodKey: "2026-06",
      workspaceId: 1,
      baseCurrency: "SAR",
      balanceSheet: { assets: "1000000.01", liabilities: "200000.00", equity: "800000.01" },
    });

    const tamperedHash = computeDossierFingerprint(tamperedDossier);
    expect(tamperedHash).not.toBe(hash1);
  });

  it("guarantees AES-256-GCM encryption and decryption roundtrip for frozen dossier payloads", () => {
    const secret = "unit-test-secure-vault-key-32-chars-long!";
    const payload = JSON.stringify({
      version: "v1.0",
      periodKey: "2026-06",
      fingerprint: "a".repeat(64),
      certifiedAt: Date.now(),
    });

    const encrypted = encryptVaultValue(payload, secret);
    expect(encrypted.startsWith("v1.")).toBe(true);

    const decrypted = decryptVaultValue(encrypted, secret);
    expect(decrypted).toBe(payload);
  });
});
