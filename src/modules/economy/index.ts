import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { BalanceCommand } from './commands/balance';
import { DailyCommand } from './commands/daily';
import { WorkCommand } from './commands/work';
import { PayCommand } from './commands/pay';
import { ShopCommand } from './commands/shop';
import { BuyCommand } from './commands/buy';
import { InventoryCommand } from './commands/inventory';
import { LeaderboardCommand } from './commands/leaderboard';
import { z } from 'zod';

export const EconomyConfigSchema = z.object({
  currency: z.string().default('💰'),
  currencyName: z.string().default('coins'),
  dailyAmount: z.number().min(1).max(10000).default(100),
  dailyStreak: z.boolean().default(true),
  workEnabled: z.boolean().default(true),
  workCooldown: z.number().min(60).max(86400).default(3600),
  workMinAmount: z.number().default(50),
  workMaxAmount: z.number().default(200),
  economyType: z.enum(['local', 'global']).default('local'),
  bankEnabled: z.boolean().default(true),
  shopEnabled: z.boolean().default(true),
});

export default class EconomyModule implements IModule {
  name = 'economy';
  description = 'Système économique complet avec monnaie, boutique et échanges';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = EconomyConfigSchema;
  defaultConfig = {
    currency: '💰',
    currencyName: 'coins',
    dailyAmount: 100,
    dailyStreak: true,
    workEnabled: true,
    workCooldown: 3600,
    workMinAmount: 50,
    workMaxAmount: 200,
    economyType: 'local',
    bankEnabled: true,
    shopEnabled: true,
  };

  commands = [
    new BalanceCommand(),
    new DailyCommand(),
    new WorkCommand(),
    new PayCommand(),
    new ShopCommand(),
    new BuyCommand(),
    new InventoryCommand(),
    new LeaderboardCommand(),
  ];

  events = [];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
