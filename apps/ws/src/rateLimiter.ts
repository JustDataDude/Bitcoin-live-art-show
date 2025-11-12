/**
 * Server-side Rate Limiter
 * Prevents spam and abuse on the WebSocket server
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class ServerRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private maxActions: number;
  private timeWindowMs: number;

  constructor(maxActions: number, timeWindowMs: number) {
    this.maxActions = maxActions;
    this.timeWindowMs = timeWindowMs;

    // Clean up old entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetAt < now) {
        this.limits.delete(key);
      }
    }
  }

  canPerform(key: string): { allowed: boolean; resetAt?: number; remaining?: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || entry.resetAt < now) {
      // No entry or expired, allow and create new entry
      this.limits.set(key, {
        count: 1,
        resetAt: now + this.timeWindowMs,
      });
      return {
        allowed: true,
        resetAt: now + this.timeWindowMs,
        remaining: this.maxActions - 1,
      };
    }

    if (entry.count >= this.maxActions) {
      // Rate limit exceeded
      return {
        allowed: false,
        resetAt: entry.resetAt,
        remaining: 0,
      };
    }

    // Increment count
    entry.count++;
    this.limits.set(key, entry);

    return {
      allowed: true,
      resetAt: entry.resetAt,
      remaining: this.maxActions - entry.count,
    };
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  getRemaining(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || entry.resetAt < Date.now()) {
      return this.maxActions;
    }
    return Math.max(0, this.maxActions - entry.count);
  }
}

// Global rate limiters for different actions
export const bidRateLimiter = new ServerRateLimiter(5, 10000); // 5 bids per 10 seconds
export const tipRateLimiter = new ServerRateLimiter(10, 60000); // 10 tips per minute
export const messageRateLimiter = new ServerRateLimiter(20, 60000); // 20 messages per minute

