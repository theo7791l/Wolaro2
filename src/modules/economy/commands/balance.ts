import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class BalanceCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Voir votre solde ou celui d\'un autre utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont vous voulez voir le solde')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('utilisateur') || interaction.user;

    try {
      const balance = await context.database.getBalance(interaction.guildId!, target.id);
      
      const bankData = await context.database.query(
        'SELECT bank_balance, daily_streak FROM guild_economy WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, target.id]
      );

      const bankBalance = bankData[0]?.bank_balance || 0;
      const dailyStreak = bankData[0]?.daily_streak || 0;

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`💰 Solde de ${target.username}`)
        .addFields(
          { name: 'Portefeuille', value: `💵 ${balance.toLocaleString()} coins`, inline: true },
          { name: 'Banque', value: `🏛️ ${bankBalance.toLocaleString()} coins`, inline: true },
          { name: 'Total', value: `💰 ${(balance + bankBalance).toLocaleString()} coins`, inline: true },
          { name: 'Série quotidienne', value: `🔥 ${dailyStreak} jour(s)`, inline: false }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de récupérer le solde.',
        ephemeral: true,
      });
    }
  }
}
