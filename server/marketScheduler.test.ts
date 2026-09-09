import { describe, expect, it, vi } from "vitest";
import {
  acquireDistributedMarketLock,
  releaseDistributedMarketLock,
  getMarketDaemonStatus,
  startMarketAutomationDaemon,
  stopMarketAutomationDaemon,
  MARKET_REFRESH_LOCK_NAME,
} from "./marketScheduler";
import { isMarketDataStale, MARKET_DATA_STALE_AFTER_MS } from "./marketData";

describe("marketScheduler & distributed locking", () => {
  it("should have correct lock name and parameters", () => {
    expect(MARKET_REFRESH_LOCK_NAME).toBe("family_eod_market_refresh");
  });

  it("should acquire distributed lock when db returns locked: 1", async () => {
    const mockDb: any = {
      execute: vi.fn().mockResolvedValue([[{ locked: 1 }]]),
    };

    const acquired = await acquireDistributedMarketLock(mockDb, 5);
    expect(acquired).toBe(true);
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it("should fail to acquire distributed lock when db returns locked: 0 (held by another node)", async () => {
    const mockDb: any = {
      execute: vi.fn().mockResolvedValue([[{ locked: 0 }]]),
    };

    const acquired = await acquireDistributedMarketLock(mockDb, 5);
    expect(acquired).toBe(false);
  });

  it("should release distributed lock safely", async () => {
    const mockDb: any = {
      execute: vi.fn().mockResolvedValue([[{ unlocked: 1 }]]),
    };

    const released = await releaseDistributedMarketLock(mockDb);
    expect(released).toBe(true);
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it("should correctly identify quotes older than 48 hours as stale", () => {
    const now = Date.now();
    const freshTimestamp = now - 1 * 3600 * 1000; // 1 hour ago
    const staleTimestamp = now - 49 * 3600 * 1000; // 49 hours ago

    expect(isMarketDataStale(freshTimestamp, now)).toBe(false);
    expect(isMarketDataStale(staleTimestamp, now)).toBe(true);
    expect(isMarketDataStale(null, now)).toBe(true);
    expect(isMarketDataStale(undefined, now)).toBe(true);
    expect(MARKET_DATA_STALE_AFTER_MS).toBe(48 * 3600 * 1000);
  });

  it("should start and stop market automation daemon safely", () => {
    stopMarketAutomationDaemon();
    expect(getMarketDaemonStatus().active).toBe(false);

    const startRes = startMarketAutomationDaemon(60_000);
    expect(startRes.started).toBe(true);
    expect(getMarketDaemonStatus().active).toBe(true);

    // Starting again when already active should return started: false
    const secondStart = startMarketAutomationDaemon(60_000);
    expect(secondStart.started).toBe(false);

    stopMarketAutomationDaemon();
    expect(getMarketDaemonStatus().active).toBe(false);
  });
});
