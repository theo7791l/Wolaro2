import { Client } from 'discord.js';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { ModuleLoader } from './module-loader';
import { AntiRaidManager } from '../utils/security';
import { logger } from '../utils/logger';

export class EventHandler {
  private moduleLoader!: ModuleLoader;

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}

  async initialize(moduleLoader: ModuleLoader): Promise<void> {
    this.moduleLoader = moduleLoader;
    this.registerCoreEvents();
    logger.info('Event handler initialized');
  }

  private registerCoreEvents(): void {
    // Guild Member Add (Anti-Raid)
    this.client.on('guildMemberAdd', async (member) => {
      try {
        const { isSpike, joinCount } = AntiRaidManager.trackJoin(member.guild.id);

        if (isSpike) {
          logger.warn(`Raid detected in guild ${member.guild.id}: ${joinCount} joins`);

          // Log raid event
          await this.database.query(
            `INSERT INTO raid_events (guild_id, event_type, severity, join_count, user_ids, is_active)
             VALUES ($1, 'JOIN_SPIKE', 'HIGH', $2, $3, true)`,
            [member.guild.id, joinCount, JSON.stringify([member.id])]
          );

          // Check if auto-lockdown is enabled
          const config = await this.database.getGuildConfig(member.guild.id);
          const moderationModule = config?.modules?.find((m: any) => m.module_name === 'moderation');

          if (moderationModule?.config?.autoLockdown) {
            // Auto-lockdown logic would go here
            logger.info(`Auto-lockdown triggered for guild ${member.guild.id}`);
          }
        }

        // Execute module events
        await this.executeModuleEvents('guildMemberAdd', member);
      } catch (error) {
        logger.error('Error in guildMemberAdd event:', error);
      }
    });

    // Message Create (Anti-Spam)
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot || !message.guild) return;

      try {
        const { isSpam, _count } = AntiRaidManager.trackMessage(
          message.guild.id,
          message.author.id
        );

        if (isSpam) {
          logger.warn(`Spam detected from ${message.author.tag} in guild ${message.guild.id}`);

          // Auto-timeout if configured
          const config = await this.database.getGuildConfig(message.guild.id);
          const moderationModule = config?.modules?.find((m: any) => m.module_name === 'moderation');

          if (moderationModule?.config?.autoTimeout) {
            try {
              await message.member?.timeout(60000, 'Auto-modération: Spam détecté');
              await message.channel.send(`⚠️ ${message.author} a été timeout pour spam.`);
            } catch (error) {
              logger.error('Failed to timeout user:', error);
            }
          }
        }

        // Execute module events
        await this.executeModuleEvents('messageCreate', message);
      } catch (error) {
        logger.error('Error in messageCreate event:', error);
      }
    });

    // FIX: ajout de try/catch manquant sur guildCreate et guildDelete
    // Guild Create
    this.client.on('guildCreate', async (guild) => {
      try {
        logger.info(`Bot joined guild: ${guild.name} (${guild.id})`);
        await this.database.initializeGuild(guild.id, guild.ownerId);
        await this.executeModuleEvents('guildCreate', guild);
      } catch (error) {
        logger.error(`Error in guildCreate event for guild ${guild.id}:`, error);
      }
    });

    // Guild Delete
    this.client.on('guildDelete', async (guild) => {
      try {
        logger.info(`Bot left guild: ${guild.name} (${guild.id})`);
        await this.redis.invalidateGuildConfig(guild.id);
        await this.executeModuleEvents('guildDelete', guild);
      } catch (error) {
        logger.error(`Error in guildDelete event for guild ${guild.id}:`, error);
      }
    });

    // Interaction Create (for buttons, select menus, modals)
    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        await this.executeModuleEvents('interactionCreate', interaction);
      }
    });
  }

  private async executeModuleEvents(eventName: string, ...args: any[]): Promise<void> {
    const events = this.moduleLoader.getEvents(eventName);

    for (const event of events) {
      try {
        // Check if module is enabled for this guild (if applicable)
        const firstArg = args[0];
        const guildId = firstArg?.guild?.id || firstArg?.guildId;

        if (guildId && event.module) {
          const isEnabled = await this.moduleLoader.isModuleEnabledForGuild(guildId, event.module);
          if (!isEnabled) continue;
        }

        await event.execute(...args, {
          database: this.database,
          redis: this.redis,
          client: this.client,
        });
      } catch (error) {
        logger.error(`Error executing event ${eventName} from module ${event.module}:`, error);
      }
    }
  }
}
