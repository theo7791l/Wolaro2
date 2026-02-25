import { Guild, PermissionFlagsBits } from 'discord.js';
import pool from '../../../utils/database';
import { logger } from '../../../utils/logger';

export class SmartLockdown {
  async triggerLockdown(guild: Guild, level: string, reason: string): Promise<void> {
    try {
      logger.info(`Lockdown triggered for ${guild.name}: ${reason}`);

      for (const channel of guild.channels.cache.values()) {
        if (channel.isTextBased() && 'permissionOverwrites' in channel) {
          try {
            await (channel as any).permissionOverwrites.edit(guild.id, {
              [PermissionFlagsBits.SendMessages]: false,
            });
          } catch (error) {
            logger.error(`Failed to lock ${channel.name}:`, error);
          }
        }
      }

      logger.info(`Lockdown completed for ${guild.name}`);
    } catch (error) {
      logger.error('Error triggering lockdown:', error);
    }
  }
}
