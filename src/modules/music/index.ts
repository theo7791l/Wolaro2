import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { PlayCommand } from './commands/play';
import { StopCommand } from './commands/stop';
import { SkipCommand } from './commands/skip';
import { QueueCommand } from './commands/queue';
import { NowPlayingCommand } from './commands/nowplaying';
import { VolumeCommand } from './commands/volume';
import { z } from 'zod';

export const MusicConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxQueueSize: z.number().min(10).max(1000).default(100),
  defaultVolume: z.number().min(1).max(100).default(50),
  allowFilters: z.boolean().default(true),
  djRole: z.string().optional(),
  djOnlyMode: z.boolean().default(false),
  autoLeave: z.boolean().default(true),
  autoLeaveTimeout: z.number().min(60).max(3600).default(300),
});

export default class MusicModule implements IModule {
  name = 'music';
  description = 'Lecteur de musique avec support YouTube, Spotify et SoundCloud';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = MusicConfigSchema;
  defaultConfig = {
    enabled: true,
    maxQueueSize: 100,
    defaultVolume: 50,
    allowFilters: true,
    djOnlyMode: false,
    autoLeave: true,
    autoLeaveTimeout: 300,
  };

  commands = [
    new PlayCommand(),
    new StopCommand(),
    new SkipCommand(),
    new QueueCommand(),
    new NowPlayingCommand(),
    new VolumeCommand(),
  ];

  events = [];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
