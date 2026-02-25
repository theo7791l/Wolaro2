-- =====================================================
-- PROTECTION MODULE - DATABASE SCHEMA (PostgreSQL)
-- Migrated from TheoProtect (SQLite → PostgreSQL)
-- =====================================================

-- Table principale : Configuration protection par serveur
CREATE TABLE IF NOT EXISTS protection_config (
  guild_id VARCHAR(20) PRIMARY KEY,
  
  -- Anti-Spam
  antispam_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  antispam_level VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (antispam_level IN ('low', 'medium', 'high', 'extreme')),
  antispam_threshold_messages INTEGER NOT NULL DEFAULT 6,
  antispam_threshold_time INTEGER NOT NULL DEFAULT 5000,
  antispam_sanctions_progressive BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Bad Words
  badwords_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  badwords_custom_list TEXT[] NOT NULL DEFAULT '{}',
  badwords_whitelist TEXT[] NOT NULL DEFAULT '{}',
  badwords_action VARCHAR(10) NOT NULL DEFAULT 'delete' CHECK (badwords_action IN ('delete', 'timeout', 'kick', 'ban')),
  
  -- Anti-Raid
  antiraid_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  antiraid_joins_threshold INTEGER NOT NULL DEFAULT 5,
  antiraid_captcha_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  antiraid_auto_lockdown BOOLEAN NOT NULL DEFAULT FALSE,
  antiraid_action VARCHAR(10) NOT NULL DEFAULT 'kick' CHECK (antiraid_action IN ('kick', 'ban')),
  
  -- Anti-Phishing
  antiphishing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  antiphishing_check_urls BOOLEAN NOT NULL DEFAULT TRUE,
  antiphishing_trusted_domains TEXT[] NOT NULL DEFAULT '{}',
  
  -- Anti-Nuke
  antinuke_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  antinuke_channels_limit INTEGER NOT NULL DEFAULT 3,
  antinuke_roles_limit INTEGER NOT NULL DEFAULT 3,
  antinuke_bans_limit INTEGER NOT NULL DEFAULT 5,
  antinuke_protect_admins BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- NSFW Detection
  nsfw_detection_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  nsfw_check_images BOOLEAN NOT NULL DEFAULT TRUE,
  nsfw_check_videos BOOLEAN NOT NULL DEFAULT FALSE,
  nsfw_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.7 CHECK (nsfw_threshold >= 0.0 AND nsfw_threshold <= 1.0),
  
  -- Smart Lockdown
  lockdown_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  lockdown_auto_trigger BOOLEAN NOT NULL DEFAULT FALSE,
  lockdown_duration_minutes INTEGER NOT NULL DEFAULT 30,
  
  -- Général
  log_channel_id VARCHAR(20),
  whitelist_roles TEXT[] NOT NULL DEFAULT '{}',
  whitelist_users TEXT[] NOT NULL DEFAULT '{}',
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index sur guild_id (déjà PK mais explicite)
CREATE INDEX IF NOT EXISTS idx_protection_config_guild ON protection_config(guild_id);

-- Table : Logs détaillés des actions de protection
CREATE TABLE IF NOT EXISTS protection_logs (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  type VARCHAR(30) NOT NULL,
  action VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  moderator_id VARCHAR(20),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_protection_logs_guild ON protection_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_protection_logs_user ON protection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_protection_logs_type ON protection_logs(type);
CREATE INDEX IF NOT EXISTS idx_protection_logs_timestamp ON protection_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_protection_logs_guild_user ON protection_logs(guild_id, user_id);

-- Table : Statistiques agrégées par jour
CREATE TABLE IF NOT EXISTS protection_stats (
  guild_id VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  
  -- Compteurs détections
  spam_detected INTEGER NOT NULL DEFAULT 0,
  flood_detected INTEGER NOT NULL DEFAULT 0,
  bad_words_detected INTEGER NOT NULL DEFAULT 0,
  raids_detected INTEGER NOT NULL DEFAULT 0,
  phishing_detected INTEGER NOT NULL DEFAULT 0,
  nuke_attempts INTEGER NOT NULL DEFAULT 0,
  nsfw_detected INTEGER NOT NULL DEFAULT 0,
  
  -- Compteurs actions
  messages_deleted INTEGER NOT NULL DEFAULT 0,
  timeouts INTEGER NOT NULL DEFAULT 0,
  kicks INTEGER NOT NULL DEFAULT 0,
  bans INTEGER NOT NULL DEFAULT 0,
  lockdowns INTEGER NOT NULL DEFAULT 0,
  cleanups INTEGER NOT NULL DEFAULT 0,
  
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (guild_id, date)
);

-- Index pour agrégation temporelle
CREATE INDEX IF NOT EXISTS idx_protection_stats_date ON protection_stats(date DESC);

-- Table : Whitelist (membres/rôles exemptés)
CREATE TABLE IF NOT EXISTS protection_whitelist (
  guild_id VARCHAR(20) NOT NULL,
  entity_id VARCHAR(20) NOT NULL,
  entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('user', 'role')),
  reason TEXT,
  added_by VARCHAR(20) NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (guild_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_protection_whitelist_guild ON protection_whitelist(guild_id);
CREATE INDEX IF NOT EXISTS idx_protection_whitelist_type ON protection_whitelist(entity_type);

-- Table : Tracking des raids en cours
CREATE TABLE IF NOT EXISTS protection_raid_tracking (
  guild_id VARCHAR(20) PRIMARY KEY,
  joins JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  auto_locked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table : Historique des sanctions
CREATE TABLE IF NOT EXISTS protection_sanctions (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  moderator_id VARCHAR(20),
  duration_minutes INTEGER,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  
  CONSTRAINT fk_sanction_guild FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_protection_sanctions_guild ON protection_sanctions(guild_id);
CREATE INDEX IF NOT EXISTS idx_protection_sanctions_user ON protection_sanctions(user_id);
CREATE INDEX IF NOT EXISTS idx_protection_sanctions_active ON protection_sanctions(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_protection_sanctions_timestamp ON protection_sanctions(timestamp DESC);

-- Fonction pour auto-update updated_at
CREATE OR REPLACE FUNCTION update_protection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER trigger_protection_config_updated_at
  BEFORE UPDATE ON protection_config
  FOR EACH ROW
  EXECUTE FUNCTION update_protection_updated_at();

CREATE TRIGGER trigger_protection_stats_updated_at
  BEFORE UPDATE ON protection_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_protection_updated_at();

CREATE TRIGGER trigger_protection_raid_tracking_updated_at
  BEFORE UPDATE ON protection_raid_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_protection_updated_at();

-- Fonction helper : Incrémenter stats du jour
CREATE OR REPLACE FUNCTION increment_protection_stat(
  p_guild_id VARCHAR(20),
  p_stat_name VARCHAR(50),
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_sql TEXT;
BEGIN
  -- Insert or update stats
  INSERT INTO protection_stats (guild_id, date)
  VALUES (p_guild_id, v_date)
  ON CONFLICT (guild_id, date) DO NOTHING;
  
  -- Dynamic update based on stat name
  v_sql := format('UPDATE protection_stats SET %I = %I + $1 WHERE guild_id = $2 AND date = $3',
    p_stat_name, p_stat_name);
  
  EXECUTE v_sql USING p_increment, p_guild_id, v_date;
END;
$$ LANGUAGE plpgsql;

-- Vue : Stats récentes par serveur (7 derniers jours)
CREATE OR REPLACE VIEW protection_recent_stats AS
SELECT 
  guild_id,
  SUM(spam_detected) as total_spam,
  SUM(flood_detected) as total_flood,
  SUM(bad_words_detected) as total_badwords,
  SUM(raids_detected) as total_raids,
  SUM(phishing_detected) as total_phishing,
  SUM(nuke_attempts) as total_nuke,
  SUM(nsfw_detected) as total_nsfw,
  SUM(messages_deleted) as total_messages_deleted,
  SUM(timeouts) as total_timeouts,
  SUM(kicks) as total_kicks,
  SUM(bans) as total_bans,
  MAX(date) as last_activity
FROM protection_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY guild_id;

-- Commentaires pour documentation
COMMENT ON TABLE protection_config IS 'Configuration du système de protection par serveur';
COMMENT ON TABLE protection_logs IS 'Logs détaillés de toutes les actions de protection';
COMMENT ON TABLE protection_stats IS 'Statistiques agrégées par jour pour analytics';
COMMENT ON TABLE protection_whitelist IS 'Membres et rôles exemptés des systèmes de protection';
COMMENT ON TABLE protection_raid_tracking IS 'Suivi en temps réel des raids détectés';
COMMENT ON TABLE protection_sanctions IS 'Historique complet des sanctions appliquées';
COMMENT ON FUNCTION increment_protection_stat IS 'Helper pour incrémenter un compteur de stats du jour courant';
COMMENT ON VIEW protection_recent_stats IS 'Vue agrégée des stats des 7 derniers jours par serveur';
