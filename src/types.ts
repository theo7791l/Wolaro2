import { Client, SlashCommandBuilder, ChatInputCommandInteraction, PermissionResolvable } from 'discord.js';
import { DatabaseManager } from './database/manager';
import { RedisManager } from './cache/redis';
import { ZodSchema } from 'zod';

// ==============================================
// CORE INTERFACES
// ==============================================

export interface ICommandContext {
  client: Client;
  database: DatabaseManager;
  redis: RedisManager;
  guildConfig?: any;
}

export interface ICommand {
  data: SlashCommandBuilder;
  module?: string;
  permissions?: PermissionResolvable[];
  guildOnly?: boolean;
  ownerOnly?: boolean;
  cooldown?: number;
  execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void>;
}

export interface IEvent {
  name: string;
  module?: string;
  once?: boolean;
  execute(...args: any[]): Promise<void>;
}

export interface IModule {
  name: string;
  description: string;
  version: string;
  author: string;
  configSchema?: ZodSchema;
  defaultConfig?: Record<string, any>;
  commands: ICommand[];
  events: IEvent[];
}

// ==============================================
// DATABASE MODELS
// ==============================================

export interface Guild {
  guild_id: string;
  owner_id: string;
  plan_type: 'FREE' | 'PREMIUM' | 'ENTERPRISE';
  joined_at: Date;
  premium_until?: Date;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface GuildModule {
  id: number;
  guild_id: string;
  module_name: string;
  enabled: boolean;
  config: Record<string, any>;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface GlobalProfile {
  user_id: string;
  username: string;
  discriminator?: string;
  avatar_url?: string;
  global_xp: number;
  global_level: number;
  badges: string[];
  achievements: string[];
  reputation: number;
  bio?: string;
  created_at: Date;
  updated_at: Date;
}

export interface MasterAdmin {
  id: number;
  user_id: string;
  username: string;
  access_level: number;
  permissions: string[];
  can_impersonate: boolean;
  can_blacklist: boolean;
  can_force_restart: boolean;
  ip_whitelist: string[];
  two_factor_secret?: string;
  two_factor_enabled: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  id: string;
  guild_id?: string;
  user_id: string;
  action_type: string;
  target_type?: string;
  target_id?: string;
  changes?: Record<string, any>;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

export interface ModerationCase {
  id: number;
  guild_id: string;
  case_number: number;
  user_id: string;
  moderator_id: string;
  action_type: 'WARN' | 'MUTE' | 'KICK' | 'BAN' | 'UNBAN';
  reason?: string;
  duration?: string;
  expires_at?: Date;
  is_active: boolean;
  evidence: any[];
  created_at: Date;
}

export interface EconomyProfile {
  id: number;
  guild_id: string;
  user_id: string;
  balance: number;
  bank_balance: number;
  daily_streak: number;
  last_daily?: Date;
  inventory: any[];
  created_at: Date;
  updated_at: Date;
}

export interface RPGProfile {
  id: number;
  guild_id: string;
  user_id: string;
  level: number;
  xp: number;
  gold: number;
  health: number;
  max_health: number;
  attack: number;
  defense: number;
  class: string;
  wins: number;
  losses: number;
  inventory: any[];
  equipped: Record<string, any>;
  quests_completed: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Ticket {
  id: string;
  guild_id: string;
  channel_id: string;
  ticket_number: number;
  user_id: string;
  subject: string;
  type: string;
  status: 'open' | 'closed';
  claimed_by?: string;
  claimed_at?: Date;
  closed_by?: string;
  closed_at?: Date;
  close_reason?: string;
  created_at: Date;
}

export interface Giveaway {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string;
  prize: string;
  winners_count: number;
  host_id: string;
  end_time: Date;
  status: 'active' | 'ended' | 'cancelled';
  ended_at?: Date;
  created_at: Date;
}

export interface GiveawayParticipant {
  id: number;
  giveaway_id: string;
  user_id: string;
  is_winner: boolean;
  joined_at: Date;
}

// ==============================================
// API TYPES
// ==============================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends APIResponse<T> {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface JWTPayload {
  userId: string;
  username: string;
  discriminator?: string;
  guilds?: string[];
  iat: number;
  exp: number;
}

export interface WebSocketMessage {
  event: string;
  data: any;
  guildId?: string;
  timestamp: string;
}

// ==============================================
// CONFIGURATION TYPES
// ==============================================

export interface BotConfig {
  token: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  // FIX: ajout de publicKey requis pour vérification des signatures Discord (SecurityManager.verifySignature)
  publicKey: string;
  masterAdmins: string[];
  geminiApiKey: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  api: APIConfig;
  cluster: ClusterConfig;
  security: SecurityConfig;
  features: FeatureFlags;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  maxConnections: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface APIConfig {
  port: number;
  host: string;
  jwtSecret: string;
  corsOrigin: string[];
  wsPort: number;
  wsEnabled: boolean;
  panelUrl: string;
  panelSessionDuration: number;
}

export interface ClusterConfig {
  enabled: boolean;
  shardCount: number | 'auto';
}

export interface SecurityConfig {
  encryptionKey: string;
  ipWhitelist: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface FeatureFlags {
  musicEnabled: boolean;
  aiEnabled: boolean;
  rpgEnabled: boolean;
  ticketsEnabled: boolean;
  giveawaysEnabled: boolean;
}

// ==============================================
// UTILITY TYPES
// ==============================================

export type ModuleName =
  | 'moderation'
  | 'economy'
  | 'leveling'
  | 'music'
  | 'admin'
  | 'ai'
  | 'rpg'
  | 'tickets'
  | 'giveaways';

export type ActionType =
  | 'COMMAND_EXECUTED'
  | 'MODULE_TOGGLED'
  | 'CONFIG_UPDATED'
  | 'USER_BANNED'
  | 'USER_KICKED'
  | 'MESSAGE_DELETED'
  | 'ROLE_ASSIGNED'
  | 'GUILD_JOINED'
  | 'GUILD_LEFT'
  | 'AI_QUERY'
  | 'AI_AUTOMOD_DELETE'
  | 'RPG_BATTLE'
  | 'TICKET_CREATED'
  | 'TICKET_CLOSED'
  | 'GIVEAWAY_CREATED'
  | 'GIVEAWAY_ENDED';

export interface CacheOptions {
  key: string;
  ttl?: number;
  data?: any;
}

export interface RateLimitInfo {
  identifier: string;
  limitType: string;
  hitCount: number;
  isBlocked: boolean;
  resetTime?: Date;
}

export interface CommandStats {
  commandName: string;
  executionCount: number;
  averageExecutionTime: number;
  errorCount: number;
  lastExecuted?: Date;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  guildCount: number;
  userCount: number;
  commandsExecuted: number;
  activeConnections: number;
}
