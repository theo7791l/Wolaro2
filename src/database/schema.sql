-- Wolaro Database Schema
-- PostgreSQL 15+ Required

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

-- Guild members (for panel permissions)
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
CREATE INDEX idx_guild_modules_config ON guild_modules USING GIN (config);

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

CREATE INDEX idx_guild_settings_guild ON guild_settings(guild_id);
CREATE INDEX idx_guild_settings_category ON guild_settings(guild_id, category);
CREATE INDEX idx_guild_settings_value ON guild_settings USING GIN (value);

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

CREATE INDEX idx_panel_sessions_user ON panel_sessions(user_id);
CREATE INDEX idx_panel_sessions_token ON panel_sessions(session_token);
CREATE INDEX idx_panel_sessions_expires ON panel_sessions(expires_at);

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

CREATE INDEX idx_global_profiles_xp ON global_profiles(global_xp DESC);
CREATE INDEX idx_global_profiles_level ON global_profiles(global_level DESC);
CREATE INDEX idx_global_profiles_badges ON global_profiles USING GIN (badges);

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

CREATE INDEX idx_master_admins_user ON master_admins(user_id);
CREATE INDEX idx_master_admins_level ON master_admins(access_level);

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

CREATE INDEX idx_audit_logs_guild ON audit_logs(guild_id, timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Rate limiting tracking
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

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier, limit_type);
CREATE INDEX idx_rate_limits_blocked ON rate_limits(is_blocked, blocked_until) WHERE is_blocked = TRUE;

-- ==============================================
-- ECONOMY SYSTEM (MULTI-LEVEL)
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

CREATE INDEX idx_guild_economy_guild ON guild_economy(guild_id);
CREATE INDEX idx_guild_economy_balance ON guild_economy(guild_id, balance DESC);
CREATE INDEX idx_guild_economy_user ON guild_economy(user_id);

-- Global economy (cross-server)
CREATE TABLE global_economy (
    user_id VARCHAR(20) PRIMARY KEY REFERENCES global_profiles(user_id) ON DELETE CASCADE,
    global_coins BIGINT DEFAULT 0,
    premium_currency BIGINT DEFAULT 0,
    total_earned BIGINT DEFAULT 0,
    total_spent BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_global_economy_coins ON global_economy(global_coins DESC);

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

CREATE INDEX idx_moderation_cases_guild ON moderation_cases(guild_id, case_number DESC);
CREATE INDEX idx_moderation_cases_user ON moderation_cases(guild_id, user_id);
CREATE INDEX idx_moderation_cases_active ON moderation_cases(guild_id, is_active) WHERE is_active = TRUE;

-- Anti-raid detection
CREATE TABLE raid_events (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    join_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    user_ids JSONB DEFAULT '[]',
    auto_actions JSONB DEFAULT '[]',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_raid_events_guild ON raid_events(guild_id, started_at DESC);
CREATE INDEX idx_raid_events_active ON raid_events(guild_id, is_active) WHERE is_active = TRUE;

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

CREATE INDEX idx_rpg_profiles_guild ON rpg_profiles(guild_id);
CREATE INDEX idx_rpg_profiles_level ON rpg_profiles(guild_id, level DESC);
CREATE INDEX idx_rpg_profiles_user ON rpg_profiles(user_id);

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

CREATE INDEX idx_tickets_guild ON tickets(guild_id, ticket_number DESC);
CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_tickets_status ON tickets(guild_id, status);
CREATE INDEX idx_tickets_channel ON tickets(channel_id);

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

CREATE INDEX idx_giveaways_guild ON giveaways(guild_id);
CREATE INDEX idx_giveaways_status ON giveaways(status, end_time);
CREATE INDEX idx_giveaways_message ON giveaways(message_id);

CREATE TABLE giveaway_participants (
    id SERIAL PRIMARY KEY,
    giveaway_id UUID REFERENCES giveaways(id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL,
    is_winner BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(giveaway_id, user_id)
);

CREATE INDEX idx_giveaway_participants_giveaway ON giveaway_participants(giveaway_id);
CREATE INDEX idx_giveaway_participants_user ON giveaway_participants(user_id);
CREATE INDEX idx_giveaway_participants_winner ON giveaway_participants(giveaway_id, is_winner) WHERE is_winner = TRUE;

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

CREATE INDEX idx_leveling_profiles_guild ON leveling_profiles(guild_id);
CREATE INDEX idx_leveling_profiles_level ON leveling_profiles(guild_id, level DESC, xp DESC);
CREATE INDEX idx_leveling_profiles_user ON leveling_profiles(user_id);

-- ==============================================
-- CUSTOM COMMANDS & TEMPLATES
-- ==============================================

CREATE TABLE custom_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id VARCHAR(20) NOT NULL,
    command_name VARCHAR(32) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(20) DEFAULT 'SLASH' CHECK (trigger_type IN ('SLASH', 'PREFIX', 'CONTEXT_MENU')),
    response_type VARCHAR(20) DEFAULT 'EMBED' CHECK (response_type IN ('TEXT', 'EMBED', 'BUTTON', 'MODAL')),
    response_content JSONB NOT NULL,
    permissions JSONB DEFAULT '[]',
    cooldown INTEGER DEFAULT 0,
    usage_count BIGINT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, command_name)
);

CREATE INDEX idx_custom_commands_guild ON custom_commands(guild_id);
CREATE INDEX idx_custom_commands_enabled ON custom_commands(guild_id, is_enabled);

-- Template store
CREATE TABLE server_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    creator_id VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    config_snapshot JSONB NOT NULL,
    modules_included JSONB DEFAULT '[]',
    download_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00,
    is_public BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_server_templates_public ON server_templates(is_public, download_count DESC);
CREATE INDEX idx_server_templates_category ON server_templates(category);
CREATE INDEX idx_server_templates_rating ON server_templates(rating DESC);

-- ==============================================
-- ANALYTICS & BUSINESS INTELLIGENCE
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

CREATE INDEX idx_guild_analytics_guild ON guild_analytics(guild_id, date DESC);
CREATE INDEX idx_guild_analytics_metric ON guild_analytics(guild_id, metric_type, date DESC);

-- ==============================================
-- TRIGGERS FOR AUTO-UPDATE
-- ==============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guilds_updated_at BEFORE UPDATE ON guilds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_modules_updated_at BEFORE UPDATE ON guild_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_settings_updated_at BEFORE UPDATE ON guild_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_profiles_updated_at BEFORE UPDATE ON global_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_admins_updated_at BEFORE UPDATE ON master_admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rpg_profiles_updated_at BEFORE UPDATE ON rpg_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leveling_profiles_updated_at BEFORE UPDATE ON leveling_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- CLEANUP OLD SESSIONS (run periodically)
-- ==============================================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM panel_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
