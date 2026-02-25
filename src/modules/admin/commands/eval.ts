import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { SecurityManager } from '../../../utils/security';
import util from 'util';
import vm from 'vm';

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
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const code = interaction.options.getString('code', true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Créer un sandbox sécurisé
      const sandbox = {
        interaction,
        context,
        client: context.client,
        console: console,
        util: util,
        // Ne pas exposer process, require, __dirname, etc.
      };

      // Exécuter dans un contexte isolé avec timeout
      let evaled = vm.runInNewContext(code, sandbox, {
        timeout: 5000, // 5 secondes max
        displayErrors: true,
      });

      if (typeof evaled !== 'string') {
        evaled = util.inspect(evaled, { depth: 0 });
      }

      // Filtrer les tokens et secrets sensibles
      evaled = String(evaled)
        .replace(/[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g, '[DISCORD_TOKEN]')
        .replace(/[A-Za-z0-9]{64}/g, '[SECRET_KEY]')
        .replace(/postgresql:\/\/[^\s]+/g, '[DATABASE_URL]');

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
      const errorMsg = error.message || 'Unknown error';
      await interaction.editReply({
        content: `❌ **Error:**\n\`\`\`js\n${errorMsg}\n\`\`\``,
      });
    }
  }
}
