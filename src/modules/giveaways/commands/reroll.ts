import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { GiveawayManager } from '../utils/manager';

export class RerollCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('reroll')
    .setDescription('Retirer un nouveau gagnant')
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

    await interaction.deferReply();

    try {
      const giveaway = await context.database.query(
        'SELECT * FROM giveaways WHERE guild_id = $1 AND message_id = $2 AND status = $3',
        [interaction.guildId!, messageId, 'ended']
      );

      if (giveaway.length === 0) {
        await interaction.editReply('❌ Giveaway introuvable ou non terminé.');
        return;
      }

      // Get participants
      const participants = await context.database.query(
        'SELECT user_id FROM giveaway_participants WHERE giveaway_id = $1',
        [giveaway[0].id]
      );

      if (participants.length === 0) {
        await interaction.editReply('❌ Aucun participant pour ce giveaway.');
        return;
      }

      // Select new winner
      const newWinner = participants[Math.floor(Math.random() * participants.length)];

      const channel = await context.client.channels.fetch(giveaway[0].channel_id);
      if (channel?.isTextBased()) {
        await (channel as any).send(
          `🎉 Nouveau gagnant pour **${giveaway[0].prize}** : <@${newWinner.user_id}> ! Félicitations ! 🎉`
        );
      }

      await interaction.editReply(`✅ Nouveau gagnant tiré : <@${newWinner.user_id}>`);
    } catch (error) {
      await interaction.editReply('❌ Erreur lors du reroll.');
    }
  }
}
