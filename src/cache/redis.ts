/**
 * Redis Cache Module - Complete Implementation
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
 * RedisManager class - Complete implementation
 */
export class RedisManager {
  private client: RedisClientType | null;

  constructor() {
    this.client = redisClient;
  }

  getClient(): RedisClientType | null {
    return this.client;
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

  async del(key: string): Promise<boolean> {
    return this.delete(key);
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

  // Cooldown methods
  async hasCooldown(key: string): Promise<boolean> {
    return this.exists(key);
  }

  async getCooldownTTL(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      return 0;
    }
  }

  async setCooldown(key: string, seconds: number): Promise<boolean> {
    return this.set(key, '1', seconds);
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number }> {
    if (!this.client) return { allowed: true, remaining: limit };
    
    try {
      const count = await this.client.incr(key);
      
      if (count === 1) {
        await this.client.expire(key, window);
      }

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      return { allowed, remaining };
    } catch (error) {
      logger.error('Rate limit error:', error);
      return { allowed: true, remaining: limit };
    }
  }

  // Blocking
  async isBlocked(identifier: string): Promise<boolean> {
    return this.exists(`blocked:${identifier}`);
  }

  async blockIdentifier(identifier: string, duration: number): Promise<boolean> {
    return this.set(`blocked:${identifier}`, '1', duration);
  }

  // Guild config caching
  async getGuildConfig(guildId: string): Promise<any> {
    const data = await this.get(`guild:${guildId}:config`);
    return data ? JSON.parse(data) : null;
  }

  async cacheGuildConfig(guildId: string, config: any): Promise<boolean> {
    return this.set(`guild:${guildId}:config`, JSON.stringify(config), 300);
  }

  async invalidateGuildConfig(guildId: string): Promise<boolean> {
    return this.delete(`guild:${guildId}:config`);
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isOpen;
  }
}

export default new RedisManager();
