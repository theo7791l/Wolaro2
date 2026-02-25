import { GuildMember, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { RaidAnalysis, RaidAction, RiskFactor, JoinInfo } from '../types';
import pool from '../../../utils/database';
import logger from '../../../utils/logger';

/**
 * Système anti-raid avec détection de patterns suspects
 * Adapté de TheoProtect pour Wolaro2
 */
export class AntiRaidSystem {
  private joinQueue: JoinInfo[] = [];
  private suspiciousUsers = new Set<string>();
  private raidMode = false;
  private raidStartTime: number | null = null;

  private readonly config = {
    joinTimeWindow: 60000, // 60 secondes
    joinThreshold: 5, // 5 membres en 60s
    accountAgeMin: 7, // 7 jours
  };

  /**
   * Analyse un nouveau membre pour détecter des patterns de raid
   */
  async analyzeMemberJoin(member: GuildMember): Promise<RaidAnalysis> {
    const now = Date.now();
    const accountAge = now - member.user.createdTimestamp;
    const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);

    // Ajouter à la queue
    this.joinQueue.push({
      userId: member.id,
      username: member.user.username,
      timestamp: now,
      accountAge: accountAgeDays,
      avatarHash: member.user.avatar
    });

    // Nettoyer anciens joins
    this.joinQueue = this.joinQueue.filter(
      join => now - join.timestamp < this.config.joinTimeWindow
    );

    // Calculer facteurs de risque
    const riskFactors: RiskFactor[] = [];

    // 1. Compte jeune
    if (accountAgeDays < this.config.accountAgeMin) {
      riskFactors.push({
        type: 'YOUNG_ACCOUNT',
        severity: 3,
        details: `Compte créé il y a ${accountAgeDays.toFixed(1)} jours`
      });
    }

    // 2. Avatar par défaut
    if (!member.user.avatar) {
      riskFactors.push({
        type: 'DEFAULT_AVATAR',
        severity: 2,
        details: 'Pas d\'avatar personnalisé'
      });
    }

    // 3. Nom suspect
    const suspiciousPatterns = [
      /discord.*nitro/i,
      /free.*nitro/i,
      /@everyone/i,
      /(.)\1{4,}/, // Caractères répétés
      /^[a-zA-Z0-9]{1,3}$/, // Noms très courts
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(member.user.username))) {
      riskFactors.push({
        type: 'SUSPICIOUS_USERNAME',
        severity: 3,
        details: 'Pattern de nom suspect'
      });
    }

    // 4. Taux de joins rapide
    const recentJoins = this.joinQueue.length;
    if (recentJoins > this.config.joinThreshold) {
      riskFactors.push({
        type: 'RAPID_JOINS',
        severity: 5,
        details: `${recentJoins} membres ont rejoint en ${this.config.joinTimeWindow / 1000}s`
      });

      // Activer raid mode
      if (!this.raidMode) {
        this.activateRaidMode();
      }
    }

    // 5. Noms similaires (attaque coordonnée)
    const similarNames = this.joinQueue.filter(join => {
      const similarity = this.calculateSimilarity(join.username, member.user.username);
      return similarity > 0.7 && join.userId !== member.id;
    });

    if (similarNames.length > 3) {
      riskFactors.push({
        type: 'COORDINATED_USERNAMES',
        severity: 4,
        details: `${similarNames.length} noms similaires détectés`
      });
    }

    // Score de risque total
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
   * Calcule la similarité entre deux chaînes (Levenshtein-based)
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
   * Détermine l'action à effectuer en fonction du risque
   */
  private determineAction(riskScore: number, isRaidMode: boolean): RaidAction {
    if (isRaidMode || riskScore >= 10) {
      return { type: 'BAN', reason: 'Raid détecté - Compte suspect' };
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
   * Exécute l'action sur un membre suspect
   */
  async executeAction(member: GuildMember, action: RaidAction): Promise<{ success: boolean; message: string }> {
    try {
      switch (action.type) {
        case 'BAN':
          await member.ban({ reason: action.reason, deleteMessageSeconds: 0 });
          return { success: true, message: `🔨 ${member.user.tag} banni` };

        case 'KICK':
          await member.kick(action.reason);
          return { success: true, message: `👢 ${member.user.tag} expulsé` };

        case 'QUARANTINE': {
          const quarantineRole = member.guild.roles.cache.find(r => r.name === 'Quarantaine');
          if (quarantineRole) {
            await member.roles.set([quarantineRole], action.reason);
            return { success: true, message: `⚠️ ${member.user.tag} mis en quarantaine` };
          }
          return { success: false, message: 'Rôle Quarantaine introuvable' };
        }

        case 'MONITOR':
          return { success: true, message: `🔍 ${member.user.tag} sous surveillance` };

        default:
          return { success: true, message: 'Aucune action' };
      }
    } catch (error) {
      logger.error('[AntiRaid] Error executing action:', error);
      return { success: false, message: String(error) };
    }
  }

  /**
   * Active le mode raid
   */
  private activateRaidMode(): void {
    this.raidMode = true;
    this.raidStartTime = Date.now();
    logger.warn('🚨 [AntiRaid] RAID MODE ACTIVATED');

    // Désactiver automatiquement après 10 minutes de calme
    setTimeout(() => {
      if (this.raidMode && this.joinQueue.length < 3) {
        this.deactivateRaidMode();
      }
    }, 600000);
  }

  /**
   * Désactive le mode raid
   */
  private deactivateRaidMode(): void {
    this.raidMode = false;
    this.raidStartTime = null;
    logger.info('✅ [AntiRaid] Raid mode deactivated');
  }

  /**
   * Obtient les statistiques du raid
   */
  getRaidStats(): { isActive: boolean; startTime: number | null; recentJoins: number; suspiciousUsers: number } {
    return {
      isActive: this.raidMode,
      startTime: this.raidStartTime,
      recentJoins: this.joinQueue.length,
      suspiciousUsers: this.suspiciousUsers.size
    };
  }
}

export default new AntiRaidSystem();
