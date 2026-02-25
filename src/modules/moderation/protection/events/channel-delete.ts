import { GuildChannel, NonThreadGuildBasedChannel } from 'discord.js';
import { logger } from '../../../../utils/logger';

export async function handleChannelDelete(
  channel: GuildChannel | NonThreadGuildBasedChannel,
  protectionModule: any
): Promise<void> {
  try {
    // Type guard for guild channels
    if (!('guild' in channel)) return;

    const config = await protectionModule.database.getConfig(channel.guild.id);
    
    if (!config.antinuke_enabled) return;

    await protectionModule.antiNuke.handleChannelDelete(
      channel.guild,
      channel
    );

    await protectionModule.database.logAction(
      channel.guild.id,
      'system',
      'nuke_attempt',
      'channel_deleted',
      'Channel supprimé',
      { channel_id: channel.id, channel_name: channel.name }
    );

    if (config.antinuke_protect_admins) {
      await protectionModule.antiNuke.protectServer(
        channel.guild,
        'channel_delete'
      );
    }
  } catch (error) {
    logger.error('Error handling channel delete:', error);
  }
}
