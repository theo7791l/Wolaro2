import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class ClearCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprimer des messages')
    .addIntegerOption((option) =>
      option
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Supprimer uniquement les messages de cet utilisateur')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'moderation';
  permissions = [PermissionFlagsBits.ManageMessages];
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const amount = interaction.options.getInteger('nombre', true);
    const targetUser = interaction.options.getUser('utilisateur');

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel!.messages.fetch({ limit: 100 });
      
      let toDelete = messages.filter((msg) => {
        const isRecent = Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000; // 14 days
        const matchesUser = !targetUser || msg.author.id === targetUser.id;
        return isRecent && matchesUser;
      });

      toDelete = toDelete.first(amount);

      if (toDelete.size === 0) {
        await interaction.editReply('❌ Aucun message trouvé à supprimer.');
        return;
      }

      await interaction.channel!.bulkDelete(toDelete, true);

      await interaction.editReply(
        `✅ ${toDelete.size} message(s) supprimé(s)${targetUser ? ` de **${targetUser.tag}**` : ''}.`
      );

      // Log action
      await context.database.logAction(interaction.user.id, 'MESSAGES_CLEARED', {
        count: toDelete.size,
        targetUser: targetUser?.id,
        channelId: interaction.channelId,
      }, interaction.guildId!);
    } catch (error) {
      await interaction.editReply('❌ Impossible de supprimer les messages.');
    }
  }
}
