import { IEvent } from '../../../types';
import { Interaction, ButtonInteraction, EmbedBuilder } from 'discord.js';
import { logger } from '../../../utils/logger';

export class GiveawayButtonHandler implements IEvent {
  name = 'interactionCreate';
  module = 'giveaways';

  async execute(interaction: Interaction, context: any): Promise<void> {
    if (!interaction.isButton()) return;

    const button = interaction as ButtonInteraction;

    if (button.customId === 'giveaway_enter') {
      await this.handleEntry(button, context);
    }
  }

  private async handleEntry(button: ButtonInteraction, context: any): Promise<void> {
    try {
      // Get giveaway
      const giveaway = await context.database.query(
        'SELECT * FROM giveaways WHERE guild_id = $1 AND message_id = $2 AND status = $3',
        [button.guildId!, button.message.id, 'active']
      );

      if (giveaway.length === 0) {
        await button.reply({
          content: '❌ Ce giveaway n\'est plus actif.',
          ephemeral: true,
        });
        return;
      }

      // Check if already entered
      const alreadyEntered = await context.database.query(
        'SELECT * FROM giveaway_participants WHERE giveaway_id = $1 AND user_id = $2',
        [giveaway[0].id, button.user.id]
      );

      if (alreadyEntered.length > 0) {
        await button.reply({
          content: '❌ Vous participez déjà à ce giveaway !',
          ephemeral: true,
        });
        return;
      }

      // Check requirements
      const config = await context.database.getGuildConfig(button.guildId!);
      const giveawaysModule = config?.modules?.find((m: any) => m.module_name === 'giveaways');

      if (giveawaysModule?.config?.requireRole) {
        const member = await button.guild!.members.fetch(button.user.id);
        if (!member.roles.cache.has(giveawaysModule.config.requireRole)) {
          await button.reply({
            content: `❌ Vous devez avoir le rôle <@&${giveawaysModule.config.requireRole}> pour participer.`,
            ephemeral: true,
          });
          return;
        }
      }

      if (giveawaysModule?.config?.minAccountAge > 0) {
        const accountAge = (Date.now() - button.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        if (accountAge < giveawaysModule.config.minAccountAge) {
          await button.reply({
            content: `❌ Votre compte doit avoir au moins ${giveawaysModule.config.minAccountAge} jours pour participer.`,
            ephemeral: true,
          });
          return;
        }
      }

      if (giveawaysModule?.config?.minServerJoinAge > 0) {
        const member = await button.guild!.members.fetch(button.user.id);
        const joinAge = (Date.now() - member.joinedTimestamp!) / (1000 * 60 * 60 * 24);
        if (joinAge < giveawaysModule.config.minServerJoinAge) {
          await button.reply({
            content: `❌ Vous devez être sur le serveur depuis au moins ${giveawaysModule.config.minServerJoinAge} jours pour participer.`,
            ephemeral: true,
          });
          return;
        }
      }

      // Add participant
      await context.database.query(
        'INSERT INTO giveaway_participants (giveaway_id, user_id, joined_at) VALUES ($1, $2, NOW())',
        [giveaway[0].id, button.user.id]
      );

      // Get new participant count
      const count = await context.database.query(
        'SELECT COUNT(*) as count FROM giveaway_participants WHERE giveaway_id = $1',
        [giveaway[0].id]
      );

      // Update message
      const embed = button.message.embeds[0];
      const newEmbed = EmbedBuilder.from(embed).setFooter({
        text: `${count[0].count} participant(s) | Hôte: ${giveaway[0].host_id}`,
      });

      await button.message.edit({ embeds: [newEmbed] });

      await button.reply({
        content: '✅ Vous participez maintenant au giveaway ! Bonne chance ! 🎉',
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error handling giveaway entry:', error);
      await button.reply({
        content: '❌ Erreur lors de l\'inscription au giveaway.',
        ephemeral: true,
      });
    }
  }
}
