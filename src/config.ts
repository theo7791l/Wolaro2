import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  discord: z.object({
    token: z.string().min(1),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url(),
  }),
  database: z.object({
    url: z.string().url(),
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    name: z.string().default('wolaro'),
    user: z.string().default('postgres'),
    password: z.string().min(1),
  }),
  redis: z.object({
    url: z.string().url(),
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
  }),
  api: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
    jwtSecret: z.string().min(32),
    sessionSecret: z.string().min(32),
  }),
  security: z.object({
    masterAdminIds: z.array(z.string()),
    ipWhitelist: z.array(z.string()),
    enable2FA: z.boolean().default(false),
  }),
  websocket: z.object({
    port: z.number().default(3001),
  }),
  environment: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  cluster: z.object({
    enabled: z.boolean().default(false),
    shardCount: z.union([z.number(), z.literal('auto')]).default('auto'),
  }),
});

export const config = configSchema.parse({
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
  },
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    host: process.env.API_HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || '',
    sessionSecret: process.env.SESSION_SECRET || '',
  },
  security: {
    masterAdminIds: process.env.MASTER_ADMIN_IDS?.split(',') || [],
    ipWhitelist: process.env.IP_WHITELIST?.split(',') || [],
    enable2FA: process.env.ENABLE_2FA === 'true',
  },
  websocket: {
    port: parseInt(process.env.WS_PORT || '3001'),
  },
  environment: process.env.NODE_ENV as 'development' | 'production' | 'test',
  logLevel: process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug',
  cluster: {
    enabled: process.env.CLUSTER_MODE === 'true',
    shardCount: process.env.SHARD_COUNT === 'auto' ? 'auto' : parseInt(process.env.SHARD_COUNT || '1'),
  },
});

export type Config = z.infer<typeof configSchema>;
