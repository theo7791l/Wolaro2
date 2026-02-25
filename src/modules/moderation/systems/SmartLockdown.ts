import { Guild, TextChannel, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import pool from '../../../utils/database';
import logger from '../../../utils/logger';

/**
 * Système de verrouillage intelligent du serveur
 * Retire les permissions d'écriture pour @everyone
 */
export class SmartLockdownSystem {
  private lockedGuilds = new Set<string>();

  /**
   * Verrouille tous les salons d'une guild
   */
  async lockdown(guild: Guild, reason: string = 'Lockdown manuel'): Promise<{ success: boolean; message: string; lockedChannels: number }> {
    if (this.lockedGuilds.has(guild.id)) {
      return { success: false, message: 'Le serveur est déjà verrouillé', lockedChannels: 0 };
    }

    try {
      this.lockedGuilds.add(guild.id);
      let lockedCount = 0;

      const everyoneRole = guild.roles.everyone;

      // Verrouiller tous les salons textuels
      for (const [, channel] of guild.channels.cache) {
        if (channel.isTextBased() && channel.type === 0) { // GUILD_TEXT
          const textChannel = channel as TextChannel;

          try {
            await textChannel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: false,
              AddReactions: false
            });
            lockedCount++;
          } catch (error) {
            logger.error(`[Lockdown] Failed to lock ${textChannel.name}:`, error);
          }
        }
      }

      // Log dans PostgreSQL
      await pool.query(
        'INSERT INTO moderation_logs (guild_id, type, data, timestamp) VALUES ($1, $2, $3, $4)',
        [guild.id, 'lockdown', JSON.stringify({ reason, lockedChannels: lockedCount }), new Date()]
      );

      // Log dans le salon
      const logChannel = guild.channels.cache.find(c =>
        c.name.includes('log') || c.name.includes('mod')
      );

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🔒 Serveur verrouillé')
            .setDescription(
              `**Raison:** ${reason}\n` +
              `**Salons verrouillés:** ${lockedCount}\n\n` +
              `Les membres ne peuvent plus envoyer de messages.`
            )
            .setTimestamp()
            .setFooter({ text: 'Wolaro Smart Lockdown' })]
        });
      }

      logger.info(`[Lockdown] 🔒 ${guild.name} locked (${lockedCount} channels)`);
      return { success: true, message: `Serveur verrouillé (${lockedCount} salons)`, lockedChannels: lockedCount };
    } catch (error) {
      this.lockedGuilds.delete(guild.id);
      logger.error('[Lockdown] Error:', error);
      return { success: false, message: String(error), lockedChannels: 0 };
    }
  }

  /**
   * Déverrouille tous les salons d'une guild
   */
  async unlock(guild: Guild, reason: string = 'Déverrouillage manuel'): Promise<{ success: boolean; message: string; unlockedChannels: number }> {
    if (!this.lockedGuilds.has(guild.id)) {
      return { success: false, message: 'Le serveur n\'est pas verrouillé', unlockedChannels: 0 };
    }

    try {
      this.lockedGuilds.delete(guild.id);
      let unlockedCount = 0;

      const everyoneRole = guild.roles.everyone;

      // Déverrouiller tous les salons textuels
      for (const [, channel] of guild.channels.cache) {
        if (channel.isTextBased() && channel.type === 0) {
          const textChannel = channel as TextChannel;

          try {
            await textChannel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: null,
              AddReactions: null
            });
            unlockedCount++;
          } catch (error) {
            logger.error(`[Unlock] Failed to unlock ${textChannel.name}:`, error);
          }
        }
      }

      // Log dans PostgreSQL
      await pool.query(
        'INSERT INTO moderation_logs (guild_id, type, data, timestamp) VALUES ($1, $2, $3, $4)',
        [guild.id, 'unlock', JSON.stringify({ reason, unlockedChannels: unlockedCount }), new Date()]
      );

      // Log dans le salon
      const logChannel = guild.channels.cache.find(c =>
        c.name.includes('log') || c.name.includes('mod')
      );

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🔓 Serveur déverrouillé')
            .setDescription(
              `**Raison:** ${reason}\n` +
              `**Salons déverrouillés:** ${unlockedCount}\n\n` +
              `Les membres peuvent à nouveau envoyer des messages.`
            )
            .setTimestamp()
            .setFooter({ text: 'Wolaro Smart Lockdown' })]
        });
      }

      logger.info(`[Unlock] 🔓 ${guild.name} unlocked (${unlockedCount} channels)`);
      return { success: true, message: `Serveur déverrouillé (${unlockedCount} salons)`, unlockedChannels: unlockedCount };
    } catch (error) {
      logger.error('[Unlock] Error:', error);
      return { success: false, message: String(error), unlockedChannels: 0 };
    }
  }

  /**
   * Vérifie si une guild est verrouillée
   */
  isLocked(guildId: string): boolean {
    return this.lockedGuilds.has(guildId);
  }
}

export default new SmartLockdownSystem();
