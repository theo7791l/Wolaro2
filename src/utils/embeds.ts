import { EmbedBuilder, ColorResolvable } from 'discord.js';

/**
 * Wolaro Embed Style Guide
 * Professional, clean embeds without excessive emojis
 */

export class EmbedStyles {
  // Color palette
  static readonly COLORS = {
    PRIMARY: '#3498DB' as ColorResolvable,    // Blue - general info
    SUCCESS: '#2ECC71' as ColorResolvable,    // Green - success
    WARNING: '#F39C12' as ColorResolvable,    // Orange - warnings
    DANGER: '#E74C3C' as ColorResolvable,     // Red - errors/bans
    INFO: '#9B59B6' as ColorResolvable,       // Purple - info
    NEUTRAL: '#95A5A6' as ColorResolvable,    // Gray - neutral
    ECONOMY: '#F1C40F' as ColorResolvable,    // Gold - economy
    MODERATION: '#E67E22' as ColorResolvable, // Dark orange - mod
    RPG: '#1ABC9C' as ColorResolvable,        // Teal - RPG
    AI: '#8E44AD' as ColorResolvable,         // Dark purple - AI
  };

  // Standard success embed
  static success(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLORS.SUCCESS)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  // Standard error embed
  static error(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLORS.DANGER)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  // Standard info embed
  static info(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLORS.INFO)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  // Warning embed
  static warning(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLORS.WARNING)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  // Moderation case embed
  static moderationCase(
    caseNumber: number,
    action: string,
    user: string,
    moderator: string,
    reason: string
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLORS.MODERATION)
      .setTitle(`Moderation Case #${caseNumber}`)
      .addFields(
        { name: 'Action', value: action, inline: true },
        { name: 'User', value: user, inline: true },
        { name: 'Moderator', value: moderator, inline: true },
        { name: 'Reason', value: reason || 'No reason provided', inline: false }
      )
      .setTimestamp();
  }

  // Economy transaction embed
  static economyTransaction(
    type: string,
    amount: number,
    balance: number,
    details?: string
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.ECONOMY)
      .setTitle('Transaction')
      .addFields(
        { name: 'Type', value: type, inline: true },
        { name: 'Amount', value: `${amount.toLocaleString()} coins`, inline: true },
        { name: 'New Balance', value: `${balance.toLocaleString()} coins`, inline: true }
      )
      .setTimestamp();

    if (details) {
      embed.addFields({ name: 'Details', value: details, inline: false });
    }

    return embed;
  }

  // RPG profile embed
  static rpgProfile(
    username: string,
    level: number,
    xp: number,
    gold: number,
    health: number,
    maxHealth: number,
    attack: number,
    defense: number,
    rpgClass: string,
    wins: number,
    losses: number
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLORS.RPG)
      .setTitle(`RPG Profile: ${username}`)
      .addFields(
        { name: 'Class', value: rpgClass, inline: true },
        { name: 'Level', value: level.toString(), inline: true },
        { name: 'XP', value: xp.toLocaleString(), inline: true },
        { name: 'Gold', value: gold.toLocaleString(), inline: true },
        { name: 'Health', value: `${health}/${maxHealth}`, inline: true },
        { name: 'Stats', value: `ATK: ${attack} | DEF: ${defense}`, inline: true },
        { name: 'Record', value: `${wins}W - ${losses}L`, inline: true }
      )
      .setTimestamp();
  }

  // RPG battle result embed
  static battleResult(
    winner: string,
    loser: string,
    damage: number,
    rewards?: { gold?: number; xp?: number }
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.RPG)
      .setTitle('Battle Result')
      .addFields(
        { name: 'Winner', value: winner, inline: true },
        { name: 'Defeated', value: loser, inline: true },
        { name: 'Final Damage', value: damage.toString(), inline: true }
      )
      .setTimestamp();

    if (rewards) {
      const rewardText = [];
      if (rewards.gold) rewardText.push(`${rewards.gold} gold`);
      if (rewards.xp) rewardText.push(`${rewards.xp} XP`);
      if (rewardText.length > 0) {
        embed.addFields({ name: 'Rewards', value: rewardText.join(' | '), inline: false });
      }
    }

    return embed;
  }

  // Ticket embed
  static ticket(
    ticketNumber: number,
    user: string,
    subject: string,
    type: string,
    status: string
  ): EmbedBuilder {
    const color = status === 'open' ? this.COLORS.SUCCESS : this.COLORS.NEUTRAL;
    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`Ticket #${ticketNumber}`)
      .addFields(
        { name: 'User', value: user, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Status', value: status.toUpperCase(), inline: true },
        { name: 'Subject', value: subject, inline: false }
      )
      .setTimestamp();
  }

  // Giveaway embed
  static giveaway(
    prize: string,
    winners: number,
    endTime: number,
    host: string,
    participants?: number
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.PRIMARY)
      .setTitle('Giveaway')
      .setDescription(`**Prize:** ${prize}\n\nClick the button below to participate!`)
      .addFields(
        { name: 'Winners', value: winners.toString(), inline: true },
        { name: 'Ends', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
        { name: 'Host', value: host, inline: true }
      )
      .setTimestamp(endTime);

    if (participants !== undefined) {
      embed.setFooter({ text: `${participants} participant(s)` });
    }

    return embed;
  }

  // AI response embed
  static aiResponse(question: string, answer: string, model: string = 'Gemini'): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLORS.AI)
      .setTitle('AI Response')
      .addFields(
        { name: 'Question', value: question, inline: false },
        { name: 'Answer', value: answer.substring(0, 1024), inline: false }
      )
      .setFooter({ text: `Powered by ${model}` })
      .setTimestamp();
  }

  // Leaderboard embed
  static leaderboard(
    title: string,
    entries: { rank: number; name: string; value: string }[],
    color: ColorResolvable = this.COLORS.PRIMARY
  ): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();

    if (entries.length === 0) {
      embed.setDescription('No entries found.');
    } else {
      const description = entries
        .map((entry) => `**${entry.rank}.** ${entry.name} - ${entry.value}`)
        .join('\n');
      embed.setDescription(description);
    }

    return embed;
  }
}
