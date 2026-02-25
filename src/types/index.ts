/**
 * Global Types - Exports explicites pour Wolaro2
 * @module types
 */

import { Client } from 'discord.js';

/**
 * Interface pour les modules Wolaro2
 */
export interface WolaroModule {
  name: string;
  initialize: (client: Client) => Promise<void>;
  shutdown?: () => Promise<void>;
}

/**
 * Interface pour les commandes Discord
 */
export interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
  cooldown?: number;
}

/**
 * Configuration du bot
 */
export interface BotConfig {
  token: string;
  clientId: string;
  databaseUrl: string;
  redisUrl?: string;
}

// Alias pour compatibilité
export type IModule = WolaroModule;
export type ICommand = Command;
