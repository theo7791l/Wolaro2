/**
 * Bad Words System - Fixed types
 */

import { Message } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';
import type { BadWordDetectionResult } from '../types';

export class BadWordsSystem {
  private badWords = [
    'badword1',
    'badword2',
    // Add more as needed
  ];

  constructor(private db: ProtectionDatabase) {}

  async check(message: Message): Promise<BadWordDetectionResult> {
    if (!message.guild) {
      return { detected: false, words: [], severity: 'low' };
    }

    const config = await this.db.getConfig(message.guild.id);
    if (!config.badwords_enabled) {
      return { detected: false, words: [], severity: 'low' };
    }

    const content = message.content.toLowerCase();
    const detectedWords = this.badWords.filter(word => content.includes(word.toLowerCase()));

    if (detectedWords.length > 0) {
      return {
        detected: true,
        words: detectedWords,
        severity: detectedWords.length > 2 ? 'high' : 'medium',
      };
    }

    return { detected: false, words: [], severity: 'low' };
  }

  async handle(message: Message): Promise<void> {
    try {
      await message.delete();
      await this.db.incrementStat(message.guild!.id, 'badwords_filtered');

      if (message.channel.isSendable()) {
        const reply = await message.channel.send({
          content: `⚠️ **${message.author}** Langage inapproprié détecté.`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      }
    } catch (error) {
      logger.error('Error handling bad words:', error);
    }
  }
}
