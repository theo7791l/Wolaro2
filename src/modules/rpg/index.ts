import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { ProfileCommand } from './commands/profile';
import { BattleCommand } from './commands/battle';
import { InventoryCommand } from './commands/inventory';
import { ShopCommand } from './commands/shop';
import { QuestCommand } from './commands/quest';
import { DailyCommand } from './commands/daily';
import { z } from 'zod';

export const RPGConfigSchema = z.object({
  enabled: z.boolean().default(true),
  startingGold: z.number().min(0).max(10000).default(100),
  startingHealth: z.number().min(10).max(1000).default(100),
  pvpEnabled: z.boolean().default(true),
  pveEnabled: z.boolean().default(true),
  questsEnabled: z.boolean().default(true),
  dailyRewardGold: z.number().min(10).max(1000).default(50),
  dailyRewardXP: z.number().min(10).max(500).default(100),
});

export default class RPGModule implements IModule {
  name = 'rpg';
  description = 'Système RPG avec combats, inventaire, quêtes et équipement';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = RPGConfigSchema;
  defaultConfig = {
    enabled: true,
    startingGold: 100,
    startingHealth: 100,
    pvpEnabled: true,
    pveEnabled: true,
    questsEnabled: true,
    dailyRewardGold: 50,
    dailyRewardXP: 100,
  };

  commands = [
    new ProfileCommand(),
    new BattleCommand(),
    new InventoryCommand(),
    new ShopCommand(),
    new QuestCommand(),
    new DailyCommand(),
  ];

  events = [];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
