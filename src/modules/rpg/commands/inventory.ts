import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class InventoryCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpginventory')
    .setDescription('Voir votre inventaire RPG') as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    try {
      const inventory = await context.database.query(
        'SELECT inventory, equipped FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
        [interaction.guildId!, interaction.user.id]
      );

      const items = inventory[0]?.inventory || [];
      const equipped = inventory[0]?.equipped || {};

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎒 Inventaire RPG')
        .setTimestamp();

      if (equipped.weapon || equipped.armor || equipped.accessory) {
        let equippedText = '';
        if (equipped.weapon) equippedText += `⚔️ ${equipped.weapon}\n`;
        if (equipped.armor) equippedText += `🛡️ ${equipped.armor}\n`;
        if (equipped.accessory) equippedText += `💍 ${equipped.accessory}\n`;
        embed.addFields({ name: '🎯 Équipé', value: equippedText, inline: false });
      }

      if (items.length > 0) {
        const itemsList = items.map((item: any) => `${item.emoji} ${item.name} x${item.quantity}`).join('\n');
        embed.addFields({ name: '📦 Objets', value: itemsList || 'Aucun objet', inline: false });
      } else {
        embed.setDescription('Votre inventaire est vide. Visitez `/rpgshop` pour acheter des objets !');
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de charger l\'inventaire.',
        ephemeral: true,
      });
    }
  }
}
