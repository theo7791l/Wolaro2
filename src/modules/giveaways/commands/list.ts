import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class ListCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('glist')
    .setDescription('Voir les giveaways actifs') as SlashCommandBuilder;

  module = 'giveaways';
  guildOnly = true;
  cooldown = 10;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    try {
      const giveaways = await context.database.query(
        'SELECT * FROM giveaways WHERE guild_id = $1 AND status = $2 ORDER BY end_time ASC',
        [interaction.guildId!, 'active']
      );

      if (giveaways.length === 0) {
        await interaction.reply({
          content: '❌ Aucun giveaway actif sur ce serveur.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🎉 Giveaways Actifs')
        .setTimestamp();

      for (const giveaway of giveaways.slice(0, 10)) {
        const endTimestamp = Math.floor(new Date(giveaway.end_time).getTime() / 1000);
        embed.addFields({
          name: giveaway.prize,
          value: (
            `**Gagnants:** ${giveaway.winners_count}\n` +
            `**Se termine:** <t:${endTimestamp}:R>\n` +
            `**Salon:** <#${giveaway.channel_id}>\n` +
            `**Message ID:** ${giveaway.message_id}`
          ),
          inline: false,
        });
      }

      if (giveaways.length > 10) {
        embed.setFooter({ text: `Et ${giveaways.length - 10} autre(s) giveaway(s)...` });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Erreur lors de la récupération des giveaways.',
        ephemeral: true,
      });
    }
  }
}
