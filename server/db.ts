import { randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, User, platformAdminInvitations, platformAuditEvents, platformOwnership, users } from "../drizzle/schema";
import { claimInitialPlatformOwner, isEligibleInitialPlatformOwner, verifyPlatformAdminInvitationAfterGoogleLogin } from "./platformOwnership";

export function getMysqlPoolConfig(env: NodeJS.ProcessEnv = process.env) {
  let dbUrl = env.DATABASE_URL || "";
  if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
    dbUrl = dbUrl.slice(1, -1);
  }

  const connectionLimit = env.DB_CONNECTION_LIMIT ? parseInt(env.DB_CONNECTION_LIMIT, 10) : 10;
  const maxIdle = env.DB_MAX_IDLE ? parseInt(env.DB_MAX_IDLE, 10) : 10;
  const idleTimeout = env.DB_IDLE_TIMEOUT_MS ? parseInt(env.DB_IDLE_TIMEOUT_MS, 10) : 60000;
  const isTiDB = Boolean(dbUrl && dbUrl.includes("tidbcloud.com"));

  return {
    uri: dbUrl,
    connectionLimit: Number.isFinite(connectionLimit) && connectionLimit > 0 ? connectionLimit : 10,
    maxIdle: Number.isFinite(maxIdle) && maxIdle > 0 ? maxIdle : 10,
    idleTimeout: Number.isFinite(idleTimeout) && idleTimeout > 0 ? idleTimeout : 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 15000,
    waitForConnections: true,
    queueLimit: 0,
    ...(isTiDB
      ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }
      : {}),
  };
}

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export async function resetDb(): Promise<void> {
  if (_pool) {
    try {
      await _pool.end();
    } catch {
      // Ignore pool close errors
    }
  }
  _pool = null;
  _db = null;
}

// Lazily create the drizzle instance with explicit mysql2 connection pool and robust reconnect handling
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const config = getMysqlPoolConfig();
      _pool = mysql.createPool(config);

      // Handle connection pool errors to prevent uncaught exceptions and heal stale pools
      (_pool as any).on("error", (err: any) => {
        console.error("[Database Pool] Error event:", err?.message || err);
        const fatalCodes = [
          "PROTOCOL_CONNECTION_LOST",
          "ECONNRESET",
          "ETIMEDOUT",
          "EPIPE",
          "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
          "ER_CON_COUNT_ERROR",
        ];
        if (fatalCodes.includes(err?.code) || err?.fatal) {
          console.warn(`[Database Pool] Fatal connection error (${err?.code || "FATAL"}). Invalidation scheduled for auto-reconnect.`);
          _pool = null;
          _db = null;
        }
      });

      // Guard individual connection sockets against unhandled disconnects
      (_pool as any).on("connection", (conn: any) => {
        conn.on("error", (err: any) => {
          console.warn("[Database Socket] Socket error:", err?.code || err?.message);
          if (["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE"].includes(err?.code)) {
            try {
              conn.destroy();
            } catch {}
          }
        });
      });

      _db = drizzle(_pool as any);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export function getPool() {
  return _pool;
}

export function setDbInstance(db: any) {
  _db = db;
}

/**
 * Executes a database operation with automatic reconnection retry on network disconnects (ECONNRESET, connection closed, etc.)
 */
