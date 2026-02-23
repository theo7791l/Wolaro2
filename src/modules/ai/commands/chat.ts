import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

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
      // Get current config
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const aiModule = config?.modules?.find((m: any) => m.module_name === 'ai');

      if (!aiModule) {
        await interaction.reply({
          content: '❌ Le module IA n\'est pas activé sur ce serveur.',
          ephemeral: true,
        });
        return;
      }

      let chatChannels = aiModule.config?.chatChannels || [];

      if (enable) {
        if (!chatChannels.includes(interaction.channelId)) {
          chatChannels.push(interaction.channelId);
        }
      } else {
        chatChannels = chatChannels.filter((id: string) => id !== interaction.channelId);
      }

      // Update config
      await context.database.query(
        `UPDATE guild_modules
         SET config = jsonb_set(config, '{chatChannels}', $3::jsonb)
         WHERE guild_id = $1 AND module_name = 'ai'`,
        [interaction.guildId!, 'ai', JSON.stringify(chatChannels)]
      );

      // Invalidate cache
      await context.redis.invalidateGuildConfig(interaction.guildId!);

      await interaction.reply(
        enable
          ? `✅ Chat IA activé dans ce salon. Le bot répondra automatiquement aux messages.`
          : `❌ Chat IA désactivé dans ce salon.`
      );
    } catch (error) {
      await interaction.reply({
        content: '❌ Erreur lors de la configuration du chat IA.',
        ephemeral: true,
      });
    }
  }
}
