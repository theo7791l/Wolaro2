import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class QuestCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Voir vos quêtes actives') as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 5;

  private quests = [
    {
      id: 'kill_skeletons',
      name: '💀 Chasseur de squelettes',
      description: 'Vaincre 5 squelettes',
      progress: 0,
      goal: 5,
      rewards: { gold: 200, xp: 300 },
    },
    {
      id: 'collect_gold',
      name: '💰 Amasseur d\'or',
      description: 'Posséder 1000 or',
      progress: 0,
      goal: 1000,
      rewards: { gold: 500, xp: 500 },
    },
    {
      id: 'win_battles',
      name: '⚔️ Gladiateur',
      description: 'Gagner 10 combats PvP',
      progress: 0,
      goal: 10,
      rewards: { gold: 1000, xp: 1000 },
    },
  ];

    async execute(interaction: ChatInputCommandInteraction, _context: ICommandContext): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setColor('#4A90E2')
        .setTitle('📜 Quêtes Actives')
        .setDescription('Complétez des quêtes pour obtenir des récompenses !')
        .setTimestamp();

      for (const quest of this.quests) {
        const progressBar = this.createProgressBar(quest.progress, quest.goal);
        embed.addFields({
          name: quest.name,
          value: `${quest.description}\n${progressBar} ${quest.progress}/${quest.goal}\nRécompenses: ${quest.rewards.gold} or, ${quest.rewards.xp} XP`,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de charger les quêtes.',
        ephemeral: true,
      });
    }
  }

  private createProgressBar(current: number, max: number): string {
    const percentage = Math.min((current / max) * 100, 100);
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }
}
