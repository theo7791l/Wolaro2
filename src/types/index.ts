/**
 * Global Types - Complete exports
 */

import { Client } from 'discord.js';

export interface WolaroModule {
  name: string;
  initialize: (client: Client) => Promise<void>;
  shutdown?: () => Promise<void>;
}

export interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
  cooldown?: number;
}

export interface BotConfig {
  token: string;
  clientId: string;
  databaseUrl: string;
  redisUrl?: string;
}
