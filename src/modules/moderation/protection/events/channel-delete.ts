import { GuildChannel } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { IEvent } from '../../../../types';
import protectionModule from '../index';

export class ProtectionChannelDeleteHandler implements IEvent {
  name = 'channelDelete';

  async execute(channel: GuildChannel): Promise<void> {
    try {
      if (!channel.guild) return;

      // Anti-nuke will handle channel deletion tracking internally
      await protectionModule.antiNuke.handleChannelDelete(channel.guild, channel);
    } catch (error) {
      logger.error('Error handling channel delete:', error);
    }
  }
}
