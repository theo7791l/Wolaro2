/**
 * API Entry Point
 * Exports startAPI() function used by src/index.ts
 * Delegates to APIServer (server.ts) which contains the full implementation
 */
import { Application } from 'express';
import { Client } from 'discord.js';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { PubSubManager } from '../cache/pubsub';
import { APIServer } from './server';

// Re-export APIServer for direct use
export { APIServer } from './server';

/**
 * Start the API server
 * FIX: ajout du paramètre 'client: Client' — transmis à APIServer pour les routes /api/discord.
 * Sans lui, app.locals.client était null, causant des TypeError sur toutes les routes
 * qui tentaient d'accéder au client Discord (guilds, channels, members...).
 */
export async function startAPI(
  client: Client,
  database: DatabaseManager,
  redis: RedisManager
): Promise<Application> {
  // Create a minimal PubSubManager with no Discord client (panel-only pub/sub)
  const pubsub = new PubSubManager(redis, null as any, database);

  // Initialize Pub/Sub (non-blocking — bot continues if Redis pub/sub fails)
  await pubsub.initialize().catch((_err) => {
    // Logged internally in PubSubManager — no crash
  });

  const server = new APIServer(client, database, redis, pubsub);
  server.start();

  return server.getApp();
}
