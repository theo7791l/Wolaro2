import { WebSocketServer as WSServer } from 'ws';

/**
 * Extended WebSocketServer with custom notification methods
 */
export interface ExtendedWebSocketServer extends WSServer {
  notifyConfigUpdate(guildId: string, config: any): void;
  notifyModuleToggle(guildId: string, moduleName: string, enabled: boolean): void;
}
