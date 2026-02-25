/**
 * Role Delete Event Handler - Fixed
 */

import { Role } from 'discord.js';
import { logger } from '../../../../utils/logger';

export async function handleRoleDelete(
  role: Role,
  protectionModule: any
): Promise<void> {
  try {
    const config = await protectionModule.database.getConfig(role.guild.id);

    if (!config.antinuke_enabled) return;

    await protectionModule.antiNuke.handleRoleDelete(role.guild, role);

    await protectionModule.database.logAction(
      role.guild.id,
      'system',
      'nuke_attempt',
      'role_deleted',
      'Role supprimé',
      { role_id: role.id, role_name: role.name }
    );
  } catch (error) {
    logger.error('Error handling role delete:', error);
  }
}
