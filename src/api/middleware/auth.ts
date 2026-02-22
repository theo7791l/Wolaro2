import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { SecurityManager } from '../../utils/security';
import { DatabaseManager } from '../../database/manager';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    isMaster?: boolean;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, config.api.jwtSecret) as any;
    
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      isMaster: SecurityManager.isMaster(decoded.userId),
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function masterAdminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const database: DatabaseManager = req.app.locals.database;
  const isMaster = await database.isMasterAdmin(req.user.id);

  if (!isMaster) {
    return res.status(403).json({ error: 'Forbidden: Master admin access required' });
  }

  next();
}

export async function guildAccessMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const guildId = req.params.guildId;
  if (!guildId) {
    return res.status(400).json({ error: 'Guild ID required' });
  }

  // Master admins bypass guild access checks
  if (SecurityManager.isMaster(req.user.id)) {
    return next();
  }

  const database: DatabaseManager = req.app.locals.database;
  const guild = await database.query(
    'SELECT owner_id FROM guilds WHERE guild_id = $1',
    [guildId]
  );

  if (!guild.length || guild[0].owner_id !== req.user.id) {
    return res.status(403).json({ error: 'You do not have access to this guild' });
  }

  next();
}
