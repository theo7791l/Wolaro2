import { Message, EmbedBuilder } from 'discord.js';
import type { PhishingAnalysis, PhishingURL, PatternRisk, PhishingAction } from '../types';
import axios from 'axios';
import logger from '../../../utils/logger';

/**
 * Système anti-phishing avec détection de liens malveillants
 * Adapté de TheoProtect pour Wolaro2
 */
export class AntiPhishingSystem {
  private cache = new Map<string, { isMalicious: boolean; timestamp: number; patternScore: number; patternRisks: PatternRisk[]; externalCheck?: string }>();
  private readonly cacheTimeout = 3600000; // 1 heure

  private readonly phishingPatterns = [
    // Arnaques Discord
    /discord[.-]?nitro/i,
    /free[.-]?nitro/i,
    /discord[.-]?gift/i,
    /steam[.-]?nitro/i,
    /dlscord/i,
    /discorcl/i,
    /discorcd/i,

    // Arnaques Steam
    /steamcommunity[.-]?(com|ru|org|net|co)/i,
    /steam[.-]?community[.-]?com/i,
    /steampowered[.-]?(ru|org|net)/i,
    /steamcornmunity/i,

    // Phishing générique
    /verify[.-]?account/i,
    /claim[.-]?reward/i,
    /urgent[.-]?security/i,
    /suspended[.-]?account/i,
    /bit\.ly\//i,
    /tinyurl\.com\//i,
    /goo\.gl\//i
  ];

  private readonly suspiciousTLDs = [
    '.tk', '.ml', '.ga', '.cf', '.gq', // Domaines gratuits
    '.ru', '.su', '.cn', // Pays à risque
    '.top', '.xyz', '.club', '.online'
  ];

  /**
   * Extrait les URLs d'un message
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return text.match(urlRegex) || [];
  }

  /**
   * Vérifie si une URL match des patterns de phishing
   */
  private checkPatterns(url: string): PatternRisk[] {
    const risks: PatternRisk[] = [];

    // Patterns de phishing
    for (const pattern of this.phishingPatterns) {
      if (pattern.test(url)) {
        risks.push({
          type: 'PATTERN_MATCH',
          severity: 4,
          pattern: pattern.toString()
        });
      }
    }

    // TLDs suspects
    for (const tld of this.suspiciousTLDs) {
      if (url.toLowerCase().includes(tld)) {
        risks.push({
          type: 'SUSPICIOUS_TLD',
          severity: 2,
          tld
        });
      }
    }

    // Adresses IP dans l'URL
    const ipRegex = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
    if (ipRegex.test(url)) {
      risks.push({
        type: 'IP_ADDRESS',
        severity: 3,
        detail: 'URL contient une adresse IP'
      });
    }

    // Attaques homographes (caractères Unicode lookalikes)
    if (/[\u0400-\u04FF]/.test(url)) { // Cyrillique
      risks.push({
        type: 'HOMOGRAPH',
        severity: 5,
        detail: 'Caractères cyrilliques détectés'
      });
    }

    // Sous-domaines excessifs
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
   * Vérifie une URL avec Google Safe Browsing (optionnel)
   */
  private async checkGoogleSafeBrowsing(url: string): Promise<boolean | null> {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    if (!apiKey) return null;

    try {
      const response = await axios.post(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
        {
          client: {
            clientId: 'wolaro',
            clientVersion: '2.0.0'
          },
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
   * Vérifie une URL avec PhishTank (gratuit)
   */
  private async checkPhishTank(url: string): Promise<boolean | null> {
    try {
      const encodedUrl = encodeURIComponent(url);
      const response = await axios.get(
        'https://checkurl.phishtank.com/checkurl/',
        {
          params: {
            url: encodedUrl,
            format: 'json'
          },
          timeout: 5000
        }
      );

      return response.data?.results?.in_database === true;
    } catch (error) {
      // PhishTank a des rate limits, échouer silencieusement
      return null;
    }
  }

  /**
   * Analyse un message pour détecter du phishing
   */
  async analyzeMessage(message: Message): Promise<PhishingAnalysis> {
    const urls = this.extractUrls(message.content);
    if (urls.length === 0) return { isPhishing: false, urls: [], action: null };

    const results: PhishingURL[] = [];

    for (const url of urls) {
      // Vérifier le cache
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        if (cached.isMalicious) {
          results.push({ url, ...cached });
        }
        continue;
      }

      // Vérification par patterns (instantané)
      const patternRisks = this.checkPatterns(url);
      const patternScore = patternRisks.reduce((sum, r) => sum + r.severity, 0);

      // Vérifications API externes (async, peuvent échouer)
      let externalCheck: string | undefined;
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

      const isMalicious = patternScore >= 4 || externalCheck !== undefined;

      // Mettre en cache
      this.cache.set(url, {
        isMalicious,
        patternScore,
        patternRisks,
        externalCheck,
        timestamp: Date.now()
      });

      if (isMalicious) {
        results.push({
          url,
          isMalicious,
          patternScore,
          patternRisks,
          externalCheck
        });
      }
    }

    return {
      isPhishing: results.length > 0,
      urls: results,
      action: results.length > 0 ? this.determineAction(results) : null
    };
  }

  /**
   * Détermine l'action à effectuer en fonction du niveau de menace
   */
  private determineAction(results: PhishingURL[]): PhishingAction {
    const maxScore = Math.max(...results.map(r => r.patternScore));
    const hasExternalConfirmation = results.some(r => r.externalCheck);

    if (hasExternalConfirmation || maxScore >= 8) {
      return {
        type: 'BAN',
        reason: 'Lien de phishing détecté (confirmé par base de données externe)',
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
   * Exécute l'action déterminée
   */
  async executeAction(message: Message, action: PhishingAction, results: PhishingURL[]): Promise<boolean> {
    try {
      // Supprimer le message
      if (action.deleteMessage || action.type === 'DELETE') {
        await message.delete();
      }

      const urlList = results.map(r => `• <${r.url}>`).join('\n');
      const detectionInfo = results.map(r => {
        if (r.externalCheck) return `Confirmé par: ${r.externalCheck}`;
        return `Patterns détectés: ${r.patternRisks.map(pr => pr.type).join(', ')}`;
      }).join('\n');

      switch (action.type) {
        case 'DELETE':
          await message.channel.send({
            content: `⚠️ ${message.author}, message supprimé pour lien suspect.\n\n**URLs bloquées:**\n${urlList}`,
            allowedMentions: { users: [message.author.id] }
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
          break;

        case 'KICK':
          await message.member?.kick(action.reason);
          await message.channel.send({
            content: `🚫 ${message.author.tag} a été expulsé pour partage de lien de phishing.\n\n${detectionInfo}`,
            allowedMentions: { users: [] }
          });
          break;

        case 'BAN':
          await message.member?.ban({ reason: action.reason, deleteMessageSeconds: 86400 });
          await message.channel.send({
            content: `🔨 ${message.author.tag} a été banni pour partage de lien de phishing confirmé.\n\n${detectionInfo}`,
            allowedMentions: { users: [] }
          });
          break;
      }

      return true;
    } catch (error) {
      logger.error('[AntiPhishing] Error executing action:', error);
      return false;
    }
  }

  /**
   * Nettoie les entrées expirées du cache
   */
  clearCache(): void {
    const now = Date.now();
    for (const [url, data] of this.cache.entries()) {
      if (now - data.timestamp > this.cacheTimeout) {
        this.cache.delete(url);
      }
    }
  }
}

export default new AntiPhishingSystem();
