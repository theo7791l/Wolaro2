/**
 * Smart Lockdown - Fixed PermissionFlagsBits
 */

import { Guild, PermissionFlagsBits, ChannelType, TextChannel, NewsChannel } from 'discord.js';
import pool from '../../../utils/database';
import { logger } from '../../../utils/logger';

export class SmartLockdown {
  async triggerLockdown(guild: Guild, level: string, reason: string): Promise<void> {
    try {
      logger.info(`Lockdown triggered for ${guild.name}: ${reason}`);

      for (const channel of guild.channels.cache.values()) {
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildNews) {
          try {
            const textChannel = channel as TextChannel | NewsChannel;

            await textChannel.permissionOverwrites.edit(guild.id, {
              SendMessages: false,
            }, { reason: `Lockdown: ${reason}` });

            logger.info(`Locked channel: ${channel.name}`);
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
