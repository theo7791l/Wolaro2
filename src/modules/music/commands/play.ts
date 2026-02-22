import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

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
      const queue = MusicQueue.get(interaction.guildId!);

      // Check if bot is in voice channel
      if (!queue) {
        // Create new queue and join voice
        await MusicQueue.create(
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
      const currentQueue = MusicQueue.get(interaction.guildId!);
      if (!currentQueue) {
        await interaction.editReply('❌ Erreur lors de la création de la queue.');
        return;
      }

      currentQueue.addTrack({
        title: track.title,
        url: track.url,
        duration: track.duration,
        thumbnail: track.thumbnail,
        requester: interaction.user.id,
      });

      if (currentQueue.isPlaying()) {
        await interaction.editReply(
          `✅ **${track.title}** ajouté à la queue (Position: ${currentQueue.tracks.length})`
        );
      } else {
        await interaction.editReply(`🎵 Lecture en cours: **${track.title}**`);
        await currentQueue.play();
      }
    } catch (error) {
      await interaction.editReply('❌ Erreur lors de la lecture de la musique.');
    }
  }

  private async searchTrack(query: string): Promise<any> {
    // Mock implementation - Replace with real YouTube/Spotify API
    return {
      title: query,
      url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      duration: 213,
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    };
  }
}
