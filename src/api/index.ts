/**
 * API Entry Point
 * Exports startAPI() function used by src/index.ts
 * Delegates to APIServer (server.ts) which contains the full implementation
 */
import { Application } from 'express';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { PubSubManager } from '../cache/pubsub';
import { APIServer } from './server';

// Re-export APIServer for direct use
export { APIServer } from './server';

/**
 * Start the API server
 * FIX: suppression du paramètre 'websocket' (inutilisé et jamais transmis à APIServer).
 * Le serveur WebSocket est désormais autonome et démarré séparément dans src/index.ts.
 */
export async function startAPI(
  database: DatabaseManager,
  redis: RedisManager
): Promise<Application> {
  // Create a minimal PubSubManager with no Discord client (panel-only pub/sub)
  const pubsub = new PubSubManager(redis, null as any, database);

  // Initialize Pub/Sub (non-blocking — bot continues if Redis pub/sub fails)
  await pubsub.initialize().catch((_err) => {
    // Logged internally in PubSubManager — no crash
  });

  const server = new APIServer(null as any, database, redis, pubsub);
  server.start();

  return server.getApp();
}
