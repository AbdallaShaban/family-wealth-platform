import { describe, expect, it, beforeEach } from "vitest";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import {
  verifyGoogleIdToken,
  encodeStatePayload,
  decodeStatePayload,
  resolveRedirectUri,
} from "./_core/oauth";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";

describe("Phase 15 — Google OAuth 2.0 / OIDC Security & Verification Suite", () => {
  const TEST_CLIENT_ID = "test-client-id-12345.apps.googleusercontent.com";
  let testKeyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let testJwks: ReturnType<typeof createLocalJWKSet>;

  beforeEach(async () => {
    testKeyPair = await generateKeyPair("RS256");
    const jwk = await exportJWK(testKeyPair.publicKey);
    jwk.kid = "test-key-id-1";
    jwk.alg = "RS256";
    testJwks = createLocalJWKSet({ keys: [jwk] });
    ENV.cookieSecret = "test-jwt-secret-min-32-chars-long-for-testing-only";
  });

  async function signTestIdToken(
    claims: Record<string, unknown>,
    options: {
      key?: typeof testKeyPair.privateKey;
      kid?: string;
      expiresIn?: string | number;
      issuer?: string;
      audience?: string;
    } = {}
  ): Promise<string> {
    const key = options.key ?? testKeyPair.privateKey;
    const kid = options.kid ?? "test-key-id-1";
    const issuer = options.issuer ?? "https://accounts.google.com";
    const audience = options.audience ?? TEST_CLIENT_ID;

    const jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt();

    if (options.expiresIn !== undefined) {
      jwt.setExpirationTime(options.expiresIn);
    } else {
      jwt.setExpirationTime("1h");
    }

    return jwt.sign(key);
  }

  describe("1. State and Nonce Cryptographic Encodings", () => {
    it("encodes and decodes state payload correctly using base64url", () => {
      const statePayload = {
        state: "crypto-secure-state-32-bytes-long",
        nonce: "crypto-secure-nonce-32-bytes-long",
      };
      const encoded = encodeStatePayload(statePayload);
      expect(typeof encoded).toBe("string");
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");

      const decoded = decodeStatePayload(encoded);
      expect(decoded).toEqual(statePayload);
    });

    it("returns null when decoding invalid or tampered state string", () => {
      expect(decodeStatePayload("not-json-base64")).toBeNull();
      expect(decodeStatePayload("")).toBeNull();
      expect(decodeStatePayload("e30")).toBeNull(); // empty object {}
    });
  });

  describe("2. Redirect URI Resolution & Authoritative Server Config", () => {
    it("uses authoritative ENV.googleRedirectUri when configured", () => {
      const original = ENV.googleRedirectUri;
      ENV.googleRedirectUri = "https://family.prod.com/api/oauth/callback";
      try {
        const req = {
          protocol: "http",
          get: () => "attacker-controlled-host.com",
        } as any;
        const uri = resolveRedirectUri(req);
        expect(uri).toBe("https://family.prod.com/api/oauth/callback");
      } finally {
        ENV.googleRedirectUri = original;
      }
    });

    it("falls back to request host in development when ENV.googleRedirectUri is not set", () => {
      const original = ENV.googleRedirectUri;
      ENV.googleRedirectUri = "";
      try {
        const req = {
          protocol: "http",
          get: (header: string) => (header === "host" ? "localhost:3000" : undefined),
        } as any;
        const uri = resolveRedirectUri(req);
        expect(uri).toBe("http://localhost:3000/api/oauth/callback");
      } finally {
        ENV.googleRedirectUri = original;
      }
    });
  });

  describe("3. Google ID Token Cryptographic Verification", () => {
    it("successfully verifies a valid Google OIDC ID token", async () => {
      const nonce = "test-session-nonce-12345";
      const idToken = await signTestIdToken({
        sub: "google-sub-109827364519283746501",
        email: "family.owner@gmail.com",
        email_verified: true,
        name: "Family Owner",
        nonce,
      });

      const payload = await verifyGoogleIdToken(idToken, {
        jwks: testJwks,
        clientId: TEST_CLIENT_ID,
        expectedNonce: nonce,
      });

      expect(payload.sub).toBe("google-sub-109827364519283746501");
      expect(payload.email).toBe("family.owner@gmail.com");
      expect(payload.email_verified).toBe(true);
      expect(payload.name).toBe("Family Owner");
    });

    it("accepts accounts.google.com as valid issuer (without https:// prefix)", async () => {
      const nonce = "test-session-nonce-54321";
      const idToken = await signTestIdToken(
        {
          sub: "google-sub-998877",
          email: "user@example.com",
          email_verified: true,
          nonce,
        },
        { issuer: "accounts.google.com" }
      );

      const payload = await verifyGoogleIdToken(idToken, {
        jwks: testJwks,
        clientId: TEST_CLIENT_ID,
        expectedNonce: nonce,
      });

      expect(payload.sub).toBe("google-sub-998877");
    });

    it("rejects token when issuer is invalid", async () => {
      const idToken = await signTestIdToken(
        {
          sub: "google-sub-123",
          email: "user@example.com",
          email_verified: true,
        },
        { issuer: "https://rogue-idp.example.com" }
      );

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
        })
      ).rejects.toThrow();
    });

    it("rejects token when audience does not match GOOGLE_CLIENT_ID", async () => {
      const idToken = await signTestIdToken(
        {
          sub: "google-sub-123",
          email: "user@example.com",
          email_verified: true,
        },
        { audience: "attacker-client-id.apps.googleusercontent.com" }
      );

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
        })
      ).rejects.toThrow();
    });

    it("rejects token when signature is invalid or signed by untrusted key", async () => {
      const otherKeyPair = await generateKeyPair("RS256");
      const idToken = await signTestIdToken(
        {
          sub: "google-sub-123",
          email: "user@example.com",
          email_verified: true,
        },
        { key: otherKeyPair.privateKey }
      );

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
        })
      ).rejects.toThrow();
    });

    it("rejects expired ID token", async () => {
      const pastSeconds = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
      const idToken = await signTestIdToken(
        {
          sub: "google-sub-123",
          email: "user@example.com",
          email_verified: true,
          exp: pastSeconds,
        },
        { expiresIn: pastSeconds }
      );

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
          clockTolerance: 10,
        })
      ).rejects.toThrow();
    });

    it("rejects token when nonce does not match session nonce", async () => {
      const idToken = await signTestIdToken({
        sub: "google-sub-123",
        email: "user@example.com",
        email_verified: true,
        nonce: "attacker-nonce-999",
      });

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
          expectedNonce: "legitimate-user-nonce-111",
        })
      ).rejects.toThrow("ID token nonce does not match session nonce");
    });

    it("rejects token when email_verified is false", async () => {
      const idToken = await signTestIdToken({
        sub: "google-sub-123",
        email: "unverified@gmail.com",
        email_verified: false,
      });

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
        })
      ).rejects.toThrow("Google account email is not verified");
    });

    it("rejects token when sub is empty or whitespace", async () => {
      const idToken = await signTestIdToken({
        sub: "   ",
        email: "user@gmail.com",
        email_verified: true,
      });

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
        })
      ).rejects.toThrow("Google subject identifier (sub) is missing or invalid");
    });

    it("rejects token when sub exceeds 64 characters (schema constraint protection)", async () => {
      const overlyLongSub = "a".repeat(65);
      const idToken = await signTestIdToken({
        sub: overlyLongSub,
        email: "user@gmail.com",
        email_verified: true,
      });

      await expect(
        verifyGoogleIdToken(idToken, {
          jwks: testJwks,
          clientId: TEST_CLIENT_ID,
        })
      ).rejects.toThrow("Google subject identifier exceeds 64 characters");
    });

    it("treats sub as an opaque immutable string without regex digit constraints", async () => {
      const alphanumericSub = "google-sub-alpha_numeric.123-X";
      const idToken = await signTestIdToken({
        sub: alphanumericSub,
        email: "user@gmail.com",
        email_verified: true,
      });

      const payload = await verifyGoogleIdToken(idToken, {
        jwks: testJwks,
        clientId: TEST_CLIENT_ID,
      });

      expect(payload.sub).toBe(alphanumericSub);
    });
  });

  describe("4. Local JWT Session Engine Invariants", () => {
    it("signs and verifies session token correctly without external calls", async () => {
      const openId = "google-sub-test-777";
      const sessionToken = await sdk.createSessionToken(openId, {
        name: "Test User",
        expiresInMs: 3600_000,
      });

      expect(typeof sessionToken).toBe("string");

      const session = await sdk.verifySession(sessionToken);
      expect(session).not.toBeNull();
      expect(session?.openId).toBe(openId);
      expect(session?.name).toBe("Test User");
    });

    it("returns null on missing or invalid session token", async () => {
      expect(await sdk.verifySession(null)).toBeNull();
      expect(await sdk.verifySession("")).toBeNull();
      expect(await sdk.verifySession("invalid.jwt.token")).toBeNull();
    });

    it("rejects authentication when session token signature is forged", async () => {
      const otherSecret = new TextEncoder().encode("some-completely-different-jwt-secret-key-32");
      const forgedToken = await new SignJWT({
        openId: "attacker-id",
        appId: "family-wealth",
        name: "Attacker",
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime("1h")
        .sign(otherSecret);

      const session = await sdk.verifySession(forgedToken);
      expect(session).toBeNull();
    });
  });

  describe("5. Environment Guard for Development OAuth Bypass", () => {
    it("strictly refuses bypass and returns 503 in production when Google credentials are missing", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalIsProd = ENV.isProduction;
      const origClientId = ENV.googleClientId;
      const origClientSecret = ENV.googleClientSecret;

      try {
        process.env.NODE_ENV = "production";
        ENV.isProduction = true;
        ENV.googleClientId = "";
        ENV.googleClientSecret = "";

        const express = (await import("express")).default;
        const app = express();
        const { registerOAuthRoutes } = await import("./_core/oauth");
        registerOAuthRoutes(app);

        const routes = (app._router as any).stack;
        const loginLayer = routes.find((l: any) => l.route?.path === "/api/oauth/login");
        expect(loginLayer).toBeDefined();

        let statusCode = 0;
        let responseJson: any = null;
        let redirected = false;
        const mockReq = { headers: {}, socket: { encrypted: false } } as any;
        const mockRes = {
          status: (code: number) => {
            statusCode = code;
            return mockRes;
          },
          json: (data: any) => {
            responseJson = data;
            return mockRes;
          },
          redirect: () => {
            redirected = true;
          },
          cookie: () => {},
        } as any;

        await loginLayer.route.stack[0].handle(mockReq, mockRes);
        expect(statusCode).toBe(503);
        expect(redirected).toBe(false);
        expect(responseJson?.error).toBe("service_unavailable");
        expect(responseJson?.message).toBe("بوابة تسجيل الدخول عبر Google غير مهيأة على الخادم حاليًا.");
      } finally {
        process.env.NODE_ENV = originalEnv;
        ENV.isProduction = originalIsProd;
        ENV.googleClientId = origClientId;
        ENV.googleClientSecret = origClientSecret;
      }
    });
  });
});
