import { RedisManager } from './redis';
import { logger } from '../utils/logger';

/**
 * Redis Fallback Manager
 * Ensures bot continues working if Redis is down
 * Uses in-memory cache as backup
 */

export class RedisFallbackManager {
  private redis: RedisManager;
  private isRedisAvailable: boolean = true;
  private memoryCache: Map<string, { value: string; expiry: number }> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(redis: RedisManager) {
    this.redis = redis;
    this.startHealthCheck();
  }

  /**
   * Periodic health check for Redis
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const client = this.redis.getClient();
        if (client) {
          await client.ping();
          if (!this.isRedisAvailable) {
            logger.info('Redis reconnected successfully');
            this.isRedisAvailable = true;
          }
        } else {
          if (this.isRedisAvailable) {
            logger.warn('Redis client not available');
            this.isRedisAvailable = false;
          }
        }
      } catch (error) {
        if (this.isRedisAvailable) {
          logger.error('Redis connection lost, falling back to memory cache');
          this.isRedisAvailable = false;
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Get with automatic fallback
   */
  async get(key: string): Promise<string | null> {
    // Try Redis first
    if (this.isRedisAvailable) {
      try {
        const value = await this.redis.get(key);
        return value;
      } catch (error) {
        logger.warn(`Redis get failed for key ${key}, using memory cache`);
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(key);
    if (cached) {
      if (Date.now() < cached.expiry) {
        return cached.value;
      } else {
        this.memoryCache.delete(key);
      }
    }

    return null;
  }

  /**
   * Set with automatic fallback
   */
  async set(key: string, value: string, ttl: number = 3600): Promise<void> {
    // Try Redis first
    if (this.isRedisAvailable) {
      try {
        await this.redis.set(key, value, ttl);
        // Also cache in memory as backup
        this.memoryCache.set(key, {
          value,
          expiry: Date.now() + ttl * 1000,
        });
        return;
      } catch (error) {
        logger.warn(`Redis set failed for key ${key}, using memory cache only`);
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }

  /**
   * Delete with automatic fallback
   */
  async delete(key: string): Promise<void> {
    // Try Redis first
    if (this.isRedisAvailable) {
      try {
        await this.redis.delete(key);
      } catch (error) {
        logger.warn(`Redis delete failed for key ${key}`);
        this.isRedisAvailable = false;
      }
    }

    // Also delete from memory cache
    this.memoryCache.delete(key);
  }

  /**
   * Check if Redis is available
   */
  public isAvailable(): boolean {
    return this.isRedisAvailable;
  }

  /**
   * Get cache stats
   */
  public getStats(): {
    redisAvailable: boolean;
    memoryCacheSize: number;
    memoryCacheKeys: string[];
  } {
    return {
      redisAvailable: this.isRedisAvailable,
      memoryCacheSize: this.memoryCache.size,
      memoryCacheKeys: Array.from(this.memoryCache.keys()),
    };
  }

  /**
   * Clear expired entries from memory cache
   */
  public cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (now >= cached.expiry) {
        this.memoryCache.delete(key);
      }
    }
    logger.info(`Memory cache cleaned, ${this.memoryCache.size} entries remaining`);
  }

  /**
   * Sync memory cache to Redis when it comes back online
   */
  public async syncToRedis(): Promise<void> {
    if (!this.isRedisAvailable) {
      logger.warn('Cannot sync to Redis: connection unavailable');
      return;
    }

    logger.info(`Syncing ${this.memoryCache.size} entries from memory to Redis`);
    const now = Date.now();

    for (const [key, cached] of this.memoryCache.entries()) {
      if (now < cached.expiry) {
        try {
          const ttl = Math.floor((cached.expiry - now) / 1000);
          await this.redis.set(key, cached.value, ttl);
        } catch (error) {
          logger.error(`Failed to sync key ${key} to Redis:`, error);
        }
      }
    }

    logger.info('Memory cache synced to Redis successfully');
  }

  /**
   * Cleanup
   */
  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.memoryCache.clear();
    logger.info('Redis fallback manager shutdown');
  }
}
