import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { logger } from '../../../utils/logger.js';

export class ChatCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('aichat')
    .setDescription('Activer/désactiver le chat IA dans ce salon')
    .addBooleanOption((option) =>
      option
        .setName('activer')
        .setDescription('Activer (true) ou désactiver (false) le chat IA')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'ai';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const enable = interaction.options.getBoolean('activer', true);

    try {
      // Ensure guild exists first
      await context.database.query(
        `INSERT INTO guilds (guild_id, owner_id)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO NOTHING`,
        [interaction.guildId!, interaction.guild!.ownerId]
      );

      // Get current config
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const aiModule = config?.modules?.find((m: any) => m.module_name === 'ai');

      let chatChannels = aiModule?.config?.chatChannels || [];

      if (enable) {
        if (!chatChannels.includes(interaction.channelId)) {
          chatChannels.push(interaction.channelId);
        }
      } else {
        chatChannels = chatChannels.filter((id: string) => id !== interaction.channelId);
      }

      // Insert or update the AI module configuration
      await context.database.query(
        `INSERT INTO guild_modules (guild_id, module_name, enabled, config)
         VALUES ($1, 'ai', true, $2::jsonb)
         ON CONFLICT (guild_id, module_name)
         DO UPDATE SET
           config = jsonb_set(
             COALESCE(guild_modules.config, '{}'::jsonb),
             '{chatChannels}',
             $2::jsonb
           ),
           updated_at = NOW()`,
        [interaction.guildId!, JSON.stringify(chatChannels)]
      );

      // Invalidate cache
      await context.redis.invalidateGuildConfig(interaction.guildId!);

      await interaction.reply(
        enable
          ? `✅ Chat IA activé dans ce salon. Le bot répondra automatiquement aux messages.`
          : `❌ Chat IA désactivé dans ce salon.`
      );

      logger.info(`AI chat ${enable ? 'enabled' : 'disabled'} in channel ${interaction.channelId} by ${interaction.user.tag}`);
    } catch (error) {
      logger.error('Error configuring AI chat:', error);
      await interaction.reply({
        content: '❌ Erreur lors de la configuration du chat IA.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
