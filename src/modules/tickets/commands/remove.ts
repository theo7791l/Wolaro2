import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class RemoveUserCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('ticketremove')
    .setDescription('Retirer un utilisateur du ticket')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur à retirer')
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
        content: '❌ Cette commande ne peut être utilisée que dans un ticket.',
        ephemeral: true,
      });
      return;
    }

    if (user.id === ticket[0].user_id) {
      await interaction.reply({
        content: '❌ Vous ne pouvez pas retirer le créateur du ticket.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.channel?.permissionOverwrites.delete(user.id);
      await interaction.reply(`✅ ${user} a été retiré du ticket.`);
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de retirer l\'utilisateur.',
        ephemeral: true,
      });
    }
  }
}
