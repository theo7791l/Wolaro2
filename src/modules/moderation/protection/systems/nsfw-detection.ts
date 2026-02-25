/**
 * NSFW Detection System - Migrated from TheoProtect nsfwDetection.js
 * Détection AI de contenu NSFW via Sightengine API
 */

import { Message } from 'discord.js';
import axios from 'axios';
import { logger } from '../../../../utils/logger';
import { ProtectionDB } from '../database';
import type { NSFWDetectionResult } from '../types';

interface CacheEntry {
  result: NSFWDetectionResult;
  timestamp: number;
}

export class NSFWDetectionSystem {
  private apiUser: string | undefined;
  private apiSecret: string | undefined;
  private enabled: boolean;
  private cache = new Map<string, CacheEntry>();
  private cacheTimeout = 3600000; // 1 hour
  private db: ProtectionDB;

  constructor(db: ProtectionDB) {
    this.db = db;
    this.apiUser = process.env.SIGHTENGINE_API_USER;
    this.apiSecret = process.env.SIGHTENGINE_API_SECRET;
    this.enabled = !!(this.apiUser && this.apiSecret);

    if (!this.enabled) {
      logger.warn('⚠️  [NSFW] Sightengine API not configured - NSFW detection disabled');
      logger.info('   💡 Add SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET to enable');
    } else {
      logger.info('✅ [NSFW] Detection system enabled');
    }
  }

  /**
   * Check if system is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Extract image URLs from message
   */
  private extractImageUrls(message: Message): string[] {
    const urls: string[] = [];

    // Attachments
    message.attachments.forEach(attachment => {
      if (attachment.contentType?.startsWith('image/')) {
        urls.push(attachment.url);
      }
    });

    // Embeds
    message.embeds.forEach(embed => {
      if (embed.image?.url) urls.push(embed.image.url);
      if (embed.thumbnail?.url) urls.push(embed.thumbnail.url);
    });

    // URLs in message content
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
    const contentUrls = message.content.match(urlRegex) || [];
    urls.push(...contentUrls);

    return [...new Set(urls)];
  }

  /**
   * Check image URL with Sightengine API
   */
  private async checkImage(imageUrl: string): Promise<NSFWDetectionResult | null> {
    if (!this.enabled) return null;

    // Check cache
    const cached = this.cache.get(imageUrl);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    try {
      const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
        params: {
          url: imageUrl,
          models: 'nudity-2.1,gore,offensive',
          api_user: this.apiUser,
          api_secret: this.apiSecret
        },
        timeout: 10000
      });

      const data = response.data;

      // Calculate NSFW score
      const nsfwScore = Math.max(
        data.nudity?.sexual_activity || 0,
        data.nudity?.sexual_display || 0,
        data.nudity?.erotica || 0,
        data.gore?.prob || 0,
        data.offensive?.prob || 0
      );

      const result: NSFWDetectionResult = {
        is_nsfw: nsfwScore > 0.7,
        score: nsfwScore,
        labels: [
          ...(data.nudity?.sexual_activity > 0.5 ? ['sexual_activity'] : []),
          ...(data.nudity?.sexual_display > 0.5 ? ['sexual_display'] : []),
          ...(data.nudity?.erotica > 0.5 ? ['erotica'] : []),
          ...(data.gore?.prob > 0.5 ? ['gore'] : []),
          ...(data.offensive?.prob > 0.5 ? ['offensive'] : [])
        ],
        image_url: imageUrl
      };

      // Cache result
      this.cache.set(imageUrl, { result, timestamp: Date.now() });

      return result;
    } catch (error) {
      logger.error('[NSFW] API error:', error);
      return null;
    }
  }

  /**
   * Analyze message for NSFW content
   */
  async analyzeMessage(message: Message): Promise<{
    hasNSFW: boolean;
    checked: boolean;
    images?: Array<{ url: string; score: number; labels: string[] }>;
    action?: any;
  }> {
    if (!this.enabled) {
      return { hasNSFW: false, checked: false };
    }

    const config = await this.db.getConfig(message.guild!.id);
    if (!config.nsfw_detection_enabled) {
      return { hasNSFW: false, checked: false };
    }

    const imageUrls = this.extractImageUrls(message);
    if (imageUrls.length === 0) {
      return { hasNSFW: false, checked: true, images: [] };
    }

    const results: Array<{ url: string; score: number; labels: string[] }> = [];

    for (const url of imageUrls) {
      const result = await this.checkImage(url);
      if (result && result.score >= config.nsfw_threshold) {
        results.push({
          url,
          score: result.score,
          labels: result.labels
        });
      }
    }

    return {
      hasNSFW: results.length > 0,
      checked: true,
      images: results,
      action: results.length > 0 ? this.determineAction(results) : null
    };
  }

  /**
   * Determine action based on NSFW detection
   */
  private determineAction(results: Array<{ score: number }>): {
    type: string;
    reason: string;
    duration?: number;
    deleteMessage?: boolean;
  } {
    const maxScore = Math.max(...results.map(r => r.score));

    if (maxScore >= 0.9) {
      return {
        type: 'BAN',
        reason: 'Contenu NSFW extrêmement explicite',
        deleteMessage: true
      };
    } else if (maxScore >= 0.8) {
      return {
        type: 'TIMEOUT',
        reason: 'Contenu NSFW détecté',
        duration: 86400000, // 24h
        deleteMessage: true
      };
    } else if (maxScore >= 0.7) {
      return {
        type: 'WARN',
        reason: 'Contenu potentiellement inapproprié',
        deleteMessage: true
      };
    }

    return {
      type: 'DELETE',
      reason: 'Contenu suspect détecté'
    };
  }

  /**
   * Execute action on NSFW message
   */
  async executeAction(
    message: Message,
    action: any,
    results: Array<{ url: string; score: number; labels: string[] }>
  ): Promise<boolean> {
    try {
      // Delete message
      await message.delete();

      const imageList = results
        .map(r => `• Score: ${(r.score * 100).toFixed(1)}% - Labels: ${r.labels.join(', ')}`)
        .join('\n');

      switch (action.type) {
        case 'WARN':
          await message.channel.send({
            content:
              `⚠️ ${message.author}, message supprimé pour contenu inapproprié.\n\n` +
              `**Images détectées:**\n${imageList}`,
            allowedMentions: { users: [message.author.id] }
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
          break;

        case 'TIMEOUT':
          if (message.member) {
            await message.member.timeout(action.duration, action.reason);
          }
          await message.channel.send({
            content: `🔇 ${message.author} timeout 24h pour contenu NSFW.`
          });
          break;

        case 'BAN':
          if (message.member) {
            await message.member.ban({ reason: action.reason, deleteMessageSeconds: 86400 });
          }
          await message.channel.send({
            content: `🔨 ${message.author.tag} banni pour contenu NSFW explicite.`
          });
          break;

        default:
          await message.channel.send({
            content: '🚫 Message supprimé : contenu inapproprié.'
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      }

      // Log action
      await this.db.logAction({
        guild_id: message.guild!.id,
        user_id: message.author.id,
        type: 'nsfw_detected',
        action: action.type === 'WARN' ? 'warn' : action.type === 'TIMEOUT' ? 'timeout' : action.type.toLowerCase() as any,
        reason: action.reason,
        details: { images: results.map(r => ({ url: r.url, score: r.score, labels: r.labels })) }
      });

      await this.db.incrementStat(message.guild!.id, 'nsfw_detected');

      return true;
    } catch (error) {
      logger.error('[NSFW] Error executing action:', error);
      return false;
    }
  }
}
