import dotenv from 'dotenv';

dotenv.config();

export const config = {
  token: process.env.DISCORD_BOT_TOKEN || '',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'wolaro',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  // ⚡ Groq AI API (30 RPM, 14,400 RPD gratuit)
  groqApiKey: process.env.GROQ_API_KEY || '',
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || '',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
