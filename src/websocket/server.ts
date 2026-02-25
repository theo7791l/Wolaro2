import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
// FIX: named import au lieu de default import (config.ts n'exporte qu'un named export)
import { config } from '../config';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { logger } from '../utils/logger';

/**
 * WebSocket Server with Socket.io
 * Real-time communication between API and Panel
 * Bot → Redis → API → WebSocket → Panel
 */

export class WebSocketServer {
  private io!: SocketIOServer;
  // FIX: httpServer créé en interne dans start() — suppression du paramètre constructeur
  // qui créait une incompatibilité avec l'instanciation dans src/index.ts (new WebSocketServer())
  private httpServer!: HTTPServer;
  private database: DatabaseManager;
  private redis: RedisManager;
  private redisSubscriber: any;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(database: DatabaseManager, redis: RedisManager) {
    this.database = database;
    this.redis = redis;
  }

  /**
   * Start the WebSocket server on its own HTTP listener (wsPort)
   * FIX: méthode start() ajoutée — absente de la version précédente alors qu'appelée dans index.ts
   */
  async start(): Promise<void> {
    this.httpServer = createServer();

    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: [
          'https://wolaro.fr',
          'https://www.wolaro.fr',
          'http://localhost:3001',
          ...config.api.corsOrigin,
        ],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupAuthentication();
    await this.setupRedisSubscriber();
    this.setupEventHandlers();

    await new Promise<void>((resolve, reject) => {
      this.httpServer.listen(config.api.wsPort, () => {
        logger.info(`WebSocket server listening on port ${config.api.wsPort}`);
        resolve();
      });
      this.httpServer.on('error', reject);
    });
  }

