/**
 * Database Migrations Manager
 * Gère les migrations de base de données automatiquement au démarrage
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export class MigrationsManager {
  constructor(private pool: Pool) {}

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      logger.info('Checking database migrations...');
      
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Check if protection tables need to be created
      const needsProtectionMigration = await this.needsProtectionMigration();
      
      if (needsProtectionMigration) {
        logger.info('Running protection module migration...');
        await this.runProtectionMigration();
        await this.markMigrationExecuted('protection_module_initial');
        logger.info('✅ Protection migration completed');
      } else {
        logger.info('✅ All migrations up to date');
      }
    } catch (error) {
      logger.error('Migration error:', error);
      throw error;
    }
  }

  /**
   * Ensure migrations tracking table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  /**
   * Check if protection migration is needed
   */
  private async needsProtectionMigration(): Promise<boolean> {
    // Check if migration was already executed
    const migrationCheck = await this.pool.query(
      "SELECT * FROM migrations WHERE name = 'protection_module_initial'"
    );
    
    if (migrationCheck.rows.length > 0) {
      return false;
    }
    
    // Check if tables already exist
    const tableCheck = await this.pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'protection_config'
    `);
    
    return tableCheck.rows.length === 0;
  }

  /**
   * Mark migration as executed
   */
  private async markMigrationExecuted(name: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
  }

  /**
   * Run protection module migration
   */
  private async runProtectionMigration(): Promise<void> {
    const sql = `
      -- Protection Config
      CREATE TABLE IF NOT EXISTS protection_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        antispam_enabled BOOLEAN DEFAULT true,
        antispam_level VARCHAR(10) DEFAULT 'medium',
        antispam_message_limit INTEGER DEFAULT 5,
        antispam_time_window INTEGER DEFAULT 5000,
        badwords_enabled BOOLEAN DEFAULT true,
        badwords_action VARCHAR(20) DEFAULT 'delete',
        badwords_strict_mode BOOLEAN DEFAULT false,
        badwords_whitelist TEXT[] DEFAULT '{}',
        antiraid_enabled BOOLEAN DEFAULT true,
        antiraid_captcha_enabled BOOLEAN DEFAULT false,
        antiraid_auto_lockdown BOOLEAN DEFAULT false,
        antiraid_join_threshold INTEGER DEFAULT 5,
        antiphishing_enabled BOOLEAN DEFAULT true,
        antiphishing_check_urls BOOLEAN DEFAULT true,
        antiphishing_trusted_domains TEXT[] DEFAULT '{}',
        antinuke_enabled BOOLEAN DEFAULT true,
        antinuke_protect_admins BOOLEAN DEFAULT true,
        antinuke_channel_delete_limit INTEGER DEFAULT 3,
        antinuke_role_delete_limit INTEGER DEFAULT 3,
        nsfw_detection_enabled BOOLEAN DEFAULT false,
        nsfw_threshold DECIMAL(3,2) DEFAULT 0.7,
        lockdown_enabled BOOLEAN DEFAULT true,
        lockdown_auto_trigger BOOLEAN DEFAULT false,
        log_channel_id VARCHAR(20),
        whitelist_users TEXT[] DEFAULT '{}',
        whitelist_roles TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Protection Logs
      CREATE TABLE IF NOT EXISTS protection_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        reason TEXT,
        details JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );

      -- Protection Stats
      CREATE TABLE IF NOT EXISTS protection_stats (
        guild_id VARCHAR(20) PRIMARY KEY,
        spam_detected INTEGER DEFAULT 0,
        badwords_filtered INTEGER DEFAULT 0,
        raids_detected INTEGER DEFAULT 0,
        phishing_blocked INTEGER DEFAULT 0,
        nuke_attempts INTEGER DEFAULT 0,
        nsfw_detected INTEGER DEFAULT 0,
        lockdowns INTEGER DEFAULT 0,
        last_reset TIMESTAMP DEFAULT NOW()
      );

      -- Raid Detections
      CREATE TABLE IF NOT EXISTS raid_detections (
        id SERIAL PRIMARY KEY,
        member_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_factors JSONB,
        action VARCHAR(50),
        detected_at TIMESTAMP DEFAULT NOW()
      );

      -- Phishing Domains
      CREATE TABLE IF NOT EXISTS phishing_domains (
        domain VARCHAR(255) PRIMARY KEY,
        is_malicious BOOLEAN NOT NULL,
        confidence DECIMAL(3,2),
        last_checked TIMESTAMP DEFAULT NOW()
      );

      -- Lockdown States
      CREATE TABLE IF NOT EXISTS lockdown_states (
        guild_id VARCHAR(20) PRIMARY KEY,
        is_locked BOOLEAN DEFAULT false,
        reason TEXT,
        started_at TIMESTAMP,
        locked_channels TEXT[]
      );

      -- Nuke Detections
      CREATE TABLE IF NOT EXISTS nuke_detections (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        action_count INTEGER NOT NULL,
        time_window INTEGER NOT NULL,
        detected_at TIMESTAMP DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_protection_logs_guild ON protection_logs(guild_id);
      CREATE INDEX IF NOT EXISTS idx_protection_logs_timestamp ON protection_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_raid_detections_guild ON raid_detections(guild_id);
      CREATE INDEX IF NOT EXISTS idx_nuke_detections_guild ON nuke_detections(guild_id);

      -- Trigger function
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_protection_config_updated_at ON protection_config;
      CREATE TRIGGER update_protection_config_updated_at 
        BEFORE UPDATE ON protection_config 
        FOR EACH ROW 
        EXECUTE PROCEDURE update_updated_at_column();
    `;

    await this.pool.query(sql);
  }
}
