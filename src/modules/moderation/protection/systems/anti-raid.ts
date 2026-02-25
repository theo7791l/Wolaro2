/**
 * Anti-Raid System - Fixed property names
 */

import { GuildMember, Guild } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';
import { CaptchaSystem } from './captcha';

interface RiskAnalysis {
  isRisk: boolean;
  riskScore: number;
  riskFactors: Array<{
    type: string;
    severity: number;
    details: string;
  }>;
}

export class AntiRaidSystem {
  private joinTracker = new Map<string, number[]>();

  constructor(
    private db: ProtectionDatabase,
    private captcha: CaptchaSystem
  ) {}

  async analyzeMemberJoin(member: GuildMember): Promise<RiskAnalysis> {
    const config = await this.db.getConfig(member.guild.id);
    let riskScore = 0;
    const riskFactors: RiskAnalysis['riskFactors'] = [];

    // Account age check
    const accountAge = Date.now() - member.user.createdTimestamp;
    const oneDayMs = 86400000;

    if (accountAge < oneDayMs) {
      riskScore += 3;
      riskFactors.push({
        type: 'new_account',
        severity: 3,
        details: `Account créé il y a ${Math.floor(accountAge / 3600000)}h`,
      });
    }

    // Default avatar
    if (!member.user.avatar) {
      riskScore += 1;
      riskFactors.push({
        type: 'default_avatar',
        severity: 1,
        details: 'Avatar par défaut',
      });
    }

    // Join rate
    const guildId = member.guild.id;
    if (!this.joinTracker.has(guildId)) {
      this.joinTracker.set(guildId, []);
    }

    const joins = this.joinTracker.get(guildId)!;
    joins.push(Date.now());

    const recentJoins = joins.filter(t => Date.now() - t < 60000);
    this.joinTracker.set(guildId, recentJoins);

    if (recentJoins.length >= config.antiraid_join_threshold) {
      riskScore += 4;
      riskFactors.push({
        type: 'rapid_joins',
        severity: 4,
        details: `${recentJoins.length} joins en 1 minute`,
      });
    }

    return {
      isRisk: riskScore >= 3,
      riskScore,
      riskFactors,
    };
  }
}
