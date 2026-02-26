import { GuildChannel } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { EventHandler, EventContext } from '../../../../types';
import protectionModule from '../index';

export class ProtectionChannelDeleteHandler implements EventHandler {
  name = 'channelDelete';

  async execute(channel: GuildChannel, context: EventContext): Promise<void> {
    try {
      if (!channel.guild) return;

      // Check anti-nuke
      const shouldBlock = await protectionModule.antiNuke.checkChannelDelete(channel);
      if (shouldBlock) {
        await protectionModule.antiNuke.handleNuke(channel.guild);
      }
    } catch (error) {
      logger.error('Error handling channel delete:', error);
    }
  }
}
