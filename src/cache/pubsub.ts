import { RedisManager } from './redis';
import { Client } from 'discord.js';
import { DatabaseManager } from '../database/manager';
import { logger } from '../utils/logger';

/**
 * Redis Pub/Sub System
 * Real-time synchronization between Panel, API, and Bot
 * 
 * Flow: Bot/Panel → Redis Publish → API subscribes → WebSocket → Panel UI
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
   * Get Redis instance (for external access)
   */
  public getRedis(): RedisManager {
    return this.redis;
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
      await this.subscriber.subscribe('permission:revoked', this.handlePermissionRevoked.bind(this));
      await this.subscriber.subscribe('command:executed', this.handleCommandExecuted.bind(this));

      logger.info('Redis Pub/Sub initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Pub/Sub:', error);
      logger.warn('Bot will continue without real-time sync');
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
      const keys = await this.redis.getClient().keys(`*:${guildId}*`);
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
   * Handle permission revoked (no action needed on bot side)
   */
  private async handlePermissionRevoked(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      logger.info(`Permission revoked event received: ${JSON.stringify(data)}`);
      // WebSocket server handles this, bot just logs it
    } catch (error) {
      logger.error('Error handling permission revoked:', error);
    }
  }

  /**
   * Handle command executed (for audit/logging)
   */
  private async handleCommandExecuted(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      logger.info(`Command executed event received: ${JSON.stringify(data)}`);
      // Can be used for real-time command logs in panel
    } catch (error) {
      logger.error('Error handling command executed:', error);
    }
  }

  /**
   * PUBLISH METHODS (Panel/Bot side)
   */

  /**
   * Publish config update (Panel/Bot side)
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
   * Publish module toggle (Panel/Bot side)
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
   * Publish full guild reload (Panel/Bot side)
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
   * Publish permission revoked (Bot side only)
   */
  async publishPermissionRevoked(guildId: string, userId: string, reason: string): Promise<void> {
    try {
      await this.redis.getClient().publish(
        'permission:revoked',
        JSON.stringify({ guildId, userId, reason, timestamp: Date.now() })
      );
      logger.warn(`Published permission revoked for user ${userId} in guild ${guildId}`);
    } catch (error) {
      logger.error('Error publishing permission revoked:', error);
    }
  }

  /**
   * Publish command executed (Bot side)
   * Used for real-time command logs in panel
   */
  async publishCommandExecuted(
    guildId: string,
    command: string,
    executor: string,
    result: 'success' | 'error'
  ): Promise<void> {
    try {
      await this.redis.getClient().publish(
        'command:executed',
        JSON.stringify({ guildId, command, executor, result, timestamp: Date.now() })
      );
      logger.info(`Published command executed: ${command} by ${executor} in guild ${guildId}`);
    } catch (error) {
      logger.error('Error publishing command executed:', error);
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
