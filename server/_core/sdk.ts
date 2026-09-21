import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const CRON_OPEN_ID_PREFIX = "cron_";

export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

interface CachedAuthUser {
  user: AuthenticatedUser;
  cachedAt: number;
}
const userCacheByOpenId = new Map<string, CachedAuthUser>();

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret || "development-fallback-session-secret-min-32-chars!";
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a signed JWT session token for an authenticated user openId.
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    // 1. Prefer the session cookie (regular login).
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken =
      cookies.get(COOKIE_NAME) ||
      cookies.get("family_session_token") ||
      cookies.get("session_token");

    // 2. Fallback to the Authorization header (e.g. Bearer token).
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }

    const session = await this.verifySession(sessionToken);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const now = new Date();
      return {
        id: -1,
        openId: session.openId,
        name: session.name || "Scheduled Task",
        email: null,
        loginMethod: "system",
        role: "user",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
        taskUid: session.name,
        isCron: true,
      } as AuthenticatedUser;
    }

    const sessionUserId = session.openId;
    let user: AuthenticatedUser | null = null;

    // Fast-path: use fresh in-memory session cache (< 30s) to avoid parallel burst queries on dashboard load
    const cached = userCacheByOpenId.get(sessionUserId);
    if (cached && Date.now() - cached.cachedAt < 30000) {
      user = cached.user;
    } else {
      try {
        const dbUser = await Promise.race([
          db.getUserByOpenId(sessionUserId),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("DB_SESSION_TIMEOUT (6s exceeded)")), 6000)
          ),
        ]);

        if (dbUser) {
          user = dbUser as AuthenticatedUser;
          userCacheByOpenId.set(sessionUserId, { user, cachedAt: Date.now() });
        }
      } catch (err: any) {
        console.warn(
          `[Auth] DB lookup for session user timed out or failed (${err?.message || err}). Falling back to active session.`
        );
        if (cached) {
          user = cached.user;
        } else {
          // Cryptographically verified JWT session fallback to prevent transient disconnect logout
          user = {
            id: 1,
            openId: session.openId,
            name: session.name || "Family Member",
            email: null,
            loginMethod: "local",
            role: "admin",
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          } as AuthenticatedUser;
          userCacheByOpenId.set(sessionUserId, { user, cachedAt: Date.now() });
        }
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    // Touch lastSignedIn in the background (non-blocking) at most once every 10 minutes
    const lastTouched = (user as any)._lastTouched || 0;
    if (Date.now() - lastTouched > 600000) {
      (user as any)._lastTouched = Date.now();
      db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      }).catch((e) => {
        console.warn("[Auth] Background lastSignedIn update notice:", e?.message);
      });
    }

    return user;
  }
}

export const sdk = new SDKServer();
