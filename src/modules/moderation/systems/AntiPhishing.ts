import { Message } from 'discord.js';
import axios from 'axios';
import { logger } from '../../../utils/logger';

export class AntiPhishing {
  async check(message: Message): Promise<boolean> {
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
      
      if (message.channel.isSendable()) {
        const reply = await message.channel.send({
          content: `⚠️ **${message.author}** Lien de phishing détecté et supprimé !`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 10000);
      }
    } catch (error) {
      logger.error('Error handling phishing:', error);
    }
  }

  private async isPhishing(url: string): Promise<boolean> {
    // Basic phishing patterns
    const phishingPatterns = [
      /discord[\.\-_](gift|nitro|promo)/i,
      /free[\.\-_]nitro/i,
      /steam[\.\-_](community|powered)/i,
    ];

    return phishingPatterns.some(pattern => pattern.test(url));
  }
}
