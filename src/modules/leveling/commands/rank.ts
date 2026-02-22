import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { EmbedStyles } from '../../../utils/embeds';

export class RankCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Voir votre niveau ou celui d\'un autre utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont voir le niveau')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'leveling';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

    if (targetUser.bot) {
      const embed = EmbedStyles.error(
        'Erreur',
        'Les bots n\'ont pas de niveaux.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    try {
      // Get leveling profile
      const profile = await context.database.query(
        'SELECT * FROM leveling_profiles WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, targetUser.id]
      );

      if (profile.length === 0) {
        const embed = EmbedStyles.warning(
          'Aucun niveau',
          `${targetUser.username} n'a pas encore gagné d'expérience sur ce serveur.`
        );
        await interaction.reply({ embeds: [embed] });
        return;
      }

      const { level, xp, messages_sent } = profile[0];

      // Calculate XP needed for next level
      const xpNeeded = level * 100;
      const progress = Math.floor((xp / xpNeeded) * 100);

      // Get user rank
      const rankQuery = await context.database.query(
        `SELECT COUNT(*) + 1 as rank FROM leveling_profiles 
         WHERE guild_id = $1 AND (level > $2 OR (level = $2 AND xp > $3))`,
        [interaction.guildId!, level, xp]
      );
      const rank = rankQuery[0]?.rank || 0;

      // Create progress bar
      const progressBar = this.createProgressBar(progress, 20);

      // Create professional embed
      const embed = EmbedStyles.info(
        `Niveau - ${targetUser.username}`,
        'Progression et statistiques'
      )
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'Niveau', value: level.toString(), inline: true },
          { name: 'Rang', value: `#${rank}`, inline: true },
          { name: 'Messages', value: messages_sent.toLocaleString(), inline: true },
          {
            name: 'Expérience',
            value: `${xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP\n${progressBar} ${progress}%`,
            inline: false,
          }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      const embed = EmbedStyles.error(
        'Erreur',
        'Une erreur est survenue lors de la récupération du niveau.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private createProgressBar(percentage: number, length: number): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
