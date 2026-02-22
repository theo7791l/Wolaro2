import { Client, GuildMember, PartialGuildMember } from 'discord.js';
import { DatabaseManager } from '../database/manager';
import { PubSubManager } from '../cache/pubsub';
import { logger } from '../utils/logger';

/**
 * Guild Member Update Event
 * Detects permission changes on Discord and syncs to database
 * Publishes Redis event if admin permissions are revoked
 */

export class GuildMemberUpdateEvent {
  constructor(
    private client: Client,
    private database: DatabaseManager,
    private pubsub: PubSubManager
  ) {
    this.client.on('guildMemberUpdate', this.handleMemberUpdate.bind(this));
    logger.info('GuildMemberUpdate event registered');
  }

  private async handleMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ): Promise<void> {
    try {
      // Check if roles changed
      if (oldMember.roles.cache.size === newMember.roles.cache.size) {
        const oldRoleIds = oldMember.roles.cache.map((r) => r.id).sort();
        const newRoleIds = newMember.roles.cache.map((r) => r.id).sort();
        if (oldRoleIds.join(',') === newRoleIds.join(',')) {
          return; // No role changes
        }
      }

      const guildId = newMember.guild.id;
      const userId = newMember.id;

      // Check if member had admin permissions before
      const hadAdminBefore = oldMember.permissions?.has('Administrator') || false;
      const hasAdminNow = newMember.permissions.has('Administrator');

      // Update database with new permissions
      const permissions = [];
      if (hasAdminNow) permissions.push('ADMINISTRATOR');
      if (newMember.permissions.has('ManageGuild')) permissions.push('MANAGE_GUILD');
      if (newMember.permissions.has('ManageChannels')) permissions.push('MANAGE_CHANNELS');
      if (newMember.permissions.has('ManageRoles')) permissions.push('MANAGE_ROLES');
      if (newMember.permissions.has('KickMembers')) permissions.push('KICK_MEMBERS');
      if (newMember.permissions.has('BanMembers')) permissions.push('BAN_MEMBERS');

      await this.database.query(
        `INSERT INTO guild_members (guild_id, user_id, permissions)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, user_id)
         DO UPDATE SET permissions = $3, joined_at = NOW()`,
        [guildId, userId, permissions]
      );

      logger.info(`Updated permissions for user ${userId} in guild ${guildId}`);

      // If admin permissions were revoked, publish Redis event
      if (hadAdminBefore && !hasAdminNow) {
        await this.publishPermissionRevoked(guildId, userId, 'Administrator role removed on Discord');
      }
    } catch (error) {
      logger.error('Error handling guild member update:', error);
    }
  }

  /**
   * Publish permission revoked event to Redis
   * This will trigger WebSocket to disconnect user from panel
   */
  private async publishPermissionRevoked(
    guildId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      await this.pubsub.getRedis().getClient().publish(
        'permission:revoked',
        JSON.stringify({
          guildId,
          userId,
          reason,
          timestamp: Date.now(),
        })
      );

      logger.warn(`Published permission revoked for user ${userId} in guild ${guildId}`);
    } catch (error) {
      logger.error('Error publishing permission revoked:', error);
    }
  }
}
