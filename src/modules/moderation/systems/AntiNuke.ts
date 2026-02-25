import { Guild, GuildAuditLogsEntry, PermissionsBitField } from 'discord.js';
import pool from '../../../utils/database';
import { logger } from '../../../utils/logger';

export class AntiNuke {
  private actionTracking = new Map<string, Map<string, number>>();

  async handleChannelDelete(guild: Guild, channel: any): Promise<void> {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: 12, // CHANNEL_DELETE
        limit: 1,
      });

      const entry = auditLogs.entries.first();
      if (!entry || !entry.executor) return;

      await this.trackAction(guild.id, entry.executor.id, 'channel_delete');
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
        PermissionsBitField.Flags.BanMembers,
        PermissionsBitField.Flags.KickMembers,
      ];

      for (const role of guild.roles.cache.values()) {
        if (role.permissions.any(dangerousPerms)) {
          if (guild.members.me && guild.members.me.roles.highest.comparePositionTo(role) > 0) {
            try {
              await role.setPermissions(0n, `Anti-Nuke Protection: ${actionType}`);
              logger.info(`Removed permissions from role ${role.name}`);
            } catch (error) {
              logger.error(`Failed to update role ${role.name}:`, error);
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

    const guildTracking = this.actionTracking.get(guildId)!;
    const key = `${userId}-${action}`;
    const count = (guildTracking.get(key) || 0) + 1;
    guildTracking.set(key, count);

    setTimeout(() => guildTracking.delete(key), 60000);
  }
}
