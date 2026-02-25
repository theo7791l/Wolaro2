/**
 * Module Loader - Fixed type mismatch
 */

import { Client } from 'discord.js';
import { Pool } from 'pg';
import { RedisManager } from '../cache/redis';
import { logger } from '../utils/logger';
import type { WolaroModule } from '../types';
import type { Command } from '../types';

interface EventHandler {
  name: string;
  module: string;
  execute: (...args: any[]) => Promise<void>;
}

export class ModuleLoader {
  private modules = new Map<string, WolaroModule>();
  private commands = new Map<string, Command>();
  private events = new Map<string, EventHandler[]>();
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

  registerCommand(command: Command): void {
    const commandName = command.data.name;
    this.commands.set(commandName, command);
  }

  registerEvent(eventName: string, handler: EventHandler): void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    this.events.get(eventName)!.push(handler);
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  getCommand(commandName: string): Command | undefined {
    return this.commands.get(commandName);
  }

  getEvents(eventName: string): EventHandler[] {
    return this.events.get(eventName) || [];
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

  async isModuleEnabledForGuild(guildId: string, moduleName: string): Promise<boolean> {
    return this.isModuleEnabled(guildId, moduleName);
  }

  getModule(name: string): WolaroModule | undefined {
    return this.modules.get(name);
  }

  getAllModules(): Map<string, WolaroModule> {
    return this.modules;
  }
}
