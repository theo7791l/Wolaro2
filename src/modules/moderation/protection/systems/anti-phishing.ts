/**
 * Anti-Phishing System - Migrated from TheoProtect antiPhishing.js
 * Détection intelligente de liens de phishing avec vérifications externes
 */

import { Message } from 'discord.js';
import axios from 'axios';
import { logger } from '../../../../utils/logger';
import { ProtectionDB } from '../database';
import type { PhishingDomain } from '../types';

interface RiskCheck {
  type: string;
  severity: number;
  detail?: string;
  pattern?: string;
  tld?: string;
  count?: number;
}

interface PhishingResult {
  url: string;
  isMalicious: boolean;
  patternScore: number;
  patternRisks: RiskCheck[];
  externalCheck: string | null;
}

interface CacheEntry {
  isMalicious: boolean;
  patternScore: number;
  patternRisks: RiskCheck[];
  externalCheck: string | null;
  timestamp: number;
}

export class AntiPhishingSystem {
  private cache = new Map<string, CacheEntry>();
  private cacheTimeout = 3600000; // 1 hour
  private db: ProtectionDB;

  private phishingPatterns = [
    /discord[.-]?nitro/i,
    /free[.-]?nitro/i,
    /discord[.-]?gift/i,
    /steam[.-]?nitro/i,
    /dlscord/i,
    /discorcl/i,
    /discorcd/i,
    /steamcommunity[.-]?(com|ru|org|net|co)/i,
    /steam[.-]?community[.-]?com/i,
    /steampowered[.-]?(ru|org|net)/i,
    /steamcornmunity/i,
    /verify[.-]?account/i,
    /claim[.-]?reward/i,
    /urgent[.-]?security/i,
    /suspended[.-]?account/i,
    /bit\.ly\//i,
    /tinyurl\.com\//i,
    /goo\.gl\//i
  ];

  private suspiciousTLDs = [
    '.tk', '.ml', '.ga', '.cf', '.gq',
    '.ru', '.su', '.cn',
    '.top', '.xyz', '.club', '.online'
  ];

  constructor(db: ProtectionDB) {
    this.db = db;
    setInterval(() => this.clearCache(), 300000); // Clean every 5 min
  }

  /**
   * Extract URLs from message
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return text.match(urlRegex) || [];
  }

  /**
   * Check if URL matches phishing patterns
   */
  private checkPatterns(url: string): RiskCheck[] {
    const risks: RiskCheck[] = [];

    // Check phishing patterns
    for (const pattern of this.phishingPatterns) {
      if (pattern.test(url)) {
        risks.push({
          type: 'PATTERN_MATCH',
          severity: 4,
          pattern: pattern.toString()
        });
      }
    }

    // Check suspicious TLDs
    for (const tld of this.suspiciousTLDs) {
      if (url.toLowerCase().includes(tld)) {
        risks.push({
          type: 'SUSPICIOUS_TLD',
          severity: 2,
          tld
        });
      }
    }

    // Check for IP addresses in URL
    const ipRegex = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
    if (ipRegex.test(url)) {
      risks.push({
        type: 'IP_ADDRESS',
        severity: 3,
        detail: 'URL contient une adresse IP'
      });
    }

    // Check for homograph attacks (unicode lookalikes)
    if (/[\u0400-\u04FF]/.test(url)) {
      risks.push({
        type: 'HOMOGRAPH',
        severity: 5,
        detail: 'Caractères cyrilliques détectés'
      });
    }

    // Check for excessive subdomains
    const hostname = url.split('/')[2] || '';
    const subdomains = hostname.split('.');
    if (subdomains.length > 4) {
      risks.push({
        type: 'EXCESSIVE_SUBDOMAINS',
        severity: 2,
        count: subdomains.length
      });
    }

    return risks;
  }

  /**
   * Check URL with Google Safe Browsing (requires API key)
   */
  private async checkGoogleSafeBrowsing(url: string): Promise<boolean | null> {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    if (!apiKey) return null;

    try {
      const response = await axios.post(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
        {
          client: { clientId: 'wolaro', clientVersion: '2.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }]
          }
        },
        { timeout: 5000 }
      );

      return response.data.matches ? response.data.matches.length > 0 : false;
    } catch (error) {
      logger.error('[AntiPhishing] Google Safe Browsing error:', error);
      return null;
    }
  }

  /**
   * Check URL with PhishTank (free, no API key needed)
   */
  private async checkPhishTank(url: string): Promise<boolean | null> {
    try {
      const encodedUrl = encodeURIComponent(url);
      const response = await axios.get(
        'https://checkurl.phishtank.com/checkurl/',
        {
          params: { url: encodedUrl, format: 'json' },
          timeout: 5000
        }
      );

      return response.data?.results?.in_database === true;
    } catch (error) {
      return null; // Fail silently (rate limits)
    }
  }

