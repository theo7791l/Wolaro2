/**
 * Module Loader - Fixed type mismatch
 */

import { Client } from 'discord.js';
import { Pool } from 'pg';
import { RedisManager } from '../cache/redis';
import { logger } from '../utils/logger';
import type { WolaroModule } from '../types';

export class ModuleLoader {
  private modules = new Map<string, WolaroModule>();
  private client: Client;
  private database: Pool;
  private redis: RedisManager;

  constructor(client: Client, database: Pool, redis: RedisManager) {
    this.client = client;
    this.database = database;
    this.redis = redis;
  }

  async loadModule(moduleName: string, module: WolaroModule): Promise<void> {
    try {
      await module.initialize(this.client);
      this.modules.set(moduleName, module);
      logger.info(`Module ${moduleName} loaded successfully`);
    } catch (error) {
      logger.error(`Failed to load module ${moduleName}:`, error);
      throw error;
    }
  }

  async loadAllModules(): Promise<void> {
    logger.info('Loading modules...');
    // Module loading logic here
  }

  async isModuleEnabled(guildId: string, moduleName: string): Promise<boolean> {
    const cacheKey = `module:${guildId}:${moduleName}:enabled`;
    const cached = await this.redis.get(cacheKey);

    if (cached !== null) return cached === 'true';

    const result = await this.database.query(
      'SELECT enabled FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
      [guildId, moduleName]
    );

    const enabled = result.rows[0]?.enabled ?? true;
    await this.redis.set(cacheKey, String(enabled), 300);

    return enabled;
  }

  getModule(name: string): WolaroModule | undefined {
    return this.modules.get(name);
  }

  getAllModules(): Map<string, WolaroModule> {
    return this.modules;
  }
}
