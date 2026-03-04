import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { RpgStartCommand } from './commands/rpgstart';
import { RpgResetCommand } from './commands/rpgreset';
import { ProfileCommand } from './commands/profile';
import { BattleCommand } from './commands/battle';
import { InventoryCommand } from './commands/inventory';
import { ShopCommand } from './commands/shop';
import { BuyCommand } from './commands/buy';
import { QuestCommand } from './commands/quest';
import { DailyCommand } from './commands/daily';
import { z } from 'zod';

export const RPGConfigSchema = z.object({
  enabled:         z.boolean().default(true),
  pvpEnabled:      z.boolean().default(true),
  pveEnabled:      z.boolean().default(true),
  questsEnabled:   z.boolean().default(true),
  dailyRewardGold: z.number().min(10).max(1000).default(50),
  dailyRewardXP:   z.number().min(10).max(500).default(100),
});

export default class RPGModule implements IModule {
  name        = 'rpg';
  description = 'Système RPG complet — classes, combats, inventaire, quêtes, équipement';
  version     = '2.1.0';
  author      = 'Wolaro';

  configSchema  = RPGConfigSchema;
  defaultConfig = {
    enabled:         true,
    pvpEnabled:      true,
    pveEnabled:      true,
    questsEnabled:   true,
    dailyRewardGold: 50,
    dailyRewardXP:   100,
  };

  // Ordre logique : setup → profil → actions → admin
  commands = [
    new RpgStartCommand(),
    new RpgResetCommand(),
    new ProfileCommand(),
    new BattleCommand(),
    new BuyCommand(),
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
