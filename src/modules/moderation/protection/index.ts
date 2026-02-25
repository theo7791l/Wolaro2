/**
 * Module Protection - TheoProtect Integration
 * Point d'entrée du module de protection avancée
 * Mise à jour avec tous les systèmes intégrés
 */

import { Client } from 'discord.js';
import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import type { WolaroModule } from '../../../types';

// Systems
import { AntiSpamSystem } from './systems/anti-spam';
import { BadWordsFilter } from './systems/bad-words';
import { AntiRaidSystem } from './systems/anti-raid';
import { AntiPhishingSystem } from './systems/anti-phishing';
import { AntiNukeSystem } from './systems/anti-nuke';
import { NSFWDetectionSystem } from './systems/nsfw-detection';
import { SmartLockdownSystem } from './systems/smart-lockdown';
import { ProtectionDB } from './database';

export class ProtectionModule implements WolaroModule {
  public readonly name = 'protection';
  public readonly description = 'Système de protection avancée (anti-spam, anti-raid, anti-phishing...)';
  
  private initialized = false;
  private db!: ProtectionDB;
  private badWords!: BadWordsFilter;
  public antiSpam!: AntiSpamSystem;
  public antiRaid!: AntiRaidSystem;
  public antiPhishing!: AntiPhishingSystem;
  public antiNuke!: AntiNukeSystem;
  public nsfwDetection!: NSFWDetectionSystem;
  public smartLockdown!: SmartLockdownSystem;

  async initialize(client: Client): Promise<void> {
    if (this.initialized) {
      logger.warn('Protection module already initialized');
      return;
    }

    try {
      // Get database pool (assume it's available from client or import)
      const pool = (client as any).dbPool as Pool;
      if (!pool) {
        throw new Error('Database pool not available');
      }

      // Initialize database manager
      this.db = new ProtectionDB(pool);

      // Initialize all systems
      this.badWords = new BadWordsFilter();
      this.antiSpam = new AntiSpamSystem(this.db, this.badWords);
      this.antiRaid = new AntiRaidSystem(this.db);
      this.antiPhishing = new AntiPhishingSystem(this.db);
      this.antiNuke = new AntiNukeSystem(this.db);
      this.nsfwDetection = new NSFWDetectionSystem(this.db);
      this.smartLockdown = new SmartLockdownSystem(this.db);

      logger.info('✓ Protection module initialized successfully');
      logger.info('  → Anti-Spam: ✅ Active');
      logger.info('  → Bad Words: ✅ Active');
      logger.info('  → Anti-Raid: ✅ Active');
      logger.info('  → Anti-Phishing: ✅ Active');
      logger.info('  → Anti-Nuke: ✅ Active');
      logger.info(`  → NSFW Detection: ${this.nsfwDetection.isEnabled() ? '✅ Active' : '⚠️  Disabled (API not configured)'}`);
      logger.info('  → Smart Lockdown: ✅ Active');
      
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize protection module:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    
    logger.info('Protection module shutting down...');
    this.initialized = false;
  }
}

// Export singleton instance
const protectionModule = new ProtectionModule();
export default protectionModule;

// Export systems for event handlers
export const antiRaid = protectionModule.antiRaid;
export const antiSpam = protectionModule.antiSpam;
export const antiPhishing = protectionModule.antiPhishing;
export const antiNuke = protectionModule.antiNuke;
export const nsfwDetection = protectionModule.nsfwDetection;
export const smartLockdown = protectionModule.smartLockdown;
