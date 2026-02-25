/**
 * Anti-Phishing System - Fixed channel.send types
 */

import { Message } from 'discord.js';
import axios from 'axios';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';

export class AntiPhishingSystem {
  private phishingPatterns = [
    /discord[\.\-_](gift|nitro|promo)/i,
    /free[\.\-_]nitro/i,
    /steam[\.\-_](community|powered)/i,
  ];

  constructor(private db: ProtectionDatabase) {}

  async check(message: Message): Promise<boolean> {
    if (!message.guild) return false;

    const config = await this.db.getConfig(message.guild.id);
    if (!config.antiphishing_enabled) return false;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = message.content.match(urlRegex);

    if (!urls) return false;

    for (const url of urls) {
      if (await this.isPhishing(url)) {
        return true;
      }
    }

    return false;
  }

  async handle(message: Message): Promise<void> {
    try {
      await message.delete();
      await this.db.incrementStat(message.guild!.id, 'phishing_blocked');

      if (message.channel.isSendable()) {
        const reply = await message.channel.send({
          content: `⚠️ **${message.author}** Lien de phishing détecté et supprimé !`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 10000);
      }

      await this.db.logAction(
        message.guild!.id,
        message.author.id,
        'phishing_detected',
        'message_deleted',
        'Lien de phishing détecté',
        { message_content: message.content }
      );
    } catch (error) {
      logger.error('Error handling phishing:', error);
    }
  }

  private async isPhishing(url: string): Promise<boolean> {
    return this.phishingPatterns.some(pattern => pattern.test(url));
  }
}
