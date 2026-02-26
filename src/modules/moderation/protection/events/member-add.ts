import { GuildMember } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { EventHandler, EventContext } from '../../../../types';
import protectionModule from '../index';

export class ProtectionMemberAddHandler implements EventHandler {
  name = 'guildMemberAdd';

  async execute(member: GuildMember, context: EventContext): Promise<void> {
    try {
      // Check anti-raid
      const shouldTrigger = await protectionModule.antiRaid.checkMemberJoin(member);
      if (shouldTrigger) {
        await protectionModule.antiRaid.handleRaid(member.guild);
      }

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
