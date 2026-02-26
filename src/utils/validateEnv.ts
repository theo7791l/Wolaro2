import { logger } from './logger';

interface EnvConfig {
  required: string[];
  optional: string[];
}

const envConfig: EnvConfig = {
  required: [
    'DISCORD_BOT_TOKEN',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ],
  optional: [
    'GROQ_API_KEY',  // Optional - only for AI module
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_ACCESS_KEY_ID',
    'CLOUDFLARE_SECRET_ACCESS_KEY',
    'LOG_LEVEL',
  ],
};

export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of envConfig.required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check optional variables
  for (const key of envConfig.optional) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  // Report missing required variables
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missing.forEach((key) => logger.error(`  - ${key}`));
    logger.error('\nPlease create a .env file based on .env.example');
    process.exit(1);
  }

  // Report missing optional variables as info
  if (warnings.length > 0) {
    logger.info('ℹ️ Optional environment variables not set (some features may be disabled):');
    warnings.forEach((key) => {
      if (key === 'GROQ_API_KEY') {
        logger.info(`  - ${key} (AI module will be disabled)`);
      } else {
        logger.info(`  - ${key}`);
      }
    });
  }

  logger.info('✅ Environment validation passed');
}
