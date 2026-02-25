/**
 * Redis Cache Module with RedisManager
 */

import { createClient } from 'redis';
import { logger } from '../utils/logger';

type RedisClientType = ReturnType<typeof createClient>;

let redisClient: RedisClientType | null = null;

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

/**
 * RedisManager class for compatibility with existing code
 */
export class RedisManager {
  private client: RedisClientType | null;

  constructor() {
    this.client = redisClient;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis exists error:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isOpen;
  }
}

export default new RedisManager();
