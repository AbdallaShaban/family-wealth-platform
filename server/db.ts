import { and, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, platformAdminInvitations, platformAuditEvents, platformOwnership, users } from "../drizzle/schema";
import { claimInitialPlatformOwner, isEligibleInitialPlatformOwner, verifyPlatformAdminInvitationAfterGoogleLogin } from "./platformOwnership";

export function getMysqlPoolConfig(env: NodeJS.ProcessEnv = process.env) {
  const connectionLimit = env.DB_CONNECTION_LIMIT ? parseInt(env.DB_CONNECTION_LIMIT, 10) : 10;
  const maxIdle = env.DB_MAX_IDLE ? parseInt(env.DB_MAX_IDLE, 10) : 10;
  const idleTimeout = env.DB_IDLE_TIMEOUT_MS ? parseInt(env.DB_IDLE_TIMEOUT_MS, 10) : 60000;

  return {
    uri: env.DATABASE_URL,
    connectionLimit: Number.isFinite(connectionLimit) && connectionLimit > 0 ? connectionLimit : 10,
    maxIdle: Number.isFinite(maxIdle) && maxIdle > 0 ? maxIdle : 10,
    idleTimeout: Number.isFinite(idleTimeout) && idleTimeout > 0 ? idleTimeout : 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance with explicit mysql2 connection pool
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const config = getMysqlPoolConfig();
      _pool = mysql.createPool(config);
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

    const textFields = ["name", "email", "loginMethod"] as const;
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

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
