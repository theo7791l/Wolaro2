import { Client, VoiceBasedChannel } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnection,
  AudioPlayer,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import * as play from 'play-dl';
import { logger } from '../../../utils/logger';

interface Track {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requester: string;
}

export class MusicQueue {
  private static queues = new Map<string, MusicQueue>();

  public tracks: Track[] = [];
  public currentTrack: Track | null = null;
  public volume: number = 50;
  private playing: boolean = false;
  private voiceChannelId: string;
  private textChannelId: string;
  private client: Client;
  private connection: VoiceConnection | null = null;
  private player: AudioPlayer | null = null;

  private constructor(
    public guildId: string,
    voiceChannelId: string,
    textChannelId: string,
    client: Client,
  ) {
    this.voiceChannelId = voiceChannelId;
    this.textChannelId = textChannelId;
    this.client = client;
  }

  static async create(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string,
    client: Client,
  ): Promise<MusicQueue> {
    const queue = new MusicQueue(guildId, voiceChannelId, textChannelId, client);

    // Get the voice channel
    const channel = await client.channels.fetch(voiceChannelId) as VoiceBasedChannel;

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    // Create audio player
    const player = createAudioPlayer();
    connection.subscribe(player);

    queue.connection = connection;
    queue.player = player;

    // Set up player event listeners
    player.on(AudioPlayerStatus.Idle, () => {
      logger.info(`Finished playing track in guild ${guildId}`);
      queue.playNext();
    });

    player.on('error', (error) => {
      logger.error('Audio player error:', error);
      queue.playNext();
    });

    // Handle voice connection state changes
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        logger.warn(`Voice connection lost for guild ${guildId}`);
        queue.destroy();
      }
    });

    MusicQueue.queues.set(guildId, queue);
    return queue;
  }

  static get(guildId: string): MusicQueue | undefined {
    return MusicQueue.queues.get(guildId);
  }

  static delete(guildId: string): void {
    const queue = MusicQueue.queues.get(guildId);
    if (queue) {
      queue.destroy();
    }
    MusicQueue.queues.delete(guildId);
  }

  addTrack(track: Track): void {
    this.tracks.push(track);
  }

  async play(): Promise<void> {
    if (this.tracks.length === 0) {
      this.playing = false;
      this.currentTrack = null;
      return;
    }

    this.currentTrack = this.tracks.shift()!;
    this.playing = true;

    try {
      logger.info(`Playing: ${this.currentTrack.title} in guild ${this.guildId}`);

      // Get audio stream from play-dl
      const stream = await play.stream(this.currentTrack.url);

      // Create audio resource
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });

      // Set volume
      if (resource.volume) {
        resource.volume.setVolume(this.volume / 100);
      }

      // Play the resource
      if (this.player) {
        this.player.play(resource);
      }
    } catch (error) {
      logger.error('Error playing track:', error);
      this.playing = false;
      this.playNext();
    }
  }

  private playNext(): void {
    if (this.tracks.length > 0) {
      this.play();
    } else {
      this.playing = false;
      this.currentTrack = null;

      // Auto-leave after timeout if configured
      setTimeout(() => {
        if (!this.isPlaying() && this.tracks.length === 0) {
          this.destroy();
        }
      }, 300000); // 5 minutes
    }
  }

  skip(): boolean {
    if (this.player) {
      this.player.stop();
      return true;
    }
    return false;
  }

  stop(): void {
    this.tracks = [];
    this.currentTrack = null;
    this.playing = false;

    if (this.player) {
      this.player.stop();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(1, Math.min(100, volume));

    // Update current playing track volume if available
    if (this.player && this.player.state.status === AudioPlayerStatus.Playing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resource = (this.player.state as any).resource;
      if (resource && resource.volume) {
        resource.volume.setVolume(this.volume / 100);
      }
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  destroy(): void {
    this.stop();

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }

    if (this.player) {
      this.player.stop();
      this.player = null;
    }

    MusicQueue.queues.delete(this.guildId);
    logger.info(`Destroyed queue for guild ${this.guildId}`);
  }
}
