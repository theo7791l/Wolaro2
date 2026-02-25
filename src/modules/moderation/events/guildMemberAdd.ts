import { GuildMember } from 'discord.js';
import pool from '../../../utils/database';
import logger from '../../../utils/logger';
import type { ModerationConfig } from '../types';

/**
 * Event handler pour les membres qui rejoignent
 * Préparé pour anti-raid (Partie 2) et captcha (Partie 3)
 */
export default {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    try {
      // Récupérer la config de modération
      const result = await pool.query(
        'SELECT config FROM guild_config WHERE guild_id = $1 AND module = $2',
        [member.guild.id, 'moderation']
      );

      if (result.rows.length === 0) return;

      const settings: ModerationConfig = result.rows[0].config;
      if (!settings.enabled) return;

      // Anti-Raid sera ajouté dans la Partie 2
      // Captcha sera ajouté dans la Partie 3

      logger.info(`[guildMemberAdd] ${member.user.tag} joined ${member.guild.name}`);

    } catch (error) {
      logger.error('[guildMemberAdd] Error:', error);
    }
  },
};
