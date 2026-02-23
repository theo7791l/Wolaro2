import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class BuyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Acheter un article de la boutique')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('L\'article à acheter (coffee, pizza, gift, boost, premium)')
        .setRequired(true)
        .addChoices(
          { name: '☕ Café - 50 coins', value: 'coffee' },
          { name: '🍕 Pizza - 150 coins', value: 'pizza' },
          { name: '🎁 Cadeau - 500 coins', value: 'gift' },
          { name: '🚀 Boost XP - 1000 coins', value: 'boost' },
          { name: '⭐ Statut Premium - 5000 coins', value: 'premium' }
        )
    ) as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 3;

  private items: Record<string, { name: string; price: number; description: string }> = {
    coffee: { name: '☕ Café', price: 50, description: 'Un bon café pour bien commencer la journée' },
    pizza: { name: '🍕 Pizza', price: 150, description: 'Une délicieuse pizza' },
    gift: { name: '🎁 Cadeau', price: 500, description: 'Un cadeau surprise' },
    boost: { name: '🚀 Boost XP', price: 1000, description: 'Double XP pendant 1 heure' },
    premium: { name: '⭐ Statut Premium', price: 5000, description: 'Statut premium pendant 7 jours' },
  };

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const itemId = interaction.options.getString('item', true);
    const item = this.items[itemId];

    if (!item) {
      await interaction.reply({
        content: '❌ Article introuvable. Utilisez `/shop` pour voir les articles disponibles.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Get user balance
      const result = await context.database.query(
        'SELECT balance FROM guild_economy WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, interaction.user.id]
      );

      const balance = result.length ? result[0].balance : 0;

      if (balance < item.price) {
        await interaction.reply({
          content: `❌ Vous n'avez pas assez d'argent ! Il vous manque **${item.price - balance}** coins.\nVotre solde: **${balance}** coins`,
          ephemeral: true,
        });
        return;
      }

      // Deduct coins and add item to inventory
      await context.database.query(
        `INSERT INTO guild_economy (guild_id, user_id, balance, inventory)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (guild_id, user_id)
         DO UPDATE SET 
           balance = guild_economy.balance - $3,
           inventory = guild_economy.inventory || $4::jsonb`,
        [
          interaction.guildId!,
          interaction.user.id,
          item.price,
          JSON.stringify([{ id: itemId, name: item.name, purchasedAt: new Date().toISOString() }]),
        ]
      );

      await interaction.reply(
        `✅ Vous avez acheté **${item.name}** pour **${item.price}** coins !\nNouveau solde: **${balance - item.price}** coins`
      );

      // Log action
      await context.database.logAction(
        interaction.user.id,
        'ITEM_PURCHASE',
        { itemId, itemName: item.name, price: item.price },
        interaction.guildId!
      );
    } catch (error) {
      await interaction.reply({
        content: '❌ Erreur lors de l\'achat. Veuillez réessayer.',
        ephemeral: true,
      });
    }
  }
}
