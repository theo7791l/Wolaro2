/**
 * Wolaro2 - Main Entry Point
 * Discord bot avec système de protection avancée
 */

import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';
import { MigrationsManager } from './database/migrations';
import protectionModule from './modules/moderation/protection/index';

dotenv.config();

// Extend Client type to include commands collection
interface ExtendedClient extends Client {
  commands?: Collection<string, any>;
  dbPool?: Pool;
}

// Create Discord client
const client: ExtendedClient = new Client({
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

// Initialize commands collection
client.commands = new Collection();

// Create database pool (optional)
let dbPool: Pool | null = null;
if (process.env.DATABASE_URL) {
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  client.dbPool = dbPool;
} else {
  logger.warn('⚠️  DATABASE_URL not configured. Running without database.');
}

// Load commands
function loadCommands() {
  const commandsLoaded = [];
  const foldersPath = path.join(__dirname, 'modules');

  if (!fs.existsSync(foldersPath)) {
    logger.warn('Modules folder not found, skipping command loading');
    return;
  }

  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder, 'commands');
    if (!fs.existsSync(commandsPath)) continue;

    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);

      try {
        const commandModule = require(filePath);
        let commandInstance = null;

        // Try to find and instantiate command class
        for (const key of Object.keys(commandModule)) {
          const exported = commandModule[key];

          if (typeof exported === 'function' && exported.prototype) {
            try {
              const instance = new exported();
              if (instance.data && typeof instance.execute === 'function') {
                commandInstance = instance;
                break;
              }
            } catch (e) {
              // Not a valid command class
            }
          } else if (exported && typeof exported === 'object' && exported.data && exported.execute) {
            commandInstance = exported;
            break;
          }
        }

        if (commandInstance && commandInstance.data) {
          const commandName = commandInstance.data.name;
          client.commands!.set(commandName, commandInstance);
          commandsLoaded.push(commandName);
        }
      } catch (error) {
        logger.error(`Failed to load command ${file}:`, error);
      }
    }
  }

  logger.info(`📦 Loaded ${commandsLoaded.length} commands: ${commandsLoaded.join(', ')}`);
}

async function main() {
  try {
    logger.info('Starting Wolaro2...');

    // Load commands first
    loadCommands();

    // Test database connection if available
    if (dbPool) {
      try {
        logger.info('Testing database connection...');
        await dbPool.query('SELECT NOW()');
        logger.info('✅ Database connected');

        // Run migrations automatically
        logger.info('Running database migrations...');
        const migrations = new MigrationsManager(dbPool);
        await migrations.runMigrations();
        logger.info('✅ Migrations completed');
      } catch (error) {
        logger.error('❌ Database connection failed:', error);
        logger.warn('⚠️  Continuing without database...');
      }
    }

    // Initialize protection module if database is available
    if (dbPool) {
      try {
        logger.info('Initializing protection module...');
        await protectionModule.initialize(client as Client);
        logger.info('✅ Protection module ready');
      } catch (error) {
        logger.error('Failed to initialize protection module:', error);
        logger.warn('Continuing without protection module...');
      }
    }

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

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands?.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, {
      client,
      database: dbPool,
      redis: null, // TODO: Add Redis support
    });
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName}:`, error);
    const reply = {
      content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  if (dbPool) {
    await protectionModule.shutdown();
    await dbPool.end();
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  if (dbPool) {
    await protectionModule.shutdown();
    await dbPool.end();
  }
  client.destroy();
  process.exit(0);
});

main();
