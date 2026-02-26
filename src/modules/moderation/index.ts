import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { BanCommand } from './commands/ban';
import { KickCommand } from './commands/kick';
import { WarnCommand } from './commands/warn';
import { TimeoutCommand } from './commands/timeout';
import { ClearCommand } from './commands/clear';
import { LockdownCommand } from './commands/lockdown';
import { ModerationEventHandler } from './events/moderation-events';
import { z } from 'zod';

// Import du sous-module protection
import protectionModule from './protection';
import { ProtectionConfigCommand } from './protection/commands/config';
import { ProtectionMessageHandler } from './protection/events/message-create';
import { ProtectionMemberAddHandler } from './protection/events/member-add';
import { ProtectionChannelDeleteHandler } from './protection/events/channel-delete';
import { ProtectionRoleDeleteHandler } from './protection/events/role-delete';

export const ModerationConfigSchema = z.object({
  autoMod: z.boolean().default(true),
  autoTimeout: z.boolean().default(true),
  autoLockdown: z.boolean().default(false),
  antiSpam: z.boolean().default(true),
  antiRaid: z.boolean().default(true),
  logChannel: z.string().optional(),
  maxWarnings: z.number().min(1).max(10).default(3),
  muteRole: z.string().optional(),
});

export default class ModerationModule implements IModule {
  name = 'moderation';
  description = 'Système de modération avancé avec anti-raid et auto-modération';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = ModerationConfigSchema;
  defaultConfig = {
    autoMod: true,
    autoTimeout: false,
    autoLockdown: false,
    antiSpam: true,
    antiRaid: true,
    maxWarnings: 3,
  };

  commands = [
    new BanCommand(),
    new KickCommand(),
    new WarnCommand(),
    new TimeoutCommand(),
    new ClearCommand(),
    new LockdownCommand(),
    // Commandes du sous-module protection
    new ProtectionConfigCommand(),
  ];

  events = [
    new ModerationEventHandler(),
    // Événements du sous-module protection
    new ProtectionMessageHandler(),
    new ProtectionMemberAddHandler(),
    new ProtectionChannelDeleteHandler(),
    new ProtectionRoleDeleteHandler(),
  ];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}

  async initialize(): Promise<void> {
    // Initialiser le sous-module protection
    await protectionModule.initialize(this.client, this.database);
  }

  async shutdown(): Promise<void> {
    await protectionModule.shutdown();
  }
}
