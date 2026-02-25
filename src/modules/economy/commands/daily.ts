import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { ValidationUtils } from '../../../utils/validation';

export class DailyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Réclamer votre récompense quotidienne') as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const client = await context.database.getClient();
    
    try {
      await client.query('BEGIN');

      // Get module config
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const economyModule = config?.modules?.find((m: any) => m.module_name === 'economy');
      const dailyAmount = economyModule?.config?.dailyAmount || 100;

      // Valider le montant de la config
      ValidationUtils.requireValidAmount(dailyAmount, 'montant quotidien');

      // Check last daily avec lock FOR UPDATE pour éviter race conditions
      const result = await client.query(
        'SELECT last_daily, daily_streak, balance FROM guild_economy WHERE guild_id = $1 AND user_id = $2 FOR UPDATE',
        [interaction.guildId!, interaction.user.id]
      );

      const now = new Date();
      const lastDaily = result.rows[0]?.last_daily ? new Date(result.rows[0].last_daily) : null;

      if (lastDaily) {
        const hoursSinceDaily = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceDaily < 24) {
          await client.query('ROLLBACK');
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
          newStreak = (result.rows[0]?.daily_streak || 0) + 1;
        }
      }

      // Calculate bonus from streak
      const streakBonus = Math.min(newStreak * 10, 500);
      const totalAmount = dailyAmount + streakBonus;

      // Valider le montant total
      ValidationUtils.requireValidAmount(totalAmount, 'montant total');

      // Update balance et streak en une seule opération atomique
      await client.query(
        `INSERT INTO guild_economy (guild_id, user_id, balance, last_daily, daily_streak)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id, user_id)
         DO UPDATE SET 
           balance = guild_economy.balance + $3,
           last_daily = $4, 
           daily_streak = $5`,
        [interaction.guildId!, interaction.user.id, totalAmount, now, newStreak]
      );

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      console.error('Error in daily command:', error);
      
      const errorMsg = error instanceof Error && error.message.includes('montant') 
        ? `❌ ${error.message}`
        : '❌ Impossible de réclamer la récompense quotidienne.';
      
      await interaction.reply({ content: errorMsg });
    } finally {
      client.release();
    }
  }
}
