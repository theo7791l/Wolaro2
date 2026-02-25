/**
 * Protection Event: Member Add
 * Analyse chaque nouveau membre pour détection de raids
 */

import { GuildMember } from 'discord.js';
import { logger } from '../../../../utils/logger';
import type { WolaroEvent } from '../../../../types';

export default {
  name: 'guildMemberAdd',
  once: false,
  
  async execute(member: GuildMember) {
    try {
      // Import systems dynamically to avoid circular dependencies
      const { antiRaid } = await import('../index');
      if (!antiRaid) return;

      // Analyze member
      const analysis = await antiRaid.analyzeMemberJoin(member);

      // Execute action if suspicious
      if (analysis.isSuspicious && analysis.action.type !== 'NONE') {
        const result = await antiRaid.executeAction(member, analysis.action, analysis.riskScore);
        
        // Log to channel
        const config = await antiRaid['db'].getConfig(member.guild.id);
        if (config.log_channel_id) {
          const logChannel = member.guild.channels.cache.get(config.log_channel_id);
          if (logChannel?.isTextBased()) {
            await logChannel.send({
              embeds: [{
                color: analysis.riskScore >= 10 ? 0xff0000 : analysis.riskScore >= 7 ? 0xff6600 : 0xffaa00,
                title: '🚨 Membre suspect détecté',
                description:
                  `**Membre:** ${member.user.tag} (${member.id})\n` +
                  `**Score de risque:** ${analysis.riskScore}/15\n` +
                  `**Mode raid:** ${analysis.raidMode ? '🔴 ACTIF' : '🟢 Inactif'}\n` +
                  `**Action:** ${result.message}`,
                fields: analysis.riskFactors.map(rf => ({
                  name: `${rf.type} (+${rf.severity})`,
                  value: rf.details,
                  inline: true
                })),
                timestamp: new Date().toISOString(),
                footer: { text: 'Wolaro Anti-Raid System' }
              }]
            });
          }
        }

        logger.info(
          `[AntiRaid] ${member.user.tag}: Risk ${analysis.riskScore} → ${analysis.action.type}`
        );
      }
    } catch (error) {
      logger.error('[Protection Member Add] Error:', error);
    }
  }
} as WolaroEvent;
