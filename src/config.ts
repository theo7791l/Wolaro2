import dotenv from 'dotenv';

dotenv.config();

export const config = {
  token: process.env.DISCORD_BOT_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
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
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  
  cluster: {
    shardCount: process.env.SHARD_COUNT || 'auto',
    totalShards: parseInt(process.env.TOTAL_SHARDS || '1'),
  },
  
  security: {
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    ipWhitelist: process.env.IP_WHITELIST?.split(',') || [],
  },
  
  masterAdmins: process.env.MASTER_ADMINS?.split(',') || [],
  
  logLevel: process.env.LOG_LEVEL || 'info',
};