  /**
   * Main analysis function
   */
  async analyzeMessage(message: Message): Promise<{
    isPhishing: boolean;
    urls?: PhishingResult[];
    action?: any;
  }> {
    const urls = this.extractUrls(message.content);
    if (urls.length === 0) return { isPhishing: false };

    const config = await this.db.getConfig(message.guild!.id);
    if (!config.antiphishing_enabled) return { isPhishing: false };

    const results: PhishingResult[] = [];

    for (const url of urls) {
      // Check trusted domains
      if (config.antiphishing_trusted_domains.some(d => url.includes(d))) {
        continue;
      }

      // Check cache first
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        if (cached.isMalicious) {
          results.push({ url, ...cached });
        }
        continue;
      }

      // Pattern-based check
      const patternRisks = this.checkPatterns(url);
      const patternScore = patternRisks.reduce((sum, r) => sum + r.severity, 0);

      // External API checks
      let externalCheck: string | null = null;
      if (config.antiphishing_check_urls) {
        try {
          const [googleResult, phishTankResult] = await Promise.allSettled([
            this.checkGoogleSafeBrowsing(url),
            this.checkPhishTank(url)
          ]);

          if (googleResult.status === 'fulfilled' && googleResult.value === true) {
            externalCheck = 'Google Safe Browsing';
          } else if (phishTankResult.status === 'fulfilled' && phishTankResult.value === true) {
            externalCheck = 'PhishTank';
          }
        } catch (error) {
          logger.error('[AntiPhishing] External check error:', error);
        }
      }

      const isMalicious = patternScore >= 3 || externalCheck !== null;

      // Cache result
      this.cache.set(url, {
        isMalicious,
        patternScore,
        patternRisks,
        externalCheck,
        timestamp: Date.now()
      });

      if (isMalicious) {
        results.push({ url, isMalicious, patternScore, patternRisks, externalCheck });
      }
    }

    return {
      isPhishing: results.length > 0,
      urls: results,
      action: results.length > 0 ? this.determineAction(results) : null
    };
  }

  /**
   * Determine action based on threat level
   */
  private determineAction(results: PhishingResult[]): {
    type: string;
    reason: string;
    deleteMessage?: boolean;
    warn?: boolean;
  } {
    const maxScore = Math.max(...results.map(r => r.patternScore));
    const hasExternalConfirmation = results.some(r => r.externalCheck);

    if (hasExternalConfirmation || maxScore >= 8) {
      return {
        type: 'BAN',
        reason: 'Lien de phishing détecté (confirmé externe)',
        deleteMessage: true
      };
    } else if (maxScore >= 5) {
      return {
        type: 'KICK',
        reason: 'Lien hautement suspect détecté',
        deleteMessage: true
      };
    } else if (maxScore >= 3) {
      return {
        type: 'DELETE',
        reason: 'Lien suspect détecté',
        warn: true
      };
    }

    return { type: 'DELETE', reason: 'Lien potentiellement dangereux' };
  }

  /**
   * Execute action on phishing message
   */
  async executeAction(
    message: Message,
    action: any,
    results: PhishingResult[]
  ): Promise<boolean> {
    try {
      // Delete message
      if (action.deleteMessage || action.type === 'DELETE') {
        await message.delete();
      }

      const urlList = results.map(r => `• <${r.url}>`).join('\n');
      const detectionInfo = results.map(r => {
        if (r.externalCheck) return `Confirmé par: ${r.externalCheck}`;
        return `Patterns: ${r.patternRisks.map(pr => pr.type).join(', ')}`;
      }).join('\n');

      switch (action.type) {
        case 'DELETE':
          await message.channel.send({
            content: `⚠️ ${message.author}, message supprimé pour lien suspect.\n\n**URLs bloquées:**\n${urlList}`,
            allowedMentions: { users: [message.author.id] }
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
          break;

        case 'KICK':
          if (message.member) {
            await message.member.kick(action.reason);
          }
          await message.channel.send({
            content: `🚫 ${message.author.tag} expulsé pour phishing.\n\n${detectionInfo}`
          });
          break;

        case 'BAN':
          if (message.member) {
            await message.member.ban({ reason: action.reason, deleteMessageSeconds: 86400 });
          }
          await message.channel.send({
            content: `🔨 ${message.author.tag} banni pour phishing confirmé.\n\n${detectionInfo}`
          });
          break;
      }

      // Log action
      await this.db.logAction({
        guild_id: message.guild!.id,
        user_id: message.author.id,
        type: 'phishing_detected',
        action: action.type === 'DELETE' ? 'message_deleted' : action.type.toLowerCase() as any,
        reason: action.reason,
        details: { urls: results.map(r => r.url), scores: results.map(r => r.patternScore) }
      });

      await this.db.incrementStat(message.guild!.id, 'phishing_detected');

      return true;
    } catch (error) {
      logger.error('[AntiPhishing] Error executing action:', error);
      return false;
    }
  }

  /**
   * Clear old cache entries
   */
  private clearCache(): void {
    const now = Date.now();
    for (const [url, data] of this.cache.entries()) {
      if (now - data.timestamp > this.cacheTimeout) {
        this.cache.delete(url);
      }
    }
  }
}
