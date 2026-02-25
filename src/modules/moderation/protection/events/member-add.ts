/**
 * Guild Member Add Event Handler
 * Vérifie nouveaux membres pour raids + applique captcha si besoin
 */

import { GuildMember } from 'discord.js';
import protectionModule from '../index';
import { logger } from '../../../../utils/logger';

export default {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    try {
      const config = await (protectionModule as any).db.getConfig(member.guild.id);

      // Check if lockdown is active (RAID mode)
      const lockdownStatus = protectionModule.smartLockdown.getStatus(member.guild.id);
      if (lockdownStatus && config.antiraid_auto_lockdown) {
        await member.kick('Lockdown actif - Nouveaux membres refusés');
        logger.info(`[Protection] Kicked ${member.user.tag} during lockdown`);
        return;
      }

      // Anti-Raid Analysis
      if (config.antiraid_enabled) {
        const raidResult = await protectionModule.antiRaid.analyzeMember(member);

        if (raidResult.action) {
          await protectionModule.antiRaid.executeAction(member, raidResult.action, raidResult);

          // Check for auto-lockdown
          if (config.antiraid_auto_lockdown && raidResult.riskScore >= 7) {
            await protectionModule.smartLockdown.autoEscalateLockdown(
              member.guild,
              raidResult.riskScore
            );
          }
        }

        // Send captcha if enabled and member not kicked
        if (config.antiraid_captcha_enabled && raidResult.riskScore >= 3 && member.joinedAt) {
          await protectionModule.antiRaid.sendCaptcha(member);
        }
      }
    } catch (error) {
      logger.error('[Protection] Error in guildMemberAdd handler:', error);
    }
  }
};
