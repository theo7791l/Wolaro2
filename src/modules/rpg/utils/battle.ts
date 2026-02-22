import { RPGProfile } from './manager';

interface Monster {
  name: string;
  health: number;
  attack: number;
  defense: number;
  goldReward: number;
  xpReward: number;
}

interface BattleResult {
  victory: boolean;
  log: string[];
  attacker: RPGProfile;
  defender?: RPGProfile;
  rewards?: { gold: number; xp: number };
}

export class BattleEngine {
  static getMonster(type: string): Monster {
    const monsters: Record<string, Monster> = {
      skeleton: {
        name: '💀 Squelette',
        health: 50,
        attack: 8,
        defense: 3,
        goldReward: 30,
        xpReward: 50,
      },
      zombie: {
        name: '🧟 Zombie',
        health: 100,
        attack: 15,
        defense: 5,
        goldReward: 75,
        xpReward: 100,
      },
      dragon: {
        name: '🐉 Dragon',
        health: 200,
        attack: 30,
        defense: 15,
        goldReward: 200,
        xpReward: 300,
      },
      boss: {
        name: '👺 Boss Final',
        health: 500,
        attack: 50,
        defense: 25,
        goldReward: 1000,
        xpReward: 1000,
      },
    };

    return monsters[type] || monsters.skeleton;
  }

  static async pvpBattle(attacker: RPGProfile, defender: RPGProfile): Promise<BattleResult> {
    const log: string[] = [];
    let attackerHP = attacker.health;
    let defenderHP = defender.health;

    log.push('⚔️ **Combat PvP commencé !**');

    let round = 1;
    while (attackerHP > 0 && defenderHP > 0 && round <= 10) {
      // Attacker's turn
      const attackDamage = Math.max(1, attacker.attack - defender.defense + this.randomize(5));
      defenderHP -= attackDamage;
      log.push(`Round ${round}: Attaquant inflige ${attackDamage} dégâts`);

      if (defenderHP <= 0) break;

      // Defender's turn
      const defenseDamage = Math.max(1, defender.attack - attacker.defense + this.randomize(5));
      attackerHP -= defenseDamage;
      log.push(`Round ${round}: Défenseur inflige ${defenseDamage} dégâts`);

      round++;
    }

    const victory = attackerHP > defenderHP;

    attacker.health = Math.max(0, attackerHP);
    defender.health = Math.max(0, defenderHP);

    if (victory) {
      attacker.wins++;
      defender.losses++;
      log.push('\n✅ **Victoire !**');
    } else {
      attacker.losses++;
      defender.wins++;
      log.push('\n❌ **Défaite !**');
    }

    return { victory, log, attacker, defender };
  }

  static async pveBattle(attacker: RPGProfile, monster: Monster): Promise<BattleResult> {
    const log: string[] = [];
    let attackerHP = attacker.health;
    let monsterHP = monster.health;

    log.push(`⚔️ **Combat contre ${monster.name} !**`);

    let round = 1;
    while (attackerHP > 0 && monsterHP > 0 && round <= 15) {
      // Player's turn
      const attackDamage = Math.max(1, attacker.attack - monster.defense + this.randomize(5));
      monsterHP -= attackDamage;
      log.push(`Round ${round}: Vous infligez ${attackDamage} dégâts`);

      if (monsterHP <= 0) break;

      // Monster's turn
      const monsterDamage = Math.max(1, monster.attack - attacker.defense + this.randomize(3));
      attackerHP -= monsterDamage;
      log.push(`Round ${round}: ${monster.name} inflige ${monsterDamage} dégâts`);

      round++;
    }

    const victory = monsterHP <= 0;
    attacker.health = Math.max(0, attackerHP);

    let rewards;
    if (victory) {
      attacker.wins++;
      attacker.gold += monster.goldReward;
      attacker.xp += monster.xpReward;
      rewards = { gold: monster.goldReward, xp: monster.xpReward };
      log.push('\n✅ **Victoire !**');
    } else {
      attacker.losses++;
      log.push('\n❌ **Défaite !**');
    }

    return { victory, log, attacker, rewards };
  }

  private static randomize(range: number): number {
    return Math.floor(Math.random() * range) - Math.floor(range / 2);
  }
}
