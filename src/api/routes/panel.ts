import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { logger } from '../../utils/logger';

export const panelRouter = Router();

panelRouter.use(authMiddleware);

const pubsub = {
  publishConfigUpdate: async (guildId: string, settings: any) => {
    logger.debug(`PubSub: config update for ${guildId}`);
  },
  publishModuleToggle: async (guildId: string, moduleName: string, enabled: boolean, config: any) => {
    logger.debug(`PubSub: module ${moduleName} toggled for ${guildId}`);
  },
  publishGuildReload: async (guildId: string) => {
    logger.debug(`PubSub: guild ${guildId} reload requested`);
  },
};

/**
 * Get guild configuration
 * GET /api/panel/guilds/:guildId
 */
panelRouter.get('/guilds/:guildId', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const database: DatabaseManager = req.app.locals.database;

    const guild = await database.getGuildConfig(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    return res.json({ guild });
  } catch (error) {
    logger.error('Error fetching guild config:', error);
    return res.status(500).json({ error: 'Failed to fetch guild configuration' });
  }
});

/**
 * Update guild settings
 * PUT /api/panel/guilds/:guildId/settings
 */
panelRouter.put('/guilds/:guildId/settings', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const { settings } = req.body;
    const userId = req.user!.id;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings object' });
    }

    const database: DatabaseManager = req.app.locals.database;

    await database.query(
      `UPDATE guilds SET settings = $2, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $1`,
      [guildId, JSON.stringify(settings)]
    );

    // Publish to Redis PubSub
    await pubsub.publishConfigUpdate(guildId, settings);

    // Log action
    await database.logAction(userId, 'GUILD_SETTINGS_UPDATED', { settings }, guildId);

    return res.json({ success: true, settings });
  } catch (error) {
    logger.error('Error updating guild settings:', error);
    return res.status(500).json({ error: 'Failed to update guild settings' });
  }
});

/**
 * Update module configuration
 * PUT /api/panel/guilds/:guildId/modules/:moduleName
 */
panelRouter.put('/guilds/:guildId/modules/:moduleName', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const moduleName = String(req.params.moduleName);
    const { enabled, config: moduleConfig } = req.body;
    const userId = req.user!.id;

    const database: DatabaseManager = req.app.locals.database;

    if (typeof enabled === 'boolean') {
      await database.toggleModule(guildId, moduleName, enabled);
    }

    if (moduleConfig && typeof moduleConfig === 'object') {
      await database.updateModuleConfig(guildId, moduleName, moduleConfig);
    }

    // Publish to Redis PubSub
    await pubsub.publishModuleToggle(guildId, moduleName, enabled, moduleConfig);

    // Log action
    await database.logAction(userId, 'MODULE_TOGGLED', { moduleName, enabled, config: moduleConfig }, guildId);

    return res.json({ success: true, module: moduleName, enabled, config: moduleConfig });
  } catch (error) {
    logger.error('Error updating module config:', error);
    return res.status(500).json({ error: 'Failed to update module configuration' });
  }
});

/**
 * Force reload guild
 * POST /api/panel/guilds/:guildId/reload
 */
panelRouter.post('/guilds/:guildId/reload', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const userId = req.user!.id;
    const database: DatabaseManager = req.app.locals.database;

    // Publish reload event
    await pubsub.publishGuildReload(guildId);

    // Log action
    await database.logAction(userId, 'GUILD_RELOAD', {}, guildId);

    logger.info(`Guild ${guildId} reload triggered by user ${userId}`);

    return res.json({ success: true, message: 'Guild reload triggered' });
  } catch (error) {
    logger.error('Error reloading guild:', error);
    return res.status(500).json({ error: 'Failed to reload guild' });
  }
});
