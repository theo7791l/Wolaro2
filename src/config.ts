import dotenv from 'dotenv';
import { BotConfig } from './types';

dotenv.config();

const config: BotConfig = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  redirectUri: process.env.DISCORD_REDIRECT_URI || 'https://wolaro.fr/api/auth/callback',
  // FIX: ajout de publicKey requis pour vérification des signatures Discord (SecurityManager.verifySignature)
  publicKey: process.env.DISCORD_PUBLIC_KEY || '',

  // IDs des Master Admins (séparés par des virgules dans .env)
  masterAdmins: process.env.MASTER_ADMIN_IDS?.split(',').map((id) => id.trim()) || [],

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
    host: process.env.API_HOST || '0.0.0.0',
    jwtSecret: process.env.API_JWT_SECRET || 'change_this_secret',
    corsOrigin: process.env.API_CORS_ORIGIN?.split(',').map((o) => o.trim()) || [
      'https://wolaro.fr',
      'https://www.wolaro.fr',
      'http://localhost:3001',
    ],
    wsPort: parseInt(process.env.WS_PORT || '3001'),
    wsEnabled: process.env.WS_ENABLED !== 'false',
    panelUrl: process.env.PANEL_URL || 'https://wolaro.fr/panel',
    panelSessionDuration: parseInt(process.env.PANEL_SESSION_DURATION || '604800'),
  },

  cluster: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    shardCount:
      process.env.CLUSTER_SHARD_COUNT === 'auto'
        ? 'auto'
        : parseInt(process.env.CLUSTER_SHARD_COUNT || '1'),
  },

  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    ipWhitelist: process.env.IP_WHITELIST?.split(',').map((ip) => ip.trim()) || [
      '127.0.0.1',
      '::1',
    ],
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  features: {
    musicEnabled: process.env.FEATURE_MUSIC_ENABLED !== 'false',
    aiEnabled: process.env.FEATURE_AI_ENABLED !== 'false',
    rpgEnabled: process.env.FEATURE_RPG_ENABLED !== 'false',
    ticketsEnabled: process.env.FEATURE_TICKETS_ENABLED !== 'false',
    giveawaysEnabled: process.env.FEATURE_GIVEAWAYS_ENABLED !== 'false',
  },

  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

// ==========================================
// Validations au démarrage
// ==========================================

if (!config.token) {
  throw new Error('DISCORD_TOKEN est requis dans le fichier .env');
}

if (!config.clientId) {
  throw new Error('DISCORD_CLIENT_ID est requis dans le fichier .env');
}

// FIX: validation ajoutée pour DISCORD_PUBLIC_KEY
if (!config.publicKey) {
  throw new Error('DISCORD_PUBLIC_KEY est requis dans le fichier .env');
}

if (!config.database.password) {
  console.warn('[Wolaro] Avertissement : DB_PASSWORD non défini');
}

if (config.security.encryptionKey.length < 32) {
  console.warn('[Wolaro] Avertissement : ENCRYPTION_KEY doit faire au moins 32 caractères');
}

// FIX: jwtSecret par défaut bloque le démarrage en production (risque sécurité critique).
// En développement, un warn suffit ; en production, le bot ne doit pas démarrer avec
// la valeur par défaut qui rendrait tous les tokens JWT triviallement falsifiables.
if (config.api.jwtSecret === 'change_this_secret') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[Wolaro] API_JWT_SECRET doit être changé en production (valeur par défaut interdite)'
    );
  }
  console.warn('[Wolaro] Avertissement : Changez API_JWT_SECRET en production');
}

if (config.features.aiEnabled && !config.geminiApiKey) {
  console.warn('[Wolaro] Avertissement : GEMINI_API_KEY non défini mais module AI activé');
}

// FIX: suppression du double export (export default + export { config }) — gardé uniquement le named export
export { config };
