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
});
