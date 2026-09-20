import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedReadModel, invalidateReadModelCache, readModelCacheSize } from "./readModelCache";

describe("readModelCache", () => {
  beforeEach(() => {
    invalidateReadModelCache();
    vi.useRealTimers();
  });

  it("reuses a value only within the configured TTL", async () => {
    let loads = 0;
    const loader = async () => { loads += 1; return { value: loads }; };
    expect(await getCachedReadModel("workspace:1", loader, 1000)).toEqual({ value: 1 });
    expect(await getCachedReadModel("workspace:1", loader, 1000)).toEqual({ value: 1 });
    expect(loads).toBe(1);
    await new Promise(resolve => setTimeout(resolve, 5));
    invalidateReadModelCache("workspace:1");
    expect(await getCachedReadModel("workspace:1", loader, 1000)).toEqual({ value: 2 });
    expect(loads).toBe(2);
  });

  it("keeps workspace keys isolated and supports prefix invalidation", async () => {
    await getCachedReadModel("fx:1:EGP", async () => "one");
    await getCachedReadModel("fx:2:EGP", async () => "two");
    expect(readModelCacheSize()).toBe(2);
    invalidateReadModelCache("fx:1:");
    expect(readModelCacheSize()).toBe(1);
    expect(await getCachedReadModel("fx:2:EGP", async () => "reloaded")).toBe("two");
  });

  it("isolates wealth-health scorecards across workspaces and time buckets, invalidating on workspace mutation", async () => {
    let ws1Loads = 0;
    let ws2Loads = 0;
    let ws10Loads = 0;
    const ws1Loader = async () => { ws1Loads += 1; return { score: 85, load: ws1Loads }; };
    const ws2Loader = async () => { ws2Loads += 1; return { score: 90, load: ws2Loads }; };
    const ws10Loader = async () => { ws10Loads += 1; return { score: 95, load: ws10Loads }; };

    const bucketA = 1000;
    const bucketB = 1001;

    // 1. Cache entry created: Workspace 1 bucket A
    await getCachedReadModel(`wealth-health:score:1:${bucketA}`, ws1Loader, 60_000);
    // 7. Minute bucket isolation: Workspace 1 bucket B (different asOf time bucket)
    await getCachedReadModel(`wealth-health:score:1:${bucketB}`, ws1Loader, 60_000);
    // 3. Workspace isolation: Workspace 2 bucket A
    await getCachedReadModel(`wealth-health:score:2:${bucketA}`, ws2Loader, 60_000);
    // 6. Delimiter safety: Workspace 10 bucket A (must not collide with prefix 'wealth-health:score:1')
    await getCachedReadModel(`wealth-health:score:10:${bucketA}`, ws10Loader, 60_000);

    expect(readModelCacheSize()).toBe(4);
    expect(ws1Loads).toBe(2);
    expect(ws2Loads).toBe(1);
    expect(ws10Loads).toBe(1);

    // 2. Same key can be read from cache without re-invoking loader
    const hit = await getCachedReadModel(`wealth-health:score:1:${bucketA}`, ws1Loader, 60_000);
    expect(hit.load).toBe(1);
    expect(ws1Loads).toBe(2);

    // 4. Mutation invalidation removes affected Wealth Health cache entries for workspace 1
    invalidateReadModelCache("wealth-health:score:1");

    // 6 & 7. Workspace 1 entries (both buckets A and B) purged; Workspace 2 and 10 preserved
    expect(readModelCacheSize()).toBe(2);
    expect(await getCachedReadModel(`wealth-health:score:2:${bucketA}`, ws2Loader, 60_000)).toEqual({ score: 90, load: 1 });
    expect(await getCachedReadModel(`wealth-health:score:10:${bucketA}`, ws10Loader, 60_000)).toEqual({ score: 95, load: 1 });
    expect(ws2Loads).toBe(1);
    expect(ws10Loads).toBe(1);

    // 5. Newly requested score after mutation does not reuse stale data
    const reloaded = await getCachedReadModel(`wealth-health:score:1:${bucketA}`, ws1Loader, 60_000);
    expect(reloaded.load).toBe(3);
    expect(ws1Loads).toBe(3);
  });

  it("isolates stress-testing read models across workspaces with delimiter-safe prefix invalidation", async () => {
    let ws1ProfileLoads = 0;
    let ws1MacroLoads = 0;
    let ws1McLoads = 0;
    let ws1RunwayLoads = 0;
    let ws2ProfileLoads = 0;
    let ws10ProfileLoads = 0;

    const ws1Profile = async () => ({ profile: "ws1", count: ++ws1ProfileLoads });
    const ws1Macro = async () => ({ shock: "gfc", count: ++ws1MacroLoads });
    const ws1Mc = async () => ({ paths: 1000, count: ++ws1McLoads });
    const ws1Runway = async () => ({ runway: 24, count: ++ws1RunwayLoads });
    const ws2Profile = async () => ({ profile: "ws2", count: ++ws2ProfileLoads });
    const ws10Profile = async () => ({ profile: "ws10", count: ++ws10ProfileLoads });

    // Populate all 4 stress testing cache entries for Workspace 1
    await getCachedReadModel("stress-testing:1:profile:1700000000", ws1Profile, 10_000);
    await getCachedReadModel("stress-testing:1:macro:gfc_2008_inspired", ws1Macro, 30_000);
    await getCachedReadModel("stress-testing:1:mc:10:1000:42:hash123", ws1Mc, 60_000);
    await getCachedReadModel("stress-testing:1:runway:50:0.00", ws1Runway, 15_000);

    // Populate Workspace 2 and Workspace 10 (delimiter safety test for prefix "1:")
    await getCachedReadModel("stress-testing:2:profile:1700000000", ws2Profile, 10_000);
    await getCachedReadModel("stress-testing:10:profile:1700000000", ws10Profile, 10_000);

    expect(readModelCacheSize()).toBe(6);
    expect(ws1ProfileLoads).toBe(1);
    expect(ws1MacroLoads).toBe(1);
    expect(ws1McLoads).toBe(1);
    expect(ws1RunwayLoads).toBe(1);
    expect(ws2ProfileLoads).toBe(1);
    expect(ws10ProfileLoads).toBe(1);

    // Read hits without re-evaluating loaders
    expect(await getCachedReadModel("stress-testing:1:profile:1700000000", ws1Profile)).toEqual({ profile: "ws1", count: 1 });
    expect(ws1ProfileLoads).toBe(1);

    // Invalidate Workspace 1 stress testing cache using delimiter-safe prefix
    invalidateReadModelCache("stress-testing:1:");

    // Exactly 4 entries for Workspace 1 must be evicted; Workspace 2 and Workspace 10 must remain
    expect(readModelCacheSize()).toBe(2);

    // Workspace 2 and Workspace 10 remain intact in cache
    expect(await getCachedReadModel("stress-testing:2:profile:1700000000", ws2Profile)).toEqual({ profile: "ws2", count: 1 });
    expect(await getCachedReadModel("stress-testing:10:profile:1700000000", ws10Profile)).toEqual({ profile: "ws10", count: 1 });
    expect(ws2ProfileLoads).toBe(1);
    expect(ws10ProfileLoads).toBe(1);

    // Workspace 1 reloads with fresh data
    const freshProfile = await getCachedReadModel("stress-testing:1:profile:1700000000", ws1Profile);
    expect(freshProfile).toEqual({ profile: "ws1", count: 2 });
    expect(ws1ProfileLoads).toBe(2);
  });

  it("enforces MAX_CACHE_ENTRIES (500) limit with LRU eviction of oldest accessed keys", async () => {
    // Fill cache up to 500 entries
    for (let i = 1; i <= 500; i++) {
      await getCachedReadModel(`item:${i}`, async () => `val_${i}`, 60_000);
    }
    expect(readModelCacheSize()).toBe(500);

    // Access item:1 again to refresh its LRU position (making item:2 the oldest)
    await getCachedReadModel("item:1", async () => "re-read", 60_000);

    // Adding 501st item should evict the oldest entry (item:2)
    await getCachedReadModel("item:501", async () => "val_501", 60_000);
    expect(readModelCacheSize()).toBe(500);

    // item:1 should still be cached
    let reload1 = 0;
    const item1 = await getCachedReadModel("item:1", async () => { reload1++; return "fresh"; }, 60_000);
    expect(item1).toBe("val_1");
    expect(reload1).toBe(0);

    // item:2 should have been evicted and therefore reload
    let reload2 = 0;
    const item2 = await getCachedReadModel("item:2", async () => { reload2++; return "fresh_2"; }, 60_000);
    expect(item2).toBe("fresh_2");
    expect(reload2).toBe(1);
  });
});

