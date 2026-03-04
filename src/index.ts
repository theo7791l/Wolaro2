/**
 * Wolaro2 - Discord Bot Multi-tenant avec Architecture Modulaire
 * System de chargement manuel des modules
 */

import { Client, Collection, GatewayIntentBits, Partials, PermissionsBitField } from 'discord.js';
import { config } from './config';
import { logger } from './utils/logger';
import { DatabaseManager } from './database/manager';
import { RedisManager } from './cache/redis';
import * as fs from 'fs';
import * as path from 'path';

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

// Cooldown tracking par utilisateur/commande
const cooldowns = new Collection<string, Collection<string, number>>();

// ==============================================
// DATABASE & CACHE
// ==============================================

const databaseManager = new DatabaseManager();
const redisManager = new RedisManager();

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
    await databaseManager.connect();
    logger.info('✅ Database connected');

    logger.info(`✅ Redis ${redisManager.isConnected() ? 'connected' : 'disabled (optional)'}`);

    await loadAllModules();
    logger.info('✅ All modules loaded');

    loadGlobalEvents();
    logger.info('✅ Global events loaded');

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

  if (!fs.existsSync(modulesPath)) {
    logger.warn('Modules directory not found, skipping module loading');
    return;
  }

  const moduleFolders = fs.readdirSync(modulesPath);

  for (const folder of moduleFolders) {
    const modulePath = path.join(modulesPath, folder);

    if (!fs.statSync(modulePath).isDirectory()) continue;

    let indexPath = path.join(modulePath, 'index.js');
    if (!fs.existsSync(indexPath)) indexPath = path.join(modulePath, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      logger.warn(`  ⚠️  Module ${folder} has no index file`);
      continue;
    }

    try {
      const moduleData = require(indexPath);
      let module = moduleData.default || moduleData;

      if (typeof module === 'function') {
        try {
          module = new module(client, databaseManager, redisManager);
          if (typeof module.initialize === 'function') await module.initialize();
        } catch {
          logger.warn(`  ⚠️  Could not instantiate module ${folder}, using as-is`);
        }
      }

      if (module.commands && Array.isArray(module.commands)) {
        for (const command of module.commands) {
          if (command?.data?.name) {
            (client as any).commands.set(command.data.name, command);
          }
        }
      }

      if (module.events && Array.isArray(module.events)) {
        for (const event of module.events) {
          if (event?.name && typeof event.execute === 'function') {
            const handler = (...args: any[]) => {
              try {
                event.execute(...args, globalContext);
              } catch (error) {
                logger.error(`Event error [${event.name}]:`, error);
              }
            };
            event.once ? client.once(event.name, handler) : client.on(event.name, handler);
          }
        }
      }

      if (module.buttons && typeof module.buttons === 'object') {
        for (const [id, handler] of Object.entries(module.buttons)) {
          (client as any).buttonHandlers.set(id, handler);
        }
      }

      if (module.selectMenus && typeof module.selectMenus === 'object') {
        for (const [id, handler] of Object.entries(module.selectMenus)) {
          (client as any).selectMenuHandlers.set(id, handler);
        }
      }

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
  client.user.setPresence({
    activities: [{ name: '/help | Wolaro2', type: 0 }],
    status: 'online',
  });
}

async function onInteraction(interaction: any) {
  try {
    if (interaction.isChatInputCommand()) { await handleSlashCommand(interaction); return; }
    if (interaction.isButton()) { await handleButton(interaction); return; }
    if (interaction.isStringSelectMenu() || interaction.isRoleSelectMenu() ||
        interaction.isUserSelectMenu() || interaction.isChannelSelectMenu()) {
      await handleSelectMenu(interaction); return;
    }
    if (interaction.isModalSubmit()) { await handleModal(interaction); return; }
    if (interaction.isAutocomplete()) { await handleAutocomplete(interaction); return; }
  } catch (error) {
    logger.error('Interaction error:', error);
  }
}

// ==============================================
// SLASH COMMAND HANDLER
// Utilise interaction.memberPermissions (calculé par Discord) :
// → Respecte NATIVEMENT les exceptions d’intégration de rôle
//   configurées dans les paramètres du serveur Discord.
// ==============================================

async function handleSlashCommand(interaction: any) {
  const command = (client as any).commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  // 1. Commande réservée aux serveurs
  if (command.guildOnly && !interaction.guildId) {
    await interaction.reply({
      content: '❌ Cette commande ne peut être utilisée qu’en serveur.',
      ephemeral: true,
    });
    return;
  }

  // 2. Vérification des permissions via interaction.memberPermissions
  //    (Discord calcule ce champ en tenant compte des rôles, des 
  //    overrides de salon ET des exceptions d’intégration de commande)
  if (command.permissions && command.permissions.length > 0) {
    const memberPerms: PermissionsBitField | null = interaction.memberPermissions ?? null;

    if (!memberPerms) {
      await interaction.reply({
        content: '❌ Impossible de vérifier tes permissions.',
        ephemeral: true,
      });
      return;
    }

    const missingPerms = command.permissions.filter(
      (perm: any) => !memberPerms.has(perm)
    );

    if (missingPerms.length > 0) {
      await interaction.reply({
        content:
          '❌ Tu n’as pas les permissions nécessaires pour utiliser cette commande.\n' +
          'Si tu penses que c’est une erreur, contacte un administrateur pour configurer les intégrations de commandes Discord.',
        ephemeral: true,
      });
      return;
    }
  }

  // 3. Système de cooldown
  if (command.cooldown) {
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }
    const timestamps = cooldowns.get(command.data.name)!;
    const cooldownMs = command.cooldown * 1000;
    const now = Date.now();
    const userId = interaction.user.id;

    if (timestamps.has(userId)) {
      const expiresAt = timestamps.get(userId)! + cooldownMs;
      if (now < expiresAt) {
        const remaining = ((expiresAt - now) / 1000).toFixed(1);
        await interaction.reply({
          content: `⏳ Patiente encore **${remaining}s** avant de réutiliser \`/${command.data.name}\`.`,
          ephemeral: true,
        });
        return;
      }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownMs);
  }

  // 4. Exécution
  try {
    await command.execute(interaction, globalContext);
  } catch (error) {
    logger.error(`Command error [${interaction.commandName}]:`, error);
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l’exécution de cette commande.',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
}

// ==============================================
// BUTTON / SELECT / MODAL / AUTOCOMPLETE
// ==============================================

async function handleButton(interaction: any) {
  let handler = (client as any).buttonHandlers.get(interaction.customId);
  if (!handler) {
    for (const [id, h] of (client as any).buttonHandlers.entries()) {
      if (interaction.customId.startsWith(id)) { handler = h; break; }
    }
  }
  if (!handler) return;
  try {
    await handler(interaction, globalContext);
  } catch (error) {
    logger.error(`Button error [${interaction.customId}]:`, error);
  }
}

async function handleSelectMenu(interaction: any) {
  let handler = (client as any).selectMenuHandlers.get(interaction.customId);
  if (!handler) {
    for (const [id, h] of (client as any).selectMenuHandlers.entries()) {
      if (interaction.customId.startsWith(id)) { handler = h; break; }
    }
  }
  if (!handler) return;
  try {
    await handler(interaction, globalContext);
  } catch (error) {
    logger.error(`Select menu error [${interaction.customId}]:`, error);
  }
}

async function handleModal(interaction: any) {
  let handler = (client as any).modalHandlers.get(interaction.customId);
  if (!handler) {
    for (const [id, h] of (client as any).modalHandlers.entries()) {
      if (interaction.customId.startsWith(id)) { handler = h; break; }
    }
  }
  if (!handler) return;
  try {
    await handler(interaction, globalContext);
  } catch (error) {
    logger.error(`Modal error [${interaction.customId}]:`, error);
  }
}

async function handleAutocomplete(interaction: any) {
  const command = (client as any).commands.get(interaction.commandName);
  if (!command?.autocomplete) return;
  try {
    await command.autocomplete(interaction, globalContext);
  } catch (error) {
    logger.error(`Autocomplete error [${interaction.commandName}]:`, error);
  }
}

// ==============================================
// GUILD EVENTS
// ==============================================

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
  await databaseManager.disconnect();
  process.exit(0);
});

// ==============================================
// START
// ==============================================

start();
