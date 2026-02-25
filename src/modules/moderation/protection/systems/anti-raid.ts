/**
 * Anti-Raid System - Migrated from TheoProtect antiRaid.js
 * Détection intelligente de raids avec analyse de patterns
 */

import { GuildMember, TextChannel } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { ProtectionDB } from '../database';
import { CaptchaSystem } from './captcha';
import type { RaidDetection } from '../types';

interface JoinInfo {
  userId: string;
  username: string;
  timestamp: number;
  accountAge: number;
  avatarHash: string | null;
}

interface RiskFactor {
  type: string;
  severity: number;
  details: string;
}

interface RiskAnalysis {
  isSuspicious: boolean;
  riskScore: number;
  riskFactors: RiskFactor[];
  raidMode: boolean;
  action: { type: string; reason?: string };
}

export class AntiRaidSystem {
  private joinQueue: JoinInfo[] = [];
  private suspiciousUsers = new Set<string>();
  private raidMode = false;
  private raidStartTime: number | null = null;
  private db: ProtectionDB;
  private captcha: CaptchaSystem;

  constructor(db: ProtectionDB) {
    this.db = db;
    this.captcha = new CaptchaSystem(db);
    
    // Auto-cleanup old joins every 30s
    setInterval(() => this.cleanupOldJoins(), 30000);
  }

  /**
   * Analyze new member join for raid patterns
   */
  async analyzeMemberJoin(member: GuildMember): Promise<RiskAnalysis> {
    const now = Date.now();
    const accountAge = now - member.user.createdTimestamp;
    const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);

    // Add to join queue
    this.joinQueue.push({
      userId: member.id,
      username: member.user.username,
      timestamp: now,
      accountAge: accountAgeDays,
      avatarHash: member.user.avatar
    });

    // Clean old joins (> 60s)
    this.joinQueue = this.joinQueue.filter(join => now - join.timestamp < 60000);

    // Calculate risk factors
    const riskFactors: RiskFactor[] = [];

    // 1. Young account (< 7 days)
    if (accountAgeDays < 7) {
      riskFactors.push({
        type: 'YOUNG_ACCOUNT',
        severity: 3,
        details: `Compte créé il y a ${accountAgeDays.toFixed(1)} jours`
      });
    }

    // 2. Default avatar
    if (!member.user.avatar) {
      riskFactors.push({
        type: 'DEFAULT_AVATAR',
        severity: 2,
        details: 'Pas d\'avatar personnalisé'
      });
    }

    // 3. Suspicious username patterns
    const suspiciousPatterns = [
      /discord.*nitro/i,
      /free.*nitro/i,
      /@everyone/i,
      /(.)\1{4,}/,
      /^[a-zA-Z0-9]{1,3}$/,
      /discord\.gg/i,
      /http[s]?:\/\//i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(member.user.username))) {
      riskFactors.push({
        type: 'SUSPICIOUS_USERNAME',
        severity: 3,
        details: 'Pattern de nom suspect'
      });
    }

    // 4. Rapid join rate
    const recentJoins = this.joinQueue.length;
    const config = await this.db.getConfig(member.guild.id);
    
    if (recentJoins >= config.antiraid_joins_threshold) {
      riskFactors.push({
        type: 'RAPID_JOINS',
        severity: 5,
        details: `${recentJoins} membres ont rejoint en 60 secondes`
      });

      // Activate raid mode
      if (!this.raidMode) {
        await this.activateRaidMode(member.guild.id);
      }
    }

    // 5. Similar usernames (coordinated attack)
    const similarNames = this.joinQueue.filter(join => {
      const similarity = this.calculateSimilarity(join.username, member.user.username);
      return similarity > 0.7 && join.userId !== member.id;
    });

    if (similarNames.length >= 3) {
      riskFactors.push({
        type: 'COORDINATED_USERNAMES',
        severity: 4,
        details: `${similarNames.length} noms similaires détectés`
      });
    }

    // Calculate total risk score
    const riskScore = riskFactors.reduce((sum, factor) => sum + factor.severity, 0);
    const isSuspicious = riskScore >= 5 || this.raidMode;

    if (isSuspicious) {
      this.suspiciousUsers.add(member.id);
    }

