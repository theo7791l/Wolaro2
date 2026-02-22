import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class LockdownCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Verrouiller ou déverrouiller un salon')
    .addBooleanOption((option) =>
      option
        .setName('activer')
        .setDescription('Activer (true) ou désactiver (false) le lockdown')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('La raison du lockdown')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'moderation';
  permissions = [PermissionFlagsBits.ManageChannels];
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const enable = interaction.options.getBoolean('activer', true);
    const reason = interaction.options.getString('raison') || 'Lockdown automatique';

    await interaction.deferReply();

    try {
      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply('❌ Cette commande ne peut être utilisée que dans un salon textuel.');
        return;
      }

      await channel.permissionOverwrites.edit(interaction.guildId!, {
        SendMessages: !enable,
      });

      await interaction.editReply(
        enable
          ? `🔒 **Salon verrouillé**\n${reason}`
          : `🔓 **Salon déverrouillé**\n${reason}`
      );

      // Log action
      await context.database.logAction(interaction.user.id, enable ? 'CHANNEL_LOCKDOWN' : 'CHANNEL_UNLOCK', {
        channelId: channel.id,
        reason,
      }, interaction.guildId!);
    } catch (error) {
      await interaction.editReply('❌ Impossible de modifier les permissions du salon.');
    }
  }
}
