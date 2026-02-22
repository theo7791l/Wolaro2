import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../../database/manager';
import { PubSubManager } from '../../cache/pubsub';
import { authMiddleware } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Panel API Routes for wolaro.fr/panel
 * Secure communication between web panel and bot
 * With Redis Pub/Sub for real-time sync
 */

// Get user guilds with bot presence and permissions
router.get('/guilds', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;

    // Get guilds where user is admin and bot is present
    const guilds = await database.query(
      `SELECT g.*,
        CASE WHEN gm.user_id IS NOT NULL THEN true ELSE false END as is_admin
      FROM guilds g
      LEFT JOIN guild_members gm ON g.guild_id = gm.guild_id AND gm.user_id = $1
      WHERE gm.permissions @> ARRAY['ADMINISTRATOR']::varchar[]
         OR g.owner_id = $1
      ORDER BY g.joined_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: guilds,
      count: guilds.length,
    });
  } catch (error: any) {
    logger.error('Error fetching user guilds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch guilds',
    });
  }
});

// Get specific guild configuration
router.get('/guilds/:guildId', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;

    // Verify user has access to this guild
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2 AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
       UNION
       SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
      [guildId, userId]
    );

    if (hasAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get guild config with modules
    const guild = await database.getGuildConfig(guildId);

    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found',
      });
    }

    res.json({
      success: true,
      data: guild,
    });
  } catch (error: any) {
    logger.error('Error fetching guild config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch guild configuration',
    });
  }
});

// Update guild settings
router.patch('/guilds/:guildId', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const pubsub: PubSubManager = req.app.locals.pubsub;
    const { settings } = req.body;

    // Verify access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2 AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
       UNION
       SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
      [guildId, userId]
    );

    if (hasAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Update settings
    await database.query(
      'UPDATE guilds SET settings = $1, updated_at = NOW() WHERE guild_id = $2',
      [JSON.stringify(settings), guildId]
    );

    // Publish config update event to Redis
    await pubsub.publishConfigUpdate(guildId, settings);

    // Log action
    await database.logAction(userId, 'GUILD_SETTINGS_UPDATED', { settings }, guildId);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      realtime: true,
    });
  } catch (error: any) {
    logger.error('Error updating guild settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
});

// Get guild modules
router.get('/guilds/:guildId/modules', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;

    // Verify access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2 AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
       UNION
       SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
      [guildId, userId]
    );

    if (hasAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get modules
    const modules = await database.query(
      'SELECT * FROM guild_modules WHERE guild_id = $1 ORDER BY module_name ASC',
      [guildId]
    );

    res.json({
      success: true,
      data: modules,
    });
  } catch (error: any) {
    logger.error('Error fetching modules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch modules',
    });
  }
});

// Toggle module
router.patch('/guilds/:guildId/modules/:moduleName', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId, moduleName } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const pubsub: PubSubManager = req.app.locals.pubsub;
    const { enabled, config: moduleConfig } = req.body;

    // Verify access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2 AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
       UNION
       SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
      [guildId, userId]
    );

    if (hasAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Update module
    if (typeof enabled === 'boolean') {
      await database.toggleModule(guildId, moduleName, enabled);
    }

    if (moduleConfig) {
      await database.updateModuleConfig(guildId, moduleName, moduleConfig);
    }

    // Publish module toggle event to Redis
    await pubsub.publishModuleToggle(guildId, moduleName, enabled, moduleConfig);

    // Log action
    await database.logAction(userId, 'MODULE_TOGGLED', { moduleName, enabled, config: moduleConfig }, guildId);

    res.json({
      success: true,
      message: 'Module updated successfully',
      realtime: true,
    });
  } catch (error: any) {
    logger.error('Error updating module:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update module',
    });
  }
});

// Get guild analytics
router.get('/guilds/:guildId/analytics', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const { days = 7 } = req.query;

    // Verify access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2 AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
       UNION
       SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
      [guildId, userId]
    );

    if (hasAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const intervalDays = Math.min(Math.max(parseInt(days as string) || 7, 1), 90);

    // Get analytics
    const analytics = await database.query(
      `SELECT metric_type, metric_value, date
       FROM guild_analytics
       WHERE guild_id = $1
         AND date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       ORDER BY date DESC`,
      [guildId, intervalDays]
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

// Get audit logs
router.get('/guilds/:guildId/audit', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const { limit = 50, offset = 0 } = req.query;

    // Verify access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2 AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
       UNION
       SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
      [guildId, userId]
    );

    if (hasAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get audit logs
    const logs = await database.query(
      `SELECT * FROM audit_logs WHERE guild_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
      [guildId, parseInt(limit as string) || 50, parseInt(offset as string) || 0]
    );

    const total = await database.query(
      'SELECT COUNT(*) as count FROM audit_logs WHERE guild_id = $1',
      [guildId]
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: parseInt(total[0].count),
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
    });
  }
});

// Sync guild data from Discord
router.post('/guilds/:guildId/sync', standardRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const pubsub: PubSubManager = req.app.locals.pubsub;
    const client = req.app.locals.client;

    // Verify access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2 AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
       UNION
       SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
      [guildId, userId]
    );

    if (hasAccess.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Fetch guild from Discord
    const guild = await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Bot is not in this guild',
      });
    }

    // Update guild info
    await database.query(
      `UPDATE guilds SET
        settings = jsonb_set(settings, '{name}', $1),
        settings = jsonb_set(settings, '{icon}', $2),
        settings = jsonb_set(settings, '{member_count}', $3),
        updated_at = NOW()
      WHERE guild_id = $4`,
      [
        JSON.stringify(guild.name),
        JSON.stringify(guild.iconURL()),
        guild.memberCount.toString(),
        guildId,
      ]
    );

    // Publish guild reload event to Redis
    await pubsub.publishGuildReload(guildId);

    res.json({
      success: true,
      message: 'Guild data synchronized',
      realtime: true,
      data: {
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
      },
    });
  } catch (error: any) {
    logger.error('Error syncing guild:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync guild data',
    });
  }
});

export default router;
