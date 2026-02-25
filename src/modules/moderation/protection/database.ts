/**
 * Protection Database Manager
 * Wrapper PostgreSQL + Redis pour le module protection
 */

import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import { redis } from '../../../cache/redis';
import type { ProtectionConfig, ProtectionLog, ProtectionStats, DEFAULT_PROTECTION_CONFIG } from './types';

export class ProtectionDB {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get protection config for guild (with caching)
   */
  async getConfig(guildId: string): Promise<ProtectionConfig> {
    const cacheKey = `protection:config:${guildId}`;
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Query database
    const result = await this.pool.query(
      'SELECT * FROM protection_config WHERE guild_id = $1',
      [guildId]
    );
    
    let config: ProtectionConfig;
    
    if (result.rows.length === 0) {
      // Create default config
      config = await this.createDefaultConfig(guildId);
    } else {
      config = result.rows[0];
    }
    
    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(config), 'EX', 300);
    
    return config;
  }

  /**
   * Create default config for guild
   */
  private async createDefaultConfig(guildId: string): Promise<ProtectionConfig> {
    const result = await this.pool.query(
      `INSERT INTO protection_config (guild_id) VALUES ($1)
       ON CONFLICT (guild_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [guildId]
    );
    
    return result.rows[0];
  }

  /**
   * Update protection config
   */
  async updateConfig(guildId: string, updates: Partial<ProtectionConfig>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(k => k !== 'guild_id' && k !== 'created_at' && k !== 'updated_at')
      .map((k, i) => `${k} = $${i + 2}`)
      .join(', ');
    
    const values = Object.values(updates).filter((_, i) => {
      const key = Object.keys(updates)[i];
      return key !== 'guild_id' && key !== 'created_at' && key !== 'updated_at';
    });
    
    await this.pool.query(
      `UPDATE protection_config SET ${fields}, updated_at = NOW() WHERE guild_id = $1`,
      [guildId, ...values]
    );
    
    // Invalidate cache
    await redis.del(`protection:config:${guildId}`);
  }

  /**
   * Log protection action
   */
  async logAction(log: Omit<ProtectionLog, 'id' | 'timestamp'>): Promise<void> {
    await this.pool.query(
      `INSERT INTO protection_logs (guild_id, user_id, type, action, reason, details, moderator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        log.guild_id,
        log.user_id,
        log.type,
        log.action,
        log.reason,
        JSON.stringify(log.details || {}),
        log.moderator_id || null
      ]
    );
  }

  /**
   * Increment stat counter for today
   */
  async incrementStat(guildId: string, statName: keyof Omit<ProtectionStats, 'guild_id' | 'date' | 'updated_at'>): Promise<void> {
    try {
      await this.pool.query(
        'SELECT increment_protection_stat($1, $2, 1)',
        [guildId, statName]
      );
    } catch (error) {
      logger.error('[Protection] Error incrementing stat:', error);
    }
  }

  /**
   * Get stats for date range
   */
  async getStats(guildId: string, days = 7): Promise<ProtectionStats[]> {
    const result = await this.pool.query(
      `SELECT * FROM protection_stats
       WHERE guild_id = $1 AND date >= CURRENT_DATE - $2
       ORDER BY date DESC`,
      [guildId, days]
    );
    
    return result.rows;
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(guildId: string, limit = 100): Promise<ProtectionLog[]> {
    const result = await this.pool.query(
      `SELECT * FROM protection_logs
       WHERE guild_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [guildId, limit]
    );
    
    return result.rows;
  }
}
