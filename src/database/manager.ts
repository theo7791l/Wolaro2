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

  /**
   * FIX: implémentation de cleanupGuild() — appelée sur l'événement guildDelete.
   * Purge toutes les données résiduelles d'un serveur en deux passes :
   *   1. Tables sans FK CASCADE vers guilds (suppression explicite requise)
   *   2. Suppression de la ligne guilds (cascade vers guild_members, guild_modules,
   *      guild_settings, guild_economy via ON DELETE CASCADE défini dans le schéma)
   */
  async cleanupGuild(guildId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      // Tables sans FK CASCADE — suppression explicite dans l'ordre correct
      // (giveaway_participants est supprimé automatiquement via FK CASCADE sur giveaways)
      const orphanTables = [
        'moderation_cases',
        'rpg_profiles',
        'tickets',
        'giveaways',
        'leveling_profiles',
        'guild_analytics',
        'custom_commands',
      ];

      for (const table of orphanTables) {
        await client.query(`DELETE FROM ${table} WHERE guild_id = $1`, [guildId]);
      }

      // audit_logs : guild_id nullable, sans FK — nettoyage explicite
      await client.query('DELETE FROM audit_logs WHERE guild_id = $1', [guildId]);

      // Suppression de la guild (cascade automatique vers guild_members,
      // guild_modules, guild_settings, guild_economy)
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

  /**
   * FIX: updateGlobalXP — trois corrections appliquées :
   *
   *  1. GREATEST(0, global_xp + $2) sur global_xp :
   *     empêche les XP négatifs si xpGain est négatif (sanction, correction, etc.).
   *     Sans ce garde, POWER(xp_négatif / 100.0, 0.5) produit NaN en PostgreSQL,
   *     ce qui corrompt silencieusement la colonne global_level.
   *
   *  2. Division par 100.0 (float) au lieu de 100 (integer) :
   *     évite la troncature entière, ex. POWER(199/100, 0.5) = POWER(1, 0.5) = 1.0
   *     au lieu de POWER(1.99, 0.5) = 1.41 — les deux donnent level=2 dans ce cas,
   *     mais aux bornes exactes (ex. xp=100) le résultat peut diverger.
   *
   *  3. GREATEST(1, ...) sur global_level :
   *     garantit que le niveau ne peut jamais tomber en dessous de 1
   *     même si la formule retourne 0 dans un cas limite.
   */
  async updateGlobalXP(userId: string, xpGain: number): Promise<void> {
    await this.query(
      `UPDATE global_profiles
       SET global_xp = GREATEST(0, global_xp + $2),
           global_level = GREATEST(1, FLOOR(POWER(GREATEST(0, global_xp + $2) / 100.0, 0.5))::INTEGER + 1)
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

  /**
   * Ensures a guild_economy row exists for this user without modifying existing data.
   * FIX: séparé de getBalance() pour éviter qu'une lecture effectue une écriture silencieuse.
   */
  async getOrCreateEconomyProfile(guildId: string, userId: string): Promise<void> {
    await this.query(
      `INSERT INTO guild_economy (guild_id, user_id, balance)
       VALUES ($1, $2, 0)
       ON CONFLICT (guild_id, user_id) DO NOTHING`,
      [guildId, userId]
    );
  }

  /**
   * Returns the balance for a user, creating their profile if it doesn't exist.
   * FIX: refactorisé pour séparer la création du profil (getOrCreateEconomyProfile)
   * de la lecture pure. L'ancienne version faisait un UPDATE SET updated_at à chaque
   * lecture, ce qui était trompeur et générait des écritures inutiles.
   */
  async getBalance(guildId: string, userId: string): Promise<number> {
    await this.getOrCreateEconomyProfile(guildId, userId);
    const result = await this.query(
      `SELECT balance FROM guild_economy WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return result[0]?.balance || 0;
  }

  /**
   * FIX: GREATEST(0, ...) ajouté sur les deux branches (INSERT et UPDATE) pour empêcher
   * qu'un `amount` négatif (retrait, pénalité) ne crée un solde négatif.
   * Cohérent avec le comportement de updateGlobalXP() qui utilise le même garde.
   *
   * Sans ce garde :
   *  - Nouveau profil avec amount < 0 → balance négative dès la création
   *  - Profil existant avec balance + amount < 0 → solde négatif possible
   * Les deux branches clampent désormais à 0.
   */
  async addBalance(guildId: string, userId: string, amount: number): Promise<number> {
    const result = await this.query(
      `INSERT INTO guild_economy (guild_id, user_id, balance)
       VALUES ($1, $2, GREATEST(0, $3))
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET balance = GREATEST(0, guild_economy.balance + $3)
       RETURNING balance`,
      [guildId, userId, amount]
    );
    return result[0].balance;
  }
}
