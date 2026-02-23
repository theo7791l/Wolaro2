import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class ShopCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgshop')
    .setDescription('Voir la boutique RPG') as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 5;

  private shop = [
    { id: 'sword', name: '⚔️ Épée en fer', price: 100, attack: 10, type: 'weapon' },
    { id: 'sword2', name: '⚔️ Épée en acier', price: 250, attack: 25, type: 'weapon' },
    { id: 'armor', name: '🛡️ Armure de cuir', price: 150, defense: 10, type: 'armor' },
    { id: 'armor2', name: '🛡️ Armure de fer', price: 300, defense: 20, type: 'armor' },
    { id: 'potion', name: '🧪 Potion de soin', price: 50, heal: 50, type: 'consumable' },
    { id: 'ring', name: '💍 Anneau de force', price: 500, attack: 15, defense: 5, type: 'accessory' },
  ];

    async execute(interaction: ChatInputCommandInteraction, _context: ICommandContext): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏪 Boutique RPG')
      .setDescription('Utilisez `/rpgbuy <item>` pour acheter')
      .setFooter({ text: 'Les prix sont en or' });

    for (const item of this.shop) {
      let stats = '';
      if (item.attack) stats += `+${item.attack} ATK `;
      if (item.defense) stats += `+${item.defense} DEF `;
      if (item.heal) stats += `+${item.heal} HP `;

      embed.addFields({
        name: `${item.name} - ${item.price} or`,
        value: stats || 'Objet consommable',
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
}
