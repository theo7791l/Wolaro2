import { GuildMember } from 'discord.js';
import pool from '../../../utils/database';
import { logger } from '../../../utils/logger';

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  try {
    // TODO: Implement member add logic
    logger.info(`Member ${member.user.tag} joined ${member.guild.name}`);
  } catch (error) {
    logger.error('Error handling guild member add:', error);
  }
}
