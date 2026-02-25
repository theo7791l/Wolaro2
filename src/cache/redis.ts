/**
 * Redis Cache Module
 */

import { createClient } from 'redis';
import { logger } from '../utils/logger';

let redisClient: ReturnType<typeof createClient> | null = null;

try {
  if (process.env.REDIS_URL) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    redisClient.connect().catch((err) => {
      logger.warn('Redis connection failed:', err);
      redisClient = null;
    });
  }
} catch (error) {
  logger.warn('Redis not configured');
}

export const redis = redisClient;
