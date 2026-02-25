import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { SecurityManager } from '../../../utils/security';
import { logger } from '../../../utils/logger.js';

export class BlacklistCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('[MASTER] Blacklister ou déblacklister un serveur')
    .addStringOption((option) =>
      option
        .setName('guild-id')
        .setDescription('L\'ID du serveur')
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('blacklist')
        .setDescription('Blacklister (true) ou déblacklister (false)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('La raison du blacklist')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'admin';
  guildOnly = false;
  cooldown = 0;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    if (!SecurityManager.isMaster(interaction.user.id)) {
      await interaction.reply({
        content: '❌ Cette commande est réservée aux Master Admins.'
      });
      return;
    }

    const guildId = interaction.options.getString('guild-id', true);
    const shouldBlacklist = interaction.options.getBoolean('blacklist', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

    try {
      // Get guild owner info if available
      const targetGuild = await context.client.guilds.fetch(guildId).catch(() => null);
      const ownerId = targetGuild?.ownerId || '000000000000000000';

      // Ensure guild exists in database before updating
      await context.database.query(
        `INSERT INTO guilds (guild_id, owner_id, is_blacklisted, blacklist_reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id)
         DO UPDATE SET 
           is_blacklisted = $3,
           blacklist_reason = $4`,
        [guildId, ownerId, shouldBlacklist, shouldBlacklist ? reason : null]
      );

      // Invalidate cache
      await context.redis.invalidateGuildConfig(guildId);

      // Log action
      await context.database.logAction(
        interaction.user.id,
        shouldBlacklist ? 'MASTER_BLACKLIST' : 'MASTER_UNBLACKLIST',
        { guildId, reason },
        guildId
      );

      logger.info(`Guild ${guildId} ${shouldBlacklist ? 'blacklisted' : 'unblacklisted'} by ${interaction.user.tag}. Reason: ${reason}`);

      await interaction.reply({
        content: `✅ Serveur ${guildId} ${shouldBlacklist ? 'blacklisté' : 'déblacklisté'}.\\n**Raison:** ${reason}`
      });

      // Try to leave the guild if blacklisted
      if (shouldBlacklist && targetGuild) {
        try {
          await targetGuild.leave();
          logger.info(`Left blacklisted guild ${guildId}`);
        } catch (error) {
          logger.error(`Failed to leave blacklisted guild ${guildId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error modifying blacklist:', error);
      await interaction.reply({
        content: '❌ Erreur lors de la modification du blacklist.'
      });
    }
  }
}
