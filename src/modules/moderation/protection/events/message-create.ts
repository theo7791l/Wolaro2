/**
 * Message Create Event Handler
 * Vérifie tous les messages pour spam, bad words, phishing, NSFW
 */

import { Message } from 'discord.js';
import protectionModule from '../index';
import { logger } from '../../../../utils/logger';

export default {
  name: 'messageCreate',
  async execute(message: Message) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    try {
      // 1. Anti-Spam Check
      const spamResult = await protectionModule.antiSpam.analyzeMessage(message);
      if (spamResult.isSpam && spamResult.action) {
        await protectionModule.antiSpam.executeAction(message, spamResult.action);
        return; // Stop processing
      }

      // 2. Bad Words Check
      // (integrated in anti-spam, but can be separate)

      // 3. Anti-Phishing Check
      const phishingResult = await protectionModule.antiPhishing.analyzeMessage(message);
      if (phishingResult.isPhishing && phishingResult.action && phishingResult.urls) {
        await protectionModule.antiPhishing.executeAction(
          message,
          phishingResult.action,
          phishingResult.urls
        );
        return;
      }

      // 4. NSFW Detection (if enabled)
      if (protectionModule.nsfwDetection.isEnabled()) {
        const nsfwResult = await protectionModule.nsfwDetection.analyzeMessage(message);
        if (nsfwResult.hasNSFW && nsfwResult.action && nsfwResult.images) {
          await protectionModule.nsfwDetection.executeAction(
            message,
            nsfwResult.action,
            nsfwResult.images
          );
          return;
        }
      }
    } catch (error) {
      logger.error('[Protection] Error in messageCreate handler:', error);
    }
  }
};
