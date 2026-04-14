// Simple in-memory cache for infrequently-changing catalog data.
// TTL-based invalidation — catalog data refreshes when scraper runs.

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class QueryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  constructor(private defaultTtlMs: number) {
    // Cleanup expired entries every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60_000).unref?.();
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// Default cache: 5 minutes TTL for catalog data
export const cache = new QueryCache(5 * 60_000);

console.log('[cache] Initialized with 5min default TTL');
