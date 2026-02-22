import { Router } from 'express';
import { authMiddleware, guildAccessMiddleware, AuthRequest } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimiter';
import { DatabaseManager } from '../../database/manager';
import { logger } from '../../utils/logger';

export const analyticsRouter = Router();

/**
 * Get guild activity metrics
 * GET /api/analytics/:guildId/activity
 */
analyticsRouter.get('/:guildId/activity', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res) => {
  try {
    const { guildId } = req.params;
    const { period = '7d' } = req.query;

    const database: DatabaseManager = req.app.locals.database;

    // Calculate date range (sanitized via whitelist, never interpolated from user input)
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;

    const metrics = await database.query(
      `SELECT
          date,
          SUM(CASE WHEN metric_type = 'MESSAGE_COUNT' THEN metric_value ELSE 0 END) as messages,
          SUM(CASE WHEN metric_type = 'MEMBER_JOIN'   THEN metric_value ELSE 0 END) as joins,
          SUM(CASE WHEN metric_type = 'MEMBER_LEAVE'  THEN metric_value ELSE 0 END) as leaves,
          SUM(CASE WHEN metric_type = 'COMMAND_USAGE' THEN metric_value ELSE 0 END) as commands
        FROM guild_analytics
        WHERE guild_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY date
        ORDER BY date ASC`,
      [guildId]
    );

    res.json({ metrics });
  } catch (error) {
    logger.error('Error fetching activity metrics:', error);
    res.status(500).json({ error: 'Failed to fetch activity metrics' });
  }
});

/**
 * Get module usage statistics
 * GET /api/analytics/:guildId/modules
 */
analyticsRouter.get('/:guildId/modules', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res) => {
  try {
    const { guildId } = req.params;

    const database: DatabaseManager = req.app.locals.database;

    const moduleStats = await database.query(
      `SELECT module_name, enabled, config, updated_at
       FROM guild_modules
       WHERE guild_id = $1
       ORDER BY module_name`,
      [guildId]
    );

    res.json({ modules: moduleStats });
  } catch (error) {
    logger.error('Error fetching module stats:', error);
    res.status(500).json({ error: 'Failed to fetch module statistics' });
  }
});

/**
 * Get top users by activity
 * GET /api/analytics/:guildId/top-users
 */
analyticsRouter.get('/:guildId/top-users', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res) => {
  try {
    const { guildId } = req.params;
    const { limit = 10, metric = 'balance' } = req.query;

    const database: DatabaseManager = req.app.locals.database;

    // Fix SQL injection: sanitize orderBy via explicit whitelist (never interpolate user input)
    const ALLOWED_ORDER_BY = ['balance', 'bank_balance', 'daily_streak'] as const;
    type AllowedOrder = typeof ALLOWED_ORDER_BY[number];
    const orderBy: AllowedOrder = ALLOWED_ORDER_BY.includes(metric as AllowedOrder)
      ? (metric as AllowedOrder)
      : 'balance';

    const topUsers = await database.query(
      `SELECT user_id, balance, bank_balance, daily_streak
       FROM guild_economy
       WHERE guild_id = $1
       ORDER BY ${orderBy} DESC
       LIMIT $2`,
      [guildId, Math.min(Number(limit), 50)]
    );

    res.json({ topUsers });
  } catch (error) {
    logger.error('Error fetching top users:', error);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});
