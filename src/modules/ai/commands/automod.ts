import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { logger } from '../../../utils/logger.js';

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
      // Ensure guild exists first
      await context.database.query(
        `INSERT INTO guilds (guild_id, owner_id)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO NOTHING`,
        [interaction.guildId!, interaction.guild!.ownerId]
      );

      // Insert or update the AI module configuration
      await context.database.query(
        `INSERT INTO guild_modules (guild_id, module_name, enabled, config)
         VALUES ($1, 'ai', true, $2::jsonb)
         ON CONFLICT (guild_id, module_name)
         DO UPDATE SET
           config = jsonb_set(
             jsonb_set(COALESCE(guild_modules.config, '{}'::jsonb), '{autoModEnabled}', to_jsonb($3::boolean)),
             '{autoModThreshold}', to_jsonb($4::numeric)
           ),
           updated_at = NOW()`,
        [
          interaction.guildId!,
          JSON.stringify({ autoModEnabled: enable, autoModThreshold: threshold }),
          enable,
          threshold,
        ]
      );

      await context.redis.invalidateGuildConfig(interaction.guildId!);

      await interaction.reply(
        `✅ Auto-modération IA **${enable ? 'activée' : 'désactivée'}**.\n` +
          (enable ? `Seuil de toxicité: **${threshold}**` : '')
      );

      logger.info(`Automod ${enable ? 'enabled' : 'disabled'} in guild ${interaction.guildId} by ${interaction.user.tag}`);
    } catch (error) {
      logger.error('Error configuring automod:', error);
      await interaction.reply({
        content: '❌ Erreur lors de la configuration.',
        flags: ['Ephemeral'],
      });
    }
  }
}
