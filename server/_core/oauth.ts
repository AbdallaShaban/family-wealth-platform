import { randomBytes, timingSafeEqual } from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import * as db from "../db";
import { getOAuthStateCookieOptions, getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

export const OAUTH_STATE_COOKIE = "oauth_auth_state";
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Cached remote JWK set for Google ID token signature verification
let defaultGoogleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getGoogleJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!defaultGoogleJwks) {
    defaultGoogleJwks = createRemoteJWKSet(GOOGLE_JWKS_URL);
  }
  return defaultGoogleJwks;
}

export type GoogleIdTokenPayload = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
  nonce?: string;
};

export type StateCookiePayload = {
  state: string;
  nonce: string;
};

export function encodeStatePayload(payload: StateCookiePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeStatePayload(encoded: string): StateCookiePayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.state === "string" &&
      typeof parsed.nonce === "string"
    ) {
      return parsed as StateCookiePayload;
    }
  } catch {
    // Malformed state cookie
  }
  return null;
}

export function resolveRedirectUri(req: Request): string {
  // Authoritative server-side environment configuration in production
  if (ENV.googleRedirectUri && ENV.googleRedirectUri.trim().length > 0) {
    return ENV.googleRedirectUri.trim();
  }
  // Safe local fallback for development
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol === "https" ? "https" : "http";
  return `${protocol}://${host}/api/oauth/callback`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validates a Google OpenID Connect ID Token cryptographically.
 * Can accept an injected key store / custom JWKS for isolated unit testing.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: {
    jwks?: Parameters<typeof jwtVerify>[1];
    clientId?: string;
    expectedNonce?: string;
    clockTolerance?: number;
  } = {}
): Promise<GoogleIdTokenPayload> {
  const clientId = options.clientId ?? ENV.googleClientId;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const keySet = options.jwks ?? getGoogleJwks();

  const { payload } = await jwtVerify(idToken, keySet, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
    clockTolerance: options.clockTolerance ?? 10,
  });

  const googlePayload = payload as GoogleIdTokenPayload;

  // Nonce validation: must match the nonce stored in the auth state cookie
  if (options.expectedNonce !== undefined) {
    if (!googlePayload.nonce || !safeEqual(googlePayload.nonce, options.expectedNonce)) {
      throw new Error("ID token nonce does not match session nonce");
    }
  }

  // Email verification: reject unverified email accounts
  if (googlePayload.email_verified !== true) {
    throw new Error("Google account email is not verified");
  }

  // Subject (sub) validation: immutable opaque identifier, max 64 chars
  if (
    !googlePayload.sub ||
    typeof googlePayload.sub !== "string" ||
    googlePayload.sub.trim().length === 0
  ) {
    throw new Error("Google subject identifier (sub) is missing or invalid");
  }

  if (googlePayload.sub.length > 64) {
    throw new Error("Google subject identifier exceeds 64 characters");
  }

  return googlePayload;
}

export function registerOAuthRoutes(app: Express) {
  /**
   * GET /api/oauth/login
   * Initiates the Google OAuth 2.0 / OpenID Connect authorization code flow.
   */
  app.get("/api/oauth/login", async (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      // STRICT SECURITY GUARD:
      // Local development convenience ONLY.
      // NEVER allowed in production or any environment where NODE_ENV is not strictly "development".
      const isExplicitLocalDev =
        process.env.NODE_ENV === "development" && !ENV.isProduction;

      if (isExplicitLocalDev) {
        console.warn(
          "[OAuth] Development mode active & Google credentials not set: authenticating seeded local owner."
        );

        let devUser = await db.getUserByOpenId("auth0|owner_rashid");
        if (!devUser) {
          const database = await db.getDb();
          if (database) {
            const { users } = await import("../../drizzle/schema");
            const [firstUser] = await database.select().from(users).limit(1);
            devUser = firstUser;
          }
        }

        if (devUser) {
          await db.upsertUser({
            openId: devUser.openId,
            lastSignedIn: new Date(),
          });

          const sessionToken = await sdk.createSessionToken(devUser.openId, {
            name: devUser.name ?? "Tariq Al-Rashid",
            expiresInMs: ONE_YEAR_MS,
          });

          const sessionCookieOpts = getSessionCookieOptions(req);
          res.cookie(COOKIE_NAME, sessionToken, {
            ...sessionCookieOpts,
            maxAge: ONE_YEAR_MS,
          });

          return res.redirect(302, "/");
        }
      }

      console.error("[OAuth] Cannot initiate login: Google credentials are not configured.");
      res.status(503).json({
        error: "service_unavailable",
        message: "بوابة تسجيل الدخول عبر Google غير مهيأة على الخادم حاليًا.",
      });
      return;
    }

    const redirectUri = resolveRedirectUri(req);
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");

    const statePayload = encodeStatePayload({ state, nonce });
    const stateCookieOpts = getOAuthStateCookieOptions(req);
    res.cookie(OAUTH_STATE_COOKIE, statePayload, stateCookieOpts);

    const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
    authUrl.searchParams.set("client_id", ENV.googleClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("prompt", "select_account");

    res.redirect(302, authUrl.toString());
  });

  /**
   * GET /api/oauth/callback
   * Handles Google OAuth redirect callback, validates CSRF state, exchanges code for tokens,
   * validates Google ID token, provisions fresh production identity, and sets session cookie.
   */
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF & Replay guard: state must match the short-lived cookie
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const rawStateCookie = cookies[OAUTH_STATE_COOKIE];
    const parsedStateCookie = rawStateCookie ? decodeStatePayload(rawStateCookie) : null;

    if (!parsedStateCookie || !safeEqual(parsedStateCookie.state, state)) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }

    // Immediately clear state cookie to prevent replay attacks
    const stateCookieOpts = getOAuthStateCookieOptions(req);
    res.clearCookie(OAUTH_STATE_COOKIE, {
      path: stateCookieOpts.path,
      secure: stateCookieOpts.secure,
      sameSite: stateCookieOpts.sameSite,
    });

    try {
      const redirectUri = resolveRedirectUri(req);

      // Server-to-server TLS token exchange with Google
      const tokenParams = new URLSearchParams({
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });

      const tokenResponse = await axios.post<{
        access_token: string;
        id_token: string;
        expires_in: number;
        token_type: string;
        scope: string;
      }>(GOOGLE_TOKEN_ENDPOINT, tokenParams.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15_000,
      });

      const { id_token: idToken } = tokenResponse.data;
      if (!idToken) {
        res.status(502).json({ error: "id_token missing from Google response" });
        return;
      }

      // Cryptographically verify Google ID token
      const idTokenPayload = await verifyGoogleIdToken(idToken, {
        expectedNonce: parsedStateCookie.nonce,
      });

      const openId = idTokenPayload.sub;
      const email = idTokenPayload.email ?? null;
      const name = idTokenPayload.name || (email ? email.split("@")[0] : "Google User");

      // FRESH PRODUCTION IDENTITY:
      // Provision/update user in MySQL keyed exclusively on immutable Google sub (openId).
      // No automatic account linking based on email alone.
      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Create session JWT token
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie
      const sessionCookieOpts = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...sessionCookieOpts,
        maxAge: ONE_YEAR_MS,
      });

      // Redirect user to home
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Google callback failed:", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
