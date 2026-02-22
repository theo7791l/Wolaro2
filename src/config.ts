import dotenv from 'dotenv';
import { BotConfig } from './types';

dotenv.config();

const config: BotConfig = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  
  masterAdmins: process.env.MASTER_ADMIN_IDS?.split(',') || [],

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'wolaro',
    user: process.env.DB_USER || 'wolaro',
    password: process.env.DB_PASSWORD || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    jwtSecret: process.env.API_JWT_SECRET || 'change_this_secret',
    corsOrigin: process.env.API_CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    wsPort: parseInt(process.env.WS_PORT || '3001'),
  },

  cluster: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    shardCount: process.env.CLUSTER_SHARD_COUNT === 'auto' 
      ? 'auto' 
      : parseInt(process.env.CLUSTER_SHARD_COUNT || '1'),
  },

  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    ipWhitelist: process.env.IP_WHITELIST?.split(',') || ['127.0.0.1', '::1'],
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  features: {
    musicEnabled: process.env.FEATURE_MUSIC_ENABLED !== 'false',
    aiEnabled: process.env.FEATURE_AI_ENABLED === 'true',
    rpgEnabled: process.env.FEATURE_RPG_ENABLED !== 'false',
    ticketsEnabled: process.env.FEATURE_TICKETS_ENABLED !== 'false',
    giveawaysEnabled: process.env.FEATURE_GIVEAWAYS_ENABLED !== 'false',
  },
};

// Validation
if (!config.token) {
  throw new Error('DISCORD_TOKEN is required');
}

if (!config.clientId) {
  throw new Error('DISCORD_CLIENT_ID is required');
}

if (!config.database.password) {
  console.warn('Warning: DB_PASSWORD not set');
}

if (config.security.encryptionKey.length < 32) {
  console.warn('Warning: ENCRYPTION_KEY should be at least 32 characters');
}

if (config.api.jwtSecret === 'change_this_secret') {
  console.warn('Warning: Please change API_JWT_SECRET');
}

export default config;
