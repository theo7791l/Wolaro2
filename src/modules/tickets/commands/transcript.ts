import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { TicketManager } from '../utils/manager';

export class TranscriptCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Générer un transcript du ticket') as SlashCommandBuilder;

  module = 'tickets';
  guildOnly = true;
  cooldown = 10;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    // Check if in ticket channel
    const ticket = await context.database.query(
      'SELECT * FROM tickets WHERE guild_id = $1 AND channel_id = $2',
      [interaction.guildId!, interaction.channelId]
    );

    if (ticket.length === 0) {
      await interaction.reply({
        content: '❌ Cette commande ne peut être utilisée que dans un ticket.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const transcript = await TicketManager.generateTranscript(
        interaction.channel!,
        ticket[0],
        context
      );

      const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), {
        name: `ticket-${ticket[0].ticket_number}-transcript.html`,
      });

      await interaction.editReply({
        content: '✅ Transcript généré !',
        files: [attachment],
      });
    } catch (error) {
      await interaction.editReply('❌ Erreur lors de la génération du transcript.');
    }
  }
}
