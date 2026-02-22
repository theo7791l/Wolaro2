import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { SecurityManager } from '../../../utils/security';
import util from 'util';

export class EvalCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('eval')
    .setDescription('[MASTER] Exécuter du code JavaScript')
    .addStringOption((option) =>
      option
        .setName('code')
        .setDescription('Le code à exécuter')
        .setRequired(true)
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

    const code = interaction.options.getString('code', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      let evaled = eval(code);

      if (typeof evaled !== 'string') {
        evaled = util.inspect(evaled, { depth: 0 });
      }

      // Truncate if too long
      if (evaled.length > 1900) {
        evaled = evaled.substring(0, 1900) + '...';
      }

      await interaction.editReply({
        content: `✅ **Output:**\n\`\`\`js\n${evaled}\n\`\`\``,
      });

      // Log dangerous command
      await context.database.logAction(
        interaction.user.id,
        'MASTER_EVAL',
        { code: code.substring(0, 200) }
      );
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ **Error:**\n\`\`\`js\n${error.message}\n\`\`\``,
      });
    }
  }
}
