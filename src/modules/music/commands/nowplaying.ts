import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { getPlayer } from '../utils/player';
import { logger } from '../../../utils/logger';

export class NowPlayingCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Afficher la musique en cours de lecture') as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 3;

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

      const embed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('🎵 Lecture en cours')
        .setDescription(`**${current.info.title}**`)
        .addFields(
          { name: '⏱️ Durée', value: current.info.duration, inline: true },
          { name: '👤 Chaîne', value: current.info.uploader, inline: true },
          { name: '🎶 Demandé par', value: `<@${current.requestedBy}>`, inline: true }
        )
        .setTimestamp();

      const queue = player.getQueue();
      if (queue.length > 0) {
        embed.setFooter({ text: `${queue.length} titre(s) en attente` });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error: any) {
      logger.error('Error in nowplaying command:', error);
      await interaction.reply({
        content: '❌ Erreur lors de l\'affichage de la musique en cours.',
        ephemeral: true,
      });
    }
  }
}
