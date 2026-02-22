import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { PubSubManager } from '../cache/pubsub';
import { Client } from 'discord.js';
import config from '../config';
import { logger } from '../utils/logger';

// Routes
import authRoutes from './routes/auth';
import guildRoutes from './routes/guilds';
import panelRoutes from './routes/panel';
import discordRoutes from './routes/discord';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';

export class APIServer {
  private app: Application;
  private database: DatabaseManager;
  private redis: RedisManager;
  private pubsub: PubSubManager;
  private client: Client;

  constructor(client: Client, database: DatabaseManager, redis: RedisManager, pubsub: PubSubManager) {
    this.app = express();
    this.client = client;
    this.database = database;
    this.redis = redis;
    this.pubsub = pubsub;

    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddlewares(): void {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://wolaro.fr"],
          scriptSrc: ["'self'", "https://wolaro.fr"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://wolaro.fr", "wss://wolaro.fr"],
        },
      },
    }));

    // CORS for wolaro.fr
    this.app.use(cors({
      origin: [
        'https://wolaro.fr',
        'https://www.wolaro.fr',
        'http://localhost:3001', // Development
        ...config.api.corsOrigin,
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Inject dependencies into requests
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      (req as any).database = this.database;
      (req as any).redis = this.redis;
      (req as any).pubsub = this.pubsub;
      (req as any).client = this.client;
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        pubsub: 'active',
      });
    });

    // API Routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/guilds', guildRoutes);
    this.app.use('/api/panel', panelRoutes);
    this.app.use('/api/discord', discordRoutes); // Discord data enrichment
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/analytics', analyticsRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Wolaro API',
        version: '1.0.0',
        documentation: 'https://wolaro.fr/docs',
        panel: 'https://wolaro.fr/panel',
        features: {
          realtime: true,
          pubsub: true,
          discord_enrichment: true,
        },
        endpoints: {
          auth: '/api/auth',
          guilds: '/api/guilds',
          panel: '/api/panel',
          discord: '/api/discord',
          admin: '/api/admin',
          analytics: '/api/analytics',
        },
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('API Error:', err);

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: isDevelopment ? err.message : undefined,
        stack: isDevelopment ? err.stack : undefined,
      });
    });
  }

  public start(): void {
    const port = config.api.port;

    this.app.listen(port, () => {
      logger.info(`API Server started on port ${port}`);
      logger.info(`Panel API: http://localhost:${port}/api/panel`);
      logger.info(`Discord API: http://localhost:${port}/api/discord`);
      logger.info(`Production URL: https://wolaro.fr`);
      logger.info(`Redis Pub/Sub: ACTIVE`);
    });
  }

  public getApp(): Application {
    return this.app;
  }
}
