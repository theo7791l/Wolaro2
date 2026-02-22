import { RedisManager } from './redis';
import { Client } from 'discord.js';
import { DatabaseManager } from '../database/manager';
import { logger } from '../utils/logger';

/**
 * Redis Pub/Sub System
 * Real-time synchronization between Panel and Bot
 * 
 * When panel updates config → publishes message → bot receives → reloads cache
 */

export class PubSubManager {
  private redis: RedisManager;
  private client: Client;
  private database: DatabaseManager;
  private subscriber: any;

  constructor(redis: RedisManager, client: Client, database: DatabaseManager) {
    this.redis = redis;
    this.client = client;
    this.database = database;
  }

  /**
   * Initialize Pub/Sub listener (Bot side)
   */
  async initialize(): Promise<void> {
    try {
      // Create subscriber client
      this.subscriber = this.redis.getClient().duplicate();
      await this.subscriber.connect();

      // Subscribe to channels
      await this.subscriber.subscribe('config:update', this.handleConfigUpdate.bind(this));
      await this.subscriber.subscribe('module:toggle', this.handleModuleToggle.bind(this));
      await this.subscriber.subscribe('guild:reload', this.handleGuildReload.bind(this));

      logger.info('Redis Pub/Sub initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Pub/Sub:', error);
    }
  }

  /**
   * Handle config update event
   */
  private async handleConfigUpdate(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId, settings } = data;

      logger.info(`Config update received for guild ${guildId}`);

      // Clear cache for this guild
      await this.redis.delete(`guild:config:${guildId}`);

      // Reload config from database
      const newConfig = await this.database.getGuildConfig(guildId);

      // Cache new config
      await this.redis.set(`guild:config:${guildId}`, JSON.stringify(newConfig), 3600);

      logger.info(`Config reloaded for guild ${guildId}`);
    } catch (error) {
      logger.error('Error handling config update:', error);
    }
  }

  /**
   * Handle module toggle event
   */
  private async handleModuleToggle(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId, moduleName, enabled } = data;

      logger.info(`Module ${moduleName} ${enabled ? 'enabled' : 'disabled'} for guild ${guildId}`);

      // Clear guild config cache
      await this.redis.delete(`guild:config:${guildId}`);

      // Clear module-specific cache
      await this.redis.delete(`guild:module:${guildId}:${moduleName}`);

      // Reload config
      const newConfig = await this.database.getGuildConfig(guildId);
      await this.redis.set(`guild:config:${guildId}`, JSON.stringify(newConfig), 3600);

      logger.info(`Module cache cleared for ${moduleName} in guild ${guildId}`);
    } catch (error) {
      logger.error('Error handling module toggle:', error);
    }
  }

  /**
   * Handle full guild reload event
   */
  private async handleGuildReload(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId } = data;

      logger.info(`Full reload requested for guild ${guildId}`);

      // Clear all caches for this guild
      const keys = await this.redis.getClient().keys(`guild:*:${guildId}*`);
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redis.delete(key)));
      }

      // Reload everything
      const config = await this.database.getGuildConfig(guildId);
      await this.redis.set(`guild:config:${guildId}`, JSON.stringify(config), 3600);

      logger.info(`Full reload completed for guild ${guildId}`);
    } catch (error) {
      logger.error('Error handling guild reload:', error);
    }
  }

  /**
   * Publish config update (Panel side)
   */
  async publishConfigUpdate(guildId: string, settings: any): Promise<void> {
    try {
      await this.redis.getClient().publish(
        'config:update',
        JSON.stringify({ guildId, settings, timestamp: Date.now() })
      );
      logger.info(`Published config update for guild ${guildId}`);
    } catch (error) {
      logger.error('Error publishing config update:', error);
    }
  }

  /**
   * Publish module toggle (Panel side)
   */
  async publishModuleToggle(guildId: string, moduleName: string, enabled: boolean, config?: any): Promise<void> {
    try {
      await this.redis.getClient().publish(
        'module:toggle',
        JSON.stringify({ guildId, moduleName, enabled, config, timestamp: Date.now() })
      );
      logger.info(`Published module toggle for ${moduleName} in guild ${guildId}`);
    } catch (error) {
      logger.error('Error publishing module toggle:', error);
    }
  }

  /**
   * Publish full guild reload (Panel side)
   */
  async publishGuildReload(guildId: string): Promise<void> {
    try {
      await this.redis.getClient().publish(
        'guild:reload',
        JSON.stringify({ guildId, timestamp: Date.now() })
      );
      logger.info(`Published guild reload for ${guildId}`);
    } catch (error) {
      logger.error('Error publishing guild reload:', error);
    }
  }

  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
      logger.info('Pub/Sub subscriber shutdown');
    }
  }
}