export async function withDbRetry<T>(
  operation: (db: NonNullable<ReturnType<typeof drizzle>>) => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const db = await getDb();
    if (!db) {
      throw new Error("Database is not available");
    }
    try {
      return await operation(db);
    } catch (err: any) {
      lastError = err;
      const isDisconnect =
        err?.code === "PROTOCOL_CONNECTION_LOST" ||
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "EPIPE" ||
        err?.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR" ||
        err?.message?.includes("Connection lost") ||
        err?.message?.includes("closed the connection") ||
        err?.message?.includes("ECONNRESET");

      if (isDisconnect && attempt < maxRetries) {
        console.warn(
          `[Database] Connection issue during query (${err?.code || err?.message}). Resetting pool and retrying (${attempt}/${maxRetries})...`
        );
        await resetDb();
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });

    const [persistedUser] = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (!persistedUser || !isEligibleInitialPlatformOwner(persistedUser)) return;

    const now = Date.now();
    const ownershipClaim = await claimInitialPlatformOwner({
      userId: persistedUser.id,
      email: persistedUser.email,
      loginMethod: persistedUser.loginMethod,
      store: {
        claimIfEmpty: async userId => {
          await db.execute(sql`INSERT IGNORE INTO ${platformOwnership} (
            id, ownerUserId, createdAt, updatedAt
          ) VALUES (1, ${userId}, ${now}, ${now})`);
          const [ownership] = await db.select().from(platformOwnership).where(eq(platformOwnership.id, 1)).limit(1);
          return ownership?.ownerUserId ?? null;
        },
      },
    });
    if (ownershipClaim.ownerUserId === persistedUser.id && persistedUser.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, persistedUser.id));
    }

    const eligibleForAdminInvitation = isEligibleInitialPlatformOwner(persistedUser);
    if (!eligibleForAdminInvitation || !persistedUser.email) return;
    const normalizedEmail = persistedUser.email.trim().toLowerCase();
    const pendingInvitations = await db
      .select()
      .from(platformAdminInvitations)
      .where(and(eq(platformAdminInvitations.email, normalizedEmail), eq(platformAdminInvitations.status, "pending_login"), gt(platformAdminInvitations.expiresAt, now)));
    if (!pendingInvitations.length) return;
    await db.transaction(async tx => {
      for (const invitation of pendingInvitations) {
        const verification = verifyPlatformAdminInvitationAfterGoogleLogin({ invitation, userId: persistedUser.id, email: persistedUser.email, loginMethod: persistedUser.loginMethod, now });
        if (!verification.verified) continue;
        await tx.update(platformAdminInvitations).set({ status: verification.status, verifiedUserId: verification.verifiedUserId, updatedAt: now }).where(eq(platformAdminInvitations.id, invitation.id));
        await tx.insert(platformAuditEvents).values({ actorUserId: persistedUser.id, targetUserId: persistedUser.id, action: "platform_admin_invitation.verified", beforeState: { status: "pending_login" }, afterState: { status: "awaiting_review", invitationId: invitation.id }, occurredAt: now });
      }
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }).catch((err) => {
    console.warn("[Database] Cannot get user: database not available or query failed:", err?.message || err);
    return undefined;
  });
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const normalized = email.trim().toLowerCase();
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }).catch((err) => {
    console.warn("[Database] Cannot get user by email:", err?.message || err);
    return undefined;
  });
}

export async function createUserWithPassword(params: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<User> {
  return withDbRetry(async (db) => {
    const normalizedEmail = params.email.trim().toLowerCase();
    const existingCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const isFirstUser = Number(existingCount[0]?.count ?? 0) === 0;
    const openId = `local|${randomUUID()}`;

    const now = new Date();
    await db.insert(users).values({
      openId,
      email: normalizedEmail,
      name: params.name.trim(),
      passwordHash: params.passwordHash,
      loginMethod: "local",
      role: isFirstUser ? "admin" : "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    });

    const [created] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    if (!created) {
      throw new Error("Failed to retrieve created user");
    }

    return created;
  });
}

export async function ensurePasswordHashColumn(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const [cols]: any = await db.execute(sql`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'passwordHash'
      AND TABLE_SCHEMA = DATABASE()
    `);
    const rows = Array.isArray(cols) ? cols : (cols?.rows || []);
    if (!rows || rows.length === 0) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255) NULL`);
      console.log("[Database] Schema check: passwordHash column ensured in users table");
    }
  } catch (err) {
    // Non-fatal if column already exists or in-memory DB
    console.warn("[Database] ensurePasswordHashColumn notice:", err instanceof Error ? err.message : String(err));
  }
}

