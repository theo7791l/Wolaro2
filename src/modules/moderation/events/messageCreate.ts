import { Message } from 'discord.js';
import pool from '../../../utils/database';
import logger from '../../../utils/logger';
import autoAntiSpam from '../systems/AutoAntiSpam';
import type { ModerationConfig } from '../types';

/**
 * Event handler pour les messages créés
 * Vérifie spam, flood, bad words, phishing, etc.
 */
export default {
  name: 'messageCreate',
  async execute(message: Message) {
    // Ignorer MPs et messages du bot lui-même
    if (!message.guild) return;
    if (message.author.id === message.client.user?.id) return;

    try {
      // Récupérer la config de modération
      const result = await pool.query(
        'SELECT config FROM guild_config WHERE guild_id = $1 AND module = $2',
        [message.guild.id, 'moderation']
      );

      if (result.rows.length === 0) return;

      const settings: ModerationConfig = result.rows[0].config;
      if (!settings.enabled) return;

      // Vérifier anti-spam (tous les messages)
      if (settings.antispam_enabled) {
        await autoAntiSpam.checkMessage(message, settings);
      }

      // Autres vérifications (anti-phishing, NSFW) seront ajoutées dans les parties 2 et 3

    } catch (error) {
      logger.error('[messageCreate] Error:', error);
    }
  },
};
