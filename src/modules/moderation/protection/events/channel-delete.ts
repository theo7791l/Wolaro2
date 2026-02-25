/**
 * Channel Delete Event Handler
 * Track suppressions de channels pour anti-nuke
 */

import { DMChannel, GuildChannel, AuditLogEvent } from 'discord.js';
import protectionModule from '../index';
import { logger } from '../../../../utils/logger';

export default {
  name: 'channelDelete',
  async execute(channel: DMChannel | GuildChannel) {
    if (!channel.guild) return;

    try {
      const executor = await protectionModule.antiNuke.getExecutor(
        channel.guild,
        AuditLogEvent.ChannelDelete
      );
      if (!executor) return;

      const exceeded = await protectionModule.antiNuke.trackAction(
        executor.id,
        channel.guild.id,
        'channelDelete'
      );

      if (exceeded) {
        await protectionModule.antiNuke.handleNukeAttempt(
          channel.guild,
          executor,
          'channelDelete'
        );
      }
    } catch (error) {
      logger.error('[Protection] Error in channelDelete handler:', error);
    }
  }
};
