type CacheEntry<T> = { expiresAt: number; value: T };

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 5_000;

export async function getCachedReadModel<T>(key: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) return existing.value;
  const value = await loader();
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
