import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Client } from 'discord.js';
import { logger } from '../../utils/logger';

export const discordRouter = Router();

discordRouter.use(authMiddleware);

/**
 * Get user guilds from Discord
 * GET /api/discord/guilds
 */
discordRouter.get('/guilds', async (req: AuthRequest, res) => {
  try {
    const client: Client = req.app.locals.client;

    const userGuilds = client.guilds.cache
      .filter((g) => g.members.cache.has(req.user!.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL(),
        memberCount: g.memberCount,
      }));

    return res.json({ guilds: userGuilds });
  } catch (error) {
    logger.error('Error fetching user guilds:', error);
    return res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

/**
 * Get guild info
 * GET /api/discord/guilds/:guildId
 */
discordRouter.get('/guilds/:guildId', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const client: Client = req.app.locals.client;

    const guild = await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const member = await guild.members.fetch(req.user!.id).catch(() => null);

    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this guild' });
    }

    return res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      isOwner: guild.ownerId === req.user!.id,
      isAdmin: member.permissions.has('Administrator'),
    });
  } catch (error) {
    logger.error('Error fetching guild info:', error);
    return res.status(500).json({ error: 'Failed to fetch guild information' });
  }
});

/**
 * Get guild channels
 * GET /api/discord/guilds/:guildId/channels
 */
discordRouter.get('/guilds/:guildId/channels', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const client: Client = req.app.locals.client;

    const guild = await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const member = await guild.members.fetch(req.user!.id).catch(() => null);

    if (!member || !member.permissions.has('ManageChannels')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const channels = guild.channels.cache
      .filter((c) => c.isTextBased())
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));

    return res.json({ channels });
  } catch (error) {
    logger.error('Error fetching guild channels:', error);
    return res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * Get guild roles
 * GET /api/discord/guilds/:guildId/roles
 */
discordRouter.get('/guilds/:guildId/roles', async (req: AuthRequest, res) => {
  try {
    const guildId = String(req.params.guildId);
    const client: Client = req.app.locals.client;

    const guild = await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const member = await guild.members.fetch(req.user!.id).catch(() => null);

    if (!member || !member.permissions.has('ManageRoles')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const roles = guild.roles.cache
      .filter((r) => !r.managed && r.id !== guild.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
      }));

    return res.json({ roles });
  } catch (error) {
    logger.error('Error fetching guild roles:', error);
    return res.status(500).json({ error: 'Failed to fetch roles' });
  }
});
