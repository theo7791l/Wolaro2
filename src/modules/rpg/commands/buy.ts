import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { RPGManager } from '../utils/manager';

const ITEMS: Record<string, { name: string; price: number; attack?: number; defense?: number; heal?: number; type: string }> = {
  sword:  { name: '⚔️ Épée en fer',      price: 100, attack: 10,             type: 'weapon'     },
  sword2: { name: '⚔️ Épée en acier',   price: 250, attack: 25,             type: 'weapon'     },
  armor:  { name: '🛡️ Armure de cuir',  price: 150, defense: 10,            type: 'armor'      },
  armor2: { name: '🛡️ Armure de fer',   price: 300, defense: 20,            type: 'armor'      },
  potion: { name: '🧪 Potion de soin',  price: 50,  heal: 50,               type: 'consumable' },
  ring:   { name: '💍 Anneau de force', price: 500, attack: 15, defense: 5, type: 'accessory'  },
};

export class BuyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgbuy')
    .setDescription('🛒 Acheter un équipement dans la boutique RPG')
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('L\'objet à acheter')
        .setRequired(true)
        .addChoices(
          { name: '⚔️ Épée en fer — 100 or (+10 ATK)',             value: 'sword'  },
          { name: '⚔️ Épée en acier — 250 or (+25 ATK)',          value: 'sword2' },
          { name: '🛡️ Armure de cuir — 150 or (+10 DEF)',          value: 'armor'  },
          { name: '🛡️ Armure de fer — 300 or (+20 DEF)',           value: 'armor2' },
          { name: '🧪 Potion de soin — 50 or (+50 PV)',              value: 'potion' },
          { name: '💍 Anneau de force — 500 or (+15 ATK, +5 DEF)',    value: 'ring'   },
        )
    ) as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const itemId = interaction.options.getString('item', true);
    const item   = ITEMS[itemId];

    if (!item) {
      await interaction.reply({ content: '❌ Item introuvable.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    // ── Vérification profil ──────────────────────────────────────────────────
    const profile = await RPGManager.getProfile(interaction.guildId!, interaction.user.id, context.database);

    if (!profile) {
      await interaction.editReply('❌ Tu n\'as pas de profil RPG. Utilise `/rpgstart` pour commencer.');
      return;
    }

    const gold      = profile.gold;
    const inventory = Array.isArray(profile.inventory) ? [...profile.inventory] : [];

    // ── Vérification solde ────────────────────────────────────────────────
    if (gold < item.price) {
      await interaction.editReply(
        `❌ Or insuffisant !\nTu as **${gold}** 🪙, il te faut **${item.price}** 🪙.\nIl te manque **${item.price - gold}** or.`
      );
      return;
    }

    // ── Potion : appliquer immédiatement (soin) ──────────────────────────
    if (item.type === 'consumable' && item.heal) {
      const newHealth = Math.min(profile.health + item.heal, profile.maxHealth);
      await context.database.query(
        `UPDATE rpg_profiles
         SET gold = gold - $3, health = $4
         WHERE guild_id = $1 AND user_id = $2 AND gold >= $3`,
        [interaction.guildId!, interaction.user.id, item.price, newHealth]
      );

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🧪 Potion utilisée !')
        .addFields(
          { name: '❤️ Santé restaurée',  value: `\`${newHealth}/${profile.maxHealth}\` PV`, inline: true },
          { name: '🪙 Or restant',      value: `\`${gold - item.price}\``,               inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ── Équipement : ajouter à l'inventaire ─────────────────────────────
    inventory.push({
      id:          itemId,
      name:        item.name,
      type:        item.type,
      attack:      item.attack  ?? 0,
      defense:     item.defense ?? 0,
      purchasedAt: new Date().toISOString(),
    });

    // Mise à jour atomique : déduire l'or + mettre à jour inventaire
    // La condition AND gold >= $3 évite une race condition
    const rows = await context.database.query(
      `UPDATE rpg_profiles
       SET gold = gold - $3, inventory = $4::jsonb
       WHERE guild_id = $1 AND user_id = $2 AND gold >= $3
       RETURNING gold`,
      [interaction.guildId!, interaction.user.id, item.price, JSON.stringify(inventory)]
    );

    if (!rows || rows.length === 0) {
      await interaction.editReply('❌ Or insuffisant. Quelqu\'un d\'autre a modifié ton profil. Réessaie.');
      return;
    }

    const newGold = Number(rows[0].gold);

    const statsText = [
      item.attack  ? `+${item.attack} ATK`  : null,
      item.defense ? `+${item.defense} DEF` : null,
    ].filter(Boolean).join(' | ') || 'Aucun bonus';

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🛒 Achat réussi !')
      .setDescription(`Tu as acheté **${item.name}** !`)
      .addFields(
        { name: '📦 Item',         value: item.name,           inline: true },
        { name: '🪙 Prix payé',    value: `${item.price} or`,  inline: true },
        { name: '🪙 Or restant',   value: `${newGold}`,        inline: true },
        { name: '📊 Bonus',        value: statsText,           inline: true },
      )
      .addFields({ name: '\u200b', value: '➡️ Utilise `/rpginventory` pour voir tes objets.' })
      .setFooter({ text: `${interaction.user.tag} • RPG`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
