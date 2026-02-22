import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { logger } from '../utils/logger';

/**
 * WebSocket Server with Socket.io
 * Real-time communication between API and Panel
 * Bot → Redis → API → WebSocket → Panel
 */

export class WebSocketServer {
  private io: SocketIOServer;
  private database: DatabaseManager;
  private redis: RedisManager;
  private redisSubscriber: any;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(httpServer: HTTPServer, database: DatabaseManager, redis: RedisManager) {
    this.database = database;
    this.redis = redis;

    // Initialize Socket.io with CORS
    this.io = new SocketIOServer(httpServer, {
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
    this.setupRedisSubscriber();
    this.setupEventHandlers();
  }

  /**
   * Authenticate WebSocket connections with JWT
   */
  private setupAuthentication(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT
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
      // Create dedicated subscriber client
      this.redisSubscriber = this.redis.getClient().duplicate();
      await this.redisSubscriber.connect();

      // Subscribe to all relevant channels
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

      // Track connected user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      // Join user's guilds rooms
      this.joinUserGuilds(socket, userId);

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`WebSocket disconnected: ${username} (${userId})`);
        this.connectedUsers.get(userId)?.delete(socket.id);
        if (this.connectedUsers.get(userId)?.size === 0) {
          this.connectedUsers.delete(userId);
        }
      });

      // Handle manual guild join (when user navigates to guild panel)
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

      // Handle leave guild room
      socket.on('leave:guild', (guildId: string) => {
        socket.leave(`guild:${guildId}`);
        logger.info(`User ${userId} left guild room ${guildId}`);
      });

      // Ping/pong for connection health
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
   */
  private async joinUserGuilds(socket: Socket, userId: string): Promise<void> {
    try {
      const guilds = await this.database.query(
        `SELECT DISTINCT g.guild_id FROM guilds g
         LEFT JOIN guild_members gm ON g.guild_id = gm.guild_id
         WHERE gm.user_id = $1 AND gm.permissions @> ARRAY['ADMINISTRATOR']::varchar[]
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

  /**
   * Redis Event Handlers - Forward to WebSocket clients
   */

  private async handleConfigUpdate(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { guildId, settings } = data;

      // Emit to all users in this guild room
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
      const { guildId, moduleName, enabled, config } = data;

      // Emit to all users in this guild room
      this.io.to(`guild:${guildId}`).emit('module:toggled', {
        guildId,
        moduleName,
        enabled,
        config,
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

      // Emit to all users in this guild room
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

      // Get user's socket connections
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.forEach((socketId) => {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            // Force leave guild room
            socket.leave(`guild:${guildId}`);

            // Emit permission revoked event
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

      // Emit to all users monitoring this guild
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

  /**
   * Manual emit (for API routes)
   */
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

  /**
   * Get connected users count
   */
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
   * Cleanup
   */
  public async shutdown(): Promise<void> {
    if (this.redisSubscriber) {
      await this.redisSubscriber.unsubscribe();
      await this.redisSubscriber.quit();
    }
    this.io.close();
    logger.info('WebSocket server shutdown');
  }
}
