declare module '@apple502j/erela.js' {
  import { Client, User } from 'discord.js';

  export class Manager {
    constructor(options: ManagerOptions);
    players: Map<string, Player>;
    nodes: Map<string, any>;
    init(clientId: string): this;
    search(query: string, requester: User): Promise<SearchResult>;
    create(options: PlayerOptions): Player;
    destroy(guildId: string): void;
    updateVoiceState(data: any): void;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export interface ManagerOptions {
    nodes: NodeOptions[];
    send: (id: string, payload: any) => void;
    plugins?: any[];
  }

  export interface NodeOptions {
    host: string;
    port: number;
    password: string;
    secure?: boolean;
    identifier?: string;
  }

  export interface PlayerOptions {
    guild: string;
    voiceChannel: string;
    textChannel: string;
    selfDeafen?: boolean;
    selfMute?: boolean;
  }

  export interface Player {
    guild: string;
    voiceChannel: string;
    textChannel: string;
    queue: Queue;
    playing: boolean;
    paused: boolean;
    state: string;
    connect(): void;
    disconnect(): void;
    destroy(): void;
    play(): void;
    pause(pause: boolean): void;
    setVolume(volume: number): void;
    stop(): void;
  }

  export interface Queue {
    current: Track | null;
    size: number;
    add(track: Track | Track[]): void;
    remove(position: number): Track;
    clear(): void;
  }

  export interface Track {
    title: string;
    author: string;
    uri: string;
    duration: number;
    thumbnail: string;
    requester: User;
  }

  export interface SearchResult {
    loadType: 'TRACK_LOADED' | 'PLAYLIST_LOADED' | 'SEARCH_RESULT' | 'NO_MATCHES' | 'LOAD_FAILED';
    tracks: Track[];
    playlist?: {
      name: string;
      duration: number;
    };
  }
}
