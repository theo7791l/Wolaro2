import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
}   from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { EmbedStyles } from '../../../utils/embeds';

export class BanCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Le membre à bannir')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('Raison du bannissement')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('supprimer_messages')
        .setDescription('Supprimer les messages des X derniers jours (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder;

  module = 'moderation';
  permissions = [PermissionFlagsBits.BanMembers];
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const user = interaction.options.getUser('utilisateur', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const deleteMessageDays = interaction.options.getInteger('supprimer_messages') || 0;

    // Check if user can be banned
    const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
    
    if (member) {
      if (member.id === interaction.user.id) {
        const embed = EmbedStyles.error(
          'Erreur',
          'Vous ne pouvez pas vous bannir vous-même.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (member.id === interaction.guild!.ownerId) {
        const embed = EmbedStyles.error(
          'Erreur',
          'Vous ne pouvez pas bannir le propriétaire du serveur.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (member.roles.highest.position >= (interaction.member as any).roles.highest.position) {
        const embed = EmbedStyles.error(
          'Erreur',
          'Vous ne pouvez pas bannir un membre avec un rôle supérieur ou égal au vôtre.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
    }

    await interaction.deferReply();

    try {
      // Ban user
      await interaction.guild!.members.ban(user.id, {
        reason: `${reason} | Modérateur: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteMessageDays * 86400,
      });

      // Create moderation case
      const caseResult = await context.database.query(
        `INSERT INTO moderation_cases (
          guild_id, case_number, user_id, moderator_id, action_type, reason, created_at
        ) VALUES (
          $1,
          COALESCE((SELECT MAX(case_number) FROM moderation_cases WHERE guild_id = $1), 0) + 1,
          $2, $3, $4, $5, NOW()
        ) RETURNING case_number`,
        [interaction.guildId!, user.id, interaction.user.id, 'BAN', reason]
      );

      const caseNumber = caseResult[0]?.case_number || 0;

      // Success embed
      const embed = EmbedStyles.moderationCase(
        caseNumber,
        'BAN',
        `${user.tag} (${user.id})`,
        interaction.user.tag,
        reason
      );

      if (deleteMessageDays > 0) {
        embed.addFields({
          name: 'Messages supprimés',
          value: `${deleteMessageDays} jour(s)`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Try to DM user
      try {
        const dmEmbed = EmbedStyles.warning(
          `Banni de ${interaction.guild!.name}`,
          `Vous avez été banni de **${interaction.guild!.name}**.\n\n**Raison:** ${reason}`
        ).setFooter({ text: `Case #${caseNumber}` });

        await user.send({ embeds: [dmEmbed] });
      } catch {
        // User has DMs disabled
      }
    } catch (error) {
      const embed = EmbedStyles.error(
        'Erreur de bannissement',
        'Une erreur est survenue lors du bannissement. Vérifiez que le bot a les permissions nécessaires.'
      );
      await interaction.editReply({ embeds: [embed] });
    }
  }
}
