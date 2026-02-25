/**
 * Protection Database - Complete exports
 */

import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import type { ProtectionConfig, ProtectionLog, ProtectionStats } from './types';

type StatType = keyof Omit<ProtectionStats, 'guild_id' | 'last_reset'>;

export class ProtectionDatabase {
  constructor(private pool: Pool) {}

  async getConfig(guildId: string): Promise<ProtectionConfig> {
    const result = await this.pool.query(
      'SELECT * FROM protection_config WHERE guild_id = $1',
      [guildId]
    );

    if (result.rows.length === 0) {
      return this.createDefaultConfig(guildId);
    }

    return result.rows[0];
  }

  async updateConfig(guildId: string, config: Partial<ProtectionConfig>): Promise<void> {
    const fields = Object.keys(config).filter(k => k !== 'guild_id');
    const values = fields.map(f => (config as any)[f]);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

    await this.pool.query(
      `UPDATE protection_config SET ${setClause} WHERE guild_id = $1`,
      [guildId, ...values]
    );
  }

  async logAction(
    guildId: string,
    userId: string,
    type: string,
    action: string,
    reason: string,
    details: any
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO protection_logs (guild_id, user_id, type, action, reason, details) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [guildId, userId, type, action, reason, JSON.stringify(details)]
    );
  }

  async incrementStat(guildId: string, stat: StatType): Promise<void> {
    await this.pool.query(
      `INSERT INTO protection_stats (guild_id, ${stat}) VALUES ($1, 1)
       ON CONFLICT (guild_id) DO UPDATE SET ${stat} = protection_stats.${stat} + 1`,
      [guildId]
    );
  }

  async getStats(guildId: string): Promise<ProtectionStats | null> {
    const result = await this.pool.query(
      'SELECT * FROM protection_stats WHERE guild_id = $1',
      [guildId]
    );
    return result.rows[0] || null;
  }

  async logRaidDetection(
    memberId: string,
    guildId: string,
    riskScore: number,
    riskFactors: any[]
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO raid_detections (member_id, guild_id, risk_score, risk_factors)
       VALUES ($1, $2, $3, $4)`,
      [memberId, guildId, riskScore, JSON.stringify(riskFactors)]
    );
  }

  private async createDefaultConfig(guildId: string): Promise<ProtectionConfig> {
    const result = await this.pool.query(
      `INSERT INTO protection_config (guild_id) VALUES ($1) RETURNING *`,
      [guildId]
    );
    return result.rows[0];
  }
}

// Alias for compatibility
export { ProtectionDatabase as ProtectionDB };
