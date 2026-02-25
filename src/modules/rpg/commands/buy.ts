import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { logger } from '../../../utils/logger.js';
import { ValidationUtils } from '../../../utils/validation';

export class BuyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgbuy')
    .setDescription('Acheter un équipement dans la boutique RPG')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('L\'\u00e9quipement à acheter')
        .setRequired(true)
        .addChoices(
          { name: '⚔️ Épée en fer - 100 or (+10 ATK)', value: 'sword' },
          { name: '⚔️ Épée en acier - 250 or (+25 ATK)', value: 'sword2' },
          { name: '🛡️ Armure de cuir - 150 or (+10 DEF)', value: 'armor' },
          { name: '🛡️ Armure de fer - 300 or (+20 DEF)', value: 'armor2' },
          { name: '🧪 Potion de soin - 50 or (+50 HP)', value: 'potion' },
          { name: '💍 Anneau de force - 500 or (+15 ATK, +5 DEF)', value: 'ring' }
        )
    ) as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 3;

  private items: Record<string, { name: string; price: number; attack?: number; defense?: number; heal?: number; type: string }> = {
    sword: { name: '⚔️ Épée en fer', price: 100, attack: 10, type: 'weapon' },
    sword2: { name: '⚔️ Épée en acier', price: 250, attack: 25, type: 'weapon' },
    armor: { name: '🛡️ Armure de cuir', price: 150, defense: 10, type: 'armor' },
    armor2: { name: '🛡️ Armure de fer', price: 300, defense: 20, type: 'armor' },
    potion: { name: '🧪 Potion de soin', price: 50, heal: 50, type: 'consumable' },
    ring: { name: '💍 Anneau de force', price: 500, attack: 15, defense: 5, type: 'accessory' },
  };

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const itemId = interaction.options.getString('item', true);
    const item = this.items[itemId];

    if (!item) {
      await interaction.reply({
        content: '❌ Équipement introuvable. Utilisez `/rpgshop` pour voir les équipements disponibles.'
      });
      return;
    }

    // Valider le prix de l'item
    try {
      ValidationUtils.requireValidAmount(item.price, 'prix de l\'item');
    } catch (error) {
      logger.error('Invalid item price:', { itemId, price: item.price });
      await interaction.reply({
        content: '❌ Erreur: prix de l\'item invalide. Contactez un administrateur.'
      });
      return;
    }

    const client = await context.database.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get user RPG profile avec lock FOR UPDATE pour éviter race conditions
      const result = await client.query(
        'SELECT gold, inventory FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2 FOR UPDATE',
        [interaction.guildId!, interaction.user.id]
      );

      if (!result.rows.length) {
        await client.query('ROLLBACK');
        await interaction.reply({
          content: '❌ Vous n\'avez pas encore de profil RPG ! Utilisez `/rpgstart` pour commencer.'
        });
        return;
      }

      const gold = Number(result.rows[0].gold);
      const inventory = result.rows[0].inventory || [];

      // Vérifier le solde
      if (!ValidationUtils.hasSufficientBalance(item.price, gold)) {
        await client.query('ROLLBACK');
        await interaction.reply({
          content: `❌ Vous n'avez pas assez d'or ! Il vous manque **${item.price - gold}** or.\nVotre or: **${gold}** or`
        });
        return;
      }

      // Add item to inventory
      inventory.push({
        id: itemId,
        name: item.name,
        type: item.type,
        attack: item.attack || 0,
        defense: item.defense || 0,
        heal: item.heal || 0,
        purchasedAt: new Date().toISOString(),
      });

      // Deduct gold and update inventory atomiquement
      const updateResult = await client.query(
        `UPDATE rpg_profiles 
         SET gold = gold - $3, inventory = $4::jsonb
         WHERE guild_id = $1 AND user_id = $2 AND gold >= $3
         RETURNING gold`,
        [interaction.guildId!, interaction.user.id, item.price, JSON.stringify(inventory)]
      );

      if (updateResult.rowCount === 0) {
        // Race condition: solde insuffisant entre le check et l'update
        await client.query('ROLLBACK');
        await interaction.reply({
          content: '❌ Solde insuffisant. Quelqu\'un d\'autre a modifié votre profil pendant l\'achat.'
        });
        return;
      }

      const newGold = Number(updateResult.rows[0].gold);

      // Log action
      await client.query(
        `INSERT INTO action_logs (user_id, action_type, metadata, guild_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          interaction.user.id,
          'RPG_ITEM_PURCHASE',
          JSON.stringify({ itemId, itemName: item.name, price: item.price }),
          interaction.guildId!
        ]
      );

      await client.query('COMMIT');

      let statsText = '';
      if (item.attack) statsText += `+${item.attack} ATK `;
      if (item.defense) statsText += `+${item.defense} DEF `;
      if (item.heal) statsText += `+${item.heal} HP `;

      await interaction.reply(
        `✅ Vous avez acheté **${item.name}** pour **${item.price}** or !\n${statsText}\nOr restant: **${newGold}** or`
      );

      logger.info(`RPG item purchased: ${item.name} by ${interaction.user.username} in guild ${interaction.guildId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in rpgbuy command:', error);
      await interaction.reply({
        content: '❌ Erreur lors de l\'achat. Veuillez réessayer.'
      });
    } finally {
      client.release();
    }
  }
}
