import { Message } from 'discord.js';
import pool from '../../../utils/database';
import { logger } from '../../../utils/logger';

export async function handleMessageCreate(message: Message): Promise<void> {
  try {
    if (message.author.bot) return;
    // TODO: Implement message handling logic
  } catch (error) {
    logger.error('Error handling message create:', error);
  }
}
