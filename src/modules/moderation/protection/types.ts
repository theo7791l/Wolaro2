/**
 * Protection Module Types
 * Toutes les interfaces et types pour le module de protection
 */

export interface ProtectionConfig {
  guild_id: string;
  
  // Anti-Spam
  antispam_enabled: boolean;
  antispam_level: 'low' | 'medium' | 'high';
  antispam_message_limit: number;
  antispam_time_window: number;
  
  // Bad Words
  badwords_enabled: boolean;
  badwords_action: 'delete' | 'warn' | 'timeout';
  badwords_strict_mode: boolean;
  badwords_whitelist: string[];
  badwords_custom_list: string[]; // Liste personnalisée de mots à bloquer
  
  // Anti-Raid
  antiraid_enabled: boolean;
  antiraid_captcha_enabled: boolean;
  antiraid_auto_lockdown: boolean;
  antiraid_join_threshold: number;
  
  // Anti-Phishing
  antiphishing_enabled: boolean;
  antiphishing_check_urls: boolean;
  antiphishing_trusted_domains: string[];
  
  // Anti-Nuke
  antinuke_enabled: boolean;
  antinuke_protect_admins: boolean;
  antinuke_channel_delete_limit: number;
  antinuke_role_delete_limit: number;
  
  // NSFW Detection
  nsfw_detection_enabled: boolean;
  nsfw_threshold: number;
  
  // Lockdown
  lockdown_enabled: boolean;
  lockdown_auto_trigger: boolean;
  
  // General
  log_channel_id: string | null;
  whitelist_users: string[];
  whitelist_roles: string[];
  
  created_at: Date;
  updated_at: Date;
}

export const DEFAULT_PROTECTION_CONFIG: Omit<ProtectionConfig, 'guild_id' | 'created_at' | 'updated_at'> = {
  antispam_enabled: true,
  antispam_level: 'medium',
  antispam_message_limit: 5,
  antispam_time_window: 5000,
  badwords_enabled: true,
  badwords_action: 'delete',
  badwords_strict_mode: false,
  badwords_whitelist: [],
  badwords_custom_list: [], // Liste vide par défaut
  antiraid_enabled: true,
  antiraid_captcha_enabled: false,
  antiraid_auto_lockdown: false,
  antiraid_join_threshold: 5,
  antiphishing_enabled: true,
  antiphishing_check_urls: true,
  antiphishing_trusted_domains: [],
  antinuke_enabled: true,
  antinuke_protect_admins: true,
  antinuke_channel_delete_limit: 3,
  antinuke_role_delete_limit: 3,
  nsfw_detection_enabled: false,
  nsfw_threshold: 0.7,
  lockdown_enabled: true,
  lockdown_auto_trigger: false,
  log_channel_id: null,
  whitelist_users: [],
  whitelist_roles: [],
};

export interface ProtectionLog {
  id: number;
  guild_id: string;
  user_id: string;
  type: 'spam_detected' | 'raid_detected' | 'phishing_detected' | 'nuke_attempt' | 'nsfw_detected' | 'lockdown_triggered';
  action: 'none' | 'warn' | 'timeout' | 'kick' | 'ban' | 'quarantine' | 'lockdown' | 'message_deleted';
  reason: string;
  details: any;
  timestamp: Date;
}

export interface ActionLog {
  id: number;
  guild_id: string;
  user_id: string;
  type: string;
  action: string;
  reason: string;
  details: any;
  timestamp: Date;
}

export interface ProtectionStats {
  guild_id: string;
  spam_detected: number;
  badwords_filtered: number;
  raids_detected: number;
  phishing_blocked: number;
  nuke_attempts: number;
  nsfw_detected: number;
  lockdowns: number;
  last_reset: Date;
}

export interface MessageCache {
  id: string;
  author_id: string;
  content: string;
  timestamp: number;
  is_bot: boolean;
  is_webhook: boolean;
}

export interface FloodDetection {
  detected: boolean;
  message_count: number;
  unique_users: number;
}

export interface BadWordDetectionResult {
  detected: boolean;
  words: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface CaptchaSession {
  member_id: string;
  guild_id: string;
  code: string;
  attempts: number;
  expires_at: Date;
}

export interface RaidDetection {
  member_id: string;
  guild_id: string;
  risk_score: number;
  risk_factors: Array<{
    type: string;
    severity: number;
    details: string;
  }>;
  action: string | null;
  detected_at: Date;
}

export interface PhishingDomain {
  domain: string;
  is_malicious: boolean;
  confidence: number;
  last_checked: Date;
}

export interface NSFWDetectionResult {
  is_nsfw: boolean;
  score: number;
  labels: string[];
  image_url: string;
}

export interface LockdownState {
  guild_id: string;
  is_locked: boolean;
  reason: string;
  started_at: Date;
  locked_channels: string[];
}

export interface NukeDetection {
  user_id: string;
  guild_id: string;
  action_type: string;
  action_count: number;
  time_window: number;
  detected_at: Date;
}
