import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export class DatabaseManager {
  private pool: Pool;
  public isConnected = false;

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

      // Activer TOUS les modules par défaut
      const defaultModules = [
        'moderation', 'economy', 'leveling', 'ai', 'music',
        'rpg', 'tickets', 'giveaways', 'utility', 'fun', 'logs', 'automod',
      ];

      for (const module of defaultModules) {
        await client.query(
          `INSERT INTO guild_modules (guild_id, module_name, enabled, config)
           VALUES ($1, $2, true, '{}')
           ON CONFLICT (guild_id, module_name) DO NOTHING`,
          [guildId, module]
        );
      }

      await client.query('COMMIT');
      logger.info(`Guild ${guildId} initialized with all modules enabled`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to initialize guild ${guildId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async cleanupGuild(guildId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      const orphanTables = [
        'moderation_cases', 'rpg_profiles', 'tickets',
        'giveaways', 'leveling_profiles', 'guild_analytics', 'custom_commands',
      ];

      for (const table of orphanTables) {
        await client.query(`DELETE FROM ${table} WHERE guild_id = $1`, [guildId]);
      }

      await client.query('DELETE FROM audit_logs WHERE guild_id = $1', [guildId]);
      await client.query('DELETE FROM guilds WHERE guild_id = $1', [guildId]);

      await client.query('COMMIT');
      logger.info(`Guild ${guildId} data cleaned up successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to clean up guild ${guildId}:`, error);
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

  // FIX CRITIQUE: retourne true par défaut si la guilde n'est pas encore initialisée.
  // L'ancienne version retournait false → tous les events de module étaient silencieusement
  // ignorés pour les guildes non initialisées (leveling XP, giveaway checker, etc.).
  // Comportement correct : si aucune config n'existe, considérer le module comme activé.
  async isModuleEnabled(guildId: string, moduleName: string): Promise<boolean> {
    const result = await this.query(
      'SELECT enabled FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
      [guildId, moduleName]
    );
    // Si la ligne n'existe pas → module activé par défaut (true)
    if (result.length === 0) return true;
    return result[0].enabled === true;
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

  async updateModuleConfig(guildId: string, moduleName: string, moduleConfig: any): Promise<void> {
    await this.query(
      `INSERT INTO guild_modules (guild_id, module_name, config, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (guild_id, module_name)
       DO UPDATE SET config = $3, updated_at = CURRENT_TIMESTAMP`,
      [guildId, moduleName, JSON.stringify(moduleConfig)]
    );
    logger.debug(`Module config updated for ${moduleName} in guild ${guildId}`);
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
      `INSERT INTO global_profiles (user_id, username, global_xp, global_level)
       VALUES ($1, 'Unknown', GREATEST(0, $2), GREATEST(1, FLOOR(POWER(GREATEST(0, $2) / 100.0, 0.5))::INTEGER + 1))
       ON CONFLICT (user_id)
       DO UPDATE SET 
         global_xp = GREATEST(0, global_profiles.global_xp + $2),
         global_level = GREATEST(1, FLOOR(POWER(GREATEST(0, global_profiles.global_xp + $2) / 100.0, 0.5))::INTEGER + 1)`,
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

  async getOrCreateEconomyProfile(guildId: string, userId: string): Promise<void> {
    await this.query(
      `INSERT INTO guild_economy (guild_id, user_id, balance)
       VALUES ($1, $2, 0)
       ON CONFLICT (guild_id, user_id) DO NOTHING`,
      [guildId, userId]
    );
  }

  async getBalance(guildId: string, userId: string): Promise<number> {
    await this.getOrCreateEconomyProfile(guildId, userId);
    const result = await this.query(
      `SELECT balance FROM guild_economy WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return Number(result[0]?.balance) || 0;
  }

  async addBalance(guildId: string, userId: string, amount: number): Promise<number> {
    const result = await this.query(
      `INSERT INTO guild_economy (guild_id, user_id, balance)
       VALUES ($1, $2, GREATEST(0, $3))
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET balance = GREATEST(0, guild_economy.balance + $3)
       RETURNING balance`,
      [guildId, userId, amount]
    );
    return Number(result[0].balance);
  }
}
