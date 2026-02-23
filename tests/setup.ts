// Jest setup file: sets required env variables before any module is loaded
// This prevents config.ts from throwing when DISCORD_TOKEN etc. are absent in CI

process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test_token_placeholder';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'test_client_id';
process.env.DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'test_client_secret';
process.env.DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || 'a'.repeat(64);
process.env.API_JWT_SECRET = process.env.API_JWT_SECRET || 'test_jwt_secret_that_is_long_enough';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test_encryption_key_32_characters!!';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
