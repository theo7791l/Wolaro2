import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { ImpersonateCommand } from './commands/impersonate';
import { BlacklistCommand } from './commands/blacklist';
import { StatsCommand } from './commands/stats';
import { ReloadCommand } from './commands/reload';
import { EvalCommand } from './commands/eval';
import { UpdateCommand } from './commands/update';
import ConfigCommand from './commands/config.js';

export default class AdminModule implements IModule {
  name = 'admin';
  description = 'Commandes Master Admin pour la gestion du bot';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = undefined;
  defaultConfig = {};

  commands = [
    new ImpersonateCommand(),
    new BlacklistCommand(),
    new StatsCommand(),
    new ReloadCommand(),
    new EvalCommand(),
    new UpdateCommand(),
    ConfigCommand, // Ajout de la commande /config
  ];

  events = [];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
