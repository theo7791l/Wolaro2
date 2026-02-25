/**
 * NSFW Detection System - Fixed channel types
 */

import { Message } from 'discord.js';
import axios from 'axios';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';
import type { NSFWDetectionResult } from '../types';

export class NSFWDetectionSystem {
  private sightengineUser = process.env.SIGHTENGINE_API_USER;
  private sightengineSecret = process.env.SIGHTENGINE_API_SECRET;

  constructor(private db: ProtectionDatabase) {}

  async check(message: Message): Promise<boolean> {
    if (!message.guild || message.attachments.size === 0) return false;

    const config = await this.db.getConfig(message.guild.id);
    if (!config.nsfw_detection_enabled || !this.sightengineUser) return false;

    for (const attachment of message.attachments.values()) {
      if (attachment.contentType?.startsWith('image/')) {
        const result = await this.analyzeImage(attachment.url);
        if (result.is_nsfw && result.score >= config.nsfw_threshold) {
          return true;
        }
      }
    }

    return false;
  }

  async handle(message: Message): Promise<void> {
    try {
      await message.delete();
      await this.db.incrementStat(message.guild!.id, 'nsfw_detected');

      if (message.channel.isSendable()) {
        const reply = await message.channel.send({
          content: `⚠️ **${message.author}** Contenu NSFW détecté et supprimé.`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 10000);
      }
    } catch (error) {
      logger.error('Error handling NSFW:', error);
    }
  }

  private async analyzeImage(url: string): Promise<NSFWDetectionResult> {
    try {
      const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
        params: {
          url,
          models: 'nudity',
          api_user: this.sightengineUser,
          api_secret: this.sightengineSecret,
        },
      });

      const { nudity } = response.data;
      const score = Math.max(nudity.sexual_activity || 0, nudity.sexual_display || 0);

      return {
        is_nsfw: score > 0.5,
        score,
        labels: ['nudity'],
        image_url: url,
      };
    } catch (error) {
      logger.error('Error analyzing image:', error);
      return { is_nsfw: false, score: 0, labels: [], image_url: url };
    }
  }
}
