/**
 * Anti-Nuke System - Fixed User type
 */

import { Guild, GuildAuditLogsEntry, PermissionsBitField, User } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';

export class AntiNukeSystem {
  private actionTracking = new Map<string, Map<string, number>>();

  constructor(private db: ProtectionDatabase) {}

  async handleChannelDelete(guild: Guild, channel: any): Promise<void> {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: 12, // CHANNEL_DELETE
        limit: 1,
      });

      const entry = auditLogs.entries.first();
      if (!entry || !entry.executor) return;

      // Handle User | PartialUser
      const executor: User | null = entry.executor.partial ? null : entry.executor as User;
      if (!executor) return;

      await this.trackAction(guild.id, executor.id, 'channel_delete');
      await this.db.incrementStat(guild.id, 'nuke_attempts');
    } catch (error) {
      logger.error('Error handling channel delete:', error);
    }
  }

  async protectServer(guild: Guild, actionType: string): Promise<void> {
    try {
      const dangerousPerms = [
        PermissionsBitField.Flags.Administrator,
        PermissionsBitField.Flags.ManageGuild,
        PermissionsBitField.Flags.ManageRoles,
        PermissionsBitField.Flags.ManageChannels,
      ];

      for (const role of guild.roles.cache.values()) {
        if (role.permissions.any(dangerousPerms)) {
          const me = guild.members.me;
          if (me && me.roles.highest.comparePositionTo(role) > 0) {
            try {
              await role.setPermissions(0n, `Anti-Nuke: ${actionType}`);
              logger.info(`Removed permissions from ${role.name}`);
            } catch (error) {
              logger.error(`Failed to update role:`, error);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error protecting server:', error);
    }
  }

  private async trackAction(guildId: string, userId: string, action: string): Promise<void> {
    if (!this.actionTracking.has(guildId)) {
      this.actionTracking.set(guildId, new Map());
    }

    const tracking = this.actionTracking.get(guildId)!;
    const key = `${userId}-${action}`;
    tracking.set(key, (tracking.get(key) || 0) + 1);

    setTimeout(() => tracking.delete(key), 60000);
  }
}
