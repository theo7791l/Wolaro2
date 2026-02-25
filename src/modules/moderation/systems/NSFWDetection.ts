import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';

export class NSFWDetection {
  async check(message: Message): Promise<boolean> {
    // Basic check - can be enhanced with APIs
    return false;
  }

  async handle(message: Message): Promise<void> {
    try {
      await message.delete();
      
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
}
