import { Request, Response, NextFunction } from 'express';
import { RedisManager } from '../../cache/redis';
import { SecurityManager } from '../../utils/security';
import { logger } from '../../utils/logger';

export function rateLimitMiddleware(redis: RedisManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;

    try {
      // Check if IP is blocked
      if (await redis.isBlocked(ip)) {
        return res.status(429).json({
          error: 'Too many requests. Your IP has been temporarily blocked.',
          retryAfter: 3600,
        });
      }

      // Skip rate limit for master admins
      if (userId && SecurityManager.isMaster(userId)) {
        return next();
      }

      // Rate limit by IP
      const ipKey = SecurityManager.getRateLimitKey('ip', ip);
      const ipLimit = await redis.checkRateLimit(ipKey, 100, 60);

      if (!ipLimit.allowed) {
        logger.warn(`Rate limit exceeded for IP: ${ip}`);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          remaining: ipLimit.remaining,
          resetAt: ipLimit.resetAt,
        });
      }

      // Rate limit by user (if authenticated)
      if (userId) {
        const userKey = SecurityManager.getRateLimitKey('user', userId);
        const userLimit = await redis.checkRateLimit(userKey, 200, 60);

        if (!userLimit.allowed) {
          logger.warn(`Rate limit exceeded for user: ${userId}`);
          return res.status(429).json({
            error: 'Rate limit exceeded',
            remaining: userLimit.remaining,
            resetAt: userLimit.resetAt,
          });
        }
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', userId ? '200' : '100');
      res.setHeader('X-RateLimit-Remaining', userId ? ipLimit.remaining.toString() : ipLimit.remaining.toString());
      res.setHeader('X-RateLimit-Reset', ipLimit.resetAt.toString());

      next();
    } catch (error) {
      logger.error('Rate limit middleware error:', error);
      next();
    }
  };
}
