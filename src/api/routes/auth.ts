import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { DatabaseManager } from '../../database/manager';
import { logger } from '../../utils/logger';

export const authRouter = Router();

/**
 * OAuth2 Discord Login
 * POST /api/auth/discord
 */
authRouter.post('/discord', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.discord.redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(400).json({ error: 'Failed to exchange code for token' });
    }

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();

    // Create or update user profile
    const database: DatabaseManager = req.app.locals.database;
    await database.getOrCreateGlobalProfile(userData.id, userData.username);

    // Generate JWT
    const token = jwt.sign(
      {
        userId: userData.id,
        username: userData.username,
      },
      config.api.jwtSecret,
      { expiresIn: '7d' }
    );

    logger.info(`User ${userData.username} (${userData.id}) authenticated`);

    res.json({
      token,
      user: {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar,
      },
    });
  } catch (error) {
    logger.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * Get current user
 * GET /api/auth/me
 */
authRouter.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, config.api.jwtSecret) as any;
    const database: DatabaseManager = req.app.locals.database;
    
    const profile = await database.query(
      'SELECT * FROM global_profiles WHERE user_id = $1',
      [decoded.userId]
    );

    if (!profile.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(profile[0]);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
