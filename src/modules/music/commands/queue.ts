import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

export class QueueCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Voir la queue de musique') as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, _context: ICommandContext): Promise<void> {
    const queue = MusicQueue.get(interaction.guildId!);

    if (!queue || queue.tracks.length === 0) {
      await interaction.reply({
        content: '❌ La queue est vide.',
        ephemeral: true,
      });
      return;
    }

    const current = queue.currentTrack;
    const upcoming = queue.tracks.slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🎵 Queue de musique')
      .setTimestamp();

    if (current) {
      embed.addFields({
        name: '🎶 En cours',
        value: `[${current.title}](${current.url})\nDemandé par: <@${current.requester}>`,
        inline: false,
      });
    }

    if (upcoming.length > 0) {
      const queueList = upcoming
        .map((track, index) => {
          return `${index + 1}. [${track.title}](${track.url}) - <@${track.requester}>`;
        })
        .join('\n');

      embed.addFields({
        name: `📋 À venir (${queue.tracks.length} total)`,
        value: queueList,
        inline: false,
      });
    }

    const totalDuration = queue.tracks.reduce((acc, track) => acc + track.duration, 0);
    const minutes = Math.floor(totalDuration / 60);
    const seconds = totalDuration % 60;

    embed.setFooter({
      text: `Durée totale: ${minutes}m ${seconds}s | Volume: ${queue.volume}%`,
    });

    await interaction.reply({ embeds: [embed] });
  }
}
