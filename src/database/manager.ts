import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export class DatabaseManager {
  private pool: Pool;
  private isConnected = false;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    logger.info('Database connection closed');
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query executed in ${duration}ms`);
      return result.rows;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  // ========================================
  // GUILD OPERATIONS
  // ========================================

  async initializeGuild(guildId: string, ownerId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO guilds (guild_id, owner_id, plan_type)
         VALUES ($1, $2, 'FREE')
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId, ownerId]
      );

      // Initialize default modules
      const defaultModules = ['moderation', 'economy', 'leveling'];
      for (const module of defaultModules) {
        await client.query(
          `INSERT INTO guild_modules (guild_id, module_name, enabled, config)
           VALUES ($1, $2, true, '{}')
           ON CONFLICT (guild_id, module_name) DO NOTHING`,
          [guildId, module]
        );
      }

      await client.query('COMMIT');
      logger.info(`Guild ${guildId} initialized successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to initialize guild ${guildId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getGuildConfig(guildId: string): Promise<any> {
    const result = await this.query(
      `SELECT g.*, json_agg(json_build_object(
         'module_name', gm.module_name,
         'enabled', gm.enabled,
         'config', gm.config
       )) as modules
       FROM guilds g
       LEFT JOIN guild_modules gm ON g.guild_id = gm.guild_id
       WHERE g.guild_id = $1
       GROUP BY g.guild_id`,
      [guildId]
    );
    return result[0] || null;
  }

  async isModuleEnabled(guildId: string, moduleName: string): Promise<boolean> {
    const result = await this.query(
      'SELECT enabled FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
      [guildId, moduleName]
    );
    return result[0]?.enabled || false;
  }

  async toggleModule(guildId: string, moduleName: string, enabled: boolean): Promise<void> {
    await this.query(
      `INSERT INTO guild_modules (guild_id, module_name, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, module_name)
       DO UPDATE SET enabled = $3, updated_at = CURRENT_TIMESTAMP`,
      [guildId, moduleName, enabled]
    );
    logger.info(`Module ${moduleName} ${enabled ? 'enabled' : 'disabled'} for guild ${guildId}`);
  }

  async updateModuleConfig(guildId: string, moduleName: string, config: any): Promise<void> {
    await this.query(
      `UPDATE guild_modules
       SET config = $3, updated_at = CURRENT_TIMESTAMP
       WHERE guild_id = $1 AND module_name = $2`,
      [guildId, moduleName, JSON.stringify(config)]
    );
  }

  // ========================================
  // USER PROFILES
  // ========================================

  async getOrCreateGlobalProfile(userId: string, username: string): Promise<any> {
    const result = await this.query(
      `INSERT INTO global_profiles (user_id, username)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET username = $2
       RETURNING *`,
      [userId, username]
    );
    return result[0];
  }

  async updateGlobalXP(userId: string, xpGain: number): Promise<void> {
    await this.query(
      `UPDATE global_profiles
       SET global_xp = global_xp + $2,
           global_level = FLOOR(POWER((global_xp + $2) / 100, 0.5)) + 1
       WHERE user_id = $1`,
      [userId, xpGain]
    );
  }

  // ========================================
  // MASTER ADMIN CHECKS
  // ========================================

  async isMasterAdmin(userId: string): Promise<boolean> {
    const result = await this.query(
      'SELECT 1 FROM master_admins WHERE user_id = $1',
      [userId]
    );
    return result.length > 0;
  }

  async getMasterAdminLevel(userId: string): Promise<number> {
    const result = await this.query(
      'SELECT access_level FROM master_admins WHERE user_id = $1',
      [userId]
    );
    return result[0]?.access_level || 0;
  }

  // ========================================
  // AUDIT LOGGING
  // ========================================

  async logAction(
    userId: string,
    actionType: string,
    metadata: any,
    guildId?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.query(
      `INSERT INTO audit_logs (guild_id, user_id, action_type, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [guildId || null, userId, actionType, JSON.stringify(metadata), ipAddress || null]
    );
  }

  // ========================================
  // ECONOMY
  // ========================================

  async getBalance(guildId: string, userId: string): Promise<number> {
    const result = await this.query(
      `INSERT INTO guild_economy (guild_id, user_id, balance)
       VALUES ($1, $2, 0)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING balance`,
      [guildId, userId]
    );
    return result[0]?.balance || 0;
  }

  async addBalance(guildId: string, userId: string, amount: number): Promise<number> {
    const result = await this.query(
      `INSERT INTO guild_economy (guild_id, user_id, balance)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET balance = guild_economy.balance + $3
       RETURNING balance`,
      [guildId, userId, amount]
    );
    return result[0].balance;
  }
}
