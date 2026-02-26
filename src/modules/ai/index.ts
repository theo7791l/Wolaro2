import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { AskCommand } from './commands/ask';
import { ChatCommand } from './commands/chat';
import { AutoModCommand } from './commands/automod';
import { SupportCommand } from './commands/support';
import { AIDevCommand } from './commands/aidev';
import { AIMessageHandler } from './events/ai-messages';
import { z } from 'zod';

export const AIConfigSchema = z.object({
  enabled: z.boolean().default(true),
  groqApiKey: z.string().optional(),
  chatEnabled: z.boolean().default(true),
  chatChannels: z.array(z.string()).default([]),
  autoModEnabled: z.boolean().default(false),
  autoModThreshold: z.number().min(0).max(1).default(0.8),
  contextMessages: z.number().min(1).max(20).default(10),
  maxTokens: z.number().min(100).max(8000).default(2000),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().optional(),
});

export default class AIModule implements IModule {
  name = 'ai';
  description = 'Intelligence artificielle avec Groq AI (architecture hybride multi-modèles + Xavier dev assistant)';
  version = '1.4.0';
  author = 'Wolaro';
  configSchema = AIConfigSchema;
  defaultConfig = {
    enabled: true,
    chatEnabled: true,
    chatChannels: [],
    autoModEnabled: false,
    autoModThreshold: 0.8,
    contextMessages: 10,
    maxTokens: 2000,
    temperature: 0.7,
  };

  commands = [
    new AskCommand(),
    new ChatCommand(),
    new AutoModCommand(),
    new SupportCommand(),
    new AIDevCommand(),
  ];

  events = [
    new AIMessageHandler(),
  ];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
