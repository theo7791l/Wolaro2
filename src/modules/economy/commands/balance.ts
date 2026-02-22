import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { EmbedStyles } from '../../../utils/embeds';

export class BalanceCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Voir votre solde ou celui d\'un autre utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont voir le solde')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

    try {
      // Get economy profile
      let profile = await context.database.query(
        'SELECT * FROM guild_economy WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, targetUser.id]
      );

      // Create profile if doesn't exist
      if (profile.length === 0) {
        await context.database.query(
          'INSERT INTO guild_economy (guild_id, user_id, balance, bank_balance) VALUES ($1, $2, 0, 0)',
          [interaction.guildId!, targetUser.id]
        );
        profile = [{ balance: 0, bank_balance: 0, daily_streak: 0 }];
      }

      const { balance, bank_balance, daily_streak } = profile[0];
      const totalWealth = balance + bank_balance;

      // Create professional embed
      const embed = EmbedStyles.info(
        `Économie - ${targetUser.username}`,
        'Voici les informations économiques'
      )
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(EmbedStyles.COLORS.ECONOMY)
        .addFields(
          { name: 'Portefeuille', value: `${balance.toLocaleString()} coins`, inline: true },
          { name: 'Banque', value: `${bank_balance.toLocaleString()} coins`, inline: true },
          { name: 'Total', value: `${totalWealth.toLocaleString()} coins`, inline: true }
        );

      if (daily_streak > 0) {
        embed.addFields({
          name: 'Série quotidienne',
          value: `${daily_streak} jour(s)`,
          inline: true,
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      const embed = EmbedStyles.error(
        'Erreur',
        'Une erreur est survenue lors de la récupération du solde.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