    return {
      isSuspicious,
      riskScore,
      riskFactors,
      raidMode: this.raidMode,
      action: this.determineAction(riskScore, this.raidMode)
    };
  }

  /**
   * Execute action on suspicious member
   */
  async executeAction(
    member: GuildMember,
    action: { type: string; reason?: string },
    riskScore: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.db.getConfig(member.guild.id);
      
      switch (action.type) {
        case 'BAN':
          await member.ban({ reason: action.reason });
          
          await this.db.logAction({
            guild_id: member.guild.id,
            user_id: member.id,
            type: 'raid_detected',
            action: 'ban',
            reason: action.reason || 'Raid detected',
            details: { risk_score: riskScore, raid_mode: this.raidMode }
          });
          
          return { success: true, message: `🔨 ${member.user.tag} banni` };

        case 'KICK':
          await member.kick(action.reason);
          
          await this.db.logAction({
            guild_id: member.guild.id,
            user_id: member.id,
            type: 'raid_detected',
            action: 'kick',
            reason: action.reason || 'Suspicious account',
            details: { risk_score: riskScore }
          });
          
          return { success: true, message: `👢 ${member.user.tag} expulsé` };

        case 'QUARANTINE':
          const quarantineRole = member.guild.roles.cache.find(r => r.name === 'Quarantaine');
          if (quarantineRole) {
            await member.roles.set([quarantineRole], action.reason);
            
            await this.db.logAction({
              guild_id: member.guild.id,
              user_id: member.id,
              type: 'raid_detected',
              action: 'timeout',
              reason: 'Quarantaine automatique',
              details: { risk_score: riskScore, role_id: quarantineRole.id }
            });
            
            return { success: true, message: `⚠️ ${member.user.tag} mis en quarantaine` };
          }
          return { success: false, message: 'Rôle Quarantaine introuvable' };

        case 'CAPTCHA':
          if (config.antiraid_captcha_enabled) {
            await this.captcha.sendCaptcha(member);
            return { success: true, message: `🔐 Captcha envoyé à ${member.user.tag}` };
          }
          return { success: false, message: 'Captcha désactivé' };

        case 'MONITOR':
          await this.db.logAction({
            guild_id: member.guild.id,
            user_id: member.id,
            type: 'raid_detected',
            action: 'warn',
            reason: 'Compte sous surveillance',
            details: { risk_score: riskScore }
          });
          return { success: true, message: `🔍 ${member.user.tag} sous surveillance` };

        default:
          return { success: true, message: 'Aucune action' };
      }
    } catch (error) {
      logger.error('[AntiRaid] Error executing action:', error);
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Determine action based on risk score
   */
  private determineAction(riskScore: number, isRaidMode: boolean): { type: string; reason?: string } {
    if (isRaidMode && riskScore >= 5) {
      return { type: 'BAN', reason: 'Raid détecté - Compte suspect' };
    } else if (riskScore >= 10) {
      return { type: 'BAN', reason: 'Score de risque critique' };
    } else if (riskScore >= 7) {
      return { type: 'KICK', reason: 'Comportement hautement suspect' };
    } else if (riskScore >= 5) {
      return { type: 'QUARANTINE', reason: 'Compte suspect - Quarantaine automatique' };
    } else if (riskScore >= 3) {
      return { type: 'MONITOR', reason: 'Surveillance renforcée' };
    }

    return { type: 'NONE' };
  }

  /**
   * Calculate string similarity (Levenshtein distance)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Activate raid protection mode
   */
  private async activateRaidMode(guildId: string): Promise<void> {
    this.raidMode = true;
    this.raidStartTime = Date.now();
    logger.warn(`🚨 [AntiRaid] RAID MODE ACTIVATED for guild ${guildId}`);

    await this.db.logAction({
      guild_id: guildId,
      user_id: 'SYSTEM',
      type: 'raid_detected',
      action: 'lockdown',
      reason: 'Mode raid activé automatiquement',
      details: { joins_count: this.joinQueue.length }
    });

    await this.db.incrementStat(guildId, 'raids_detected');

    // Auto-deactivate after 10 minutes
    setTimeout(() => {
      if (this.raidMode && this.joinQueue.length < 3) {
        this.deactivateRaidMode(guildId);
      }
    }, 600000);
  }

  /**
   * Deactivate raid protection mode
   */
  private async deactivateRaidMode(guildId: string): Promise<void> {
    this.raidMode = false;
    this.raidStartTime = null;
    logger.info(`✅ [AntiRaid] Raid mode deactivated for guild ${guildId}`);

    await this.db.logAction({
      guild_id: guildId,
      user_id: 'SYSTEM',
      type: 'raid_detected',
      action: 'none',
      reason: 'Mode raid désactivé',
      details: {}
    });
  }

  /**
   * Get raid statistics
   */
  getRaidStats(): {
    isActive: boolean;
    startTime: number | null;
    recentJoins: number;
    suspiciousUsers: number;
    joinQueue: JoinInfo[];
  } {
    return {
      isActive: this.raidMode,
      startTime: this.raidStartTime,
      recentJoins: this.joinQueue.length,
      suspiciousUsers: this.suspiciousUsers.size,
      joinQueue: this.joinQueue
    };
  }

  /**
   * Cleanup old join entries
   */
  private cleanupOldJoins(): void {
    const now = Date.now();
    this.joinQueue = this.joinQueue.filter(join => now - join.timestamp < 60000);

    // Clear suspicious users if no recent activity
    if (this.joinQueue.length === 0) {
      this.suspiciousUsers.clear();
    }
  }
}
