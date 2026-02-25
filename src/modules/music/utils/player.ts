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
} from '@discordjs/voice';
import { VoiceBasedChannel } from 'discord.js';
import play from 'play-dl';
import { logger } from '../../../utils/logger';
import { NewPipeAudioInfo, newpipe } from './newpipe';

export interface QueueItem {
  info: NewPipeAudioInfo;
  requestedBy: string;
}

export class MusicPlayer {
  private player: AudioPlayer;
  private connection: VoiceConnection | null = null;
  private queue: QueueItem[] = [];
  private currentTrack: QueueItem | null = null;
  private isPlaying: boolean = false;

  constructor() {
    this.player = createAudioPlayer();
    this.setupPlayerEvents();
  }

  private setupPlayerEvents() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      logger.debug('Player is idle, playing next track');
      this.isPlaying = false;
      this.playNext();
    });

    this.player.on(AudioPlayerStatus.Playing, () => {
      logger.info(`Now playing: ${this.currentTrack?.info.title}`);
      this.isPlaying = true;
    });

    this.player.on('error', (error) => {
      logger.error('Audio player error:', error);
      this.isPlaying = false;
      this.playNext();
    });
  }

  /**
   * Rejoindre un salon vocal
   */
  async join(channel: VoiceBasedChannel): Promise<VoiceConnection> {
    try {
      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
      });

      // Gérer les événements de connexion
      this.connection.on('stateChange', (oldState, newState) => {
        logger.debug(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
      });

      this.connection.on('error', (error) => {
        logger.error('Voice connection error:', error);
      });

      // Attendre que la connexion soit prête
      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 30000);
      } catch (error) {
        logger.error('Failed to enter Ready state:', error);
        throw new Error('Timeout lors de la connexion au salon vocal');
      }

      // S'abonner au player
      this.connection.subscribe(this.player);

      logger.info(`Joined voice channel: ${channel.name}`);
      return this.connection;
    } catch (error: any) {
      logger.error('Failed to join voice channel:', error);
      
      // Nettoyer la connexion en cas d'erreur
      if (this.connection) {
        this.connection.destroy();
        this.connection = null;
      }
      
      // Message d'erreur plus détaillé
      if (error.message?.includes('encryption')) {
        throw new Error('Erreur de chiffrement vocal. Installez sodium ou libsodium-wrappers.');
      }
      
      throw new Error(`Impossible de rejoindre le salon vocal: ${error.message}`);
    }
  }

  /**
   * Ajouter une piste à la queue
   */
  async addToQueue(videoUrl: string, requestedBy: string): Promise<QueueItem> {
    try {
      // Extraire les infos audio
      const audioInfo = await newpipe.getAudioUrl(videoUrl);

      const item: QueueItem = {
        info: audioInfo,
        requestedBy,
      };

      this.queue.push(item);
      logger.info(`Added to queue: ${audioInfo.title}`);

      // Si rien n'est en lecture, commencer
      if (!this.isPlaying) {
        this.playNext();
      }

      return item;
    } catch (error: any) {
      logger.error('Failed to add to queue:', error);
      throw new Error(`Impossible d'ajouter à la queue: ${error.message}`);
    }
  }

  /**
   * Jouer la prochaine piste
   */
  private async playNext() {
    if (this.queue.length === 0) {
      this.currentTrack = null;
      logger.debug('Queue is empty');
      return;
    }

    const item = this.queue.shift()!;
    this.currentTrack = item;

    try {
      logger.info(`Playing next track: ${item.info.title}`);
      
      // Obtenir le stream audio depuis YouTube via play-dl
      const stream = await play.stream(item.info.url, {
        quality: 2, // Haute qualité audio
      });

      // Créer une ressource audio depuis le stream
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });

      // Définir le volume par défaut
      resource.volume?.setVolume(0.5);

      this.player.play(resource);
    } catch (error: any) {
      logger.error('Failed to play track:', error);
      
      // Essayer la suivante si disponible
      if (this.queue.length > 0) {
        logger.info('Trying next track in queue...');
        this.playNext();
      } else {
        this.currentTrack = null;
      }
    }
  }

  /**
   * Passer à la piste suivante
   */
  skip() {
    this.player.stop();
  }

  /**
   * Arrêter la lecture et vider la queue
   */
  stop() {
    this.player.stop();
    this.queue = [];
    this.currentTrack = null;
  }

  /**
   * Quitter le salon vocal
   */
  disconnect() {
    this.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  /**
   * Changer le volume (0.0 à 1.0)
   */
  setVolume(volume: number) {
    // Volume sera appliqué à la prochaine ressource
    // Pour la piste actuelle, on ne peut pas changer dynamiquement
    logger.info(`Volume set to: ${volume}`);
  }

  /**
   * Obtenir la piste actuelle
   */
  getCurrentTrack(): QueueItem | null {
    return this.currentTrack;
  }

  /**
   * Obtenir la queue
   */
  getQueue(): QueueItem[] {
    return this.queue;
  }

  /**
   * Vérifier si le player est connecté
   */
  isConnected(): boolean {
    return this.connection !== null && this.connection.state.status !== VoiceConnectionStatus.Destroyed;
  }
}

// Gestionnaire de players par guild
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
