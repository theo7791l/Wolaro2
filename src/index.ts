/**
 * Wolaro2 - Discord Bot Multi-tenant avec Architecture Modulaire
 * System de chargement manuel des modules
 */

import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { logger } from './utils/logger';
import { DatabaseManager } from './database/manager';
import { RedisManager } from './cache/redis';
import * as fs from 'fs';
import * as path from 'path';
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
const redisManager = new RedisManager();

// ==============================================
// STARTUP SEQUENCE
// ==============================================

async function start() {
  try {
    // Connect to database
    await databaseManager.connect();
    logger.info('✅ Database connected');

    logger.info(`✅ Redis ${redisManager.isConnected() ? 'connected' : 'disabled (optional)'}`);

    // Initialize protection module
    await protectionModule.initialize(client, databaseManager);
    logger.info('✅ Protection module initialized');

    // Load all modules
    await loadAllModules();
    logger.info('✅ All modules loaded');

    // Load event handlers
    loadGlobalEvents();
    logger.info('✅ Global events loaded');

    // Start bot
    await client.login(config.token);
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// ==============================================
// MODULE LOADER
// ==============================================

async function loadAllModules() {
  const modulesPath = path.join(__dirname, 'modules');
  const moduleFolders = fs.readdirSync(modulesPath);

  for (const folder of moduleFolders) {
    const modulePath = path.join(modulesPath, folder);
    const indexPath = path.join(modulePath, 'index.js');

    if (!fs.existsSync(indexPath)) continue;

    try {
      const moduleData = require(indexPath);
      const module = moduleData.default || moduleData;

      if (module.commands) {
        for (const command of module.commands) {
          (client as any).commands.set(command.data.name, command);
        }
      }

      if (module.events) {
        for (const event of module.events) {
          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
          } else {
            client.on(event.name, (...args) => event.execute(...args));
          }
        }
      }

      logger.info(`  ✓ Loaded module: ${folder}`);
    } catch (error) {
      logger.error(`  ✗ Failed to load module ${folder}:`, error);
    }
  }
}

// ==============================================
// GLOBAL EVENT HANDLERS
// ==============================================

function loadGlobalEvents() {
  client.on('ready', onReady);
  client.on('interactionCreate', onInteraction);
  client.on('guildCreate', onGuildJoin);
  client.on('guildDelete', onGuildLeave);
}

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
    const context = {
      client,
      database: databaseManager,
      redis: redisManager,
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
  await databaseManager.disconnect();

  process.exit(0);
});

// ==============================================
// START
// ==============================================

start();
