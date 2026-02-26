import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Fix: DISCORD_TOKEN au lieu de DISCORD_BOT_TOKEN (cohérence avec .env)
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  publicKey: process.env.DISCORD_PUBLIC_KEY || '',
  redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'wolaro',
    database: process.env.DB_NAME || 'wolaro',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  },
  
  // ⚡ Groq AI API (30 RPM, 14,400 RPD gratuit) - Remplacement de Gemini
  groqApiKey: process.env.GROQ_API_KEY || '',
  
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || '',
  },
  
  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    host: process.env.API_HOST || '0.0.0.0',
    wsPort: parseInt(process.env.WS_PORT || '3001'),
    // Fix: JWT_SECRET au lieu de API_JWT_SECRET (cohérence avec certains .env)
    jwtSecret: process.env.API_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    // Fix: API_CORS_ORIGIN au lieu de CORS_ORIGIN (cohérence avec .env)
    corsOrigin: (process.env.API_CORS_ORIGIN || process.env.CORS_ORIGIN)?.split(',') || ['http://localhost:3000'],
  },
  
  cluster: {
    // Fix: CLUSTER_SHARD_COUNT au lieu de SHARD_COUNT (cohérence avec .env)
    shardCount: process.env.CLUSTER_SHARD_COUNT || process.env.SHARD_COUNT || 'auto',
    totalShards: parseInt(process.env.TOTAL_SHARDS || '1'),
  },
  
  security: {
    // Fix: RATE_LIMIT_WINDOW_MS au lieu de RATE_LIMIT_WINDOW (cohérence avec .env)
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW || '60000'),
    // Fix: RATE_LIMIT_MAX_REQUESTS au lieu de RATE_LIMIT_MAX (cohérence avec .env)
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_MAX || '100'),
    ipWhitelist: process.env.IP_WHITELIST?.split(',') || [],
  },
  
  // Fix: MASTER_ADMIN_IDS au lieu de MASTER_ADMINS (cohérence avec .env)
  masterAdmins: (process.env.MASTER_ADMIN_IDS || process.env.MASTER_ADMINS)?.split(',') || [],
  
  logLevel: process.env.LOG_LEVEL || 'info',
};
