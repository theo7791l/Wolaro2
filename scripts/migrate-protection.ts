/**
 * Migration Script - Protection Module
 * Crée automatiquement toutes les tables pour le module de protection
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PROTECTION_MIGRATION = `
-- ============================================
-- WOLARO2 PROTECTION MODULE - DATABASE SCHEMA
-- ============================================

-- Table de configuration protection
CREATE TABLE IF NOT EXISTS protection_config (
  guild_id VARCHAR(20) PRIMARY KEY,
  
  -- Anti-Spam
  antispam_enabled BOOLEAN DEFAULT true,
  antispam_level VARCHAR(10) DEFAULT 'medium',
  antispam_message_limit INTEGER DEFAULT 5,
  antispam_time_window INTEGER DEFAULT 5000,
  
  -- Bad Words
  badwords_enabled BOOLEAN DEFAULT true,
  badwords_action VARCHAR(20) DEFAULT 'delete',
  badwords_strict_mode BOOLEAN DEFAULT false,
  badwords_whitelist TEXT[] DEFAULT '{}',
  
  -- Anti-Raid
  antiraid_enabled BOOLEAN DEFAULT true,
  antiraid_captcha_enabled BOOLEAN DEFAULT false,
  antiraid_auto_lockdown BOOLEAN DEFAULT false,
  antiraid_join_threshold INTEGER DEFAULT 5,
  
  -- Anti-Phishing
  antiphishing_enabled BOOLEAN DEFAULT true,
  antiphishing_check_urls BOOLEAN DEFAULT true,
  antiphishing_trusted_domains TEXT[] DEFAULT '{}',
  
  -- Anti-Nuke
  antinuke_enabled BOOLEAN DEFAULT true,
  antinuke_protect_admins BOOLEAN DEFAULT true,
  antinuke_channel_delete_limit INTEGER DEFAULT 3,
  antinuke_role_delete_limit INTEGER DEFAULT 3,
  
  -- NSFW Detection
  nsfw_detection_enabled BOOLEAN DEFAULT false,
  nsfw_threshold DECIMAL(3,2) DEFAULT 0.7,
  
  -- Lockdown
  lockdown_enabled BOOLEAN DEFAULT true,
  lockdown_auto_trigger BOOLEAN DEFAULT false,
  
  -- General
  log_channel_id VARCHAR(20),
  whitelist_users TEXT[] DEFAULT '{}',
  whitelist_roles TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des logs d'actions
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

-- Table des statistiques
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

-- Table détection raids
CREATE TABLE IF NOT EXISTS raid_detections (
  id SERIAL PRIMARY KEY,
  member_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_factors JSONB,
  action VARCHAR(50),
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Table domaines phishing
CREATE TABLE IF NOT EXISTS phishing_domains (
  domain VARCHAR(255) PRIMARY KEY,
  is_malicious BOOLEAN NOT NULL,
  confidence DECIMAL(3,2),
  last_checked TIMESTAMP DEFAULT NOW()
);

-- Table états lockdown
CREATE TABLE IF NOT EXISTS lockdown_states (
  guild_id VARCHAR(20) PRIMARY KEY,
  is_locked BOOLEAN DEFAULT false,
  reason TEXT,
  started_at TIMESTAMP,
  locked_channels TEXT[]
);

-- Table détections nuke
CREATE TABLE IF NOT EXISTS nuke_detections (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_count INTEGER NOT NULL,
  time_window INTEGER NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEX POUR PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_protection_logs_guild ON protection_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_protection_logs_timestamp ON protection_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_protection_logs_type ON protection_logs(type);
CREATE INDEX IF NOT EXISTS idx_raid_detections_guild ON raid_detections(guild_id);
CREATE INDEX IF NOT EXISTS idx_raid_detections_member ON raid_detections(member_id);
CREATE INDEX IF NOT EXISTS idx_nuke_detections_guild ON nuke_detections(guild_id);
CREATE INDEX IF NOT EXISTS idx_nuke_detections_user ON nuke_detections(user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger pour updated_at sur protection_config
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

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue stats agrégées par jour
CREATE OR REPLACE VIEW protection_daily_stats AS
SELECT 
  guild_id,
  DATE(timestamp) as date,
  type,
  COUNT(*) as count
FROM protection_logs
GROUP BY guild_id, DATE(timestamp), type
ORDER BY date DESC;

-- Vue membres à risque
CREATE OR REPLACE VIEW high_risk_members AS
SELECT 
  member_id,
  guild_id,
  risk_score,
  detected_at
FROM raid_detections
WHERE risk_score >= 7
  AND detected_at > NOW() - INTERVAL '7 days'
ORDER BY risk_score DESC;

-- ============================================
-- FONCTIONS UTILES
-- ============================================

-- Réinitialiser les stats d'une guilde
CREATE OR REPLACE FUNCTION reset_guild_stats(guild_id_param VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE protection_stats
  SET 
    spam_detected = 0,
    badwords_filtered = 0,
    raids_detected = 0,
    phishing_blocked = 0,
    nuke_attempts = 0,
    nsfw_detected = 0,
    lockdowns = 0,
    last_reset = NOW()
  WHERE guild_id = guild_id_param;
END;
$$ LANGUAGE plpgsql;

-- Nettoyer les vieux logs (> 90 jours)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM protection_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
`;

async function runMigration() {
  console.log('🚀 Starting Protection Module migration...');
  
  try {
    await pool.query(PROTECTION_MIGRATION);
    console.log('✅ Protection tables created successfully!');
    console.log('\n📊 Tables created:');
    console.log('  ✓ protection_config');
    console.log('  ✓ protection_logs');
    console.log('  ✓ protection_stats');
    console.log('  ✓ raid_detections');
    console.log('  ✓ phishing_domains');
    console.log('  ✓ lockdown_states');
    console.log('  ✓ nuke_detections');
    console.log('\n🔍 Indexes created for performance');
    console.log('🔄 Triggers and functions created');
    console.log('\n✨ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
