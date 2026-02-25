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

export interface ActionLog {
  id: number;
  guild_id: string;
  user_id: string;
  type: 'spam_detected' | 'raid_detected' | 'phishing_detected' | 'nuke_attempt' | 'nsfw_detected' | 'lockdown_triggered';
  action: 'none' | 'warn' | 'timeout' | 'kick' | 'ban' | 'quarantine' | 'lockdown' | 'message_deleted';
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