  /**
   * Authenticate WebSocket connections with JWT
   */
  private setupAuthentication(): void {
    this.io.use(async (socket: Socket, next: any) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.api.jwtSecret) as any;
        (socket as any).userId = decoded.userId;
        (socket as any).username = decoded.username;

        logger.info(`WebSocket authentication successful for user ${decoded.userId}`);
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });
  }

  /**
   * Subscribe to Redis channels and forward to WebSocket clients
   */
  private async setupRedisSubscriber(): Promise<void> {
    try {
      this.redisSubscriber = this.redis.getClient().duplicate();
      await this.redisSubscriber.connect();

      await this.redisSubscriber.subscribe('config:update', this.handleConfigUpdate.bind(this));
      await this.redisSubscriber.subscribe('module:toggle', this.handleModuleToggle.bind(this));
      await this.redisSubscriber.subscribe('guild:reload', this.handleGuildReload.bind(this));
      await this.redisSubscriber.subscribe('permission:revoked', this.handlePermissionRevoked.bind(this));
      await this.redisSubscriber.subscribe('command:executed', this.handleCommandExecuted.bind(this));

      logger.info('WebSocket Redis subscriber initialized');
    } catch (error) {
      logger.error('Failed to setup Redis subscriber for WebSocket:', error);
      logger.warn('WebSocket will work without real-time updates');
    }
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      const username = (socket as any).username;

      logger.info(`WebSocket connected: ${username} (${userId})`);

      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      this.joinUserGuilds(socket, userId);

      socket.on('disconnect', () => {
        logger.info(`WebSocket disconnected: ${username} (${userId})`);
        this.connectedUsers.get(userId)?.delete(socket.id);
        if (this.connectedUsers.get(userId)?.size === 0) {
          this.connectedUsers.delete(userId);
        }
      });

      socket.on('join:guild', (guildId: string) => {
        this.verifyGuildAccess(userId, guildId).then((hasAccess) => {
          if (hasAccess) {
            socket.join(`guild:${guildId}`);
            logger.info(`User ${userId} joined guild room ${guildId}`);
          } else {
            socket.emit('error', { message: 'Access denied to this guild' });
          }
        });
      });

      socket.on('leave:guild', (guildId: string) => {
        socket.leave(`guild:${guildId}`);
        logger.info(`User ${userId} left guild room ${guildId}`);
      });

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  /**
   * Verify user has access to guild
   */
  private async verifyGuildAccess(userId: string, guildId: string): Promise<boolean> {
    try {
      const result = await this.database.query(
        `SELECT 1 FROM guild_members 
         WHERE guild_id = $1 AND user_id = $2 
         AND permissions @> ARRAY['ADMINISTRATOR']::varchar[]
         UNION
         SELECT 1 FROM guilds WHERE guild_id = $1 AND owner_id = $2`,
        [guildId, userId]
      );
      return result.length > 0;
    } catch (error) {
      logger.error('Error verifying guild access:', error);
      return false;
    }
  }

  /**
   * Auto-join user to their guild rooms
   * FIX: parenthèses explicites autour du bloc AND pour corriger la précédence
   * avec OR sur un LEFT JOIN. Sans parenthèses, la clause
   *   WHERE gm.user_id=$1 AND gm.permissions @> ... OR g.owner_id=$1
   * est évaluée comme :
   *   WHERE (gm.user_id=$1 AND gm.permissions @> ...) OR (g.owner_id=$1)
   * ce qui est correct en SQL standard, MAIS sur un LEFT JOIN, quand
   * g.owner_id=$1 matche sans ligne guild_members, la condition
   * g.owner_id=$1 peut retourner plusieurs lignes dupliquées pour
   * chaque membre de la guild via le LEFT JOIN. Le DISTINCT masque le
   * problème, mais les parenthèses explicites rendent l'intention claire
   * et préviennent toute régression lors d'une refactorisation.
   */
  private async joinUserGuilds(socket: Socket, userId: string): Promise<void> {
    try {
      const guilds = await this.database.query(
        `SELECT DISTINCT g.guild_id FROM guilds g
         LEFT JOIN guild_members gm ON g.guild_id = gm.guild_id
         WHERE (gm.user_id = $1 AND gm.permissions @> ARRAY['ADMINISTRATOR']::varchar[])
         OR g.owner_id = $1`,
        [userId]
      );

      guilds.forEach((guild: any) => {
        socket.join(`guild:${guild.guild_id}`);
      });

      logger.info(`User ${userId} joined ${guilds.length} guild rooms`);
    } catch (error) {
      logger.error('Error joining user guilds:', error);
    }
  }

  // ============================================================
  // Redis Event Handlers — Forward to WebSocket clients
  // ============================================================

  private async handleConfigUpdate(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId, settings } = data;

      this.io.to(`guild:${guildId}`).emit('config:updated', {
        guildId,
        settings,
        timestamp: Date.now(),
      });

      logger.info(`Config update forwarded to guild ${guildId} WebSocket clients`);
    } catch (error) {
      logger.error('Error handling config update in WebSocket:', error);
    }
  }

  private async handleModuleToggle(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      // FIX: renommage 'config' → 'moduleConfig' pour éviter le shadowing de l'import config
      const { guildId, moduleName, enabled, config: moduleConfig } = data;

      this.io.to(`guild:${guildId}`).emit('module:toggled', {
        guildId,
        moduleName,
        enabled,
        config: moduleConfig,
        timestamp: Date.now(),
      });

      logger.info(`Module toggle forwarded to guild ${guildId} WebSocket clients`);
    } catch (error) {
      logger.error('Error handling module toggle in WebSocket:', error);
    }
  }

  private async handleGuildReload(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId } = data;

      this.io.to(`guild:${guildId}`).emit('guild:reload', {
        guildId,
        timestamp: Date.now(),
      });

      logger.info(`Guild reload forwarded to guild ${guildId} WebSocket clients`);
    } catch (error) {
      logger.error('Error handling guild reload in WebSocket:', error);
    }
  }

  private async handlePermissionRevoked(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId, userId, reason } = data;

      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.forEach((socketId) => {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.leave(`guild:${guildId}`);
            socket.emit('permission:revoked', {
              guildId,
              reason: reason || 'Your permissions have been revoked',
              action: 'redirect_home',
              timestamp: Date.now(),
            });
          }
        });

        logger.warn(`Permission revoked for user ${userId} in guild ${guildId}`);
      }
    } catch (error) {
      logger.error('Error handling permission revoked in WebSocket:', error);
    }
  }

  private async handleCommandExecuted(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId, command, executor, result } = data;

      this.io.to(`guild:${guildId}`).emit('command:executed', {
        guildId,
        command,
        executor,
        result,
        timestamp: Date.now(),
      });

      logger.info(`Command execution forwarded to guild ${guildId} WebSocket clients`);
    } catch (error) {
      logger.error('Error handling command executed in WebSocket:', error);
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  public emitToGuild(guildId: string, event: string, data: any): void {
    this.io.to(`guild:${guildId}`).emit(event, data);
  }

  public emitToUser(userId: string, event: string, data: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  public getStats(): { connectedUsers: number; totalConnections: number } {
    let totalConnections = 0;
    this.connectedUsers.forEach((sockets) => {
      totalConnections += sockets.size;
    });
    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections,
    };
  }

  /**
   * Graceful shutdown
   * FIX: fermeture du httpServer sous-jacent ajoutée pour libérer le port wsPort
   */
  public async shutdown(): Promise<void> {
    if (this.redisSubscriber) {
      await this.redisSubscriber.unsubscribe();
      await this.redisSubscriber.quit();
    }
    this.io.close();
    await new Promise<void>((resolve) => this.httpServer.close(() => resolve()));
    logger.info('WebSocket server shutdown');
  }
}
