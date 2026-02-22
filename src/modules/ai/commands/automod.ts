import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class AutoModCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configurer l\'auto-modération IA')
    .addBooleanOption((option) =>
      option
        .setName('activer')
        .setDescription('Activer/désactiver l\'auto-modération')
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName('seuil')
        .setDescription('Seuil de toxicité (0.0-1.0, défaut: 0.8)')
        .setMinValue(0)
        .setMaxValue(1)
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'ai';
  permissions = [PermissionFlagsBits.Administrator];
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const enable = interaction.options.getBoolean('activer', true);
    const threshold = interaction.options.getNumber('seuil') || 0.8;

    try {
      await context.database.query(
        `UPDATE guild_modules
         SET config = jsonb_set(
           jsonb_set(config, '{autoModEnabled}', $3::jsonb),
           '{autoModThreshold}', $4::jsonb
         )
         WHERE guild_id = $1 AND module_name = 'ai'`,
        [interaction.guildId!, 'ai', enable, threshold]
      );

      await context.redis.invalidateGuildConfig(interaction.guildId!);

      await interaction.reply(
        `✅ Auto-modération IA **${enable ? 'activée' : 'désactivée'}**.\n` +
        (enable ? `Seuil de toxicité: **${threshold}**` : '')
      );
    } catch (error) {
      await interaction.reply({
        content: '❌ Erreur lors de la configuration.',
        ephemeral: true,
      });
    }
  }
}
