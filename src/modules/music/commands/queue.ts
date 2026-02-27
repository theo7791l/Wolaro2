import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { getPlayer } from '../utils/player';
import { logger } from '../../../utils/logger';

export class QueueCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Afficher la file d\'attente de musique') as SlashCommandBuilder;

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
      const queue = player.getQueue();

      const embed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('🎵 File d\'attente de musique')
        .setTimestamp();

      // Musique actuelle
      if (current) {
        embed.addFields({
          name: '🎶 En cours de lecture',
          value: `**${current.info.title}**\n⏱️ ${current.info.duration} | 👤 <@${current.requestedBy}>`,
        });
      }

      // File d'attente
      if (queue.length > 0) {
        const queueList = queue
          .slice(0, 10) // Limiter à 10 pour ne pas surcharger l'embed
          .map((track, index) => 
            `**${index + 1}.** ${track.info.title}\n⏱️ ${track.info.duration} | 👤 <@${track.requestedBy}>`
          )
          .join('\n\n');

        embed.addFields({
          name: `📋 Suivant (${queue.length} titre${queue.length > 1 ? 's' : ''})`,
          value: queueList,
        });

        if (queue.length > 10) {
          embed.setFooter({ text: `Et ${queue.length - 10} autre(s) titre(s)...` });
        }
      } else {
        embed.addFields({
          name: '📋 File d\'attente',
          value: 'Aucune musique en attente',
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error: any) {
      logger.error('Error in queue command:', error);
      await interaction.reply({
        content: '❌ Erreur lors de l\'affichage de la file d\'attente.',
        ephemeral: true,
      });
    }
  }
}
