import { Router } from 'express';
import { authMiddleware, guildAccessMiddleware, AuthRequest } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimiter';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { ExtendedWebSocketServer } from '../../types/websocket';
import { logger } from '../../utils/logger';

export const guildRouter = Router();

/**
 * Get user's guilds
 * GET /api/guilds
 */
guildRouter.get('/', standardRateLimiter, authMiddleware, async (req: AuthRequest, res) => {
  try {
    const database: DatabaseManager = req.app.locals.database;

    const guilds = await database.query(
      'SELECT * FROM guilds WHERE owner_id = $1',
      [req.user!.id]
    );

    res.json({ guilds });
  } catch (error) {
    logger.error('Error fetching guilds:', error);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

/**
 * Get guild configuration
 * GET /api/guilds/:guildId
 */
guildRouter.get('/:guildId', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const database: DatabaseManager = req.app.locals.database;
    const redis: RedisManager = req.app.locals.redis;

    // Check cache first
    let config = await redis.getGuildConfig(guildId);
    if (!config) {
      config = await database.getGuildConfig(guildId);
      if (config) {
        await redis.cacheGuildConfig(guildId, config);
      }
    }

    if (!config) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    res.json(config);
  } catch (error) {
    logger.error('Error fetching guild config:', error);
    res.status(500).json({ error: 'Failed to fetch guild configuration' });
  }
});

/**
 * Update guild settings
 * PATCH /api/guilds/:guildId/settings
 */
guildRouter.patch('/:guildId/settings', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const { category, key, value } = req.body;

    if (!category || !key || value === undefined) {
      return res.status(400).json({ error: 'Category, key, and value are required' });
    }

    const database: DatabaseManager = req.app.locals.database;
    const redis: RedisManager = req.app.locals.redis;
    const websocket: ExtendedWebSocketServer = req.app.locals.websocket;

    await database.query(
      `INSERT INTO guild_settings (guild_id, category, key, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, category, key)
       DO UPDATE SET value = $4, updated_at = CURRENT_TIMESTAMP`,
      [guildId, category, key, JSON.stringify(value)]
    );

    // Invalidate cache
    await redis.invalidateGuildConfig(guildId);

    // Notify via WebSocket
    websocket.notifyConfigUpdate(guildId, { category, key, value });

    // Log action
    await database.logAction(req.user!.id, 'SETTINGS_UPDATE', {
      guildId,
      category,
      key,
      value,
    });

    logger.info(`Settings updated for guild ${guildId} by ${req.user!.username}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating guild settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Get guild analytics
 * GET /api/guilds/:guildId/analytics
 */
guildRouter.get('/:guildId/analytics', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const { startDate, endDate, metricType } = req.query;

    const database: DatabaseManager = req.app.locals.database;

    let query = `
      SELECT metric_type, metric_value, metadata, recorded_at
      FROM guild_analytics
      WHERE guild_id = $1
    `;
    const params: any[] = [guildId];

    if (startDate) {
      query += ` AND date >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date <= $${params.length + 1}`;
      params.push(endDate);
    }
    if (metricType) {
      query += ` AND metric_type = $${params.length + 1}`;
      params.push(metricType);
    }

    query += ' ORDER BY recorded_at DESC LIMIT 1000';

    const analytics = await database.query(query, params);
    res.json({ analytics });
  } catch (error) {
    logger.error('Error fetching guild analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
