import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class BuyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgbuy')
    .setDescription('Acheter un équipement dans la boutique RPG')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('L\'équipement à acheter')
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
        content: '❌ Équipement introuvable. Utilisez `/rpgshop` pour voir les équipements disponibles.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Get user RPG profile
      const result = await context.database.query(
        'SELECT gold, inventory FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, interaction.user.id]
      );

      if (!result.length) {
        await interaction.reply({
          content: '❌ Vous n\'avez pas encore de profil RPG ! Utilisez `/rpgstart` pour commencer.',
          ephemeral: true,
        });
        return;
      }

      const gold = result[0].gold;
      const inventory = result[0].inventory || [];

      if (gold < item.price) {
        await interaction.reply({
          content: `❌ Vous n'avez pas assez d'or ! Il vous manque **${item.price - gold}** or.\nVotre or: **${gold}** or`,
          ephemeral: true,
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

      // Deduct gold and update inventory
      await context.database.query(
        `UPDATE rpg_profiles 
         SET gold = gold - $3, inventory = $4::jsonb
         WHERE guild_id = $1 AND user_id = $2`,
        [interaction.guildId!, interaction.user.id, item.price, JSON.stringify(inventory)]
      );

      let statsText = '';
      if (item.attack) statsText += `+${item.attack} ATK `;
      if (item.defense) statsText += `+${item.defense} DEF `;
      if (item.heal) statsText += `+${item.heal} HP `;

      await interaction.reply(
        `✅ Vous avez acheté **${item.name}** pour **${item.price}** or !\n${statsText}\nOr restant: **${gold - item.price}** or`
      );

      // Log action
      await context.database.logAction(
        interaction.user.id,
        'RPG_ITEM_PURCHASE',
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
