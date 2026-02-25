import { Message } from 'discord.js';
import { logger } from '../../../../utils/logger';

export async function handleMessageCreate(
  message: Message,
  protectionModule: any
): Promise<void> {
  try {
    if (message.author.bot || !message.guild) return;

    // Check spam
    if (await protectionModule.antiSpam.checkSpam(message)) {
      await protectionModule.antiSpam.handleSpam(message);
    }

    // Check bad words
    if (await protectionModule.badWords.check(message)) {
      await protectionModule.badWords.handle(message);
    }

    // Check phishing
    if (await protectionModule.antiPhishing.check(message)) {
      await protectionModule.antiPhishing.handle(message);
    }

    // Check NSFW
    if (message.attachments.size > 0 && await protectionModule.nsfwDetection.check(message)) {
      await protectionModule.nsfwDetection.handle(message);
    }
  } catch (error) {
    logger.error('Error handling message create:', error);
  }
}
