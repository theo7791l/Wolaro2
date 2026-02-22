import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class LeaderboardCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('levels')
    .setDescription('Voir le classement des niveaux') as SlashCommandBuilder;

  module = 'leveling';
  guildOnly = true;
  cooldown = 10;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    try {
      const results = await context.database.query(
        `SELECT user_id, username, global_xp, global_level
         FROM global_profiles
         ORDER BY global_xp DESC
         LIMIT 10`
      );

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Classement des niveaux')
        .setDescription('Top 10 des utilisateurs avec le plus d\'XP')
        .setTimestamp();

      if (results.length === 0) {
        embed.setDescription('Aucun utilisateur dans le classement.');
      } else {
        let description = '';
        for (let i = 0; i < results.length; i++) {
          const user = results[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          description += `${medal} **${user.username}** - Niveau ${user.global_level} (${user.global_xp.toLocaleString()} XP)\n`;
        }
        embed.setDescription(description);
      }

      // Add user's position if not in top 10
      const userRank = await context.database.query(
        `SELECT COUNT(*) as rank FROM global_profiles WHERE global_xp > (
          SELECT global_xp FROM global_profiles WHERE user_id = $1
        )`,
        [interaction.user.id]
      );

      const userPosition = parseInt(userRank[0]?.rank || '0') + 1;
      if (userPosition > 10) {
        const userData = await context.database.query(
          'SELECT global_xp, global_level FROM global_profiles WHERE user_id = $1',
          [interaction.user.id]
        );
        if (userData[0]) {
          embed.setFooter({
            text: `Votre position: #${userPosition} - Niveau ${userData[0].global_level} (${userData[0].global_xp.toLocaleString()} XP)`,
          });
        }
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible d\'afficher le classement.',
        ephemeral: true,
      });
    }
  }
}
