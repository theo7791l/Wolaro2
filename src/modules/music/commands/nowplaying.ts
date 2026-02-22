import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

export class NowPlayingCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Voir la musique en cours') as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, _context: ICommandContext): Promise<void> {
    const queue = MusicQueue.get(interaction.guildId!);

    if (!queue || !queue.isPlaying() || !queue.currentTrack) {
      await interaction.reply({
        content: '❌ Aucune musique en cours.',
        ephemeral: true,
      });
      return;
    }

    const track = queue.currentTrack;
    const minutes = Math.floor(track.duration / 60);
    const seconds = track.duration % 60;

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🎵 En cours de lecture')
      .setDescription(`[${track.title}](${track.url})`)
      .addFields(
        { name: 'Durée', value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true },
        { name: 'Demandé par', value: `<@${track.requester}>`, inline: true },
        { name: 'Volume', value: `${queue.volume}%`, inline: true }
      )
      .setThumbnail(track.thumbnail || null)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
