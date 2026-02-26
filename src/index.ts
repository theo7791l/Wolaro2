/**
 * Wolaro2 - Discord Bot Multi-tenant avec Architecture Modulaire
 * System de chargement manuel des modules - VERSION CORRIGÉE
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
(client as any).buttonHandlers = new Collection();
(client as any).selectMenuHandlers = new Collection();
(client as any).modalHandlers = new Collection();

// ==============================================
// DATABASE & CACHE
// ==============================================

const databaseManager = new DatabaseManager();
const redisManager = new RedisManager();

// Context global pour les handlers
const globalContext = {
  client,
  database: databaseManager,
  redis: redisManager,
};

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
// MODULE LOADER - VERSION CORRIGÉE
// ==============================================

async function loadAllModules() {
  const modulesPath = path.join(__dirname, 'modules');
  
  if (!fs.existsSync(modulesPath)) {
    logger.warn('Modules directory not found, skipping module loading');
    return;
  }

  const moduleFolders = fs.readdirSync(modulesPath);

  for (const folder of moduleFolders) {
    const modulePath = path.join(modulesPath, folder);
    
    // Vérifier si c'est bien un dossier
    if (!fs.statSync(modulePath).isDirectory()) continue;

    // Chercher index.js (compilé) ou index.ts (développement)
    let indexPath = path.join(modulePath, 'index.js');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(modulePath, 'index.ts');
    }

    if (!fs.existsSync(indexPath)) {
      logger.warn(`  ⚠️  Module ${folder} has no index file`);
      continue;
    }

    try {
      const moduleData = require(indexPath);
      let module = moduleData.default || moduleData;

      // Détection améliorée : vérifier si c'est une classe
      if (typeof module === 'function') {
        try {
          // Tenter l'instanciation avec le contexte
          module = new module(client, databaseManager, redisManager);
          
          // Appeler initialize si disponible
          if (typeof module.initialize === 'function') {
            await module.initialize();
          }
        } catch (error) {
          logger.warn(`  ⚠️  Could not instantiate module ${folder}, using as-is`);
        }
      }

      // Charger les commandes
      if (module.commands && Array.isArray(module.commands)) {
        for (const command of module.commands) {
          if (command && command.data && command.data.name) {
            (client as any).commands.set(command.data.name, command);
          }
        }
      }

      // Charger les événements avec contexte
      if (module.events && Array.isArray(module.events)) {
        for (const event of module.events) {
          if (event && event.name && typeof event.execute === 'function') {
            const handler = (...args: any[]) => {
              try {
                event.execute(...args, globalContext);
              } catch (error) {
                logger.error(`Event error [${event.name}]:`, error);
              }
            };

            if (event.once) {
              client.once(event.name, handler);
            } else {
              client.on(event.name, handler);
            }
          }
        }
      }

      // Charger les handlers de boutons
      if (module.buttons && typeof module.buttons === 'object') {
        for (const [id, handler] of Object.entries(module.buttons)) {
          (client as any).buttonHandlers.set(id, handler);
        }
      }

      // Charger les handlers de menus select
      if (module.selectMenus && typeof module.selectMenus === 'object') {
        for (const [id, handler] of Object.entries(module.selectMenus)) {
          (client as any).selectMenuHandlers.set(id, handler);
        }
      }

      // Charger les handlers de modals
      if (module.modals && typeof module.modals === 'object') {
        for (const [id, handler] of Object.entries(module.modals)) {
          (client as any).modalHandlers.set(id, handler);
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
  try {
    // Handler pour les commandes slash
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    // Handler pour les boutons
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    // Handler pour les menus select
    if (interaction.isStringSelectMenu() || interaction.isRoleSelectMenu() || 
        interaction.isUserSelectMenu() || interaction.isChannelSelectMenu()) {
      await handleSelectMenu(interaction);
      return;
    }

    // Handler pour les modals
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }

    // Handler pour les autocomplete
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }

  } catch (error) {
    logger.error('Interaction error:', error);
  }
}

async function handleSlashCommand(interaction: any) {
  const command = (client as any).commands.get(interaction.commandName);
  
  if (!command) {
    logger.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, globalContext);
  } catch (error) {
    logger.error(`Command error [${interaction.commandName}]:`, error);

    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
}

async function handleButton(interaction: any) {
  const handler = (client as any).buttonHandlers.get(interaction.customId);
  
  if (!handler) {
    // Essayer de trouver un handler avec préfixe
    for (const [id, h] of (client as any).buttonHandlers.entries()) {
      if (interaction.customId.startsWith(id)) {
        try {
          await h(interaction, globalContext);
          return;
        } catch (error) {
          logger.error(`Button handler error [${id}]:`, error);
        }
      }
    }
    return;
  }

  try {
    await handler(interaction, globalContext);
  } catch (error) {
    logger.error(`Button error [${interaction.customId}]:`, error);
  }
}

async function handleSelectMenu(interaction: any) {
  const handler = (client as any).selectMenuHandlers.get(interaction.customId);
  
  if (!handler) {
    // Essayer de trouver un handler avec préfixe
    for (const [id, h] of (client as any).selectMenuHandlers.entries()) {
      if (interaction.customId.startsWith(id)) {
        try {
          await h(interaction, globalContext);
          return;
        } catch (error) {
          logger.error(`Select menu handler error [${id}]:`, error);
        }
      }
    }
    return;
  }

  try {
    await handler(interaction, globalContext);
  } catch (error) {
    logger.error(`Select menu error [${interaction.customId}]:`, error);
  }
}

async function handleModal(interaction: any) {
  const handler = (client as any).modalHandlers.get(interaction.customId);
  
  if (!handler) {
    // Essayer de trouver un handler avec préfixe
    for (const [id, h] of (client as any).modalHandlers.entries()) {
      if (interaction.customId.startsWith(id)) {
        try {
          await h(interaction, globalContext);
          return;
        } catch (error) {
          logger.error(`Modal handler error [${id}]:`, error);
        }
      }
    }
    return;
  }

  try {
    await handler(interaction, globalContext);
  } catch (error) {
    logger.error(`Modal error [${interaction.customId}]:`, error);
  }
}

async function handleAutocomplete(interaction: any) {
  const command = (client as any).commands.get(interaction.commandName);
  
  if (!command || !command.autocomplete) return;

  try {
    await command.autocomplete(interaction, globalContext);
  } catch (error) {
    logger.error(`Autocomplete error [${interaction.commandName}]:`, error);
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
