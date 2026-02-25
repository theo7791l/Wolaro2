import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class AddUserCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('ticketadd')
    .setDescription('Ajouter un utilisateur au ticket')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur \u00e0 ajouter')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'tickets';
  permissions = [PermissionFlagsBits.ManageChannels];
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const user = interaction.options.getUser('utilisateur', true);

    // Check if in ticket channel
    const ticket = await context.database.query(
      'SELECT * FROM tickets WHERE guild_id = $1 AND channel_id = $2 AND status = $3',
      [interaction.guildId!, interaction.channelId, 'open']
    );

    if (ticket.length === 0) {
      await interaction.reply({
        content: '\u274c Cette commande ne peut \u00eatre utilis\u00e9e que dans un ticket.'
      });
      return;
    }

    try {
      await (interaction.channel as TextChannel)?.permissionOverwrites.create(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      await interaction.reply(`\u2705 ${user} a \u00e9t\u00e9 ajout\u00e9 au ticket.`);
    } catch (error) {
      await interaction.reply({
        content: '\u274c Impossible d\'ajouter l\'utilisateur.'
      });
    }
  }
}
