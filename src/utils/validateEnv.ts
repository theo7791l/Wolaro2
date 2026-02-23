/**
 * Environment Variables Validation Utility
 * Validates that all required environment variables are set before starting the bot
 */

import { config } from 'dotenv';
import { exit } from 'process';

// Load environment variables
config();

interface EnvValidationError {
  variable: string;
  error: string;
}

const errors: EnvValidationError[] = [];

/**
 * Check if a required environment variable is set
 */
function requireEnv(name: string, description: string): void {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    errors.push({
      variable: name,
      error: `${description} is required but not set`
    });
  }
}

/**
 * Check if an environment variable meets minimum length requirements
 */
function requireMinLength(name: string, minLength: number, description: string): void {
  const value = process.env[name];
  if (value && value.length < minLength) {
    errors.push({
      variable: name,
      error: `${description} must be at least ${minLength} characters (current: ${value.length})`
    });
  }
}

/**
 * Check if an environment variable is a valid number within range
 */
function requireNumber(name: string, min?: number, max?: number): void {
  const value = process.env[name];
  if (value) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      errors.push({
        variable: name,
        error: `Must be a valid number`
      });
    } else if (min !== undefined && num < min) {
      errors.push({
        variable: name,
        error: `Must be at least ${min}`
      });
    } else if (max !== undefined && num > max) {
      errors.push({
        variable: name,
        error: `Must be at most ${max}`
      });
    }
  }
}

/**
 * Validate all required environment variables
 */
export function validateEnvironment(): boolean {
  console.log('🔍 Validating environment variables...');

  // Discord Configuration (Required)
  requireEnv('DISCORD_TOKEN', 'Discord Bot Token');
  requireEnv('DISCORD_CLIENT_ID', 'Discord Client ID');
  requireEnv('DISCORD_CLIENT_SECRET', 'Discord Client Secret');
  requireEnv('DISCORD_PUBLIC_KEY', 'Discord Public Key');

  // Database Configuration (Required)
  requireEnv('DB_HOST', 'Database Host');
  requireEnv('DB_NAME', 'Database Name');
  requireEnv('DB_USER', 'Database User');
  requireEnv('DB_PASSWORD', 'Database Password');
  requireNumber('DB_PORT', 1, 65535);
  requireNumber('DB_MAX_CONNECTIONS', 1, 1000);

  // Redis Configuration (Required)
  requireEnv('REDIS_HOST', 'Redis Host');
  requireNumber('REDIS_PORT', 1, 65535);
  requireNumber('REDIS_DB', 0, 15);

  // API Configuration (Required)
  requireEnv('API_JWT_SECRET', 'API JWT Secret');
  requireMinLength('API_JWT_SECRET', 32, 'API JWT Secret');
  requireNumber('API_PORT', 1, 65535);

  // Security Configuration (Required)
  requireEnv('ENCRYPTION_KEY', 'Encryption Key');
  requireMinLength('ENCRYPTION_KEY', 32, 'Encryption Key');

  // Master Admin (Required)
  requireEnv('MASTER_ADMIN_IDS', 'Master Admin IDs');

  // Gemini API Key (Required if AI module is enabled)
  const aiEnabled = process.env.FEATURE_AI_ENABLED === 'true';
  if (aiEnabled) {
    requireEnv('GEMINI_API_KEY', 'Gemini API Key (AI module is enabled)');
  }

  // Check for errors
  if (errors.length > 0) {
    console.error('\n❌ Environment validation failed!\n');
    console.error('The following environment variables have issues:\n');
    
    errors.forEach(({ variable, error }) => {
      console.error(`  • ${variable}: ${error}`);
    });

    console.error('\n📝 Please check your .env file and ensure all required variables are set.');
    console.error('   You can copy .env.example to .env and fill in the values.\n');
    
    return false;
  }

  console.log('✅ Environment validation passed!\n');
  return true;
}

/**
 * Validate environment and exit if validation fails
 */
export function validateEnvironmentOrExit(): void {
  if (!validateEnvironment()) {
    exit(1);
  }
}

/**
 * Display environment configuration summary (without sensitive data)
 */
export function displayEnvironmentSummary(): void {
  console.log('📋 Environment Configuration Summary:');
  console.log(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   • Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`   • Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  console.log(`   • API Port: ${process.env.API_PORT}`);
  console.log(`   • WebSocket Port: ${process.env.WS_PORT}`);
  console.log(`   • Cluster Mode: ${process.env.CLUSTER_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`   • AI Module: ${process.env.FEATURE_AI_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`   • Music Module: ${process.env.FEATURE_MUSIC_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`   • RPG Module: ${process.env.FEATURE_RPG_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`   • Tickets Module: ${process.env.FEATURE_TICKETS_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`   • Giveaways Module: ${process.env.FEATURE_GIVEAWAYS_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log('');
}
