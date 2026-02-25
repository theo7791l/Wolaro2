/**
 * Role Delete Event Handler
 * Track suppressions de rôles pour anti-nuke
 */

import { Role, AuditLogEvent } from 'discord.js';
import protectionModule from '../index';
import { logger } from '../../../../utils/logger';

export default {
  name: 'roleDelete',
  async execute(role: Role) {
    try {
      const executor = await protectionModule.antiNuke.getExecutor(
        role.guild,
        AuditLogEvent.RoleDelete
      );
      if (!executor) return;

      const exceeded = await protectionModule.antiNuke.trackAction(
        executor.id,
        role.guild.id,
        'roleDelete'
      );

      if (exceeded) {
        await protectionModule.antiNuke.handleNukeAttempt(role.guild, executor, 'roleDelete');
      }
    } catch (error) {
      logger.error('[Protection] Error in roleDelete handler:', error);
    }
  }
};
