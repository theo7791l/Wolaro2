import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class WorkCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('work')
    .setDescription('Travailler pour gagner de l\'argent') as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 5;

  private workMessages = [
    'Vous avez travaillé comme développeur et gagné',
    'Vous avez livré des pizzas et gagné',
    'Vous avez streamé sur Twitch et gagné',
    'Vous avez créé du contenu et gagné',
    'Vous avez modéré un serveur Discord et gagné',
    'Vous avez fait du freelance et gagné',
  ];

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    try {
      // Get module config
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const economyModule = config?.modules?.find((m: any) => m.module_name === 'economy');
      
      if (!economyModule?.config?.workEnabled) {
        await interaction.reply({
          content: '❌ La commande /work est désactivée sur ce serveur.',
          ephemeral: true,
        });
        return;
      }

      const cooldown = economyModule?.config?.workCooldown || 3600;
      const minAmount = economyModule?.config?.workMinAmount || 50;
      const maxAmount = economyModule?.config?.workMaxAmount || 200;

      // Check cooldown
      const cooldownKey = `work:${interaction.guildId}:${interaction.user.id}`;
      if (await context.redis.hasCooldown(cooldownKey)) {
        const remaining = await context.redis.getCooldownTTL(cooldownKey);
        const minutes = Math.ceil(remaining / 60);
        await interaction.reply({
          content: `⏰ Vous êtes fatigué ! Reposez-vous pendant encore ${minutes} minute(s).`,
          ephemeral: true,
        });
        return;
      }

      // Calculate earnings
      const earned = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
      const message = this.workMessages[Math.floor(Math.random() * this.workMessages.length)];

      // Add to balance
      await context.database.addBalance(interaction.guildId!, interaction.user.id, earned);

      // Set cooldown
      await context.redis.setCooldown(cooldownKey, cooldown);

      await interaction.reply(`💼 ${message} **${earned} coins** !`);
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de travailler pour le moment.',
        ephemeral: true,
      });
    }
  }
}
