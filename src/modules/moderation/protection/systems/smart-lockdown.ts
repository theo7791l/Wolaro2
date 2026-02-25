/**
 * Smart Lockdown System - Fixed permissionOverwrites types
 */

import { Guild, PermissionFlagsBits, ChannelType, TextChannel, NewsChannel } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';

export class SmartLockdownSystem {
  constructor(private db: ProtectionDatabase) {}

  async triggerLockdown(guild: Guild, level: string, reason: string): Promise<void> {
    try {
      logger.info(`Lockdown triggered for ${guild.name}: ${reason}`);

      const lockedChannels: string[] = [];

      for (const channel of guild.channels.cache.values()) {
        // Only lock text channels
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildNews) {
          try {
            const textChannel = channel as TextChannel | NewsChannel;
            
            await textChannel.permissionOverwrites.edit(guild.id, {
              SendMessages: false,
            }, { reason: `Lockdown: ${reason}` });

            lockedChannels.push(channel.id);
            logger.info(`Locked channel: ${channel.name}`);
          } catch (error) {
            logger.error(`Failed to lock ${channel.name}:`, error);
          }
        }
      }

      await this.db.incrementStat(guild.id, 'lockdowns');

      await this.pool.query(
        `INSERT INTO lockdown_states (guild_id, is_locked, reason, started_at, locked_channels)
         VALUES ($1, true, $2, NOW(), $3)
         ON CONFLICT (guild_id) DO UPDATE SET
           is_locked = true,
           reason = $2,
           started_at = NOW(),
           locked_channels = $3`,
        [guild.id, reason, lockedChannels]
      );

      logger.info(`Lockdown completed: ${lockedChannels.length} channels locked`);
    } catch (error) {
      logger.error('Error triggering lockdown:', error);
    }
  }

  private get pool() {
    return (this.db as any).pool;
  }
}
