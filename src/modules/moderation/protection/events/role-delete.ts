import { Role } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { IEvent } from '../../../../types';
import protectionModule from '../index';

export class ProtectionRoleDeleteHandler implements IEvent {
  name = 'roleDelete';

  async execute(role: Role): Promise<void> {
    try {
      // Anti-nuke will handle role deletion tracking internally
      await protectionModule.antiNuke.handleRoleDelete(role.guild, role);
    } catch (error) {
      logger.error('Error handling role delete:', error);
    }
  }
}
