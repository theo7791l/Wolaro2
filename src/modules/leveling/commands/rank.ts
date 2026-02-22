import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class RankCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Voir votre niveau et votre XP')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont vous voulez voir le rang')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'leveling';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('utilisateur') || interaction.user;

    try {
      // Get user XP data from global_profiles
      const profileData = await context.database.query(
        'SELECT global_xp, global_level FROM global_profiles WHERE user_id = $1',
        [target.id]
      );

      const xp = profileData[0]?.global_xp || 0;
      const level = profileData[0]?.global_level || 1;

      // Calculate XP needed for next level
      const xpForNextLevel = this.calculateXPForLevel(level + 1);
      const xpForCurrentLevel = this.calculateXPForLevel(level);
      const xpProgress = xp - xpForCurrentLevel;
      const xpNeeded = xpForNextLevel - xpForCurrentLevel;
      const percentage = Math.floor((xpProgress / xpNeeded) * 100);

      // Get rank position
      const rankData = await context.database.query(
        `SELECT COUNT(*) as rank FROM global_profiles WHERE global_xp > $1`,
        [xp]
      );
      const rank = parseInt(rankData[0].rank) + 1;

      // Create progress bar
      const progressBar = this.createProgressBar(percentage);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎯 Rang de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Niveau', value: `🏆 ${level}`, inline: true },
          { name: 'Rang global', value: `#${rank}`, inline: true },
          { name: 'XP Total', value: `✨ ${xp.toLocaleString()}`, inline: true },
          { 
            name: 'Progression vers le niveau suivant', 
            value: `${progressBar}\n${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP (${percentage}%)`,
            inline: false 
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de récupérer les données de rang.',
        ephemeral: true,
      });
    }
  }

  private calculateXPForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 2));
  }

  private createProgressBar(percentage: number): string {
    const totalBars = 20;
    const filledBars = Math.floor((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}]`;
  }
}
