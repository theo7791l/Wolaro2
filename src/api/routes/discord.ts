import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../../database/manager';
import { Client, ChannelType } from 'discord.js';
import { authMiddleware } from '../middlewares/auth';
import { rateLimitMiddleware } from '../middlewares/ratelimit';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Discord Data Enrichment API
 * Fetches real Discord data (channels, roles, members) using bot token
 * Returns names instead of IDs for panel display
 */

// Get guild channels with names
router.get('/guilds/:guildId/channels', authMiddleware, rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.userId;
    const database: DatabaseManager = (req as any).database;
    const client: Client = (req as any).client;

    // Verify user has access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members 
       WHERE guild_id = $1 AND user_id = $2 
       AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
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
      text: [],
      voice: [],
      category: [],
      announcement: [],
      forum: [],
      stage: [],
    } as any;

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
      formattedChannels[type].sort((a: any, b: any) => a.position - b.position);
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
router.get('/guilds/:guildId/roles', authMiddleware, rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.userId;
    const database: DatabaseManager = (req as any).database;
    const client: Client = (req as any).client;

    // Verify user has access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members 
       WHERE guild_id = $1 AND user_id = $2 
       AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
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

// Get guild members (with pagination)
router.get('/guilds/:guildId/members', authMiddleware, rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.userId;
    const database: DatabaseManager = (req as any).database;
    const client: Client = (req as any).client;
    const { limit = 100, search } = req.query;

    // Verify user has access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members 
       WHERE guild_id = $1 AND user_id = $2 
       AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
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
    const members = await guild.members.fetch({ limit: parseInt(limit as string) });

    // Format members
    let formattedMembers = members.map((member) => ({
      id: member.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      displayName: member.displayName,
      avatar: member.user.displayAvatarURL(),
      roles: member.roles.cache.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
      })),
      joinedAt: member.joinedAt?.toISOString(),
      bot: member.user.bot,
    }));

    // Search filter
    if (search) {
      const searchLower = (search as string).toLowerCase();
      formattedMembers = formattedMembers.filter(
        (m) =>
          m.username.toLowerCase().includes(searchLower) ||
          m.displayName.toLowerCase().includes(searchLower)
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

// Get guild emojis
router.get('/guilds/:guildId/emojis', authMiddleware, rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.userId;
    const database: DatabaseManager = (req as any).database;
    const client: Client = (req as any).client;

    // Verify user has access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members 
       WHERE guild_id = $1 AND user_id = $2 
       AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
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

    // Fetch emojis
    const emojis = await guild.emojis.fetch();

    // Format emojis
    const formattedEmojis = emojis.map((emoji) => ({
      id: emoji.id,
      name: emoji.name,
      url: emoji.url,
      animated: emoji.animated || false,
      available: emoji.available,
    }));

    res.json({
      success: true,
      data: formattedEmojis,
      total: emojis.size,
    });
  } catch (error: any) {
    logger.error('Error fetching emojis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch emojis',
    });
  }
});

// Get guild info (general data)
router.get('/guilds/:guildId/info', authMiddleware, rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const userId = (req as any).user.userId;
    const database: DatabaseManager = (req as any).database;
    const client: Client = (req as any).client;

    // Verify user has access
    const hasAccess = await database.query(
      `SELECT 1 FROM guild_members 
       WHERE guild_id = $1 AND user_id = $2 
       AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
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

    // Get guild info
    const guildInfo = {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 256 }),
      banner: guild.bannerURL({ size: 1024 }),
      description: guild.description,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      premiumTier: guild.premiumTier,
      premiumSubscriptionCount: guild.premiumSubscriptionCount,
      verificationLevel: guild.verificationLevel,
      features: guild.features,
      createdAt: guild.createdAt.toISOString(),
    };

    res.json({
      success: true,
      data: guildInfo,
    });
  } catch (error: any) {
    logger.error('Error fetching guild info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch guild info',
    });
  }
});

export default router;
