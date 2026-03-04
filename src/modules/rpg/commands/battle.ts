import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { RPGManager } from '../utils/manager';
import { BattleEngine } from '../utils/battle';

export class BattleCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('battle')
    .setDescription('⚔️ Combattre un adversaire (PvP) ou un monstre (PvE)')
    .addUserOption(opt =>
      opt.setName('adversaire')
        .setDescription('Membre à défier en PvP')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('monstre')
        .setDescription('Monstre à affronter en PvE')
        .addChoices(
          { name: '💀 Squelette (Facile)',    value: 'skeleton' },
          { name: '🧟 Zombie (Moyen)',         value: 'zombie'   },
          { name: '🐉 Dragon (Difficile)',     value: 'dragon'   },
          { name: '👺 Boss Final (Extrême)',   value: 'boss'     },
        )
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 30;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const opponent = interaction.options.getUser('adversaire');
    const monsterType = interaction.options.getString('monstre');

    if (!opponent && !monsterType) {
      await interaction.reply({
        content: '❌ Choisis un adversaire (PvP) **ou** un monstre (PvE).',
        ephemeral: true,
      });
      return;
    }

    if (opponent?.bot) {
      await interaction.reply({ content: '❌ Tu ne peux pas combattre un bot.', ephemeral: true });
      return;
    }

    if (opponent?.id === interaction.user.id) {
      await interaction.reply({ content: '❌ Tu ne peux pas te combattre toi-même.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    // ── Vérification profil (requiert /rpgstart) ─────────────────────────────
    const attacker = await RPGManager.getProfile(interaction.guildId!, interaction.user.id, context.database);

    if (!attacker) {
      await interaction.editReply(
        '❌ Tu n\'as pas encore de profil RPG !\n➡️ Lance `/rpgstart` pour créer ton personnage et choisir ta classe.'
      );
      return;
    }

    if (attacker.health <= 0) {
      await interaction.editReply('❌ Tu es KO ! Utilise `/rpgdaily` pour récupérer de la vie.');
      return;
    }

    try {
      let result;

      if (opponent) {
        // ── PvP ────────────────────────────────────────────────────────────
        const defender = await RPGManager.getProfile(interaction.guildId!, opponent.id, context.database);

        if (!defender) {
          await interaction.editReply(`❌ ${opponent.username} n'a pas encore de profil RPG.`);
          return;
        }

        if (defender.health <= 0) {
          await interaction.editReply(`❌ ${opponent.username} est KO et ne peut pas combattre.`);
          return;
        }

        result = await BattleEngine.pvpBattle(attacker, defender);

        await RPGManager.updateProfile(interaction.guildId!, interaction.user.id, result.attacker, context.database);
        await RPGManager.updateProfile(interaction.guildId!, opponent.id, result.defender!, context.database);

        const embed = new EmbedBuilder()
          .setColor(result.victory ? 0x57f287 : 0xed4245)
          .setTitle(result.victory ? '🏆 VICTOIRE !' : '💀 DÉFAITE...')
          .setDescription(result.log.slice(0, 10).join('\n') + (result.log.length > 10 ? '\n_...(combat raccourci)_' : ''))
          .addFields(
            { name: `${interaction.user.username}`,  value: `❤️ ${result.attacker.health}/${result.attacker.maxHealth}`, inline: true },
            { name: opponent.username, value: `❤️ ${result.defender!.health}/${result.defender!.maxHealth}`, inline: true },
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } else {
        // ── PvE ────────────────────────────────────────────────────────────
        const monster = BattleEngine.getMonster(monsterType!, attacker.level);
        result = await BattleEngine.pveBattle(attacker, monster);

        await RPGManager.updateProfile(interaction.guildId!, interaction.user.id, result.attacker, context.database);

        // Truncate log to stay within Discord 4096 char embed limit
        const fullLog = result.log.join('\n');
        const description = fullLog.length > 3800
          ? fullLog.substring(0, 3797) + '...'
          : fullLog;

        const embed = new EmbedBuilder()
          .setColor(result.victory ? 0x57f287 : 0xed4245)
          .setTitle(result.victory
            ? `🏆 Victoire contre ${monster.emoji} ${monster.name} !`
            : `💀 Défaite face à ${monster.emoji} ${monster.name}...`
          )
          .setDescription(description)
          .addFields(
            { name: '❤️ PV restants',   value: `\`${result.attacker.health}/${result.attacker.maxHealth}\``, inline: true },
            { name: '📊 Niveau',         value: `\`${result.attacker.level}\``, inline: true },
          );

        if (result.rewards) {
          embed.addFields({
            name: '🎁 Récompenses',
            value: `+**${result.rewards.gold}** 🪙 or\n+**${result.rewards.xp}** ✨ XP`,
            inline: true,
          });
        }

        if (result.leveledUp) {
          embed.addFields({
            name: '🆙 Level Up !',
            value: `Tu es maintenant **niveau ${result.newLevel}** ! Santé complète restaurée.`,
          });
        }

        embed.setFooter({ text: `${interaction.user.tag} • RPG`, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      await interaction.editReply('❌ Erreur lors du combat. Réessaie dans quelques instants.');
    }
  }
}
