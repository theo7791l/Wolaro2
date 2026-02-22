import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { WebSocketServer } from '../websocket/server';
import { logger } from '../utils/logger';
import { authRouter } from './routes/auth';
import { guildRouter } from './routes/guild';
import { moduleRouter } from './routes/module';
import { adminRouter } from './routes/admin';
import { analyticsRouter } from './routes/analytics';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { errorHandler } from './middleware/error-handler';

export async function startAPI(
  database: DatabaseManager,
  redis: RedisManager,
  websocket: WebSocketServer
): Promise<Application> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.environment === 'production' ? ['https://wolaro.com'] : '*',
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  app.use(rateLimitMiddleware(redis));

  // Store dependencies in app.locals
  app.locals.database = database;
  app.locals.redis = redis;
  app.locals.websocket = websocket;

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/guilds', guildRouter);
  app.use('/api/modules', moduleRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/analytics', analyticsRouter);

  // Error handler
  app.use(errorHandler);

  // Start server
  app.listen(config.api.port, config.api.host, () => {
    logger.info(`API server listening on ${config.api.host}:${config.api.port}`);
  });

  return app;
}
