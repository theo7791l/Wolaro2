import { Role } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { EventHandler, EventContext } from '../../../../types';
import protectionModule from '../index';

export class ProtectionRoleDeleteHandler implements EventHandler {
  name = 'roleDelete';

  async execute(role: Role, context: EventContext): Promise<void> {
    try {
      // Check anti-nuke
      const shouldBlock = await protectionModule.antiNuke.checkRoleDelete(role);
      if (shouldBlock) {
        await protectionModule.antiNuke.handleNuke(role.guild);
      }
    } catch (error) {
      logger.error('Error handling role delete:', error);
    }
  }
}
