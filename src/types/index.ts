/**
 * Global Types - Consolidation de tous les exports
 * Ce fichier centralise TOUS les types pour éviter les conflits
 */

import { Client, CommandInteraction, SlashCommandBuilder } from 'discord.js';

// ============================================
// MODULE TYPES
// ============================================

/**
 * Interface pour les modules Wolaro2
 */
export interface WolaroModule {
  name: string;
  initialize: (client: Client) => Promise<void>;
  shutdown?: () => Promise<void>;
}

// ============================================
// COMMAND TYPES
// ============================================

/**
 * Interface pour les commandes Discord (version générique)
 */
export interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
  cooldown?: number;
}

/**
 * Interface pour les commandes Discord (version typeée stricte)
 */
export interface ICommand {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

// ============================================
// CONFIG TYPES
// ============================================

/**
 * Configuration du bot
 */
export interface BotConfig {
  token: string;
  clientId: string;
  databaseUrl: string;
  redisUrl?: string;
}

// ============================================
// ALIAS POUR COMPATIBILITÉ
// ============================================

export type IModule = WolaroModule;

// Re-export de tous les sous-modules
export * from './discord';
export * from './websocket';
