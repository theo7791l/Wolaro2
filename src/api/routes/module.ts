import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { logger } from '../../utils/logger';

export const moduleRouter = Router();

moduleRouter.use(authMiddleware);

const websocket = {
  notifyModuleToggle: (guildId: string, moduleName: string, enabled: boolean) => {
    logger.debug(`WS notify: module ${moduleName} ${enabled ? 'enabled' : 'disabled'} in ${guildId}`);
  },
  notifyConfigUpdate: (guildId: string, data: any) => {
    logger.debug(`WS notify: config updated in ${guildId}`);
  },
};

/**
 * Get available modules
 * GET /api/modules
 */
moduleRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const modules = [
      {
        name: 'moderation',
        displayName: 'Modération',
        description: 'Outils de modération avancés',
        icon: '🛡️',
        category: 'core',
      },
      {
        name: 'economy',
        displayName: 'Économie',
        description: 'Système d\'économie virtuelle',
        icon: '💰',
        category: 'fun',
      },
      {
        name: 'leveling',
        displayName: 'Niveaux',
        description: 'Système de niveaux et XP',
        icon: '📊',
        category: 'engagement',
      },
      {
        name: 'music',
        displayName: 'Musique',
        description: 'Lecteur de musique',
        icon: '🎵',
        category: 'fun',
      },
      {
        name: 'ai',
        displayName: 'Intelligence Artificielle',
        description: 'Chatbot IA & modération automatique',
        icon: '🤖',
        category: 'advanced',
      },
    ];

    return res.json({ modules });
  } catch (error) {
    logger.error('Error fetching modules:', error);
    return res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

/**
 * Toggle module for guild
 * POST /api/modules/:guildId/:moduleName/toggle
 */
moduleRouter.post('/:guildId/:moduleName/toggle', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const moduleName = String(req.params.moduleName);
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid enabled value' });
    }

    const database: DatabaseManager = req.app.locals.database;
    const redis: RedisManager = req.app.locals.redis;

    await database.toggleModule(guildId, moduleName, enabled);

    // Invalidate cache
    await redis.invalidateGuildConfig(guildId);

    // Notify via WebSocket
    websocket.notifyModuleToggle(guildId, moduleName, enabled);

    return res.json({
      success: true,
      module: moduleName,
      enabled,
    }, guildId);
  } catch (error) {
    logger.error('Error toggling module:', error);
    return res.status(500).json({ error: 'Failed to toggle module' });
  }
});

/**
 * Update module config
 * PUT /api/modules/:guildId/:moduleName/config
 */
moduleRouter.put('/:guildId/:moduleName/config', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const moduleName = String(req.params.moduleName);
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config object' });
    }

    const database: DatabaseManager = req.app.locals.database;
    const redis: RedisManager = req.app.locals.redis;

    await database.updateModuleConfig(guildId, moduleName, config);

    // Invalidate cache
    await redis.invalidateGuildConfig(guildId);

    // Notify via WebSocket
    websocket.notifyConfigUpdate(guildId, { module: moduleName, config });

    return res.json({
      success: true,
      module: moduleName,
      config,
    }, guildId);
  } catch (error) {
    logger.error('Error updating module config:', error);
    return res.status(500).json({ error: 'Failed to update module configuration' });
  }
});
