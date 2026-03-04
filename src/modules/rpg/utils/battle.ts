import { RPGProfile } from './manager';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Monster {
  name: string;
  emoji: string;
  health: number;
  attack: number;
  defense: number;
  goldReward: number;
  xpReward: number;
}

export interface BattleResult {
  victory: boolean;
  log: string[];
  attacker: RPGProfile;
  defender?: RPGProfile;
  rewards?: { gold: number; xp: number };
  leveledUp?: boolean;
  newLevel?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hpBar(current: number, max: number, len = 10): string {
  const filled = Math.round(Math.max(0, Math.min(current / max, 1)) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function rollCrit(critRate: number): boolean {
  return Math.random() * 100 < critRate;
}

function rollMiss(): boolean {
  return Math.random() < 0.08;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calcDamage(atk: number, def: number, equipped?: Record<string, any>): number {
  const wBonus = equipped?.weapon?.attack  ?? 0;
  const aBonus = equipped?.armor?.defense  ?? 0;
  const eff    = Math.max(1, (atk + wBonus) - Math.floor((def + aBonus) * 0.5));
  return Math.max(1, Math.floor(eff * (rand(80, 120) / 100)));
}

// Inline XP formula to avoid circular import
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// ─── Monster catalog (base stats, scaled by player level) ───────────────────
const BASE_MONSTERS: Record<string, { name: string; emoji: string; health: number; attack: number; defense: number; goldReward: number; xpReward: number }> = {
  skeleton: { name: 'Squelette',  emoji: '💀', health:  50, attack:  8, defense:  3, goldReward:   30, xpReward:   50 },
  zombie:   { name: 'Zombie',     emoji: '🧟', health: 100, attack: 15, defense:  5, goldReward:   75, xpReward:  100 },
  dragon:   { name: 'Dragon',     emoji: '🐉', health: 200, attack: 30, defense: 15, goldReward:  200, xpReward:  300 },
  boss:     { name: 'Boss Final', emoji: '👺', health: 500, attack: 50, defense: 25, goldReward: 1000, xpReward: 1000 },
};

// ─── BattleEngine ─────────────────────────────────────────────────────────────
export class BattleEngine {
  // Returns monster with stats scaled by player level (+12% per level)
  static getMonster(type: string, playerLevel = 1): Monster {
    const base  = BASE_MONSTERS[type] ?? BASE_MONSTERS.skeleton;
    const scale = 1 + (playerLevel - 1) * 0.12;
    return {
      ...base,
      health:  Math.floor(base.health  * scale),
      attack:  Math.floor(base.attack  * scale),
      defense: Math.floor(base.defense * scale),
    };
  }

  // ─── PvP ──────────────────────────────────────────────────────────────────
  static async pvpBattle(attacker: RPGProfile, defender: RPGProfile): Promise<BattleResult> {
    const log: string[] = [];
    let aHP = attacker.health;
    let dHP = defender.health;
    const aMax = attacker.maxHealth;
    const dMax = defender.maxHealth;

    log.push('⚔️ **COMBAT PvP**\n');

    for (let round = 1; round <= 12 && aHP > 0 && dHP > 0; round++) {
      log.push(`**— Round ${round} —**`);
      log.push(`\`${hpBar(aHP, aMax)}\` ❤️ ${Math.max(0, aHP)}/${aMax} (toi)`);
      log.push(`\`${hpBar(dHP, dMax)}\` ❤️ ${Math.max(0, dHP)}/${dMax} (adversaire)\n`);

      // Attacker turn
      if (rollMiss()) {
        log.push(`💨 Tu rates ton attaque !`);
      } else {
        const crit = rollCrit(attacker.critRate ?? 10);
        let dmg = calcDamage(attacker.attack, defender.defense, attacker.equipped);
        if (crit) dmg = Math.floor(dmg * 1.8);
        dHP -= dmg;
        log.push(crit
          ? `⚡ **CRITIQUE !** Tu infliges **${dmg}** dégâts !`
          : `⚔️ Tu infliges **${dmg}** dégâts.`);
      }

      if (dHP <= 0) break;

      // Defender turn
      if (rollMiss()) {
        log.push(`💨 L'adversaire rate son attaque !`);
      } else {
        const crit = rollCrit(defender.critRate ?? 10);
        let dmg = calcDamage(defender.attack, attacker.defense, defender.equipped);
        if (crit) dmg = Math.floor(dmg * 1.8);
        aHP -= dmg;
        log.push(crit
          ? `⚡ **CRITIQUE !** L'adversaire inflige **${dmg}** dégâts !`
          : `🗡️ L'adversaire inflige **${dmg}** dégâts.`);
      }
    }

    const victory = aHP > dHP;
    attacker.health = Math.max(0, aHP);
    defender.health = Math.max(0, dHP);

    if (victory) {
      attacker.wins++;
      defender.losses++;
      log.push('\n🏆 **VICTOIRE !**');
    } else {
      attacker.losses++;
      defender.wins++;
      log.push('\n💀 **DÉFAITE...**');
    }

    return { victory, log, attacker, defender };
  }

  // ─── PvE ──────────────────────────────────────────────────────────────────
  static async pveBattle(attacker: RPGProfile, monster: Monster): Promise<BattleResult> {
    const log: string[] = [];
    let aHP = attacker.health;
    let mHP = monster.health;
    const aMax = attacker.maxHealth;

    log.push(`⚔️ **COMBAT PvE — ${monster.emoji} ${monster.name}**\n`);

    for (let round = 1; round <= 15 && aHP > 0 && mHP > 0; round++) {
      log.push(`**— Round ${round} —**`);
      log.push(`\`${hpBar(aHP, aMax)}\` ❤️ ${Math.max(0, aHP)}/${aMax} (toi)`);
      log.push(`\`${hpBar(mHP, monster.health)}\` 💀 ${Math.max(0, mHP)}/${monster.health} (${monster.name})\n`);

      // Player turn
      if (rollMiss()) {
        log.push(`💨 Tu rates ton attaque !`);
      } else {
        const crit = rollCrit(attacker.critRate ?? 10);
        let dmg = calcDamage(attacker.attack, monster.defense, attacker.equipped);
        if (crit) dmg = Math.floor(dmg * 1.8);
        mHP -= dmg;
        log.push(crit
          ? `⚡ **CRITIQUE !** Tu infliges **${dmg}** dégâts à ${monster.name} !`
          : `⚔️ Tu infliges **${dmg}** dégâts à ${monster.name}.`);
      }

      if (mHP <= 0) break;

      // Monster turn
      if (rollMiss()) {
        log.push(`💨 ${monster.name} rate son attaque !`);
      } else {
        const dmg = Math.max(1, Math.floor(monster.attack - attacker.defense * 0.4 + rand(-3, 3)));
        aHP -= dmg;
        log.push(`${monster.emoji} ${monster.name} inflige **${dmg}** dégâts.`);
      }
    }

    const victory = mHP <= 0;
    attacker.health = Math.max(0, aHP);

    let rewards: { gold: number; xp: number } | undefined;
    let leveledUp = false;
    let newLevel = attacker.level;

    if (victory) {
      attacker.wins++;
      attacker.gold += monster.goldReward;
      attacker.xp   += monster.xpReward;
      rewards = { gold: monster.goldReward, xp: monster.xpReward };

      // Level-up loop (multiple levels possible)
      while (attacker.xp >= xpForLevel(attacker.level + 1)) {
        attacker.level++;
        attacker.maxHealth += 5;
        attacker.attack    += 2;
        attacker.defense   += 1;
        attacker.health     = attacker.maxHealth; // full heal
        leveledUp = true;
      }
      newLevel = attacker.level;

      log.push(`\n🏆 **VICTOIRE ! +${monster.goldReward} 🪙  +${monster.xpReward} XP**`);
      if (leveledUp) log.push(`🆙 **NIVEAU ${newLevel} atteint !** Santé restaurée.`);
    } else {
      attacker.losses++;
      log.push('\n💀 **DÉFAITE...** Utilise `/rpgdaily` pour te soigner.');
    }

    return { victory, log, attacker, rewards, leveledUp, newLevel };
  }
}
