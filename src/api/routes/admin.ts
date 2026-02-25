import { Router } from 'express';
import { authMiddleware, masterAdminMiddleware, AuthRequest } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimiter';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { logger } from '../../utils/logger';

export const adminRouter = Router();

// All admin routes require master admin access + strict rate limiting
adminRouter.use(strictRateLimiter, authMiddleware, masterAdminMiddleware);

/**
 * Get all guilds (Master Admin)
 * GET /api/admin/guilds
 */
adminRouter.get('/guilds', async (req: AuthRequest, res) => {
  try {
    const database: DatabaseManager = req.app.locals.database;

    const guilds = await database.query(
      `SELECT g.*, COUNT(gm.id) as module_count
        FROM guilds g
        LEFT JOIN guild_modules gm ON g.guild_id = gm.guild_id AND gm.enabled = true
        GROUP BY g.guild_id
        ORDER BY g.created_at DESC
        LIMIT 100`
    );

    return res.json({ guilds });
  } catch (error) {
    logger.error('Error fetching all guilds:', error);
    return res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

/**
 * Impersonate guild (Master Admin)
 * GET /api/admin/impersonate/:guildId
 */
adminRouter.get('/impersonate/:guildId', async (req: AuthRequest, res) => {
  try {
    const { guildId } = req.params;
    const database: DatabaseManager = req.app.locals.database;

    const config = await database.getGuildConfig(guildId);

    if (!config) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    // Log impersonation
    await database.logAction(req.user!.id, 'MASTER_IMPERSONATE', {
      targetGuildId: guildId,
    });

    logger.warn(`Master admin ${req.user!.username} impersonated guild ${guildId}`);

    return res.json({ config });
  } catch (error) {
    logger.error('Error impersonating guild:', error);
    return res.status(500).json({ error: 'Failed to impersonate guild' });
  }
});

/**
 * Blacklist guild (Master Admin)
 * POST /api/admin/blacklist/:guildId
 */
adminRouter.post('/blacklist/:guildId', async (req: AuthRequest, res) => {
  try {
    const { guildId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const database: DatabaseManager = req.app.locals.database;
    const redis: RedisManager = req.app.locals.redis;

    await database.query(
      `UPDATE guilds SET is_blacklisted = true, blacklist_reason = $2 WHERE guild_id = $1`,
      [guildId, reason]
    );

    // Invalidate cache
    await redis.invalidateGuildConfig(guildId);

    // Log action
    await database.logAction(req.user!.id, 'MASTER_BLACKLIST', {
      guildId,
      reason,
    });

    logger.warn(`Guild ${guildId} blacklisted by ${req.user!.username}: ${reason}`);

    return res.json({ success: true });
  } catch (error) {
    logger.error('Error blacklisting guild:', error);
    return res.status(500).json({ error: 'Failed to blacklist guild' });
  }
});

/**
 * Get audit logs (Master Admin)
 * GET /api/admin/audit-logs
 */
adminRouter.get('/audit-logs', async (req: AuthRequest, res) => {
  try {
    const { guildId, userId, actionType, limit = 100 } = req.query;
    const database: DatabaseManager = req.app.locals.database;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (guildId) {
      query += ` AND guild_id = $${params.length + 1}`;
      params.push(guildId);
    }
    if (userId) {
      query += ` AND user_id = $${params.length + 1}`;
      params.push(userId);
    }
    if (actionType) {
      query += ` AND action_type = $${params.length + 1}`;
      params.push(actionType);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(Number(limit), 1000));

    const logs = await database.query(query, params);
    return res.json({ logs });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * Get system statistics (Master Admin)
 * GET /api/admin/stats
 */
adminRouter.get('/stats', async (req: AuthRequest, res) => {
  try {
    const database: DatabaseManager = req.app.locals.database;

    const stats = await database.query(`
      SELECT
        (SELECT COUNT(*) FROM guilds) as total_guilds,
        (SELECT COUNT(*) FROM guilds WHERE is_blacklisted = false) as active_guilds,
        (SELECT COUNT(*) FROM global_profiles) as total_users,
        (SELECT COUNT(*) FROM guilds WHERE plan_type = 'PREMIUM') as premium_guilds,
        (SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours') as actions_24h
    `);

    return res.json({ stats: stats[0] });
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    return res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
});
