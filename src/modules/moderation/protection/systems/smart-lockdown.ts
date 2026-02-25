/**
 * Smart Lockdown System - Migrated from TheoProtect smartLockdown.js
 * Système de verrouillage intelligent avec escalade automatique
 */

import { Guild, PermissionsBitField } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { ProtectionDB } from '../database';
import type { LockdownState } from '../types';

type LockdownLevel = 'SOFT' | 'MEDIUM' | 'HARD' | 'RAID';

interface LockdownConfig {
  name: string;
  permissions: Record<string, boolean>;
  allowedRoles: string[];
  disableInvites?: boolean;
  kickNewMembers?: boolean;
}

interface OriginalPermission {
  channelId: string;
  permissions: { allow: string; deny: string } | null;
}

export class SmartLockdownSystem {
  private lockdownStates = new Map<string, {
    level: LockdownLevel;
    reason: string;
    activatedAt: number;
    originalPermissions: OriginalPermission[];
  }>();

  private db: ProtectionDB;

  private lockdownLevels: Record<LockdownLevel, LockdownConfig> = {
    SOFT: {
      name: 'Soft Lockdown',
      permissions: {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false
      },
      allowedRoles: ['Modérateur', 'Admin']
    },
    MEDIUM: {
      name: 'Medium Lockdown',
      permissions: {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        SendMessagesInThreads: false,
        AttachFiles: false
      },
      allowedRoles: ['Admin']
    },
    HARD: {
      name: 'Hard Lockdown',
      permissions: {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        SendMessagesInThreads: false,
        AttachFiles: false,
        Connect: false,
        Speak: false
      },
      allowedRoles: [],
      disableInvites: true
    },
    RAID: {
      name: 'Raid Protection',
      permissions: {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        SendMessagesInThreads: false,
        AttachFiles: false,
        Connect: false,
        Speak: false,
        ViewChannel: false
      },
      allowedRoles: [],
      disableInvites: true,
      kickNewMembers: true
    }
  };

  constructor(db: ProtectionDB) {
    this.db = db;
  }

  /**
   * Activate lockdown
   */
  async activateLockdown(
    guild: Guild,
    level: LockdownLevel = 'SOFT',
    reason = 'Lockdown activé'
  ): Promise<{ success: boolean; level: string; channelsLocked: number }> {
    const lockdownConfig = this.lockdownLevels[level];
    if (!lockdownConfig) {
      throw new Error(`Invalid lockdown level: ${level}`);
    }

    const originalPermissions: OriginalPermission[] = [];

    // Store original permissions and apply lockdown
    for (const [, channel] of guild.channels.cache) {
      if (channel.isTextBased() || channel.isVoiceBased()) {
        const everyonePerms = channel.permissionOverwrites.cache.get(guild.id);
        
        originalPermissions.push({
          channelId: channel.id,
          permissions: everyonePerms
            ? {
                allow: everyonePerms.allow.bitfield.toString(),
                deny: everyonePerms.deny.bitfield.toString()
              }
            : null
        });

        // Apply lockdown permissions
        const denyPerms = Object.entries(lockdownConfig.permissions)
          .filter(([, value]) => value === false)
          .map(([key]) => key);

        await channel.permissionOverwrites
          .edit(
            guild.id,
            Object.fromEntries(denyPerms.map(perm => [perm, false])),
            { reason }
          )
          .catch(err => logger.error(`Failed to lock ${channel.name}:`, err));
      }
    }

    // Disable server invites if needed
    if (lockdownConfig.disableInvites) {
      await guild.invites
        .fetch()
        .then(invites => {
          invites.forEach(invite => invite.delete().catch(() => {}));
        })
        .catch(() => {});
    }

    this.lockdownStates.set(guild.id, {
      level,
      reason,
      activatedAt: Date.now(),
      originalPermissions
    });

    await this.db.logAction({
      guild_id: guild.id,
      user_id: 'SYSTEM',
      type: 'lockdown_triggered',
      action: 'lockdown',
      reason: `${lockdownConfig.name} activé: ${reason}`,
      details: { level, channels_locked: originalPermissions.length }
    });

    await this.db.incrementStat(guild.id, 'lockdowns');

    logger.info(`[Lockdown] ${lockdownConfig.name} activated in ${guild.name}`);

    return {
      success: true,
      level: lockdownConfig.name,
      channelsLocked: originalPermissions.length
    };
  }

  /**
   * Deactivate lockdown
   */
  async deactivateLockdown(
    guild: Guild
  ): Promise<{ success: boolean; channelsRestored?: number; duration?: number; reason?: string }> {
    const state = this.lockdownStates.get(guild.id);
    if (!state) {
      return { success: false, reason: 'No active lockdown' };
    }

    let restored = 0;

    // Restore original permissions
    for (const channelData of state.originalPermissions) {
      const channel = guild.channels.cache.get(channelData.channelId);
      if (!channel) continue;

      try {
        if (channelData.permissions) {
          await channel.permissionOverwrites.edit(
            guild.id,
            {
              allow: new PermissionsBitField(BigInt(channelData.permissions.allow)),
              deny: new PermissionsBitField(BigInt(channelData.permissions.deny))
            },
            { reason: 'Lockdown désactivé' }
          );
        } else {
          await channel.permissionOverwrites.delete(guild.id, { reason: 'Lockdown désactivé' });
        }
        restored++;
      } catch (err) {
        logger.error(`Failed to restore ${channel.name}:`, err);
      }
    }

    const duration = Date.now() - state.activatedAt;
    this.lockdownStates.delete(guild.id);

    await this.db.logAction({
      guild_id: guild.id,
      user_id: 'SYSTEM',
      type: 'lockdown_triggered',
      action: 'none',
      reason: 'Lockdown désactivé',
      details: { channels_restored: restored, duration_ms: duration }
    });

    logger.info(`[Lockdown] Deactivated in ${guild.name} (${restored} channels restored)`);

    return { success: true, channelsRestored: restored, duration };
  }

  /**
   * Get lockdown status
   */
  getStatus(guildId: string): LockdownState | null {
    const state = this.lockdownStates.get(guildId);
    if (!state) return null;

    return {
      guild_id: guildId,
      is_locked: true,
      reason: state.reason,
      started_at: new Date(state.activatedAt),
      locked_channels: state.originalPermissions.map(p => p.channelId)
    };
  }

  /**
   * Auto-escalate lockdown based on threat level
   */
  async autoEscalateLockdown(
    guild: Guild,
    threatLevel: number
  ): Promise<{ success: boolean; level: string; channelsLocked: number } | null> {
    const currentState = this.lockdownStates.get(guild.id);

    if (threatLevel >= 9 && (!currentState || currentState.level !== 'RAID')) {
      return await this.activateLockdown(guild, 'RAID', 'Auto-escalade: Raid détecté');
    } else if (threatLevel >= 7 && (!currentState || currentState.level === 'SOFT')) {
      return await this.activateLockdown(guild, 'HARD', 'Auto-escalade: Menace élevée');
    } else if (threatLevel >= 5 && !currentState) {
      return await this.activateLockdown(guild, 'MEDIUM', 'Auto-escalade: Menace modérée');
    }

    return null;
  }
}
