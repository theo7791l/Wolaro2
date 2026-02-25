import { pool } from '../../../database';
import { cache } from '../../../cache';
import { logger } from '../../../utils/logger';
import { WebSocketServer } from '../../../websocket';

export interface ConfigSetting {
    category: string;
    key: string;
    value: any;
}

export class ConfigManager {
    private static readonly CACHE_TTL = 3600; // 1 hour
    private static readonly CACHE_PREFIX = 'config:';

    /**
     * Get a single setting value
     */
    async getSetting(guildId: string, category: string, key: string): Promise<any> {
        const cacheKey = `${ConfigManager.CACHE_PREFIX}${guildId}:${category}:${key}`;
        
        // Try cache first
        const cached = await cache.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        // Fetch from database
        try {
            const result = await pool.query(
                'SELECT value FROM guild_settings WHERE guild_id = $1 AND category = $2 AND key = $3',
                [guildId, category, key]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const value = result.rows[0].value;
            
            // Cache the result
            await cache.setex(cacheKey, ConfigManager.CACHE_TTL, JSON.stringify(value));
            
            return value;
        } catch (error) {
            logger.error('Error getting setting:', error);
            throw error;
        }
    }

    /**
     * Set a single setting value
     */
    async setSetting(guildId: string, category: string, key: string, value: any): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO guild_settings (guild_id, category, key, value, updated_at) 
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 ON CONFLICT (guild_id, category, key) 
                 DO UPDATE SET value = $4, updated_at = CURRENT_TIMESTAMP`,
                [guildId, category, key, JSON.stringify(value)]
            );

            // Invalidate cache
            const cacheKey = `${ConfigManager.CACHE_PREFIX}${guildId}:${category}:${key}`;
            await cache.del(cacheKey);

            // Also invalidate module cache
            await cache.del(`${ConfigManager.CACHE_PREFIX}${guildId}:${category}`);

            // Log the change
            await this.logConfigChange(guildId, category, key, value);

            // Emit WebSocket event
            WebSocketServer.broadcast('guild:config:update', {
                guildId,
                category,
                key,
                value
            });

            logger.info(`Config updated for guild ${guildId}: ${category}.${key}`);
        } catch (error) {
            logger.error('Error setting config:', error);
            throw error;
        }
    }

    /**
     * Delete a single setting
     */
    async deleteSetting(guildId: string, category: string, key: string): Promise<void> {
        try {
            await pool.query(
                'DELETE FROM guild_settings WHERE guild_id = $1 AND category = $2 AND key = $3',
                [guildId, category, key]
            );

            // Invalidate cache
            const cacheKey = `${ConfigManager.CACHE_PREFIX}${guildId}:${category}:${key}`;
            await cache.del(cacheKey);
            await cache.del(`${ConfigManager.CACHE_PREFIX}${guildId}:${category}`);

            logger.info(`Config deleted for guild ${guildId}: ${category}.${key}`);
        } catch (error) {
            logger.error('Error deleting config:', error);
            throw error;
        }
    }

    /**
     * Get all settings for a specific module/category
     */
    async getModuleSettings(guildId: string, moduleName: string): Promise<Record<string, any>> {
        const cacheKey = `${ConfigManager.CACHE_PREFIX}${guildId}:${moduleName}`;
        
        // Try cache first
        const cached = await cache.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        try {
            const result = await pool.query(
                'SELECT key, value FROM guild_settings WHERE guild_id = $1 AND category = $2',
                [guildId, moduleName]
            );

            const settings: Record<string, any> = {};
            for (const row of result.rows) {
                settings[row.key] = row.value;
            }

            // Cache the result
            await cache.setex(cacheKey, ConfigManager.CACHE_TTL, JSON.stringify(settings));

            return settings;
        } catch (error) {
            logger.error('Error getting module settings:', error);
            throw error;
        }
    }

    /**
     * Get all settings for a guild
     */
    async getAllSettings(guildId: string): Promise<Record<string, Record<string, any>>> {
        try {
            const result = await pool.query(
                'SELECT category, key, value FROM guild_settings WHERE guild_id = $1 ORDER BY category, key',
                [guildId]
            );

            const settings: Record<string, Record<string, any>> = {};
            for (const row of result.rows) {
                if (!settings[row.category]) {
                    settings[row.category] = {};
                }
                settings[row.category][row.key] = row.value;
            }

            return settings;
        } catch (error) {
            logger.error('Error getting all settings:', error);
            throw error;
        }
    }

    /**
     * Reset all settings for a module
     */
    async resetModuleSettings(guildId: string, moduleName: string): Promise<void> {
        try {
            await pool.query(
                'DELETE FROM guild_settings WHERE guild_id = $1 AND category = $2',
                [guildId, moduleName]
            );

            // Invalidate cache
            await cache.del(`${ConfigManager.CACHE_PREFIX}${guildId}:${moduleName}`);

            // Delete all individual keys from cache
            const keys = await cache.keys(`${ConfigManager.CACHE_PREFIX}${guildId}:${moduleName}:*`);
            if (keys.length > 0) {
                await cache.del(...keys);
            }

            logger.info(`Module settings reset for guild ${guildId}: ${moduleName}`);
        } catch (error) {
            logger.error('Error resetting module settings:', error);
            throw error;
        }
    }

    /**
     * Export all settings as JSON
     */
    async exportSettings(guildId: string): Promise<string> {
        try {
            const settings = await this.getAllSettings(guildId);
            
            // Also get module enabled/disabled status
            const modulesResult = await pool.query(
                'SELECT module_name, enabled, config FROM guild_modules WHERE guild_id = $1',
                [guildId]
            );

            const exportData = {
                version: '1.0.0',
                exportedAt: new Date().toISOString(),
                guildId,
                settings,
                modules: modulesResult.rows
            };

            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            logger.error('Error exporting settings:', error);
            throw error;
        }
    }

    /**
     * Import settings from JSON
     */
    async importSettings(guildId: string, json: string): Promise<void> {
        try {
            const data = JSON.parse(json);

            // Validate structure
            if (!data.version || !data.settings) {
                throw new Error('Invalid import data format');
            }

            // Start transaction
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Import settings
                for (const [category, categorySettings] of Object.entries(data.settings)) {
                    for (const [key, value] of Object.entries(categorySettings as Record<string, any>)) {
                        await client.query(
                            `INSERT INTO guild_settings (guild_id, category, key, value, updated_at) 
                             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                             ON CONFLICT (guild_id, category, key) 
                             DO UPDATE SET value = $4, updated_at = CURRENT_TIMESTAMP`,
                            [guildId, category, key, JSON.stringify(value)]
                        );
                    }
                }

                // Import module status if available
                if (data.modules) {
                    for (const module of data.modules) {
                        await client.query(
                            `INSERT INTO guild_modules (guild_id, module_name, enabled, config, updated_at)
                             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                             ON CONFLICT (guild_id, module_name)
                             DO UPDATE SET enabled = $3, config = $4, updated_at = CURRENT_TIMESTAMP`,
                            [guildId, module.module_name, module.enabled, module.config]
                        );
                    }
                }

                await client.query('COMMIT');

                // Clear all caches for this guild
                await this.clearGuildCache(guildId);

                logger.info(`Settings imported for guild ${guildId}`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            logger.error('Error importing settings:', error);
            throw error;
        }
    }

    /**
     * Clear all cached settings for a guild
     */
    async clearGuildCache(guildId: string): Promise<void> {
        const pattern = `${ConfigManager.CACHE_PREFIX}${guildId}:*`;
        const keys = await cache.keys(pattern);
        if (keys.length > 0) {
            await cache.del(...keys);
        }
    }

    /**
     * Log configuration change to audit logs
     */
    private async logConfigChange(guildId: string, category: string, key: string, value: any): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO audit_logs (guild_id, user_id, action_type, target_type, changes, timestamp)
                 VALUES ($1, 'SYSTEM', 'CONFIG_UPDATE', 'GUILD_SETTING', $2, CURRENT_TIMESTAMP)`,
                [
                    guildId,
                    JSON.stringify({
                        category,
                        key,
                        newValue: value
                    })
                ]
            );
        } catch (error) {
            logger.error('Error logging config change:', error);
            // Don't throw, logging failure shouldn't break config update
        }
    }

    /**
     * Get default values for a module
     */
    getDefaultValues(moduleName: string): Record<string, any> {
        const defaults: Record<string, Record<string, any>> = {
            moderation: {
                spam_threshold: 5,
                raid_threshold: 10,
                warn_threshold: 3,
                warn_action: 'mute',
                automod_enabled: true,
                filter_words: []
            },
            economy: {
                daily_amount: 100,
                work_min: 50,
                work_max: 150,
                work_cooldown: 3600,
                global_economy: false,
                starting_balance: 0,
                bank_limit: 10000
            },
            leveling: {
                xp_per_message: 15,
                xp_cooldown: 60,
                level_up_dm: false,
                xp_multiplier: 1.0,
                reward_mode: 'stack',
                ignored_channels: []
            },
            music: {
                volume_default: 50,
                queue_limit: 100,
                auto_leave: true,
                auto_leave_time: 300,
                vote_skip: false,
                vote_skip_percent: 50
            },
            ai: {
                response_chance: 10,
                toxicity_threshold: 0.7,
                auto_moderation: false,
                context_length: 10,
                max_tokens: 1000,
                ai_channels: []
            },
            rpg: {
                starting_gold: 100,
                starting_health: 100,
                daily_reward: 50,
                battle_cooldown: 300,
                pvp_enabled: true,
                monster_difficulty: 'normal',
                quest_refresh_hours: 24,
                death_penalty: true
            },
            tickets: {
                max_tickets: 3,
                auto_close_hours: 24,
                transcripts_enabled: true,
                support_roles: []
            },
            giveaways: {
                min_account_age_days: 7,
                min_server_age_days: 0,
                max_winners: 20,
                dm_winners: true
            },
            general: {
                prefix: '!',
                language: 'fr',
                timezone: 'Europe/Paris',
                welcome_enabled: false,
                leave_enabled: false,
                autorole_enabled: false
            }
        };

        return defaults[moduleName] || {};
    }
}

export const configManager = new ConfigManager();
