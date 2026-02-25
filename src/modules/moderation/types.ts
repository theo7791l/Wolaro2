import { Message, GuildMember, PermissionResolvable } from 'discord.js';

/**
 * Configuration de la modération pour une guild
 */
export interface ModerationConfig {
  enabled: boolean;
  antispam_enabled: boolean;
  antispam_level: 'low' | 'medium' | 'high' | 'extreme';
  badwords_enabled: boolean;
  antiraid_enabled: boolean;
  antiphishing_enabled: boolean;
  antinuke_enabled: boolean;
  captcha_enabled: boolean;
  nsfw_detection_enabled: boolean;
  log_channel_id?: string;
}

/**
 * Résultat de détection de bad words
 */
export interface BadWordResult {
  detected: boolean;
  word?: string;
  language?: 'fr' | 'en' | 'pattern';
  severity?: 'low' | 'medium' | 'high';
}

/**
 * Information sur un flood détecté
 */
export interface FloodDetection {
  userId: string;
  guildId: string;
  messageCount: number;
  timestamp: number;
  isBot: boolean;
  messageIds: string[];
}

/**
 * Facteur de risque pour l'anti-raid
 */
export interface RiskFactor {
  type: 'YOUNG_ACCOUNT' | 'DEFAULT_AVATAR' | 'SUSPICIOUS_USERNAME' | 'RAPID_JOINS' | 'COORDINATED_USERNAMES';
  severity: number;
  details: string;
}

/**
 * Analyse anti-raid d'un membre
 */
export interface RaidAnalysis {
  isSuspicious: boolean;
  riskScore: number;
  riskFactors: RiskFactor[];
  raidMode: boolean;
  action: RaidAction;
}

/**
 * Action à effectuer suite à une détection de raid
 */
export interface RaidAction {
  type: 'NONE' | 'MONITOR' | 'QUARANTINE' | 'KICK' | 'BAN';
  reason?: string;
}

/**
 * Résultat d'analyse de phishing
 */
export interface PhishingAnalysis {
  isPhishing: boolean;
  urls: PhishingURL[];
  action: PhishingAction | null;
}

/**
 * URL suspecte détectée
 */
export interface PhishingURL {
  url: string;
  isMalicious: boolean;
  patternScore: number;
  patternRisks: PatternRisk[];
  externalCheck?: string;
}

/**
 * Risque détecté dans une URL
 */
export interface PatternRisk {
  type: 'PATTERN_MATCH' | 'SUSPICIOUS_TLD' | 'IP_ADDRESS' | 'HOMOGRAPH' | 'EXCESSIVE_SUBDOMAINS';
  severity: number;
  pattern?: string;
  tld?: string;
  detail?: string;
  count?: number;
}

/**
 * Action à effectuer suite à une détection de phishing
 */
export interface PhishingAction {
  type: 'DELETE' | 'KICK' | 'BAN';
  reason: string;
  deleteMessage?: boolean;
  warn?: boolean;
}

/**
 * Message en cache pour la détection de spam
 */
export interface CachedMessage {
  content: string;
  timestamp: number;
  id: string;
}

/**
 * Information sur un membre qui rejoint (pour anti-raid)
 */
export interface JoinInfo {
  userId: string;
  username: string;
  timestamp: number;
  accountAge: number;
  avatarHash: string | null;
}
