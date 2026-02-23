import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { PubSubManager } from '../cache/pubsub';
import { Client } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { standardJsonValidator } from './middleware/json-depth-validator';

// Routes - using named imports
import { authRouter } from './routes/auth';
import { guildRouter } from './routes/guild';
import { moduleRouter } from './routes/module';
import { panelRouter } from './routes/panel';
import { discordRouter } from './routes/discord';
import { adminRouter } from './routes/admin';
import { analyticsRouter } from './routes/analytics';

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

    // SECURITY FIX: Conditional CORS based on environment
    // Remove localhost origins in production to prevent CORS bypass
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          'https://wolaro.fr',
          'https://www.wolaro.fr',
          ...config.api.corsOrigin.filter((origin) => !origin.includes('localhost')),
        ]
      : [
          'https://wolaro.fr',
          'https://www.wolaro.fr',
          'http://localhost:3001',
          ...config.api.corsOrigin,
        ];

    this.app.use(cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Body parsing with size limit
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // SECURITY FIX: JSON depth validation middleware
    // Protects against CVE-2026-AsyncLocalStorage DoS attacks
    this.app.use(standardJsonValidator);

    // Inject dependencies into app.locals (used by all route handlers)
    this.app.locals.database = this.database;
    this.app.locals.redis = this.redis;
    this.app.locals.pubsub = this.pubsub;
    this.app.locals.client = this.client;

    // Request logging with duration tracking
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
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // API Routes
    this.app.use('/api/auth', authRouter);
    this.app.use('/api/guilds', guildRouter);
    this.app.use('/api/modules', moduleRouter);
    this.app.use('/api/panel', panelRouter);
    this.app.use('/api/discord', discordRouter); // Discord data enrichment
    this.app.use('/api/admin', adminRouter);
    this.app.use('/api/analytics', analyticsRouter);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Wolaro API',
        version: '1.0.0',
        documentation: 'https://wolaro.fr/docs',
        panel: 'https://wolaro.fr/panel',
        environment: process.env.NODE_ENV || 'development',
        features: {
          realtime: true,
          pubsub: true,
          discord_enrichment: true,
          security: {
            jwt_validation: 'strict',
            json_depth_limit: 10,
            rate_limiting: 'enabled',
          },
        },
        endpoints: {
          auth: '/api/auth',
          guilds: '/api/guilds',
          modules: '/api/modules',
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
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      logger.error('API Error:', err);
      
      // SECURITY FIX: Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: isDevelopment ? err.message : 'An unexpected error occurred',
        stack: isDevelopment ? err.stack : undefined,
      });
    });
  }

  public start(): void {
    const port = config.api.port;
    const host = config.api.host;
    
    this.app.listen(port, host, () => {
      logger.info(`API Server started on ${host}:${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Panel API: http://localhost:${port}/api/panel`);
      logger.info(`Discord API: http://localhost:${port}/api/discord`);
      logger.info(`Production URL: https://wolaro.fr`);
      logger.info(`Redis Pub/Sub: ACTIVE`);
      logger.info(`Security: JWT strict validation, JSON depth limit: 10`);
    });
  }

  public getApp(): Application {
    return this.app;
  }
}
