export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  private store: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  check(identifier: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.store.get(identifier) || [];

    timestamps = timestamps.filter((ts) => ts > windowStart);

    const current = timestamps.length;
    const allowed = current < this.maxRequests;

    if (allowed) {
      timestamps.push(now);
    }

    this.store.set(identifier, timestamps);

    const resetAt =
      timestamps.length > 0
        ? timestamps[0] + this.windowMs
        : now + this.windowMs;

    return {
      limit: this.maxRequests,
      current: Math.min(current + (allowed ? 1 : 0), this.maxRequests + 1),
      remaining: Math.max(this.maxRequests - current - (allowed ? 1 : 0), 0),
      resetAt,
    };
  }

  isAllowed(identifier: string): boolean {
    const info = this.check(identifier);
    return info.remaining >= 0;
  }

  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  resetAll(): void {
    this.store.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [identifier, timestamps] of this.store.entries()) {
      const windowStart = now - this.windowMs;
      const filtered = timestamps.filter((ts) => ts > windowStart);

      if (filtered.length === 0) {
        this.store.delete(identifier);
      } else if (filtered.length < timestamps.length) {
        this.store.set(identifier, filtered);
      }
    }
  }
}
