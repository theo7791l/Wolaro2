import { GuildMember } from 'discord.js';
import { logger } from '../../../../utils/logger';

export async function handleMemberAdd(
  member: GuildMember,
  protectionModule: any
): Promise<void> {
  try {
    const config = await protectionModule.database.getConfig(member.guild.id);

    if (!config.antiraid_enabled) return;

    // Whitelist check
    if (config.whitelist_users.includes(member.id)) {
      logger.info(`Whitelisted user ${member.user.tag} joined ${member.guild.name}`);
      return;
    }

    // Analyze member for raid risk
    const raidResult = await protectionModule.antiRaid.analyzeMemberJoin(member);

    if (raidResult.isRisk) {
      await protectionModule.database.logRaidDetection(
        member.id,
        member.guild.id,
        raidResult.riskScore,
        raidResult.riskFactors
      );

      // Send captcha if enabled
      if (config.antiraid_captcha_enabled && raidResult.riskScore >= 5) {
        try {
          await protectionModule.captcha.sendCaptcha(member);
          logger.info(`Captcha sent to ${member.user.tag}`);
        } catch (error) {
          logger.error('Error sending captcha:', error);
        }
      }

      // Auto lockdown if configured
      if (config.antiraid_auto_lockdown && raidResult.riskScore >= 8) {
        await protectionModule.lockdown.triggerLockdown(
          member.guild,
          'high_risk_raid',
          'Automatic raid protection'
        );
      }
    }
  } catch (error) {
    logger.error('Error handling member add:', error);
  }
}
