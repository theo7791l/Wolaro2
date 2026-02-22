/**
 * API Entry Point
 * Exports startAPI() function used by src/index.ts
 * Delegates to APIServer (server.ts) which contains the full implementation
 */
import { Application } from 'express';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { WebSocketServer } from '../websocket/server';
import { PubSubManager } from '../cache/pubsub';
import { APIServer } from './server';

// Re-export APIServer for direct use
export { APIServer } from './server';

/**
 * Start the API server
 * Wraps APIServer class with a function interface compatible with src/index.ts
 * Note: PubSubManager is instantiated internally since src/index.ts doesn't pass it
 */
export async function startAPI(
  database: DatabaseManager,
  redis: RedisManager,
  websocket: WebSocketServer
): Promise<Application> {
  // Create a minimal PubSubManager with no Discord client (panel-only pub/sub)
  // The full PubSubManager with Discord client is used in bot modules directly
  const pubsub = new PubSubManager(redis, null as any, database);

  // Initialize Pub/Sub (non-blocking - bot continues if Redis pub/sub fails)
  await pubsub.initialize().catch((err) => {
    // Logged internally in PubSubManager - no crash
  });

  const server = new APIServer(null as any, database, redis, pubsub);
  server.start();

  return server.getApp();
}
