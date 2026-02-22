import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { RankCommand } from './commands/rank';
import { LeaderboardCommand } from './commands/leaderboard';
import { SetXPCommand } from './commands/setxp';
import { MessageXPHandler } from './events/message-xp';
import { z } from 'zod';

export const LevelingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  xpPerMessage: z.number().min(1).max(100).default(15),
  xpCooldown: z.number().min(0).max(300).default(60),
  xpMultiplier: z.number().min(0.1).max(10).default(1),
  levelUpMessage: z.boolean().default(true),
  levelUpChannel: z.string().optional(),
  noXpRoles: z.array(z.string()).default([]),
  noXpChannels: z.array(z.string()).default([]),
  stackRoles: z.boolean().default(false),
  levelRoles: z.array(z.object({
    level: z.number(),
    roleId: z.string(),
  })).default([]),
});

export default class LevelingModule implements IModule {
  name = 'leveling';
  description = 'Système de niveaux et XP avec récompenses de rôles';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = LevelingConfigSchema;
  defaultConfig = {
    enabled: true,
    xpPerMessage: 15,
    xpCooldown: 60,
    xpMultiplier: 1,
    levelUpMessage: true,
    stackRoles: false,
    noXpRoles: [],
    noXpChannels: [],
    levelRoles: [],
  };

  commands = [
    new RankCommand(),
    new LeaderboardCommand(),
    new SetXPCommand(),
  ];

  events = [
    new MessageXPHandler(),
  ];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
