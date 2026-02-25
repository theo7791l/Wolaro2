/**
 * Wolaro2 - Main Entry Point
 * Discord bot avec système de protection avancée
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { logger } from './utils/logger';
import { MigrationsManager } from './database/migrations';
import protectionModule from './modules/moderation/protection/index';

dotenv.config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// Create database pool
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Attach pool to client for access in modules
(client as any).dbPool = dbPool;

async function main() {
  try {
    logger.info('Starting Wolaro2...');

    // Test database connection
    logger.info('Testing database connection...');
    await dbPool.query('SELECT NOW()');
    logger.info('✅ Database connected');

    // Run migrations automatically
    logger.info('Running database migrations...');
    const migrations = new MigrationsManager(dbPool);
    await migrations.runMigrations();
    logger.info('✅ Migrations completed');

    // Initialize protection module
    logger.info('Initializing protection module...');
    await protectionModule.initialize(client);
    logger.info('✅ Protection module ready');

    // Login to Discord
    logger.info('Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);

    logger.info('✨ Wolaro2 is ready!');
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

// Ready event
client.once('ready', () => {
  logger.info(`Logged in as ${client.user?.tag}`);
  logger.info(`Serving ${client.guilds.cache.size} guilds`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await protectionModule.shutdown();
  await dbPool.end();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await protectionModule.shutdown();
  await dbPool.end();
  client.destroy();
  process.exit(0);
});

main();
