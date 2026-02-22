import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { GiveawayCommand } from './commands/giveaway';
import { RerollCommand } from './commands/reroll';
import { EndCommand } from './commands/end';
import { ListCommand } from './commands/list';
import { GiveawayButtonHandler } from './events/giveaway-buttons';
import { GiveawayChecker } from './utils/checker';
import { z } from 'zod';

export const GiveawaysConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultDuration: z.number().min(60).max(604800).default(86400),
  pingRole: z.string().optional(),
  requireRole: z.string().optional(),
  minAccountAge: z.number().min(0).max(365).default(0),
  minServerJoinAge: z.number().min(0).max(365).default(0),
  embedColor: z.string().default('#FF0000'),
});

export default class GiveawaysModule implements IModule {
  name = 'giveaways';
  description = 'Système de giveaways/concours automatiques';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = GiveawaysConfigSchema;
  defaultConfig = {
    enabled: true,
    defaultDuration: 86400,
    minAccountAge: 0,
    minServerJoinAge: 0,
    embedColor: '#FF0000',
  };

  commands = [
    new GiveawayCommand(),
    new RerollCommand(),
    new EndCommand(),
    new ListCommand(),
  ];

  events = [
    new GiveawayButtonHandler(),
  ];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {
    // Start giveaway checker
    GiveawayChecker.start(client, database);
  }
}
