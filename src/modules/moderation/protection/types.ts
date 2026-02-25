/**
 * Types TypeScript pour le module Protection (TheoProtect integration)
 * Migré depuis theoprotect/src/systems/*.js
 */

import { Guild, GuildMember, Message, TextChannel, User } from 'discord.js';

export interface ProtectionConfig {
  guild_id: string;
  
  // Anti-Spam
  antispam_enabled: boolean;
  antispam_level: 'low' | 'medium' | 'high' | 'extreme';
  antispam_threshold_messages: number; // Messages par fenêtre
  antispam_threshold_time: number; // Temps en ms
  antispam_sanctions_progressive: boolean;
  
  // Bad Words
  badwords_enabled: boolean;
  badwords_custom_list: string[]; // Mots custom par serveur
  badwords_whitelist: string[]; // Exceptions
  badwords_action: 'delete' | 'timeout' | 'kick' | 'ban';
  
  // Anti-Raid
  antiraid_enabled: boolean;
  antiraid_joins_threshold: number; // Joins par minute
  antiraid_captcha_enabled: boolean;
  antiraid_auto_lockdown: boolean;
  antiraid_action: 'kick' | 'ban';
  
  // Anti-Phishing
  antiphishing_enabled: boolean;
  antiphishing_check_urls: boolean;
  antiphishing_trusted_domains: string[];
  
  // Anti-Nuke
  antinuke_enabled: boolean;
  antinuke_channels_limit: number; // Max suppressions/min
  antinuke_roles_limit: number;
  antinuke_bans_limit: number;
  antinuke_protect_admins: boolean;
  
  // NSFW Detection
  nsfw_detection_enabled: boolean;
  nsfw_check_images: boolean;
  nsfw_check_videos: boolean;
  nsfw_threshold: number; // 0.0 - 1.0
  
  // Smart Lockdown
  lockdown_enabled: boolean;
  lockdown_auto_trigger: boolean;
  lockdown_duration_minutes: number;
  
  // Général
  log_channel_id?: string;
  whitelist_roles: string[]; // Rôles exemptés
  whitelist_users: string[]; // Users exemptés
  
  created_at: Date;
  updated_at: Date;
}

export interface ProtectionLog {
  id: number;
  guild_id: string;
  user_id: string;
  type: ProtectionLogType;
  action: ProtectionAction;
  reason: string;
  details: Record<string, unknown>;
  moderator_id?: string; // Si action manuelle
  timestamp: Date;
}

export type ProtectionLogType =
  | 'spam_detected'
  | 'flood_detected'
  | 'bad_word_detected'
  | 'raid_detected'
  | 'phishing_detected'
  | 'nuke_attempt'
  | 'nsfw_detected'
  | 'lockdown_triggered'
  | 'cleanup_executed'
  | 'captcha_failed'
  | 'captcha_passed';

export type ProtectionAction =
  | 'message_deleted'
  | 'timeout'
  | 'kick'
  | 'ban'
  | 'warn'
  | 'lockdown'
  | 'cleanup'
  | 'none';

export interface ProtectionStats {
  guild_id: string;
  date: string; // YYYY-MM-DD
  
  // Compteurs
  spam_detected: number;
  flood_detected: number;
  bad_words_detected: number;
  raids_detected: number;
  phishing_detected: number;
  nuke_attempts: number;
  nsfw_detected: number;
  
  // Actions
  messages_deleted: number;
  timeouts: number;
  kicks: number;
  bans: number;
  lockdowns: number;
  cleanups: number;
  
  updated_at: Date;
}

export interface SpamDetection {
  user_id: string;
  guild_id: string;
  messages: MessageCache[];
  warnings: number;
  sanctions: number;
  last_spam: Date;
}

export interface MessageCache {
  id: string;
  content: string;
  timestamp: number;
  channel_id: string;
}

export interface FloodDetection {
  channel_id: string;
  guild_id: string;
  messages: Array<{
    id: string;
    author_id: string;
    author_tag: string;
    timestamp: number;
    is_bot: boolean;
    is_webhook: boolean;
  }>;
  detected_at?: Date;
}

export interface BadWordDetectionResult {
  detected: boolean;
  word?: string;
  language?: 'fr' | 'en' | 'pattern';
  severity?: 'low' | 'medium' | 'high';
}

export interface RaidDetection {
  guild_id: string;
  joins: Array<{
    user_id: string;
    username: string;
    account_created: Date;
    joined_at: Date;
  }>;
  started_at: Date;
  is_active: boolean;
  auto_locked: boolean;
}

export interface CaptchaSession {
  guild_id: string;
  user_id: string;
  code: string;
  image_buffer: Buffer;
  created_at: Date;
  expires_at: Date;
  attempts: number;
}

export interface PhishingDomain {
  domain: string;
  severity: 'low' | 'medium' | 'high';
  added_at: Date;
  source: 'auto' | 'manual' | 'database';
}

export interface NukeDetection {
  guild_id: string;
  user_id: string;
  action_type: 'channel_delete' | 'role_delete' | 'ban_massive' | 'kick_massive';
  count: number;
  window_start: Date;
  blocked: boolean;
}

export interface NSFWDetectionResult {
  is_nsfw: boolean;
  score: number; // 0.0 - 1.0
  labels: string[];
  image_url: string;
}

export interface LockdownState {
  guild_id: string;
  is_locked: boolean;
  reason: string;
  started_at: Date;
  ends_at?: Date;
  locked_channels: string[];
  moderator_id?: string;
}

export interface ProtectionWhitelist {
  guild_id: string;
  entity_id: string; // user_id ou role_id
  entity_type: 'user' | 'role';
  reason: string;
  added_by: string;
  added_at: Date;
}

export interface SanctionHistory {
  id: number;
  guild_id: string;
  user_id: string;
  type: ProtectionAction;
  reason: string;
  moderator_id?: string;
  duration_minutes?: number;
  timestamp: Date;
  active: boolean; // Pour les timeouts temporaires
}

// Event payloads pour WebSocket
export interface ProtectionEventPayload {
  guild_id: string;
  type: ProtectionLogType;
  data: Record<string, unknown>;
  timestamp: Date;
}

// Config par défaut
export const DEFAULT_PROTECTION_CONFIG: Omit<ProtectionConfig, 'guild_id' | 'created_at' | 'updated_at'> = {
  antispam_enabled: true,
  antispam_level: 'medium',
  antispam_threshold_messages: 6,
  antispam_threshold_time: 5000,
  antispam_sanctions_progressive: true,
  
  badwords_enabled: true,
  badwords_custom_list: [],
  badwords_whitelist: [],
  badwords_action: 'delete',
  
  antiraid_enabled: true,
  antiraid_joins_threshold: 5,
  antiraid_captcha_enabled: false,
  antiraid_auto_lockdown: false,
  antiraid_action: 'kick',
  
  antiphishing_enabled: true,
  antiphishing_check_urls: true,
  antiphishing_trusted_domains: [],
  
  antinuke_enabled: true,
  antinuke_channels_limit: 3,
  antinuke_roles_limit: 3,
  antinuke_bans_limit: 5,
  antinuke_protect_admins: true,
  
  nsfw_detection_enabled: false,
  nsfw_check_images: true,
  nsfw_check_videos: false,
  nsfw_threshold: 0.7,
  
  lockdown_enabled: true,
  lockdown_auto_trigger: false,
  lockdown_duration_minutes: 30,
  
  whitelist_roles: [],
  whitelist_users: [],
};
