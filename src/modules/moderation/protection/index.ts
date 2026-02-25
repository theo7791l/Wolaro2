/**
 * Protection Module - Fixed imports and initialization
 */

import { Client } from 'discord.js';
import { Pool } from 'pg';
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

// Fix: Définition locale de l'interface au lieu d'import
interface WolaroModule {
  name: string;
  initialize: (client: Client) => Promise<void>;
  shutdown?: () => Promise<void>;
}

class ProtectionModule implements WolaroModule {
  name = 'protection';
  private db!: ProtectionDatabase;
  antiSpam!: AntiSpamSystem;
  badWords!: BadWordsSystem;
  antiRaid!: AntiRaidSystem;
  antiPhishing!: AntiPhishingSystem;
  antiNuke!: AntiNukeSystem;
  nsfwDetection!: NSFWDetectionSystem;
  lockdown!: SmartLockdownSystem;
  captcha!: CaptchaSystem;

  async initialize(client: Client): Promise<void> {
    try {
      const pool = (client as any).dbPool as Pool;
      this.db = new ProtectionDatabase(pool);

      // Initialize systems
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
