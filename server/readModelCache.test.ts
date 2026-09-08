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
});
