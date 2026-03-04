import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class RpgResetCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgreset')
    .setDescription('🔄 [Admin] Réinitialiser le profil RPG d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('membre')
        .setDescription('Le membre dont supprimer le profil RPG')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('membre', true);

    if (target.bot) {
      await interaction.reply({ content: '❌ Les bots n\'ont pas de profil RPG.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Récupérer les infos avant suppression
    const existing = await context.database.query(
      'SELECT level, class, gold, wins, losses FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
      [interaction.guildId!, target.id]
    );

    if (!existing.length) {
      await interaction.editReply(`❌ **${target.username}** n'a pas de profil RPG sur ce serveur.`);
      return;
    }

    const { level, class: cls, gold, wins, losses } = existing[0];

    // Supprimer le profil
    await context.database.query(
      'DELETE FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
      [interaction.guildId!, target.id]
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔄 Profil RPG réinitialisé')
      .setDescription(`Le profil RPG de **${target.username}** a été supprimé avec succès.`)
      .addFields(
        { name: '👤 Membre',          value: `${target}`,                     inline: true },
        { name: '📊 Ancien niveau',    value: `Niveau ${Number(level)}`,       inline: true },
        { name: '🎭 Classe',           value: cls ?? 'Inconnue',               inline: true },
        { name: '🪙 Or perdu',          value: `${Number(gold)}`,              inline: true },
        { name: '🏆 Victoires',        value: `${Number(wins)}`,              inline: true },
        { name: '💀 Défaites',         value: `${Number(losses)}`,            inline: true },
      )
      .addFields({
        name: '\u200b',
        value: `➡️ **${target.username}** peut maintenant refaire \`/rpgstart\` pour choisir une nouvelle classe.`,
      })
      .setFooter({
        text: `Réinitialisé par ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
