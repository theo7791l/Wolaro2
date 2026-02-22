import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class ShopCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Voir la boutique du serveur') as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 5;

  private defaultItems = [
    { id: 'coffee', name: '☕ Café', price: 50, description: 'Un bon café pour bien commencer la journée' },
    { id: 'pizza', name: '🍕 Pizza', price: 150, description: 'Une délicieuse pizza' },
    { id: 'gift', name: '🎁 Cadeau', price: 500, description: 'Un cadeau surprise' },
    { id: 'boost', name: '🚀 Boost XP', price: 1000, description: 'Double XP pendant 1 heure' },
    { id: 'premium', name: '⭐ Statut Premium', price: 5000, description: 'Statut premium pendant 7 jours' },
  ];

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🏪 Boutique du serveur')
        .setDescription('Utilisez `/buy <item>` pour acheter un article')
        .setFooter({ text: 'Les prix peuvent varier selon la configuration du serveur' });

      for (const item of this.defaultItems) {
        embed.addFields({
          name: `${item.name} - ${item.price} coins`,
          value: item.description,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible d\'afficher la boutique.',
        ephemeral: true,
      });
    }
  }
}
