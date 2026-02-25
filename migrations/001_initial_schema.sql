-- ==============================================
-- WOLARO DATABASE SCHEMA
-- Multi-tenant Discord bot with modular system
-- ==============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- CORE TABLES
-- ==============================================

-- Guilds (Discord servers)
CREATE TABLE IF NOT EXISTS guilds (
    guild_id VARCHAR(20) PRIMARY KEY,
    owner_id VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    icon TEXT,
    member_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    plan_type VARCHAR(20) DEFAULT 'FREE',
    is_blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    joined_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Guild members
CREATE TABLE IF NOT EXISTS guild_members (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    username VARCHAR(255),
    permissions VARCHAR(50)[],
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

-- Global user profiles
CREATE TABLE IF NOT EXISTS global_profiles (
    user_id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    discriminator VARCHAR(10),
    avatar TEXT,
    is_master_admin BOOLEAN DEFAULT FALSE,
    premium_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================
-- MODULE SYSTEM
-- ==============================================

-- Guild modules configuration
CREATE TABLE IF NOT EXISTS guild_modules (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    module_name VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, module_name)
);

-- Guild settings (key-value store)
CREATE TABLE IF NOT EXISTS guild_settings (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, category, key)
);

-- ==============================================
-- LEVELING MODULE
-- ==============================================

CREATE TABLE IF NOT EXISTS user_levels (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    xp BIGINT DEFAULT 0,
    level INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    last_message TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_levels_guild_xp ON user_levels(guild_id, xp DESC);

-- ==============================================
-- ECONOMY MODULE
-- ==============================================

CREATE TABLE IF NOT EXISTS user_economy (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    balance BIGINT DEFAULT 0,
    bank BIGINT DEFAULT 0,
    daily_claimed TIMESTAMP,
    weekly_claimed TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS economy_transactions (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON economy_transactions(guild_id, user_id, created_at DESC);

-- ==============================================
-- RPG MODULE
-- ==============================================

CREATE TABLE IF NOT EXISTS rpg_players (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    class VARCHAR(50),
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    attack INTEGER DEFAULT 10,
    defense INTEGER DEFAULT 10,
    level INTEGER DEFAULT 1,
    xp BIGINT DEFAULT 0,
    inventory JSONB DEFAULT '[]',
    equipment JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

-- ==============================================
-- MODERATION MODULE
-- ==============================================

CREATE TABLE IF NOT EXISTS moderation_logs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    case_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    reason TEXT,
    duration INTERVAL,
    expires_at TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_guild_user ON moderation_logs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_active ON moderation_logs(guild_id, active, expires_at);

-- Warnings
CREATE TABLE IF NOT EXISTS warnings (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(guild_id, user_id);

-- ==============================================
-- TICKETS MODULE
-- ==============================================

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'open',
    claimed_by VARCHAR(20),
    closed_by VARCHAR(20),
    closed_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    UNIQUE(guild_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(guild_id, status);

-- ==============================================
-- GIVEAWAYS MODULE
-- ==============================================

CREATE TABLE IF NOT EXISTS giveaways (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    message_id VARCHAR(20) UNIQUE NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    host_id VARCHAR(20) NOT NULL,
    prize TEXT NOT NULL,
    winners_count INTEGER DEFAULT 1,
    entries VARCHAR(20)[] DEFAULT ARRAY[]::VARCHAR[],
    ended BOOLEAN DEFAULT FALSE,
    winners VARCHAR(20)[] DEFAULT ARRAY[]::VARCHAR[],
    ends_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways(guild_id, ended, ends_at);

-- ==============================================
-- ANALYTICS & LOGS
-- ==============================================

CREATE TABLE IF NOT EXISTS guild_analytics (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value BIGINT NOT NULL,
    date DATE NOT NULL,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_guild_date ON guild_analytics(guild_id, date DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20),
    user_id VARCHAR(20) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_guild ON audit_logs(guild_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_guilds_updated_at BEFORE UPDATE ON guilds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_modules_updated_at BEFORE UPDATE ON guild_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_levels_updated_at BEFORE UPDATE ON user_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_economy_updated_at BEFORE UPDATE ON user_economy
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- INITIAL DATA
-- ==============================================

-- Insert default master admin (update with your Discord ID)
-- INSERT INTO global_profiles (user_id, username, is_master_admin)
-- VALUES ('1223727312416276480', 'theo7791l', TRUE)
-- ON CONFLICT (user_id) DO UPDATE SET is_master_admin = TRUE;

COMMIT;
