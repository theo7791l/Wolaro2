import { Request, Response, NextFunction } from 'express';
import config from '../../config';

/**
 * In-memory rate limiter per IP (no external dep needed).
 * For production at scale, replace with a Redis-backed limiter (e.g. rate-limiter-flexible).
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Factory that returns a per-route rate-limiter middleware.
 * @param windowMs  Time window in milliseconds (default: from config)
 * @param max       Max requests per window per IP (default: from config)
 */
export function createRateLimiter(windowMs?: number, max?: number) {
  const window = windowMs ?? config.security.rateLimitWindow;
  const limit = max ?? config.security.rateLimitMax;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
      || req.socket.remoteAddress
      || 'unknown';

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      // First request in new window
      store.set(ip, { count: 1, resetAt: now + window });
      next();
      return;
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        retryAfter,
      });
      return;
    }

    next();
  };
}

/** Strict limiter for sensitive endpoints (auth, admin) */
export const strictRateLimiter = createRateLimiter(60_000, 20);

/** Standard limiter for read endpoints */
export const standardRateLimiter = createRateLimiter();

/** Lenient limiter for public informational endpoints */
export const lenientRateLimiter = createRateLimiter(60_000, 200);
