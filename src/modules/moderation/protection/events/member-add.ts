import { GuildMember } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { IEvent } from '../../../../types';
import protectionModule from '../index';

export class ProtectionMemberAddHandler implements IEvent {
  name = 'guildMemberAdd';

  async execute(member: GuildMember): Promise<void> {
    try {
      // Anti-raid analysis
      const riskAnalysis = await protectionModule.antiRaid.analyzeMemberJoin(member);
      
      if (riskAnalysis.isRisk) {
        logger.warn(
          `High-risk member join detected in ${member.guild.name}: ` +
          `${member.user.tag} (score: ${riskAnalysis.riskScore})`
        );
        // Le système anti-raid gère automatiquement les actions
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
