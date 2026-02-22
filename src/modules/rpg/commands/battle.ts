import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { RPGManager } from '../utils/manager';
import { BattleEngine } from '../utils/battle';

export class BattleCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Combattre un adversaire')
    .addUserOption((option) =>
      option
        .setName('adversaire')
        .setDescription('L\'utilisateur à combattre (PvP)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('monstre')
        .setDescription('Combattre un monstre (PvE)')
        .addChoices(
          { name: '💀 Squelette (Facile)', value: 'skeleton' },
          { name: '🧟 Zombie (Moyen)', value: 'zombie' },
          { name: '🐉 Dragon (Difficile)', value: 'dragon' },
          { name: '👺 Boss Final (Extrême)', value: 'boss' }
        )
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 30;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const opponent = interaction.options.getUser('adversaire');
    const monster = interaction.options.getString('monstre');

    if (!opponent && !monster) {
      await interaction.reply({
        content: '❌ Veuillez choisir un adversaire (utilisateur) ou un monstre.',
        ephemeral: true,
      });
      return;
    }

    if (opponent?.bot) {
      await interaction.reply({
        content: '❌ Vous ne pouvez pas combattre un bot.',
        ephemeral: true,
      });
      return;
    }

    if (opponent?.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ Vous ne pouvez pas vous combattre vous-même.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const attacker = await RPGManager.getOrCreateProfile(
        interaction.guildId!,
        interaction.user.id,
        context.database
      );

      if (attacker.health <= 0) {
        await interaction.editReply('❌ Vous êtes KO ! Utilisez `/rpgdaily` pour vous soigner.');
        return;
      }

      let battleResult;

      if (opponent) {
        // PvP
        const defender = await RPGManager.getOrCreateProfile(
          interaction.guildId!,
          opponent.id,
          context.database
        );

        if (defender.health <= 0) {
          await interaction.editReply(`❌ ${opponent.username} est KO et ne peut pas combattre.`);
          return;
        }

        battleResult = await BattleEngine.pvpBattle(attacker, defender);
      } else {
        // PvE
        const monsterData = BattleEngine.getMonster(monster!);
        battleResult = await BattleEngine.pveBattle(attacker, monsterData);
      }

      // Update profiles
      await RPGManager.updateProfile(interaction.guildId!, interaction.user.id, battleResult.attacker, context.database);
      
      if (opponent) {
        await RPGManager.updateProfile(interaction.guildId!, opponent.id, battleResult.defender!, context.database);
      }

      // Create battle report
      const embed = new EmbedBuilder()
        .setColor(battleResult.victory ? '#00FF00' : '#FF0000')
        .setTitle(battleResult.victory ? '⚔️ VICTOIRE !' : '💀 DÉFAITE !')
        .setDescription(battleResult.log.join('\n'))
        .addFields(
          { 
            name: `${interaction.user.username}`, 
            value: `Santé: ${battleResult.attacker.health}/${battleResult.attacker.maxHealth}`, 
            inline: true 
          },
          { 
            name: opponent ? opponent.username : BattleEngine.getMonster(monster!).name, 
            value: opponent 
              ? `Santé: ${battleResult.defender!.health}/${battleResult.defender!.maxHealth}`
              : 'Vaincu !', 
            inline: true 
          }
        );

      if (battleResult.rewards) {
        embed.addFields({
          name: '🎁 Récompenses',
          value: `+${battleResult.rewards.gold} or\n+${battleResult.rewards.xp} XP`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply('❌ Erreur lors du combat.');
    }
  }
}
