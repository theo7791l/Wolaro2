import { GuildMember } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { IEvent } from '../../../../types';
import protectionModule from '../index';

export class ProtectionMemberAddHandler implements IEvent {
  name = 'guildMemberAdd';

  async execute(member: GuildMember): Promise<void> {
    try {
      // Check anti-raid (simplified - just track join)
      // The actual anti-raid system will handle detection internally
      await protectionModule.antiRaid.handleMemberJoin(member);

      // Check if captcha is enabled
      const config = await (protectionModule as any).db.getConfig(member.guild.id);
      if (config.antiraid_captcha_enabled) {
        await protectionModule.captcha.sendCaptcha(member);
      }
    } catch (error) {
      logger.error('Error handling member add:', error);
    }
  }
}
