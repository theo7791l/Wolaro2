/**
 * Wolaro2 - Discord Bot Multi-tenant avec Architecture Modulaire
 * Fix: DatabaseManager & RedisManager injection dans CommandContext
 */

import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { logger } from './utils/logger';
import { DatabaseManager } from './database/manager';
import { RedisManager } from './cache/redis';
import { loadModules } from './core/module-loader-v2';
import { readFileSync } from 'fs';
import { join } from 'path';
import protectionModule from './modules/moderation/protection';

// ==============================================
// CLIENT SETUP
// ==============================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

// Commands & events collections
(client as any).commands = new Collection();
(client as any).events = new Collection();

// ==============================================
// DATABASE & CACHE
// ==============================================

const databaseManager = new DatabaseManager();
const redisManager = new RedisManager(
  config.redis.host,
  config.redis.port,
  config.redis.password,
  config.redis.db
);

// ==============================================
// STARTUP SEQUENCE
// ==============================================

async function start() {
  try {
    // Connect to database
    await databaseManager.connect();
    logger.info('✅ Database connected');

    // Connect to Redis
    await redisManager.connect();
    logger.info('✅ Redis connected');

    // Initialize protection module
    await protectionModule.initialize(client, databaseManager);
    logger.info('✅ Protection module initialized');

    // Load all modules
    await loadModules(client, databaseManager, redisManager);
    logger.info('✅ All modules loaded');

    // Load event handlers
    loadEvents();
    logger.info('✅ Events loaded');

    // Load slash commands
    loadCommands();
    logger.info('✅ Commands loaded');

    // Start bot
    await client.login(config.token);
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// ==============================================
// EVENT LOADER
// ==============================================

function loadEvents() {
  const events = [
    { name: 'ready', execute: () => onReady() },
    { name: 'interactionCreate', execute: (interaction: any) => onInteraction(interaction) },
    { name: 'guildCreate', execute: (guild: any) => onGuildJoin(guild) },
    { name: 'guildDelete', execute: (guild: any) => onGuildLeave(guild) },
  ];

  for (const event of events) {
    client.on(event.name, event.execute);
  }
}

// ==============================================
// COMMAND LOADER
// ==============================================

function loadCommands() {
  // Les commandes sont déjà chargées par loadModules()
  logger.info(`Loaded ${(client as any).commands.size} slash commands`);
}

// ==============================================
// EVENT HANDLERS
// ==============================================

async function onReady() {
  if (!client.user) return;

  logger.info(`✅ Bot ready as ${client.user.tag}`);
  logger.info(`👥 Serving ${client.guilds.cache.size} guilds`);
  logger.info(`🛡️ Protection systems active`);

  // Set status
  client.user.setPresence({
    activities: [{ name: '/help | Wolaro2', type: 0 }],
    status: 'online',
  });
}

async function onInteraction(interaction: any) {
  if (!interaction.isChatInputCommand()) return;

  const command = (client as any).commands.get(interaction.commandName);
  if (!command) return;

  try {
    // FIX CRITIQUE: passer DatabaseManager et RedisManager au lieu de Pool brut
    const context = {
      client,
      database: databaseManager,  // Avant: pool brut → getGuildConfig is not a function
      redis: redisManager,        // Avant: null → erreurs cache
    };

    await command.execute(interaction, context);
  } catch (error) {
    logger.error(`Command error [${interaction.commandName}]:`, error);

    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function onGuildJoin(guild: any) {
  try {
    await databaseManager.initializeGuild(guild.id, guild.ownerId);
    logger.info(`🎉 Joined guild: ${guild.name} (${guild.id})`);
  } catch (error) {
    logger.error(`Failed to initialize guild ${guild.id}:`, error);
  }
}

async function onGuildLeave(guild: any) {
  logger.info(`👋 Left guild: ${guild.name} (${guild.id})`);
}

// ==============================================
// GRACEFUL SHUTDOWN
// ==============================================

process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down gracefully...');

  await protectionModule.shutdown();
  await redisManager.disconnect();
  await databaseManager.disconnect();

  process.exit(0);
});

// ==============================================
// START
// ==============================================

start();
