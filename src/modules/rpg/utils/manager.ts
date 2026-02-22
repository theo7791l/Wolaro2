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
  wins: number;
  losses: number;
  winRate: number;
  class?: string;
  inventory?: any[];
  equipped?: any;
}

export class RPGManager {
  static async getOrCreateProfile(
    guildId: string,
    userId: string,
    database: DatabaseManager
  ): Promise<RPGProfile> {
    const result = await database.query(
      'SELECT * FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
      [guildId, userId]
    );

    if (result.length > 0) {
      const data = result[0];
      return {
        level: data.level,
        xp: data.xp,
        xpToNextLevel: this.calculateXPForLevel(data.level + 1),
        gold: data.gold,
        health: data.health,
        maxHealth: data.max_health,
        attack: data.attack,
        defense: data.defense,
        wins: data.wins,
        losses: data.losses,
        winRate: data.wins + data.losses > 0 
          ? Math.round((data.wins / (data.wins + data.losses)) * 100) 
          : 0,
        class: data.class,
        inventory: data.inventory,
        equipped: data.equipped,
      };
    }

    // Create new profile
    await database.query(
      `INSERT INTO rpg_profiles (guild_id, user_id, level, xp, gold, health, max_health, attack, defense)
       VALUES ($1, $2, 1, 0, 100, 100, 100, 10, 5)`,
      [guildId, userId]
    );

    return {
      level: 1,
      xp: 0,
      xpToNextLevel: this.calculateXPForLevel(2),
      gold: 100,
      health: 100,
      maxHealth: 100,
      attack: 10,
      defense: 5,
      wins: 0,
      losses: 0,
      winRate: 0,
    };
  }

  static async updateProfile(
    guildId: string,
    userId: string,
    profile: RPGProfile,
    database: DatabaseManager
  ): Promise<void> {
    await database.query(
      `UPDATE rpg_profiles
       SET level = $3, xp = $4, gold = $5, health = $6, attack = $7, defense = $8, wins = $9, losses = $10
       WHERE guild_id = $1 AND user_id = $2`,
      [
        guildId,
        userId,
        profile.level,
        profile.xp,
        profile.gold,
        profile.health,
        profile.attack,
        profile.defense,
        profile.wins,
        profile.losses,
      ]
    );
  }

  static calculateXPForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }
}
