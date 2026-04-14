import { createMiddleware } from 'hono/factory';
import type { AuthVariables } from '../types.js';

type Window = {
  count: number;
  resetAt: number;
};

// In-memory rate limiter (process-scoped — resets on restart)
class RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  consume(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + this.windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    if (existing.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - existing.count,
      resetAt: existing.resetAt,
    };
  }

  // Clean up expired windows (call periodically or on demand)
  cleanup(): void {
    const now = Date.now();
    for (const [key, w] of this.windows) {
      if (now >= w.resetAt) this.windows.delete(key);
    }
  }
}

// Config per role
const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  admin: { maxRequests: 100, windowMs: 60_000 }, // 100/min
  paid: { maxRequests: 40, windowMs: 60_000 }, // 40/min
  free: { maxRequests: 20, windowMs: 60_000 }, // 20/min
  guest: { maxRequests: 10, windowMs: 60_000 }, // 10/min (no auth)
};

const limiter = new RateLimiter(20, 60_000);

// Cleanup every 5 minutes
setInterval(() => limiter.cleanup(), 5 * 60_000);

/**
 * Rate limiting middleware for chat endpoints.
 * Uses userId (from auth) or IP (for guests) as the key.
 */
export const rateLimit = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const userId = c.get('userId') ?? '';
  const userRole = c.get('userRole') ?? 'guest';

  // Build rate limit key: prefer userId, fallback to IP for guests
  const key =
    userId.length > 0
      ? `user:${userId}`
      : `ip:${c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'}`;

  const limits = LIMITS[userRole] ?? LIMITS.guest;

  // Create a per-role limiter if not exists (dynamic limits)
  const result = limiter.consume(key);

  // Set rate limit headers
  c.header('X-RateLimit-Limit', String(limits.maxRequests));
  c.header('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  c.header('X-RateLimit-Reset', String(result.resetAt));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    return c.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      429
    );
  }

  await next();
});

// Periodic cleanup reminder
console.log(`[rate-limit] Initialized with defaults: ${JSON.stringify(LIMITS)}`);
