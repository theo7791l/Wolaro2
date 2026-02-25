import { Guild, User, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import pool from '../../../utils/database';
import logger from '../../../utils/logger';

/**
 * Système anti-nuke pour prévenir les attaques destructrices
 * Adapté de TheoProtect pour Wolaro2
 */
export class AntiNukeSystem {
  private actions = new Map<string, { action: string; timestamp: number }[]>();

  private readonly thresholds = {
    channelDelete: { limit: 3, time: 10000 }, // 3 channels en 10s
    channelCreate: { limit: 5, time: 10000 },
    roleDelete: { limit: 3, time: 10000 },
    roleCreate: { limit: 5, time: 10000 },
    banAdd: { limit: 5, time: 30000 }, // 5 bans en 30s
    kickAdd: { limit: 8, time: 30000 },
    memberRoleUpdate: { limit: 10, time: 5000 } // 10 changements de rôles en 5s
  };

  /**
   * Track une action administrative
   * @returns true si le seuil est dépassé (nuke détecté)
   */
  trackAction(userId: string, guildId: string, actionType: keyof typeof this.thresholds): boolean {
    const key = `${userId}-${guildId}-${actionType}`;
    const now = Date.now();

    if (!this.actions.has(key)) {
      this.actions.set(key, []);
    }

    const userActions = this.actions.get(key)!;
    const threshold = this.thresholds[actionType];

    if (!threshold) return false;

    // Nettoyer les actions anciennes
    const validActions = userActions.filter(a => now - a.timestamp < threshold.time);
    validActions.push({ action: actionType, timestamp: now });
    this.actions.set(key, validActions);

    // Vérifier le seuil
    if (validActions.length >= threshold.limit) {
      logger.warn(`[Anti-Nuke] 🚨 Threshold exceeded: ${userId} - ${actionType} (${validActions.length}/${threshold.limit})`);
      return true;
    }

    return false;
  }

  /**
   * Gère une tentative de nuke détectée
   */
  async handleNukeAttempt(guild: Guild, executor: User, actionType: string): Promise<boolean> {
    if (!guild || !executor) return false;

    try {
      logger.warn(`[Anti-Nuke] ⚠️ Nuke attempt detected: ${executor.tag} - ${actionType}`);

      // Log dans PostgreSQL
      await pool.query(
        'INSERT INTO moderation_logs (guild_id, type, user_id, data, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [
          guild.id,
          'anti_nuke',
          executor.id,
          JSON.stringify({ action: actionType, timestamp: Date.now() }),
          new Date()
        ]
      );

      // Récupérer le membre
      const member = await guild.members.fetch(executor.id).catch(() => null);
      if (member && member.permissions.has(PermissionFlagsBits.Administrator)) {
        const dangerousPerms: PermissionFlagsBits[] = [
          PermissionFlagsBits.Administrator,
          PermissionFlagsBits.ManageGuild,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageRoles,
          PermissionFlagsBits.BanMembers,
          PermissionFlagsBits.KickMembers
        ];

        // Retirer tous les rôles avec permissions dangereuses
        for (const role of member.roles.cache.values()) {
          if (role.permissions.any(dangerousPerms) && guild.members.me?.roles.highest.comparePositionTo(role) > 0) {
            await member.roles.remove(role).catch(() => {});
            logger.info(`[Anti-Nuke] 🛡️ Removed role: ${role.name} from ${executor.tag}`);
          }
        }
      }

      // Bannir l'attaquant
      await guild.members.ban(executor.id, {
        reason: `[Anti-Nuke] Suspicious activity detected: ${actionType}`
      }).catch(() => {});

      logger.info(`[Anti-Nuke] ✅ Banned ${executor.tag} for nuke attempt`);

      // Envoyer un log
      const logChannel = guild.channels.cache.find(c =>
        c.name.includes('log') || c.name.includes('mod')
      );

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🚨 Anti-Nuke: Attaque détectée')
            .setDescription(
              `**Utilisateur:** ${executor.tag} (${executor.id})\n` +
              `**Action:** ${actionType}\n` +
              `**Sanction:** Ban automatique`
            )
            .setTimestamp()
            .setFooter({ text: 'Wolaro Anti-Nuke' })]
        }).catch(() => {});
      }

      return true;
    } catch (error) {
      logger.error('[Anti-Nuke] Error handling nuke attempt:', error);
      return false;
    }
  }

  /**
   * Nettoie le cache des actions expirées
   */
  clearCache(): void {
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
}

export default new AntiNukeSystem();
