import { Router } from 'express';
import { authMiddleware, guildAccessMiddleware, AuthRequest } from '../middleware/auth';
import { lenientRateLimiter, standardRateLimiter } from '../middleware/rateLimiter';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { WebSocketServer } from '../../websocket/server';
import { logger } from '../../utils/logger';

export const moduleRouter = Router();

/**
 * Get available modules
 * GET /api/modules
 */
moduleRouter.get('/', lenientRateLimiter, async (req, res): Promise<void> => {
  try {
    const modules = [
      {
        name: 'moderation',
        displayName: 'Modération',
        description: 'Système de modération avancé avec anti-raid, auto-mod et logs',
        icon: '🛡️',
        category: 'Sécurité',
      },
      {
        name: 'economy',
        displayName: 'Économie',
        description: 'Système économique avec boutique, inventaire et échanges',
        icon: '💰',
        category: 'Divertissement',
      },
      {
        name: 'leveling',
        displayName: 'Niveaux & XP',
        description: 'Système de progression avec levels, XP et récompenses',
        icon: '🎯',
        category: 'Engagement',
      },
      {
        name: 'music',
        displayName: 'Musique',
        description: 'Lecteur de musique avec playlist et contrôles avancés',
        icon: '🎵',
        category: 'Divertissement',
      },
      {
        name: 'ai',
        displayName: 'Intelligence Artificielle',
        description: 'Chatbot IA, auto-modération intelligente et analyse',
        icon: '🤖',
        category: 'Avancé',
      },
      {
        name: 'rpg',
        displayName: 'RPG',
        description: 'Système de jeu de rôle avec combats, quêtes et équipement',
        icon: '⚔️',
        category: 'Divertissement',
      },
    ];
    res.json({ modules });
  } catch (error) {
    logger.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

/**
 * Toggle module for guild
 * POST /api/modules/:guildId/:moduleName/toggle
 */
moduleRouter.post('/:guildId/:moduleName/toggle', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { guildId, moduleName } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled must be a boolean' });
    }

    const database: DatabaseManager = req.app.locals.database;
    const redis: RedisManager = req.app.locals.redis;
    const websocket: WebSocketServer = req.app.locals.websocket;

    await database.toggleModule(guildId, moduleName, enabled);

    // Invalidate cache
    await redis.del(`module:${guildId}:${moduleName}`);
    await redis.invalidateGuildConfig(guildId);

    // Notify via WebSocket
    websocket.notifyModuleToggle(guildId, moduleName, enabled);

    // Log action
    await database.logAction(req.user!.id, 'MODULE_TOGGLE', {
      guildId,
      moduleName,
      enabled,
    }, guildId);

    logger.info(`Module ${moduleName} ${enabled ? 'enabled' : 'disabled'} for guild ${guildId}`);
    res.json({ success: true, moduleName, enabled });
  } catch (error) {
    logger.error('Error toggling module:', error);
    res.status(500).json({ error: 'Failed to toggle module' });
  }
});

/**
 * Update module configuration
 * PATCH /api/modules/:guildId/:moduleName/config
 */
moduleRouter.patch('/:guildId/:moduleName/config', standardRateLimiter, authMiddleware, guildAccessMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { guildId, moduleName } = req.params;
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Config must be an object' });
    }

    const database: DatabaseManager = req.app.locals.database;
    const redis: RedisManager = req.app.locals.redis;
    const websocket: WebSocketServer = req.app.locals.websocket;

    await database.updateModuleConfig(guildId, moduleName, config);

    // Invalidate cache
    await redis.invalidateGuildConfig(guildId);

    // Notify via WebSocket
    websocket.notifyConfigUpdate(guildId, { module: moduleName, config });

    // Log action
    await database.logAction(req.user!.id, 'MODULE_CONFIG_UPDATE', {
      guildId,
      moduleName,
      config,
    }, guildId);

    logger.info(`Module ${moduleName} config updated for guild ${guildId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating module config:', error);
    res.status(500).json({ error: 'Failed to update module configuration' });
  }
});
