import WebSocket, { WebSocketServer as WSServer } from 'ws';
import { config } from '../config';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

export interface IWebSocketMessage {
  type: string;
  guildId?: string;
  data: any;
  timestamp: number;
}

export class WebSocketServer {
  private wss!: WSServer;
  private clients = new Map<string, Set<WebSocket>>();

  async start(): Promise<void> {
    this.wss = new WSServer({ port: config.websocket.port });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.info(`WebSocket server started on port ${config.websocket.port}`);
  }

  private handleConnection(ws: WebSocket, req: any): void {
    let userId: string | null = null;
    let guildId: string | null = null;

    ws.on('message', (data) => {
      try {
        const message: IWebSocketMessage = JSON.parse(data.toString());

        switch (message.type) {
          case 'AUTH':
            const token = message.data.token;
            try {
              const decoded = jwt.verify(token, config.api.jwtSecret) as any;
              userId = decoded.userId;
              
              ws.send(JSON.stringify({
                type: 'AUTH_SUCCESS',
                data: { userId },
                timestamp: Date.now(),
              }));
              
              logger.info(`WebSocket authenticated: ${userId}`);
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'AUTH_ERROR',
                data: { error: 'Invalid token' },
                timestamp: Date.now(),
              }));
              ws.close();
            }
            break;

          case 'SUBSCRIBE_GUILD':
            if (!userId) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                data: { error: 'Not authenticated' },
                timestamp: Date.now(),
              }));
              return;
            }

            guildId = message.data.guildId;
            if (!this.clients.has(guildId)) {
              this.clients.set(guildId, new Set());
            }
            this.clients.get(guildId)!.add(ws);
            
            logger.info(`User ${userId} subscribed to guild ${guildId}`);
            break;

          case 'UNSUBSCRIBE_GUILD':
            if (guildId) {
              this.clients.get(guildId)?.delete(ws);
              logger.info(`User ${userId} unsubscribed from guild ${guildId}`);
            }
            break;
        }
      } catch (error) {
        logger.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (guildId) {
        this.clients.get(guildId)?.delete(ws);
      }
      logger.info(`WebSocket disconnected: ${userId}`);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  }

  /**
   * Broadcast message to all clients subscribed to a guild
   */
  broadcastToGuild(guildId: string, message: IWebSocketMessage): void {
    const clients = this.clients.get(guildId);
    if (!clients) return;

    const payload = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Notify guild config update
   */
  notifyConfigUpdate(guildId: string, config: any): void {
    this.broadcastToGuild(guildId, {
      type: 'CONFIG_UPDATE',
      guildId,
      data: config,
      timestamp: Date.now(),
    });
  }

  /**
   * Notify module toggle
   */
  notifyModuleToggle(guildId: string, moduleName: string, enabled: boolean): void {
    this.broadcastToGuild(guildId, {
      type: 'MODULE_TOGGLE',
      guildId,
      data: { moduleName, enabled },
      timestamp: Date.now(),
    });
  }

  /**
   * Notify new audit log entry
   */
  notifyAuditLog(guildId: string, logEntry: any): void {
    this.broadcastToGuild(guildId, {
      type: 'AUDIT_LOG',
      guildId,
      data: logEntry,
      timestamp: Date.now(),
    });
  }
}
