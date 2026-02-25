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
      // S'assurer que la guilde est initialisée et le profil existe
      await context.database.getOrCreateEconomyProfile(interaction.guildId!, targetUser.id);

      const profile = await context.database.query(
        'SELECT * FROM guild_economy WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, targetUser.id]
      );

      const { balance, bank_balance, daily_streak } = profile[0] || { balance: 0, bank_balance: 0, daily_streak: 0 };
      const totalWealth = (Number(balance) || 0) + (Number(bank_balance) || 0);

      const embed = EmbedStyles.info(
        `Économie - ${targetUser.username}`,
        'Voici les informations économiques'
      )
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(EmbedStyles.COLORS.ECONOMY)
        .addFields(
          { name: '💵 Portefeuille', value: `${Number(balance || 0).toLocaleString()} coins`, inline: true },
          { name: '🏦 Banque', value: `${Number(bank_balance || 0).toLocaleString()} coins`, inline: true },
          { name: '💰 Total', value: `${totalWealth.toLocaleString()} coins`, inline: true }
        );

      if (Number(daily_streak) > 0) {
        embed.addFields({
          name: '🔥 Série quotidienne',
          value: `${daily_streak} jour(s)`,
          inline: true,
        });
      }

      // FIX: Retrait de ephemeral - les soldes sont publics et partageables
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      const embed = EmbedStyles.error(
        'Erreur',
        'Une erreur est survenue lors de la récupération du solde.'
      );
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
    }
  }
}
