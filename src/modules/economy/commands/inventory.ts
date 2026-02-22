import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class InventoryCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Voir votre inventaire ou celui d\'un autre utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont vous voulez voir l\'inventaire')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('utilisateur') || interaction.user;

    try {
      const result = await context.database.query(
        'SELECT inventory FROM guild_economy WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, target.id]
      );

      const inventory = result[0]?.inventory || [];

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`🎒 Inventaire de ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      if (inventory.length === 0) {
        embed.setDescription('Inventaire vide. Visitez `/shop` pour acheter des articles !');
      } else {
        const itemCounts = new Map<string, number>();
        for (const item of inventory) {
          itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + 1);
        }

        let description = '';
        for (const [name, count] of itemCounts.entries()) {
          description += `${name} x${count}\n`;
        }
        embed.setDescription(description);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de récupérer l\'inventaire.',
        ephemeral: true,
      });
    }
  }
}
