/**
 * Anti-Nuke System - Complete implementation
 */

import { Guild, GuildAuditLogsEntry, PermissionsBitField, User, Role } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';

export class AntiNukeSystem {
  private actionTracking = new Map<string, Map<string, number>>();

  constructor(private db: ProtectionDatabase) {}

  async handleChannelDelete(guild: Guild, channel: any): Promise<void> {
    try {
      const executor = await this.getExecutor(guild, 'CHANNEL_DELETE');
      if (!executor) return;

      const exceeded = await this.trackAction(guild.id, executor.id, 'channel_delete');
      if (exceeded) {
        await this.handleNukeAttempt(guild, executor, 'channelDelete');
      }

      await this.db.incrementStat(guild.id, 'nuke_attempts');
    } catch (error) {
      logger.error('Error handling channel delete:', error);
    }
  }

  async handleRoleDelete(guild: Guild, role: Role): Promise<void> {
    try {
      const executor = await this.getExecutor(guild, 'ROLE_DELETE');
      if (!executor) return;

      const exceeded = await this.trackAction(guild.id, executor.id, 'role_delete');
      if (exceeded) {
        await this.handleNukeAttempt(guild, executor, 'roleDelete');
      }

      await this.db.incrementStat(guild.id, 'nuke_attempts');
    } catch (error) {
      logger.error('Error handling role delete:', error);
    }
  }

  async getExecutor(guild: Guild, action: string): Promise<User | null> {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
      });

      const entry = auditLogs.entries.first();
      if (!entry || !entry.executor) return null;

      return entry.executor.partial ? null : entry.executor as User;
    } catch (error) {
      logger.error('Error getting executor:', error);
      return null;
    }
  }

  async handleNukeAttempt(guild: Guild, executor: User, actionType: string): Promise<void> {
    try {
      logger.warn(`Nuke attempt detected: ${executor.tag} - ${actionType}`);

      const member = await guild.members.fetch(executor.id).catch(() => null);
      if (member) {
        await member.ban({ reason: `Anti-Nuke: ${actionType}` });
        logger.info(`Banned ${executor.tag} for nuke attempt`);
      }

      await this.protectServer(guild, actionType);
    } catch (error) {
      logger.error('Error handling nuke attempt:', error);
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

  private async trackAction(guildId: string, userId: string, action: string): Promise<boolean> {
    if (!this.actionTracking.has(guildId)) {
      this.actionTracking.set(guildId, new Map());
    }

    const tracking = this.actionTracking.get(guildId)!;
    const key = `${userId}-${action}`;
    const count = (tracking.get(key) || 0) + 1;
    tracking.set(key, count);

    setTimeout(() => tracking.delete(key), 60000);

    return count >= 3;
  }
}
