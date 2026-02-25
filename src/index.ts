import { validateEnvironmentOrExit, displayEnvironmentSummary } from './utils/validateEnv';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { logger } from './utils/logger';
import { DatabaseManager } from './database/manager';
import { RedisManager } from './cache/redis';
import { ModuleLoader } from './core/module-loader';
import { CommandHandler } from './core/command-handler';
import { EventHandler } from './core/event-handler';
import { WebSocketServer } from './websocket/server';
import { startAPI } from './api';

// Validate environment variables before starting
validateEnvironmentOrExit();
displayEnvironmentSummary();

class WolaroBot {
  public client: Client;
  private database: DatabaseManager;
  private redis: RedisManager;
  private moduleLoader: ModuleLoader;
  private commandHandler: CommandHandler;
  private eventHandler: EventHandler;
  private websocket: WebSocketServer;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
      ...(config.cluster.enabled ? {} : { shards: 'auto' }),
    });
    this.database = new DatabaseManager();
    this.redis = new RedisManager();
    this.moduleLoader = new ModuleLoader(this.client, this.database, this.redis);
    this.commandHandler = new CommandHandler(this.client, this.database, this.redis);
    this.eventHandler = new EventHandler(this.client, this.database, this.redis);
    this.websocket = new WebSocketServer(this.database, this.redis);
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Wolaro Discord Cloud Engine...');

      await this.database.connect();
      logger.info('✓ Database connected');

      await this.redis.connect();
      logger.info('✓ Redis connected');

      await this.moduleLoader.loadAll();
      logger.info('✓ Modules loaded');

      await this.commandHandler.initialize(this.moduleLoader);
      await this.eventHandler.initialize(this.moduleLoader);
      logger.info('✓ Handlers initialized');

      await this.websocket.start();
      logger.info('✓ WebSocket server started');

      // CRITIQUE: Déplacer client.login() AVANT startAPI()
      // startAPI() démarre un serveur HTTP qui s'exécute en continu,
      // mais ne bloque PAS le thread (app.listen est non-bloquant).
      // Cependant, pour éviter toute confusion dans les logs,
      // on se connecte à Discord EN PREMIER.
      await this.client.login(config.token);
      logger.info('✓ Bot logged in successfully');

      this.setupEventListeners();

      // Démarrer l'API après la connexion Discord
      await startAPI(this.client, this.database, this.redis);
      logger.info('✓ API server started');
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private setupEventListeners(): void {
    // FIX CRITIQUE : synchronisation de TOUTES les guildes existantes au démarrage.
    // Le event guildCreate ne se déclenche QUE pour les nouvelles guildes.
    // Quand le bot redémarre, les guildes déjà présentes n'ont pas de ligne dans
    // la table `guilds`, ce qui cause une FK constraint error sur TOUTES les commandes
    // (guild_economy, guild_modules etc référencent guilds.guild_id).
    // Sans cette sync, seuls les Master Admins (commandes sans accès guild_economy)
    // pouvaient utiliser les commandes. Les utilisateurs normaux voyaient
    // "❌ Une erreur est survenue" sur chaque commande.
    this.client.on('ready', async () => {
      logger.info(`Logged in as ${this.client.user?.username}`);
      logger.info(`Serving ${this.client.guilds.cache.size} guilds`);

      logger.info('Syncing existing guilds to database...');
      let syncCount = 0;
      let errorCount = 0;

      for (const [, guild] of this.client.guilds.cache) {
        try {
          await this.database.initializeGuild(guild.id, guild.ownerId);
          syncCount++;
        } catch (error) {
          errorCount++;
          logger.error(`Failed to sync guild ${guild.id} (${guild.name}):`, error);
        }
      }

      logger.info(`✓ Guild sync complete: ${syncCount} guilds synced, ${errorCount} errors`);
    });

    // NOTE: guildCreate est déjà géré dans event-handler.ts (registerCoreEvents)
    // qui appelle initializeGuild() + executeModuleEvents('guildCreate').
    // Pas besoin de le dupliquer ici.

    // guildDelete : nettoyage des données de la guilde
    this.client.on('guildDelete', async (guild) => {
      logger.info(`Left guild: ${guild.name} (${guild.id})`);
      await this.database.cleanupGuild(guild.id);
    });

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');
    this.client.destroy();
    await this.websocket.shutdown();
    await this.database.disconnect();
    await this.redis.disconnect();
    process.exit(0);
  }
}

const bot = new WolaroBot();
bot.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
