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
      // FIX: shards:'auto' uniquement hors mode cluster.
      // En mode cluster, chaque worker Node.js gère un seul processus bot ;
      // activer shards:'auto' en parallèle créerait des conflits de sharding Discord.
      ...(config.cluster.enabled ? {} : { shards: 'auto' }),
    });
    this.database = new DatabaseManager();
    this.redis = new RedisManager();
    this.moduleLoader = new ModuleLoader(this.client, this.database, this.redis);
    this.commandHandler = new CommandHandler(this.client, this.database, this.redis);
    this.eventHandler = new EventHandler(this.client, this.database, this.redis);
    this.websocket = new WebSocketServer();
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Wolaro Discord Cloud Engine...');

      // Initialize database
      await this.database.connect();
      logger.info('✓ Database connected');

      // Initialize Redis
      await this.redis.connect();
      logger.info('✓ Redis connected');

      // Load all modules
      await this.moduleLoader.loadAll();
      logger.info('✓ Modules loaded');

      // Initialize handlers
      await this.commandHandler.initialize(this.moduleLoader);
      await this.eventHandler.initialize(this.moduleLoader);
      logger.info('✓ Handlers initialized');

      // Start WebSocket server
      await this.websocket.start();
      logger.info('✓ WebSocket server started');

      // Start API server
      await startAPI(this.database, this.redis, this.websocket);
      logger.info('✓ API server started');

      // Login to Discord
      await this.client.login(config.token);
      logger.info('✓ Bot logged in successfully');

      this.setupEventListeners();
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private setupEventListeners(): void {
    this.client.on('ready', () => {
      logger.info(`Logged in as ${this.client.user?.tag}`);
      logger.info(`Serving ${this.client.guilds.cache.size} guilds`);
    });

    this.client.on('guildCreate', async (guild) => {
      logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
      await this.database.initializeGuild(guild.id, guild.ownerId);
    });

    this.client.on('guildDelete', async (guild) => {
      logger.info(`Left guild: ${guild.name} (${guild.id})`);
    });

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');
    this.client.destroy();
    await this.database.disconnect();
    await this.redis.disconnect();
    process.exit(0);
  }
}

// Start the bot
const bot = new WolaroBot();
bot.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
