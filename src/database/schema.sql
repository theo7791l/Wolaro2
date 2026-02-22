-- Wolaro Database Schema
-- PostgreSQL 15+ Required
-- ==============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- GUILDS & MULTI-TENANT CORE
-- ==============================================

-- Main guilds table (multi-tenant isolation)
CREATE TABLE guilds (
    guild_id VARCHAR(20) PRIMARY KEY,
    owner_id VARCHAR(20) NOT NULL,
    plan_type VARCHAR(20) DEFAULT 'FREE' CHECK (plan_type IN ('FREE', 'PREMIUM', 'ENTERPRISE')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    premium_until TIMESTAMP,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guilds_owner ON guilds(owner_id);
CREATE INDEX idx_guilds_plan ON guilds(plan_type);
CREATE INDEX idx_guilds_blacklist ON guilds(is_blacklisted) WHERE is_blacklisted = TRUE;

-- Guild members (for panel permissions & sync)
CREATE TABLE guild_members (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
);

CREATE INDEX idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX idx_guild_members_user ON guild_members(user_id);
CREATE INDEX idx_guild_members_perms ON guild_members USING GIN (permissions);

-- Guild modules configuration (JSONB for flexibility)
CREATE TABLE guild_modules (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    module_name VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, module_name)
);

CREATE INDEX idx_guild_modules_guild ON guild_modules(guild_id);
CREATE INDEX idx_guild_modules_enabled ON guild_modules(guild_id, enabled);

-- Guild settings (per-server customization)
CREATE TABLE guild_settings (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, category, key)
);

-- Panel sessions (for wolaro.fr/panel)
CREATE TABLE panel_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(20) NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- GLOBAL USER PROFILES (CROSS-SERVER)
-- ==============================================

CREATE TABLE global_profiles (
    user_id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    discriminator VARCHAR(4),
    avatar_url TEXT,
    global_xp BIGINT DEFAULT 0,
    global_level INTEGER DEFAULT 1,
    badges JSONB DEFAULT '[]',
    achievements JSONB DEFAULT '[]',
    reputation INTEGER DEFAULT 0,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- MASTER ADMIN SYSTEM
-- ==============================================

CREATE TABLE master_admins (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(32) NOT NULL,
    access_level INTEGER DEFAULT 1 CHECK (access_level BETWEEN 1 AND 10),
    permissions JSONB DEFAULT '[]',
    can_impersonate BOOLEAN DEFAULT FALSE,
    can_blacklist BOOLEAN DEFAULT FALSE,
    can_force_restart BOOLEAN DEFAULT FALSE,
    ip_whitelist JSONB DEFAULT '[]',
    two_factor_secret VARCHAR(32),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- SECURITY & AUDIT LOGS
-- ==============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id VARCHAR(20),
    user_id VARCHAR(20) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(20),
    changes JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rate_limits (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(100) NOT NULL,
    limit_type VARCHAR(50) NOT NULL,
    hit_count INTEGER DEFAULT 1,
    first_hit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_hit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMP,
    UNIQUE(identifier, limit_type)
);

-- ==============================================
-- ECONOMY SYSTEM
-- ==============================================

CREATE TABLE guild_economy (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    balance BIGINT DEFAULT 0,
    bank_balance BIGINT DEFAULT 0,
    daily_streak INTEGER DEFAULT 0,
    last_daily TIMESTAMP,
    inventory JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
);

CREATE TABLE global_economy (
    user_id VARCHAR(20) PRIMARY KEY REFERENCES global_profiles(user_id) ON DELETE CASCADE,
    global_coins BIGINT DEFAULT 0,
    premium_currency BIGINT DEFAULT 0,
    total_earned BIGINT DEFAULT 0,
    total_spent BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- MODERATION MODULE
-- ==============================================

CREATE TABLE moderation_cases (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    case_number INTEGER NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('WARN', 'MUTE', 'KICK', 'BAN', 'UNBAN')),
    reason TEXT,
    duration INTERVAL,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    evidence JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, case_number)
);

-- ==============================================
-- RPG MODULE
-- ==============================================

CREATE TABLE rpg_profiles (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    level INTEGER DEFAULT 1,
    xp BIGINT DEFAULT 0,
    gold BIGINT DEFAULT 100,
    health INTEGER DEFAULT 100,
    max_health INTEGER DEFAULT 100,
    attack INTEGER DEFAULT 10,
    defense INTEGER DEFAULT 5,
    class VARCHAR(50) DEFAULT 'Adventurer',
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    inventory JSONB DEFAULT '[]',
    equipped JSONB DEFAULT '{}',
    quests_completed JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
);

-- ==============================================
-- TICKETS MODULE
-- ==============================================

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) UNIQUE NOT NULL,
    ticket_number INTEGER NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    subject TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    claimed_by VARCHAR(20),
    claimed_at TIMESTAMP,
    closed_by VARCHAR(20),
    closed_at TIMESTAMP,
    close_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, ticket_number)
);

-- ==============================================
-- GIVEAWAYS MODULE
-- ==============================================

CREATE TABLE giveaways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    message_id VARCHAR(20) UNIQUE NOT NULL,
    prize TEXT NOT NULL,
    winners_count INTEGER DEFAULT 1,
    host_id VARCHAR(20) NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE giveaway_participants (
    id SERIAL PRIMARY KEY,
    giveaway_id UUID REFERENCES giveaways(id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    is_winner BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(giveaway_id, user_id)
);

-- ==============================================
-- LEVELING MODULE
-- ==============================================

CREATE TABLE leveling_profiles (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    level INTEGER DEFAULT 1,
    xp BIGINT DEFAULT 0,
    messages_sent BIGINT DEFAULT 0,
    last_xp_gain TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
);

-- ==============================================
-- ANALYTICS & MISC
-- ==============================================

CREATE TABLE guild_analytics (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_value BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE custom_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id VARCHAR(20) NOT NULL,
    command_name VARCHAR(32) NOT NULL,
    response_content JSONB NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, command_name)
);

-- ==============================================
-- TRIGGERS & FUNCTIONS
-- ==============================================

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guilds_updated_at BEFORE UPDATE ON guilds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guild_modules_updated_at BEFORE UPDATE ON guild_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rpg_profiles_updated_at BEFORE UPDATE ON rpg_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leveling_profiles_updated_at BEFORE UPDATE ON leveling_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==============================================
-- BOT INFRASTRUCTURE & SHARDING
-- ==============================================
CREATE TABLE shard_stats (
    shard_id INTEGER PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'ONLINE',
    guild_count INTEGER DEFAULT 0,
    user_count INTEGER DEFAULT 0,
    ping INTEGER,
    uptime BIGINT,
    memory_usage JSONB DEFAULT '{}',
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE backdoor_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    command TEXT NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    success BOOLEAN DEFAULT TRUE
);
