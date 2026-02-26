import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  StreamType,
  AudioResource,
} from '@discordjs/voice';
import { VoiceBasedChannel } from 'discord.js';
import play from 'play-dl';
import { logger } from '../../../utils/logger';
import { NewPipeAudioInfo, newpipe } from './newpipe';

// Configurer FFmpeg avec ffmpeg-static via variable d'environnement
try {
  const ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    process.env.FFMPEG_PATH = ffmpegStatic;
    logger.info(`🎵 FFmpeg configured: ${ffmpegStatic}`);
  }
} catch (error) {
  logger.warn('⚠️ ffmpeg-static not found, using system FFmpeg');
}

export interface QueueItem {
  info: NewPipeAudioInfo;
  requestedBy: string;
}

export class MusicPlayer {
  private player: AudioPlayer;
  private connection: VoiceConnection | null = null;
  private queue: QueueItem[] = [];
  private currentTrack: QueueItem | null = null;
  private currentResource: AudioResource | null = null;
  private isPlaying: boolean = false;
  private readyLock = false;
  private volume: number = 0.5; // Volume par défaut (50%)

  constructor() {
    this.player = createAudioPlayer();
    this.setupPlayerEvents();
  }

  private setupPlayerEvents() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      logger.debug('Player is idle, playing next track');
      this.isPlaying = false;
      this.currentResource = null;
      this.playNext();
    });

    this.player.on(AudioPlayerStatus.Playing, () => {
      logger.info(`Now playing: ${this.currentTrack?.info.title}`);
      this.isPlaying = true;
    });

    this.player.on('error', (error) => {
      logger.error('Audio player error:', error);
      this.isPlaying = false;
      this.currentResource = null;
      this.playNext();
    });
  }

  /**
   * Rejoindre un salon vocal avec gestion anti-timeout
   */
  async join(channel: VoiceBasedChannel): Promise<VoiceConnection> {
    try {
      logger.info(`Attempting to join voice channel: ${channel.name}`);

      // Si déjà connecté, ne pas recréer la connexion
      if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        logger.info('Already connected, reusing existing connection');
        return this.connection;
      }

      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
        selfDeaf: true,
        selfMute: false,
      });

      // Gérer la reconnexion automatique
      this.connection.on('stateChange', async (oldState, newState) => {
        logger.debug(`Voice connection state: ${oldState.status} -> ${newState.status}`);

        if (newState.status === VoiceConnectionStatus.Disconnected) {
          try {
            await Promise.race([
              entersState(this.connection!, VoiceConnectionStatus.Signalling, 5000),
              entersState(this.connection!, VoiceConnectionStatus.Connecting, 5000),
            ]);
          } catch {
            logger.warn('Failed to reconnect, destroying connection');
            this.connection?.destroy();
            this.connection = null;
          }
        } else if (newState.status === VoiceConnectionStatus.Destroyed) {
          logger.warn('Connection destroyed');
          this.stop();
          this.connection = null;
        } else if (
          !this.readyLock &&
          (newState.status === VoiceConnectionStatus.Connecting ||
            newState.status === VoiceConnectionStatus.Signalling)
        ) {
          this.readyLock = true;
          try {
            await entersState(this.connection!, VoiceConnectionStatus.Ready, 20000);
          } catch {
            if (this.connection?.state.status !== VoiceConnectionStatus.Destroyed) {
              this.connection?.destroy();
            }
            this.connection = null;
          } finally {
            this.readyLock = false;
          }
        }
      });

      this.connection.on('error', (error) => {
        logger.error('Voice connection error:', error);
      });

      // Timeout réduit à 8 secondes (Discord kick après ~10-15s)
      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 8000);
        logger.info(`✅ Successfully joined voice channel: ${channel.name}`);
      } catch (error) {
        logger.error('Failed to enter Ready state after 8s');
        
        const currentStatus = this.connection?.state.status;
        if (
          this.connection &&
          (currentStatus === VoiceConnectionStatus.Connecting ||
           currentStatus === VoiceConnectionStatus.Signalling)
        ) {
          logger.warn('Still connecting, waiting 2 more seconds...');
          
          try {
            await entersState(this.connection, VoiceConnectionStatus.Ready, 2000);
            logger.info(`✅ Successfully joined after extra wait`);
          } catch {
            throw new Error('Timeout connexion vocal (10s) - Vérifiez que le bot a les permissions');
          }
        } else {
          throw new Error('Impossible de se connecter au salon vocal');
        }
      }

      // S'abonner au player
      this.connection.subscribe(this.player);

      return this.connection;
    } catch (error: any) {
      logger.error('Failed to join voice channel:', error);
      
      if (this.connection) {
        try {
          this.connection.destroy();
        } catch (e) {
          // Ignorer
        }
        this.connection = null;
      }
      
      throw new Error(`Impossible de rejoindre le salon vocal: ${error.message}`);
    }
  }

  async addToQueue(videoUrl: string, requestedBy: string): Promise<QueueItem> {
    try {
      const audioInfo = await newpipe.getAudioUrl(videoUrl);

      const item: QueueItem = {
        info: audioInfo,
        requestedBy,
      };

      this.queue.push(item);
      logger.info(`Added to queue: ${audioInfo.title}`);

      if (!this.isPlaying && !this.currentTrack) {
        await this.playNext();
      }

      return item;
    } catch (error: any) {
      logger.error('Failed to add to queue:', error);
      throw new Error(`Impossible d'ajouter à la queue: ${error.message}`);
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.currentTrack = null;
      this.currentResource = null;
      logger.debug('Queue is empty');
      return;
    }

    const item = this.queue.shift()!;
    this.currentTrack = item;

    try {
      logger.info(`Playing next track: ${item.info.title}`);
      
      const stream = await play.stream(item.info.url, {
        quality: 2,
      });

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });

      resource.volume?.setVolume(this.volume);
      this.currentResource = resource;

      this.player.play(resource);
    } catch (error: any) {
      logger.error('Failed to play track:', error);
      
      if (this.queue.length > 0) {
        logger.info('Trying next track in queue...');
        await this.playNext();
      } else {
        this.currentTrack = null;
        this.currentResource = null;
      }
    }
  }

  skip() {
    this.player.stop();
  }

  stop() {
    this.player.stop();
    this.queue = [];
    this.currentTrack = null;
    this.currentResource = null;
  }

  disconnect() {
    this.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0.0, Math.min(1.0, volume));
    logger.info(`Volume set to: ${this.volume * 100}%`);

    if (this.currentResource && this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.volume);
      logger.info('Volume applied to current track');
    }
  }

  getVolume(): number {
    return this.volume;
  }

  getCurrentTrack(): QueueItem | null {
    return this.currentTrack;
  }

  getQueue(): QueueItem[] {
    return this.queue;
  }

  isConnected(): boolean {
    return this.connection !== null && this.connection.state.status !== VoiceConnectionStatus.Destroyed;
  }
}

const players = new Map<string, MusicPlayer>();

export function getPlayer(guildId: string): MusicPlayer {
  if (!players.has(guildId)) {
    players.set(guildId, new MusicPlayer());
  }
  return players.get(guildId)!;
}

export function deletePlayer(guildId: string) {
  const player = players.get(guildId);
  if (player) {
    player.disconnect();
    players.delete(guildId);
  }
}
