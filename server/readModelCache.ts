type CacheEntry<T> = { expiresAt: number; value: T };

export const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 5_000;

export async function getCachedReadModel<T>(key: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    // Refresh access order (LRU)
    cache.delete(key);
    cache.set(key, existing);
    return existing.value;
  }
  const value = await loader();

  // Enforce memory bounds: evict oldest entry if at or above MAX_CACHE_ENTRIES
  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  cache.delete(key);
  cache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

export function invalidateReadModelCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  const normalizedPrefix = prefix.endsWith(":") ? prefix : `${prefix}:`;
  cache.forEach((_entry, key) => {
    if (key === prefix || key.startsWith(normalizedPrefix)) {
      cache.delete(key);
    }
  });
}

export function readModelCacheSize() {
  return cache.size;
}
