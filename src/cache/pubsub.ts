/**
 * PubSub System - Fixed types
 */

import { RedisManager } from './redis';
import { logger } from '../utils/logger';

export class PubSubManager {
  constructor(private redis: RedisManager) {}

  async publish(channel: string, message: any): Promise<boolean> {
    try {
      return await this.redis.set(`pubsub:${channel}`, JSON.stringify(message), 60);
    } catch (error) {
      logger.error('PubSub publish error:', error);
      return false;
    }
  }

  async subscribe(channel: string): Promise<any> {
    try {
      const data = await this.redis.get(`pubsub:${channel}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('PubSub subscribe error:', error);
      return null;
    }
  }

  async clearChannel(channel: string): Promise<void> {
    try {
      await this.redis.delete(`pubsub:${channel}`);
    } catch (error) {
      logger.error('PubSub clear error:', error);
    }
  }

  async clearAllKeys(pattern: string): Promise<void> {
    try {
      const keys = await this.getKeys(pattern);
      await Promise.all(keys.map((key: string) => this.redis.delete(key)));
    } catch (error) {
      logger.error('PubSub clearAll error:', error);
    }
  }

  private async getKeys(pattern: string): Promise<string[]> {
    // Simplified - would need proper scan implementation
    return [];
  }
}
