import { IEvent } from '../../../types';
import { Message, GuildMember } from 'discord.js';
import { SecurityManager } from '../../../utils/security';
import { logger } from '../../../utils/logger';

export class ModerationEventHandler implements IEvent {
  name = 'messageCreate';
  module = 'moderation';

  async execute(message: Message, context: any): Promise<void> {
    if (message.author.bot || !message.guild) return;

    try {
      // Get module config
      const config = await context.database.getGuildConfig(message.guild.id);
      const moderationModule = config?.modules?.find((m: any) => m.module_name === 'moderation');

      if (!moderationModule?.enabled || !moderationModule?.config?.autoMod) return;

      // Check for suspicious patterns
      if (SecurityManager.detectSuspiciousPattern(message.content)) {
        logger.warn(`Suspicious message detected from ${message.author.tag} in ${message.guild.name}`);

        // Auto-delete if configured
        if (moderationModule.config.autoTimeout) {
          try {
            await message.delete();
            await message.channel.send(
              `⚠️ ${message.author}, votre message a été supprimé automatiquement (contenu suspect détecté).`
            ).then((msg) => setTimeout(() => msg.delete(), 5000));

            // Log the action
            await context.database.logAction(
              message.author.id,
              'AUTO_MOD_DELETE',
              {
                content: message.content.substring(0, 100),
                channelId: message.channel.id,
              },
              message.guild.id
            );
          } catch (error) {
            logger.error('Failed to auto-delete message:', error);
          }
        }
      }
    } catch (error) {
      logger.error('Error in moderation event handler:', error);
    }
  }
}
