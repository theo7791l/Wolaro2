import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { GiveawayManager } from '../utils/manager';

export class EndCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('gend')
    .setDescription('Terminer un giveaway immédiatement')
    .addStringOption((option) =>
      option
        .setName('message_id')
        .setDescription('ID du message du giveaway')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'giveaways';
  permissions = [PermissionFlagsBits.ManageGuild];
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const messageId = interaction.options.getString('message_id', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const giveaway = await context.database.query(
        'SELECT * FROM giveaways WHERE guild_id = $1 AND message_id = $2 AND status = $3',
        [interaction.guildId!, messageId, 'active']
      );

      if (giveaway.length === 0) {
        await interaction.editReply('❌ Giveaway introuvable ou déjà terminé.');
        return;
      }

      await GiveawayManager.endGiveaway(giveaway[0].id, context);
      await interaction.editReply('✅ Giveaway terminé !');
    } catch (error) {
      await interaction.editReply('❌ Erreur lors de la fin du giveaway.');
    }
  }
}
