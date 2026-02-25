/**
 * API Server - Fixed initialization
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { RedisManager } from '../cache/redis';
import { PubSubManager } from '../cache/pubsub';
import { logger } from '../utils/logger';
import { adminRouter as adminRoutes } from './routes/admin';
import { guildRouter as guildRoutes } from './routes/guild';
import { moduleRouter as moduleRoutes } from './routes/module';
import panelRoutes from './routes/panel';
import { rateLimitMiddleware } from './middleware/rate-limit';

const app = express();
const PORT = process.env.API_PORT || 3001;

let database: Pool;
let redis: RedisManager;
let pubsub: PubSubManager;

export async function startAPIServer(pool: Pool): Promise<void> {
  database = pool;
  redis = new RedisManager();
  pubsub = new PubSubManager(redis);

  await pubsub.initialize().catch((err: any) => {
    logger.warn('PubSub initialization failed:', err);
  });

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(rateLimitMiddleware);

  // Attach dependencies
  app.locals.database = database;
  app.locals.redis = redis;
  app.locals.pubsub = pubsub;

  // Routes
  app.use('/admin', adminRoutes);
  app.use('/guild', guildRoutes);
  app.use('/module', moduleRoutes);
  app.use('/panel', panelRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.listen(PORT, () => {
    logger.info(`API server listening on port ${PORT}`);
  });
}

export { database, redis, pubsub };
