import { Message } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { IEvent } from '../../../../types';
import protectionModule from '../index';

export class ProtectionMessageHandler implements IEvent {
  name = 'messageCreate';

  async execute(message: Message, context?: any): Promise<void> {
    try {
      if (message.author.bot || !message.guild) return;

      // Check spam
      const spamResult = await protectionModule.antiSpam.checkSpam(message);
      if (spamResult) {
        await protectionModule.antiSpam.handleSpam(message);
        return; // Stop processing if spam detected
      }

      // Check bad words - VÉRIFIER .detected, pas l'objet entier
      const badWordsResult = await protectionModule.badWords.check(message);
      if (badWordsResult.detected) {
        await protectionModule.badWords.handle(message);
        return; // Stop processing if bad word detected
      }

      // Check phishing
      const phishingResult = await protectionModule.antiPhishing.check(message);
      if (phishingResult) {
        await protectionModule.antiPhishing.handle(message);
        return;
      }

      // Check NSFW
      if (message.attachments.size > 0) {
        const nsfwResult = await protectionModule.nsfwDetection.check(message);
        if (nsfwResult) {
          await protectionModule.nsfwDetection.handle(message);
          return;
        }
      }
    } catch (error) {
      logger.error('Error handling message create:', error);
    }
  }
}
