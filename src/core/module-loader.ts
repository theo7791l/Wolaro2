import { Client } from 'discord.js';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { logger } from '../utils/logger';
import { IModule, ICommand, IEvent } from '../types';

export class ModuleLoader {
  private modules = new Map<string, IModule>();
  private commands = new Map<string, ICommand>();
  private events = new Map<string, IEvent[]>();

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}

  async loadAll(): Promise<void> {
    const modulesPath = join(__dirname, '..', 'modules');
    try {
      const moduleDirs = readdirSync(modulesPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      logger.info(`Found ${moduleDirs.length} modules to load`);

      for (const moduleName of moduleDirs) {
        await this.loadModule(moduleName);
      }

      logger.info(`Successfully loaded ${this.modules.size} modules`);
    } catch (error) {
      logger.error('Failed to load modules:', error);
    }
  }

  async loadModule(moduleName: string): Promise<void> {
    try {
      const modulePath = join(__dirname, '..', 'modules', moduleName);
            const moduleIndex = await import(modulePath);

      if (!moduleIndex.default) {
        throw new Error(`Module ${moduleName} does not export default`);
      }

      const module: IModule = new moduleIndex.default(
        this.client,
        this.database,
        this.redis
      );

      // Validate module structure
      if (!module.name || !module.description) {
        throw new Error(`Module ${moduleName} missing required properties`);
      }

      this.modules.set(module.name, module);

      // Load commands
      if (module.commands) {
        for (const command of module.commands) {
          this.commands.set(command.data.name, command);
          logger.debug(`Loaded command: ${command.data.name} from ${module.name}`);
        }
      }

      // Load events
      if (module.events) {
        for (const event of module.events) {
          if (!this.events.has(event.name)) {
            this.events.set(event.name, []);
          }
          this.events.get(event.name)!.push(event);
          logger.debug(`Loaded event: ${event.name} from ${module.name}`);
        }
      }

      logger.info(`✓ Loaded module: ${module.name}`);
    } catch (error) {
      logger.error(`Failed to load module ${moduleName}:`, error);
    }
  }

  async reloadModule(moduleName: string): Promise<void> {
    logger.info(`Reloading module: ${moduleName}`);

    // Remove old module data
    const oldModule = this.modules.get(moduleName);
    if (oldModule) {
      // Remove commands
      if (oldModule.commands) {
        for (const command of oldModule.commands) {
          this.commands.delete(command.data.name);
        }
      }

      // Remove events
      if (oldModule.events) {
        for (const event of oldModule.events) {
          const eventList = this.events.get(event.name);
          if (eventList) {
            const filtered = eventList.filter((e) => e !== event);
            this.events.set(event.name, filtered);
          }
        }
      }

      this.modules.delete(moduleName);
    }

    // Clear require cache safely (fix: guard require.resolve with existsSync)
    const modulePath = join(__dirname, '..', 'modules', moduleName);
    try {
      if (existsSync(modulePath) || existsSync(modulePath + '.js')) {
        const resolvedPath = require.resolve(modulePath);
        delete require.cache[resolvedPath];
      } else {
        throw new Error(`Module path does not exist: ${modulePath}`);
      }
    } catch (resolveError) {
      logger.error(`Cannot resolve module path for ${moduleName}:`, resolveError);
      throw resolveError;
    }

    // Reload module
    await this.loadModule(moduleName);
  }

  getModule(name: string): IModule | undefined {
    return this.modules.get(name);
  }

  getCommand(name: string): ICommand | undefined {
    return this.commands.get(name);
  }

  getEvents(eventName: string): IEvent[] {
    return this.events.get(eventName) || [];
  }

  getAllModules(): IModule[] {
    return Array.from(this.modules.values());
  }

  getAllCommands(): ICommand[] {
    return Array.from(this.commands.values());
  }

  async isModuleEnabledForGuild(guildId: string, moduleName: string): Promise<boolean> {
    // Check cache first
    const cacheKey = `module:${guildId}:${moduleName}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached;

    // Check database
    const enabled = await this.database.isModuleEnabled(guildId, moduleName);

    // Cache result for 5 minutes
    await this.redis.set(cacheKey, enabled, 300);

    return enabled;
  }
}
