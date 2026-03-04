import { DatabaseManager } from '../../../database/manager';

export interface RPGProfile {
  level: number;
  xp: number;
  xpToNextLevel: number;
  gold: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  critRate: number;
  wins: number;
  losses: number;
  winRate: number;
  class?: string;
  inventory?: any[];
  equipped?: Record<string, any>;
}

const CRIT_RATES: Record<string, number> = {
  warrior: 10,
  mage:    20,
  archer:  25,
  paladin: 5,
};

export class RPGManager {
  // ─── Exists check ───────────────────────────────────────────────────────────
  static async profileExists(guildId: string, userId: string, db: DatabaseManager): Promise<boolean> {
    const r = await db.query(
      'SELECT 1 FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
      [guildId, userId]
    );
    return r.length > 0;
  }

  // ─── Get profile (null si pas encore inscrit) ───────────────────────────────
  static async getProfile(guildId: string, userId: string, db: DatabaseManager): Promise<RPGProfile | null> {
    const r = await db.query(
      'SELECT * FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
      [guildId, userId]
    );
    if (r.length === 0) return null;
    return this.mapRow(r[0]);
  }

  // ─── Legacy: get or auto-create (Warrior par défaut) ───────────────────────
  static async getOrCreateProfile(guildId: string, userId: string, db: DatabaseManager): Promise<RPGProfile> {
    const p = await this.getProfile(guildId, userId, db);
    if (p) return p;
    await db.query(
      `INSERT INTO rpg_profiles
       (guild_id, user_id, level, xp, gold, health, max_health, attack, defense, class, wins, losses, inventory, equipped)
       VALUES ($1, $2, 1, 0, 100, 150, 150, 15, 10, 'warrior', 0, 0, '[]', '{}')`,
      [guildId, userId]
    );
    return {
      level: 1, xp: 0, xpToNextLevel: this.calculateXPForLevel(2),
      gold: 100, health: 150, maxHealth: 150, attack: 15, defense: 10,
      critRate: 10, wins: 0, losses: 0, winRate: 0,
      class: 'warrior', inventory: [], equipped: {},
    };
  }

  // ─── Update (avec loop de level-up + sauvegarde max_health) ────────────────────
  static async updateProfile(guildId: string, userId: string, profile: RPGProfile, db: DatabaseManager): Promise<void> {
    while (profile.xp >= this.calculateXPForLevel(profile.level + 1)) {
      profile.level++;
      profile.maxHealth += 5;
      profile.attack    += 2;
      profile.defense   += 1;
      profile.health     = profile.maxHealth;
    }

    await db.query(
      `UPDATE rpg_profiles
       SET level=$3, xp=$4, gold=$5, health=$6, max_health=$7, attack=$8, defense=$9, wins=$10, losses=$11
       WHERE guild_id=$1 AND user_id=$2`,
      [
        guildId, userId,
        profile.level, profile.xp, profile.gold,
        profile.health, profile.maxHealth,
        profile.attack, profile.defense,
        profile.wins, profile.losses,
      ]
    );
  }

  static calculateXPForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  // ─── mapRow : TOUS les champs en Number() pour éviter la concaténation de strings ───
  private static mapRow(d: any): RPGProfile {
    const wins   = Number(d.wins   ?? 0);
    const losses = Number(d.losses ?? 0);
    const level  = Number(d.level  ?? 1);
    return {
      level,
      xp:            Number(d.xp   ?? 0),
      xpToNextLevel: this.calculateXPForLevel(level + 1),
      gold:          Number(d.gold  ?? 0),
      health:        Number(d.health     ?? 100),
      maxHealth:     Number(d.max_health ?? 100),
      attack:        Number(d.attack     ?? 10),
      defense:       Number(d.defense    ?? 5),
      critRate:      CRIT_RATES[d.class] ?? 10,
      wins,
      losses,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      class:     d.class     ?? 'warrior',
      inventory: d.inventory ?? [],
      equipped:  d.equipped  ?? {},
    };
  }
}
