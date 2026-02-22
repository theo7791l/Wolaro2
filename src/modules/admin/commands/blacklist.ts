import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { SecurityManager } from '../../../utils/security';

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
        content: '❌ Cette commande est réservée aux Master Admins.',
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.options.getString('guild-id', true);
    const shouldBlacklist = interaction.options.getBoolean('blacklist', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

    try {
      await context.database.query(
        `UPDATE guilds
         SET is_blacklisted = $2, blacklist_reason = $3
         WHERE guild_id = $1`,
        [guildId, shouldBlacklist, shouldBlacklist ? reason : null]
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

      await interaction.reply({
        content: `✅ Serveur ${guildId} ${shouldBlacklist ? 'blacklisté' : 'déblacklisté'}.\n**Raison:** ${reason}`,
        ephemeral: true,
      });

      // Try to leave the guild if blacklisted
      if (shouldBlacklist) {
        const guild = await context.client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          await guild.leave();
        }
      }
    } catch (error) {
      await interaction.reply({
        content: '❌ Erreur lors de la modification du blacklist.',
        ephemeral: true,
      });
    }
  }
}
