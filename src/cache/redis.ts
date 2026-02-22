import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export class RedisManager {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    // Construction de l'URL depuis host + port (pas de champ .url dans config)
    const redisUrl = config.redis.password
      ? `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}/${config.redis.db}`
      : `redis://${config.redis.host}:${config.redis.port}/${config.redis.db}`;

    this.client = createClient({ url: redisUrl }) as RedisClientType;

    this.client.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis connecting...');
    });

    this.client.on('ready', () => {
      logger.info('Redis ready');
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * Expose le client natif Redis (pour Pub/Sub duplicate, keys scan, etc.)
   */
  public getClient(): RedisClientType {
    return this.client;
  }

  // ========================================
  // CACHE OPERATIONS
  // ========================================

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
    }
  }

  /** Alias de del() pour compatibilité */
  async delete(key: string): Promise<void> {
    return this.del(key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  // ========================================
  // GUILD CONFIG CACHE
  // ========================================

  async cacheGuildConfig(guildId: string, guildConfig: any, ttl = 3600): Promise<void> {
    await this.set(`guild:${guildId}:config`, guildConfig, ttl);
  }

  async getGuildConfig(guildId: string): Promise<any | null> {
    return await this.get(`guild:${guildId}:config`);
  }

  async invalidateGuildConfig(guildId: string): Promise<void> {
    await this.del(`guild:${guildId}:config`);
  }

  // ========================================
  // RATE LIMITING
  // ========================================

  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `ratelimit:${identifier}`;
    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      const ttl = await this.client.ttl(key);
      const remaining = Math.max(0, maxRequests - current);
      const resetAt = Date.now() + ttl * 1000;
      return {
        allowed: current <= maxRequests,
        remaining,
        resetAt,
      };
    } catch (error) {
      logger.error(`Rate limit check error for ${identifier}:`, error);
      return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowSeconds * 1000 };
    }
  }

  async blockIdentifier(identifier: string, durationSeconds: number): Promise<void> {
    await this.set(`blocked:${identifier}`, true, durationSeconds);
  }

  async isBlocked(identifier: string): Promise<boolean> {
    return await this.exists(`blocked:${identifier}`);
  }

  // ========================================
  // COOLDOWNS
  // ========================================

  async setCooldown(key: string, seconds: number): Promise<void> {
    await this.set(`cooldown:${key}`, true, seconds);
  }

  async hasCooldown(key: string): Promise<boolean> {
    return await this.exists(`cooldown:${key}`);
  }

  async getCooldownTTL(key: string): Promise<number> {
    try {
      return await this.client.ttl(`cooldown:${key}`);
    } catch {
      return 0;
    }
  }
}
