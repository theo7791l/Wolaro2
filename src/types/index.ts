import { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionResolvable } from 'discord.js';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';

export interface IModule {
  name: string;
  description: string;
  version: string;
  author?: string;
  commands?: ICommand[];
  events?: IEvent[];
  configSchema?: any;
  defaultConfig?: any;
}

export interface ICommand {
  data: SlashCommandBuilder;
  module?: string;
  permissions?: PermissionResolvable[];
  guildOnly?: boolean;
  cooldown?: number;
  execute: (
    interaction: ChatInputCommandInteraction,
    context: ICommandContext
  ) => Promise<void>;
}

export interface IEvent {
  name: string;
  module?: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void>;
}

export interface ICommandContext {
  database: DatabaseManager;
  redis: RedisManager;
  client: Client;
}

export interface IGuildConfig {
  guild_id: string;
  owner_id: string;
  plan_type: 'FREE' | 'PREMIUM' | 'ENTERPRISE';
  settings: Record<string, any>;
  modules: IModuleConfig[];
}

export interface IModuleConfig {
  module_name: string;
  enabled: boolean;
  config: Record<string, any>;
  priority: number;
}

export interface IRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface IAntiRaidConfig {
  autoLockdown: boolean;
  autoTimeout: boolean;
  joinThreshold: number;
  messageThreshold: number;
  notifyChannel?: string;
}

export interface IMasterAdmin {
  user_id: string;
  username: string;
  access_level: number;
  permissions: string[];
  can_impersonate: boolean;
  can_blacklist: boolean;
  can_force_restart: boolean;
}
