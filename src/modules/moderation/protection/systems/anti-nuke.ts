/**
 * Anti-Nuke System - Migrated from TheoProtect antiNuke.js
 * Protection contre les attaques de destruction massive du serveur
 */

import { Guild, User, AuditLogEvent } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { ProtectionDB } from '../database';
import type { NukeDetection } from '../types';

interface ActionThreshold {
  limit: number;
  time: number;
}

interface ActionEntry {
  action: string;
  timestamp: number;
}

export class AntiNukeSystem {
  private thresholds: Record<string, ActionThreshold> = {
    channelDelete: { limit: 3, time: 10000 },
    channelCreate: { limit: 5, time: 10000 },
    roleDelete: { limit: 3, time: 10000 },
    roleCreate: { limit: 5, time: 10000 },
    banAdd: { limit: 5, time: 30000 },
    kickAdd: { limit: 8, time: 30000 },
    memberRoleUpdate: { limit: 10, time: 5000 }
  };

  private actions = new Map<string, ActionEntry[]>();
  private db: ProtectionDB;

  constructor(db: ProtectionDB) {
    this.db = db;
    setInterval(() => this.clearCache(), 60000); // Clean every 60s
  }

  /**
   * Track action and check if threshold exceeded
   */
  async trackAction(
    userId: string,
    guildId: string,
    actionType: string
  ): Promise<boolean> {
    const key = `${userId}-${guildId}-${actionType}`;
    const now = Date.now();

    if (!this.actions.has(key)) {
      this.actions.set(key, []);
    }

    const userActions = this.actions.get(key)!;
    const threshold = this.thresholds[actionType];

    if (!threshold) return false;

    // Clean old actions
    const validActions = userActions.filter(
      a => now - a.timestamp < threshold.time
    );
    validActions.push({ action: actionType, timestamp: now });
    this.actions.set(key, validActions);

    // Check threshold
    if (validActions.length >= threshold.limit) {
      logger.warn(
        `[Anti-Nuke] 🚨 Threshold exceeded: ${userId} - ${actionType} (${validActions.length}/${threshold.limit})`
      );
      return true;
    }

    return false;
  }

  /**
   * Handle nuke attempt
   */
  async handleNukeAttempt(
    guild: Guild,
    executor: User,
    actionType: string
  ): Promise<boolean> {
    try {
      logger.warn(`[Anti-Nuke] ⚠️ Nuke attempt: ${executor.tag} - ${actionType}`);

      const config = await this.db.getConfig(guild.id);
      if (!config.antinuke_enabled) return false;

      // Check if user is whitelisted
      if (config.whitelist_users.includes(executor.id)) {
        logger.info(`[Anti-Nuke] User ${executor.tag} is whitelisted, skipping`);
        return false;
      }

      // Log action
      await this.db.logAction({
        guild_id: guild.id,
        user_id: executor.id,
        type: 'nuke_attempt',
        action: 'ban',
        reason: `Tentative de nuke: ${actionType}`,
        details: { action_type: actionType }
      });

      await this.db.incrementStat(guild.id, 'nuke_attempts');

      // Remove dangerous permissions
      const member = await guild.members.fetch(executor.id).catch(() => null);
      if (member) {
        const dangerousPerms = [
          'Administrator',
          'ManageGuild',
          'ManageChannels',
          'ManageRoles',
          'BanMembers',
          'KickMembers'
        ];

        // Remove all roles with dangerous permissions
        for (const role of member.roles.cache.values()) {
          if (role.permissions.any(dangerousPerms as any) && role.editable) {
            await member.roles.remove(role).catch(() => {});
            logger.info(`[Anti-Nuke] 🛡️ Removed role: ${role.name} from ${executor.tag}`);
          }
        }
      }

      // Ban attacker
      await guild.members.ban(executor.id, {
        reason: `[Anti-Nuke] Suspicious activity: ${actionType}`
      }).catch(() => {});

      logger.info(`[Anti-Nuke] ✅ Banned ${executor.tag} for nuke attempt`);

      // Send log
      if (config.log_channel_id) {
        const logChannel = guild.channels.cache.get(config.log_channel_id);
        if (logChannel?.isTextBased()) {
          await logChannel.send({
            embeds: [{
              color: 0xff0000,
              title: '🚨 Anti-Nuke: Attaque détectée',
              description:
                `**Utilisateur:** ${executor.tag} (${executor.id})\n` +
                `**Action:** ${actionType}\n` +
                `**Sanction:** Ban automatique`,
              timestamp: new Date().toISOString(),
              footer: { text: 'Wolaro Anti-Nuke System' }
            }]
          }).catch(() => {});
        }
      }

      return true;
    } catch (error) {
      logger.error('[Anti-Nuke] Error handling nuke attempt:', error);
      return false;
    }
  }

  /**
   * Get executor from audit logs
   */
  async getExecutor(guild: Guild, event: AuditLogEvent): Promise<User | null> {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: event,
        limit: 1
      });

      const entry = auditLogs.entries.first();
      if (!entry) return null;

      // Check if action is recent (< 5 seconds)
      if (Date.now() - entry.createdTimestamp > 5000) return null;

      return entry.executor;
    } catch (error) {
      logger.error('[Anti-Nuke] Error fetching audit logs:', error);
      return null;
    }
  }

  /**
   * Clear old cache entries
   */
  private clearCache(): void {
    const now = Date.now();
    for (const [key, actions] of this.actions.entries()) {
      const validActions = actions.filter(a => now - a.timestamp < 60000);
      if (validActions.length === 0) {
        this.actions.delete(key);
      } else {
        this.actions.set(key, validActions);
      }
    }
  }

  /**
   * Get stats for guild
   */
  getStats(guildId: string): { actions: Map<string, number> } {
    const stats = new Map<string, number>();
    
    for (const [key, actions] of this.actions.entries()) {
      if (key.includes(guildId)) {
        const actionType = key.split('-')[2];
        stats.set(actionType, actions.length);
      }
    }
    
    return { actions: stats };
  }
}
