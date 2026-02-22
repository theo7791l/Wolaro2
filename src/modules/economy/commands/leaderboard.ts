import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class LeaderboardCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir le classement des plus riches du serveur')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type de classement')
        .addChoices(
          { name: 'Argent total', value: 'total' },
          { name: 'Portefeuille', value: 'wallet' },
          { name: 'Banque', value: 'bank' }
        )
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 10;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const type = interaction.options.getString('type') || 'total';

    try {
      let orderBy = 'balance + bank_balance';
      let title = '🏆 Classement des plus riches';

      if (type === 'wallet') {
        orderBy = 'balance';
        title = '💵 Classement par portefeuille';
      } else if (type === 'bank') {
        orderBy = 'bank_balance';
        title = '🏛️ Classement par banque';
      }

      const results = await context.database.query(
        `SELECT user_id, balance, bank_balance, (balance + bank_balance) as total
         FROM guild_economy
         WHERE guild_id = $1
         ORDER BY ${orderBy} DESC
         LIMIT 10`,
        [interaction.guildId!]
      );

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(title)
        .setTimestamp();

      if (results.length === 0) {
        embed.setDescription('Aucun utilisateur dans le classement.');
      } else {
        let description = '';
        for (let i = 0; i < results.length; i++) {
          const user = results[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          
          let amount = user.total;
          if (type === 'wallet') amount = user.balance;
          if (type === 'bank') amount = user.bank_balance;

          try {
            const discordUser = await context.client.users.fetch(user.user_id);
            description += `${medal} **${discordUser.username}** - ${amount.toLocaleString()} coins\n`;
          } catch {
            description += `${medal} User ${user.user_id} - ${amount.toLocaleString()} coins\n`;
          }
        }
        embed.setDescription(description);
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
