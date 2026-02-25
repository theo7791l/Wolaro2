import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class DailyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Réclamer votre récompense quotidienne') as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    try {
      // Get module config
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const economyModule = config?.modules?.find((m: any) => m.module_name === 'economy');
      const dailyAmount = economyModule?.config?.dailyAmount || 100;

      // Check last daily
      const result = await context.database.query(
        'SELECT last_daily, daily_streak FROM guild_economy WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, interaction.user.id]
      );

      const now = new Date();
      const lastDaily = result[0]?.last_daily ? new Date(result[0].last_daily) : null;

      if (lastDaily) {
        const hoursSinceDaily = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceDaily < 24) {
          const hoursRemaining = Math.ceil(24 - hoursSinceDaily);
          await interaction.reply({
            content: `⏰ Vous avez déjà réclamé votre récompense quotidienne. Revenez dans ${hoursRemaining}h.`
          });
          return;
        }
      }

      // Calculate streak
      let newStreak = 1;
      if (lastDaily) {
        const hoursSinceDaily = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
        if (hoursSinceDaily < 48) {
          newStreak = (result[0]?.daily_streak || 0) + 1;
        }
      }

      // Calculate bonus from streak
      const streakBonus = Math.min(newStreak * 10, 500);
      const totalAmount = dailyAmount + streakBonus;

      // Add to balance
      await context.database.addBalance(interaction.guildId!, interaction.user.id, totalAmount);

      // Update streak
      await context.database.query(
        `INSERT INTO guild_economy (guild_id, user_id, last_daily, daily_streak)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id, user_id)
         DO UPDATE SET last_daily = $3, daily_streak = $4`,
        [interaction.guildId!, interaction.user.id, now, newStreak]
      );

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎁 Récompense quotidienne')
        .setDescription(`Vous avez reçu votre récompense quotidienne !`)
        .addFields(
          { name: 'Montant de base', value: `💰 ${dailyAmount} coins`, inline: true },
          { name: 'Bonus de série', value: `🔥 ${streakBonus} coins`, inline: true },
          { name: 'Total', value: `✨ ${totalAmount} coins`, inline: true },
          { name: 'Série actuelle', value: `${newStreak} jour(s)`, inline: false }
        )
        .setFooter({ text: 'Revenez demain pour maintenir votre série !' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de réclamer la récompense quotidienne.'
      });
    }
  }
}
