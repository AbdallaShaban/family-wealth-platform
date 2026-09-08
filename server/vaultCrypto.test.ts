import { describe, expect, it } from "vitest";
import { decryptVaultValue, encryptVaultValue } from "./vaultCrypto";

describe("vault crypto", () => {
  it("encrypts opaque metadata and decrypts it only with the same server secret", () => {
    const secret = "a-test-secret-longer-than-sixteen-characters";
    const encrypted = encryptVaultValue("vault/workspace-7/file.pdf", secret);
    expect(encrypted).not.toContain("file.pdf");
    expect(decryptVaultValue(encrypted, secret)).toBe("vault/workspace-7/file.pdf");
  });

  it("rejects malformed or differently keyed ciphertext", () => {
    expect(() => decryptVaultValue("not-a-vault-token", "a-test-secret-longer-than-sixteen-characters")).toThrow();
    expect(() => decryptVaultValue(encryptVaultValue("data", "a-test-secret-longer-than-sixteen-characters"), "a-different-secret-longer-than-sixteen")).toThrow();
  });
});
