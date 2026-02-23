import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';
import * as play from 'play-dl';
import { logger } from '../../../utils/logger';

export class PlayCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer une musique depuis YouTube, Spotify ou SoundCloud')
    .addStringOption((option) =>
      option
        .setName('recherche')
        .setDescription('URL ou terme de recherche')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Vous devez être dans un salon vocal pour utiliser cette commande.',
        ephemeral: true,
      });
      return;
    }

    const query = interaction.options.getString('recherche', true);

    await interaction.deferReply();

    try {
      // Get or create queue for this guild
      let queue = MusicQueue.get(interaction.guildId!);

      // Check if bot is in voice channel
      if (!queue) {
        // Create new queue and join voice
        queue = await MusicQueue.create(
          interaction.guildId!,
          voiceChannel.id,
          interaction.channel!.id,
          context.client
        );
      }

      // Search for track
      const track = await this.searchTrack(query);

      if (!track) {
        await interaction.editReply('❌ Aucun résultat trouvé.');
        return;
      }

      // Add to queue
      queue.addTrack({
        title: track.title,
        url: track.url,
        duration: track.duration,
        thumbnail: track.thumbnail,
        requester: interaction.user.id,
      });

      if (queue.isPlaying()) {
        await interaction.editReply(
          `✅ **${track.title}** ajouté à la queue (Position: ${queue.tracks.length})`
        );
      } else {
        await interaction.editReply(`🎵 Lecture en cours: **${track.title}**`);
        await queue.play();
      }
    } catch (error) {
      logger.error('Error in play command:', error);
      await interaction.editReply('❌ Erreur lors de la lecture de la musique.');
    }
  }

  private async searchTrack(query: string): Promise<any> {
    try {
      // Check if it's a URL
      if (play.yt_validate(query) === 'video') {
        const info = await play.video_info(query);
        return {
          title: info.video_details.title || 'Unknown',
          url: info.video_details.url,
          duration: info.video_details.durationInSec,
          thumbnail: info.video_details.thumbnails[0]?.url || '',
        };
      } else if (play.yt_validate(query) === 'playlist') {
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        if (videos.length > 0) {
          const firstVideo = videos[0];
          return {
            title: firstVideo.title || 'Unknown',
            url: firstVideo.url,
            duration: firstVideo.durationInSec,
            thumbnail: firstVideo.thumbnails[0]?.url || '',
          };
        }
      } else if (play.sp_validate(query)) {
        // Spotify URL
        const spotifyData = await play.spotify(query);
        if (spotifyData.type === 'track') {
          // Search for the track on YouTube
          const searchQuery = `${spotifyData.name} ${(spotifyData as any).artists?.map((a: any) => a.name).join(' ')}`;
          const searched = await play.search(searchQuery, { limit: 1 });
          if (searched.length > 0) {
            return {
              title: searched[0].title || 'Unknown',
              url: searched[0].url,
              duration: searched[0].durationInSec,
              thumbnail: searched[0].thumbnails[0]?.url || '',
            };
          }
        }
      } else {
        // Search YouTube
        const searched = await play.search(query, { limit: 1 });
        if (searched.length > 0) {
          return {
            title: searched[0].title || 'Unknown',
            url: searched[0].url,
            duration: searched[0].durationInSec,
            thumbnail: searched[0].thumbnails[0]?.url || '',
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error searching track:', error);
      return null;
    }
  }
}
