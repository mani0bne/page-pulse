export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

export class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = {
    size: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000, cleanupIntervalMs: number = 60000) {
    this.maxSize = maxSize;
    this.startCleanupTimer(cleanupIntervalMs);
  }

  set(key: string, value: T, ttlSeconds: number): void {
    const now = Date.now();
    const ttlMs = ttlSeconds * 1000;

    this.store.set(key, {
      data: value,
      timestamp: now,
      ttl: ttlMs,
    });

    if (this.store.size > this.maxSize) {
      this.evictOldest();
    }

    this.stats.size = this.store.size;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      this.store.delete(key);
      this.stats.size = this.store.size;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      this.store.delete(key);
      this.stats.size = this.store.size;
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.store.delete(key);
    if (deleted) {
      this.stats.size = this.store.size;
    }
    return deleted;
  }

  clear(): void {
    this.store.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private evictOldest(): void {
    if (this.store.size === 0) return;

    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.store.size;
    }
  }

  private startCleanupTimer(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.store.entries()) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          this.store.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.stats.size = this.store.size;
      }
    }, intervalMs);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}
