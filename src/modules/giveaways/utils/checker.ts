import { Client } from 'discord.js';
import { DatabaseManager } from '../../../database/manager';
import { GiveawayManager } from './manager';
import { logger } from '../../../utils/logger';

export class GiveawayChecker {
  private static interval: NodeJS.Timeout | null = null;

  static start(client: Client, database: DatabaseManager): void {
    if (this.interval) return;

    logger.info('Starting giveaway checker...');

    // Check every 10 seconds
    this.interval = setInterval(async () => {
      try {
        const expiredGiveaways = await database.query(
          'SELECT * FROM giveaways WHERE status = $1 AND end_time <= NOW()',
          ['active']
        );

        for (const giveaway of expiredGiveaways) {
          await GiveawayManager.endGiveaway(giveaway.id, { client, database });
        }
      } catch (error) {
        logger.error('Error in giveaway checker:', error);
      }
    }, 10000);
  }

  static stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Giveaway checker stopped');
    }
  }
}
