/**
 * Protection Module - Système de protection avancé
 * Intégré au module moderation avec tous les systèmes actifs
 */

import { Client } from 'discord.js';
import { DatabaseManager } from '../../../database/manager';
import { logger } from '../../../utils/logger';
import { AntiSpamSystem } from './systems/anti-spam';
import { BadWordsSystem } from './systems/bad-words';
import { AntiRaidSystem } from './systems/anti-raid';
import { AntiPhishingSystem } from './systems/anti-phishing';
import { AntiNukeSystem } from './systems/anti-nuke';
import { NSFWDetectionSystem } from './systems/nsfw-detection';
import { SmartLockdownSystem } from './systems/smart-lockdown';
import { CaptchaSystem } from './systems/captcha';
import { ProtectionDatabase } from './database';

export class ProtectionModule {
  name = 'protection';
  private db!: ProtectionDatabase;
  
  // Systèmes exposés publiquement pour accès depuis les commandes/events
  public antiSpam!: AntiSpamSystem;
  public badWords!: BadWordsSystem;
  public antiRaid!: AntiRaidSystem;
  public antiPhishing!: AntiPhishingSystem;
  public antiNuke!: AntiNukeSystem;
  public nsfwDetection!: NSFWDetectionSystem;
  public lockdown!: SmartLockdownSystem;
  public captcha!: CaptchaSystem;

  async initialize(client: Client, database: DatabaseManager): Promise<void> {
    try {
      // Utiliser le nouveau DatabaseManager au lieu de l'ancien Pool
      this.db = new ProtectionDatabase(database.getPool());

      // Initialize systems dans le bon ordre (captcha avant antiRaid)
      this.badWords = new BadWordsSystem(this.db);
      this.antiSpam = new AntiSpamSystem(this.db);
      this.captcha = new CaptchaSystem(this.db);
      this.antiRaid = new AntiRaidSystem(this.db, this.captcha);
      this.antiPhishing = new AntiPhishingSystem(this.db);
      this.antiNuke = new AntiNukeSystem(this.db);
      this.nsfwDetection = new NSFWDetectionSystem(this.db);
      this.lockdown = new SmartLockdownSystem(this.db);

      logger.info('✓ Protection module initialized successfully');
      logger.info(`  → Anti-Spam: ✅ Active`);
      logger.info(`  → Bad Words: ✅ Active`);
      logger.info(`  → Anti-Raid: ✅ Active`);
      logger.info(`  → Anti-Phishing: ✅ Active`);
      logger.info(`  → Anti-Nuke: ✅ Active`);
      logger.info(`  → NSFW Detection: ${this.nsfwDetection.isEnabled() ? '✅ Active' : '⚠️  Disabled (API not configured)'}`);
      logger.info(`  → Smart Lockdown: ✅ Active`);
      logger.info(`  → Captcha System: ✅ Active`);
    } catch (error) {
      logger.error('Failed to initialize protection module:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Protection module shutdown');
  }
}

export default new ProtectionModule();
