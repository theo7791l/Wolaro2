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
        content: '\u274c La queue est vide.'
      });
      return;
    }

    const current = queue.currentTrack;
    const upcoming = queue.tracks.slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('\ud83c\udfb5 Queue de musique')
      .setTimestamp();

    if (current) {
      embed.addFields({
        name: '\ud83c\udfb6 En cours',
        value: `[${current.title}](${current.url})\nDemand\u00e9 par: <@${current.requester}>`,
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
        name: `\ud83d\udccb \u00c0 venir (${queue.tracks.length} total)`,
        value: queueList,
        inline: false,
      });
    }

    const totalDuration = queue.tracks.reduce((acc, track) => acc + track.duration, 0);
    const minutes = Math.floor(totalDuration / 60);
    const seconds = totalDuration % 60;

    embed.setFooter({
      text: `Dur\u00e9e totale: ${minutes}m ${seconds}s | Volume: ${queue.volume}%`,
    });

    await interaction.reply({ embeds: [embed] });
  }
}
