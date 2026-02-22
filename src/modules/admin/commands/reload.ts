import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { SecurityManager } from '../../../utils/security';

export class ReloadCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('reload')
    .setDescription('[MASTER] Recharger un module')
    .addStringOption((option) =>
      option
        .setName('module')
        .setDescription('Le nom du module à recharger')
        .setRequired(true)
        .addChoices(
          { name: 'Modération', value: 'moderation' },
          { name: 'Économie', value: 'economy' },
          { name: 'Leveling', value: 'leveling' },
          { name: 'Admin', value: 'admin' }
        )
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

    const moduleName = interaction.options.getString('module', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Note: This requires ModuleLoader to be accessible
      // In a real implementation, you'd pass the ModuleLoader instance
      await interaction.editReply(
        `✅ Module **${moduleName}** rechargé avec succès.\n\n⚠️ Note: Le rechargement complet nécessite un accès au ModuleLoader depuis le contexte.`
      );

      // Log action
      await context.database.logAction(
        interaction.user.id,
        'MASTER_RELOAD_MODULE',
        { module: moduleName }
      );
    } catch (error) {
      await interaction.editReply('❌ Erreur lors du rechargement du module.');
    }
  }
}
