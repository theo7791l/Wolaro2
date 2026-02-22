import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { RPGManager } from '../utils/manager';

export class DailyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgdaily')
    .setDescription('Réclamer votre récompense quotidienne RPG') as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    try {
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const rpgModule = config?.modules?.find((m: any) => m.module_name === 'rpg');

      const goldReward = rpgModule?.config?.dailyRewardGold || 50;
      const xpReward = rpgModule?.config?.dailyRewardXP || 100;

      // Check last daily
      const lastDaily = await context.redis.get(`rpg:daily:${interaction.guildId}:${interaction.user.id}`);

      if (lastDaily) {
        const timeLeft = 86400 - (Date.now() - parseInt(lastDaily)) / 1000;
        const hoursLeft = Math.ceil(timeLeft / 3600);
        await interaction.reply({
          content: `⏰ Vous avez déjà réclamé votre récompense quotidienne. Revenez dans ${hoursLeft}h.`,
          ephemeral: true,
        });
        return;
      }

      // Get profile
      const profile = await RPGManager.getOrCreateProfile(
        interaction.guildId!,
        interaction.user.id,
        context.database
      );

      // Apply rewards and heal
      profile.gold += goldReward;
      profile.xp += xpReward;
      profile.health = profile.maxHealth; // Full heal

      await RPGManager.updateProfile(interaction.guildId!, interaction.user.id, profile, context.database);

      // Set cooldown
      await context.redis.set(
        `rpg:daily:${interaction.guildId}:${interaction.user.id}`,
        Date.now().toString(),
        86400
      );

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎁 Récompense Quotidienne RPG')
        .setDescription('Vous avez réclamé votre récompense quotidienne !')
        .addFields(
          { name: '💰 Or', value: `+${goldReward}`, inline: true },
          { name: '✨ XP', value: `+${xpReward}`, inline: true },
          { name: '❤️ Santé', value: 'Complètement soigné !', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de réclamer la récompense.',
        ephemeral: true,
      });
    }
  }
}
