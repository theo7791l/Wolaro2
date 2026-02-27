import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { getPlayer } from '../utils/player';
import { logger } from '../../../utils/logger';

export class SkipCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Passer à la musique suivante') as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 2;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Vous devez être dans un salon vocal.',
        ephemeral: true,
      });
      return;
    }

    try {
      const player = getPlayer(interaction.guildId!);

      if (!player.isConnected()) {
        await interaction.reply({
          content: '❌ Aucune musique en cours de lecture.',
          ephemeral: true,
        });
        return;
      }

      const current = player.getCurrentTrack();
      if (!current) {
        await interaction.reply({
          content: '❌ Aucune musique en cours de lecture.',
          ephemeral: true,
        });
        return;
      }

      player.skip();

      await interaction.reply(
        `⏩ **${current.info.title}** a été passée par <@${interaction.user.id}>`
      );
    } catch (error: any) {
      logger.error('Error in skip command:', error);
      await interaction.reply({
        content: '❌ Erreur lors du passage à la musique suivante.',
        ephemeral: true,
      });
    }
  }
}
