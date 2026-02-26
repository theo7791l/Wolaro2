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
        selfDeaf: true, // Se mettre sourd pour éviter de recevoir l'audio des autres
        selfMute: false, // Ne pas se mute pour pouvoir parler (jouer de la musique)
      });

      // Gérer la reconnexion automatique
      this.connection.on('stateChange', async (oldState, newState) => {
        logger.debug(`Voice connection state: ${oldState.status} -> ${newState.status}`);

        // Gestion de la reconnexion si Disconnected
        if (newState.status === VoiceConnectionStatus.Disconnected) {
          try {
            await Promise.race([
              entersState(this.connection!, VoiceConnectionStatus.Signalling, 5000),
              entersState(this.connection!, VoiceConnectionStatus.Connecting, 5000),
            ]);
            // Semble pouvoir se reconnecter, attendre qu'il se reconnecte
          } catch {
            // Impossible de se reconnecter, détruire la connexion
            logger.warn('Failed to reconnect, destroying connection');
            this.connection?.destroy();
            this.connection = null;
          }
        } else if (newState.status === VoiceConnectionStatus.Destroyed) {
          // Connexion détruite, nettoyer
          logger.warn('Connection destroyed');
          this.stop();
          this.connection = null;
        } else if (
          !this.readyLock &&
          (newState.status === VoiceConnectionStatus.Connecting ||
            newState.status === VoiceConnectionStatus.Signalling)
        ) {
          // En train de se connecter, verrouiller et attendre Ready
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

      // Attendre l'état Ready avec timeout réduit à 15 secondes
      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 15000);
        logger.info(`✅ Successfully joined voice channel: ${channel.name}`);
      } catch (error) {
        logger.error('Failed to enter Ready state after 15s:', error);
        
        // Essayer de se connecter quand même si on est en Connecting
        if (this.connection.state.status === VoiceConnectionStatus.Connecting) {
          logger.warn('Still connecting, waiting 5 more seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          if (this.connection.state.status !== VoiceConnectionStatus.Ready) {
            throw new Error('Timeout lors de la connexion au salon vocal (20s)');
          }
        } else {
          throw new Error('Timeout lors de la connexion au salon vocal (15s)');
        }
      }

      // S'abonner au player
      this.connection.subscribe(this.player);

      return this.connection;
    } catch (error: any) {
      logger.error('Failed to join voice channel:', error);
      
      // Nettoyer la connexion en cas d'erreur
      if (this.connection) {
        try {
          this.connection.destroy();
        } catch (e) {
          // Ignorer les erreurs de destruction
        }
        this.connection = null;
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
      if (!this.isPlaying && !this.currentTrack) {
        await this.playNext();
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
      this.currentResource = null;
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

      // Appliquer le volume actuel
      resource.volume?.setVolume(this.volume);
      this.currentResource = resource;

      this.player.play(resource);
    } catch (error: any) {
      logger.error('Failed to play track:', error);
      
      // Essayer la suivante si disponible
      if (this.queue.length > 0) {
        logger.info('Trying next track in queue...');
        await this.playNext();
      } else {
        this.currentTrack = null;
        this.currentResource = null;
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
    this.currentResource = null;
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
   * S'applique immédiatement à la piste actuelle ET aux prochaines
   */
  setVolume(volume: number) {
    // Limiter le volume entre 0.0 et 1.0
    this.volume = Math.max(0.0, Math.min(1.0, volume));
    logger.info(`Volume set to: ${this.volume * 100}%`);

    // Appliquer le volume à la ressource actuelle si elle existe
    if (this.currentResource && this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.volume);
      logger.info('Volume applied to current track');
    }
  }

  /**
   * Obtenir le volume actuel (0.0 à 1.0)
   */
  getVolume(): number {
    return this.volume;
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
