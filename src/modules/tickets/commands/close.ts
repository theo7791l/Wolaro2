import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { TicketManager } from '../utils/manager';

export class CloseCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('closeticket')
    .setDescription('Fermer un ticket')
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('Raison de la fermeture')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'tickets';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

    // Check if in ticket channel
    const ticket = await context.database.query(
      'SELECT * FROM tickets WHERE guild_id = $1 AND channel_id = $2 AND status = $3',
      [interaction.guildId!, interaction.channelId, 'open']
    );

    if (ticket.length === 0) {
      await interaction.reply({
        content: '❌ Cette commande ne peut être utilisée que dans un ticket ouvert.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await TicketManager.closeTicket(
        interaction.channelId,
        interaction.user.id,
        reason,
        context
      );

      await interaction.editReply('✅ Le ticket sera fermé dans 5 secondes...');

      setTimeout(async () => {
        await interaction.channel?.delete();
      }, 5000);
    } catch (error) {
      await interaction.editReply('❌ Erreur lors de la fermeture du ticket.');
    }
  }
}
