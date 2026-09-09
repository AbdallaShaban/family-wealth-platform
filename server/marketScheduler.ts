import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { refreshYahooMarketData, type MarketRefreshResult } from "./marketRefresh";

export const MARKET_REFRESH_LOCK_NAME = "family_eod_market_refresh";
export const DEFAULT_LOCK_TIMEOUT_SECONDS = 5;

let daemonInterval: NodeJS.Timeout | null = null;
let lastExecutionTimestamp: number | null = null;
let lastExecutionResult: MarketRefreshResult | null = null;

/**
 * Attempts to acquire the MySQL distributed lock for market refresh.
 * Uses GET_LOCK(name, timeout) so only one server process can execute at a time.
 */
export async function acquireDistributedMarketLock(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  timeoutSeconds: number = DEFAULT_LOCK_TIMEOUT_SECONDS
): Promise<boolean> {
  try {
    const rawResult: any = await db.execute(
      sql`SELECT GET_LOCK(${MARKET_REFRESH_LOCK_NAME}, ${timeoutSeconds}) AS locked`
    );
    const rows = Array.isArray(rawResult)
      ? Array.isArray(rawResult[0])
        ? rawResult[0]
        : rawResult
      : [];
    const firstRow = rows[0] || {};
    return firstRow.locked === 1 || firstRow.locked === "1" || String(firstRow.locked) === "1";
  } catch (error) {
    console.warn("[MarketScheduler] Failed to acquire distributed lock:", error);
    return false;
  }
}

/**
 * Releases the MySQL distributed lock for market refresh.
 * Must ALWAYS be called in a finally block when the lock is acquired.
 */
export async function releaseDistributedMarketLock(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<boolean> {
  try {
    const rawResult: any = await db.execute(
      sql`SELECT RELEASE_LOCK(${MARKET_REFRESH_LOCK_NAME}) AS unlocked`
    );
    const rows = Array.isArray(rawResult)
      ? Array.isArray(rawResult[0])
        ? rawResult[0]
        : rawResult
      : [];
    const firstRow = rows[0] || {};
    return firstRow.unlocked === 1 || firstRow.unlocked === "1" || String(firstRow.unlocked) === "1";
  } catch (error) {
    console.warn("[MarketScheduler] Failed to release distributed lock:", error);
    return false;
  }
}

/**
 * Executes a locked market quotes refresh.
 * Safe across multiple server nodes/processes.
 * If another process holds the lock, skips gracefully without throwing.
 */
export async function executeLockedMarketRefresh(): Promise<{
  executed: boolean;
  lockAcquired: boolean;
  skippedReason?: string;
  result?: MarketRefreshResult;
}> {
  const db = await getDb();
  if (!db) {
    return { executed: false, lockAcquired: false, skippedReason: "database_unavailable" };
  }

  const acquired = await acquireDistributedMarketLock(db, DEFAULT_LOCK_TIMEOUT_SECONDS);
  if (!acquired) {
    return {
      executed: false,
      lockAcquired: false,
      skippedReason: "lock_held_by_another_node",
    };
  }

  try {
    const refreshResult = await refreshYahooMarketData();
    lastExecutionTimestamp = Date.now();
    lastExecutionResult = refreshResult;
    return { executed: true, lockAcquired: true, result: refreshResult };
  } finally {
    await releaseDistributedMarketLock(db);
  }
}

/**
 * Starts the in-process market automation daemon.
 * Periodically executes locked market refresh.
 */
export function startMarketAutomationDaemon(intervalMs: number = 3600_000): { started: boolean } {
  if (daemonInterval) {
    return { started: false };
  }

  daemonInterval = setInterval(async () => {
    try {
      await executeLockedMarketRefresh();
    } catch (err) {
      console.error("[MarketScheduler] Daemon execution error:", err);
    }
  }, intervalMs);

  if (typeof daemonInterval.unref === "function") {
    daemonInterval.unref();
  }

  return { started: true };
}

/**
 * Stops the market automation daemon (useful for clean test teardown or shutdown).
 */
export function stopMarketAutomationDaemon() {
  if (daemonInterval) {
    clearInterval(daemonInterval);
    daemonInterval = null;
  }
}

/**
 * Returns the current status of the daemon and last run metadata.
 */
export function getMarketDaemonStatus() {
  return {
    active: daemonInterval !== null,
    lastExecutionTimestamp,
    lastExecutionResult,
  };
}
