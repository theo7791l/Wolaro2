import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../../database/manager';
import { Client, ChannelType } from 'discord.js';
import { authMiddleware } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Discord Data Enrichment API
 * Fetches real Discord data (channels, roles, members) using bot token
 * Returns names instead of IDs for panel display
 */

// Apply standard rate limiting
router.use(standardRateLimiter);

// Get guild channels with names
router.get('/guilds/:guildId/channels', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const client: Client = req.app.locals.client;

    // Verify user has access
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

    // Fetch all channels
    const channels = await guild.channels.fetch();

    // Format channels by type
    const formattedChannels = {
      text: [] as any[],
      voice: [] as any[],
      category: [] as any[],
      announcement: [] as any[],
      forum: [] as any[],
      stage: [] as any[],
    };

    channels.forEach((channel) => {
      if (!channel) return;
      const channelData = {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        parentId: channel.parentId || null,
      };

      switch (channel.type) {
        case ChannelType.GuildText:
          formattedChannels.text.push(channelData);
          break;
        case ChannelType.GuildVoice:
          formattedChannels.voice.push(channelData);
          break;
        case ChannelType.GuildCategory:
          formattedChannels.category.push(channelData);
          break;
        case ChannelType.GuildAnnouncement:
          formattedChannels.announcement.push(channelData);
          break;
        case ChannelType.GuildForum:
          formattedChannels.forum.push(channelData);
          break;
        case ChannelType.GuildStageVoice:
          formattedChannels.stage.push(channelData);
          break;
      }
    });

    // Sort by position
    Object.keys(formattedChannels).forEach((type) => {
      (formattedChannels as any)[type].sort((a: any, b: any) => a.position - b.position);
    });

    res.json({
      success: true,
      data: formattedChannels,
      total: channels.size,
    });
  } catch (error: any) {
    logger.error('Error fetching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels',
    });
  }
});

// Get guild roles with names
router.get('/guilds/:guildId/roles', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const client: Client = req.app.locals.client;

    // Verify user has access
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

    // Fetch all roles
    const roles = await guild.roles.fetch();

    // Format roles
    const formattedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position,
      permissions: role.permissions.bitfield.toString(),
      mentionable: role.mentionable,
      hoist: role.hoist,
      managed: role.managed,
      members: role.members.size,
    }));

    // Sort by position (highest first)
    formattedRoles.sort((a, b) => b.position - a.position);

    res.json({
      success: true,
      data: formattedRoles,
      total: roles.size,
    });
  } catch (error: any) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roles',
    });
  }
});

// Get guild members (with search)
router.get('/guilds/:guildId/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.id;
    const database: DatabaseManager = req.app.locals.database;
    const client: Client = req.app.locals.client;
    const { limit = 100, search } = req.query;

    // Verify user has access
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

    // Fetch members
    const members = await guild.members.fetch({ limit: Math.min(parseInt(limit as string) || 100, 1000) });

    // Format members
    let formattedMembers = members.map((member) => ({
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      avatar: member.user.displayAvatarURL(),
      roles: member.roles.cache.map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
      joinedAt: member.joinedAt?.toISOString(),
      bot: member.user.bot,
    }));

    // Search filter
    if (search) {
      const searchLower = (search as string).toLowerCase();
      formattedMembers = formattedMembers.filter(
        (m) => m.username.toLowerCase().includes(searchLower) || m.displayName.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: formattedMembers,
      total: formattedMembers.length,
      guildTotal: guild.memberCount,
    });
  } catch (error: any) {
    logger.error('Error fetching members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch members',
    });
  }
});

export default router;
