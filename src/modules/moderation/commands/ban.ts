import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class BanCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption((option) =>
      option
        .setName('membre')
        .setDescription('Le membre à bannir')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('La raison du bannissement')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('jours-messages')
        .setDescription('Nombre de jours de messages à supprimer (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'moderation';
  permissions = [PermissionFlagsBits.BanMembers];
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('membre', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const deleteMessageDays = interaction.options.getInteger('jours-messages') || 0;

    try {
      const member = await interaction.guild!.members.fetch(target.id);

      // Check hierarchy
      if (member.roles.highest.position >= interaction.member!.roles.highest.position) {
        await interaction.reply({
          content: '❌ Vous ne pouvez pas bannir ce membre (rôle supérieur ou égal).',
          ephemeral: true,
        });
        return;
      }

      // Ban the user
      await member.ban({ deleteMessageSeconds: deleteMessageDays * 86400, reason });

      // Get case number
      const caseResult = await context.database.query(
        'SELECT COALESCE(MAX(case_number), 0) + 1 as next_case FROM moderation_cases WHERE guild_id = $1',
        [interaction.guildId!]
      );
      const caseNumber = caseResult[0].next_case;

      // Log to database
      await context.database.query(
        `INSERT INTO moderation_cases (guild_id, case_number, user_id, moderator_id, action_type, reason)
         VALUES ($1, $2, $3, $4, 'BAN', $5)`,
        [interaction.guildId!, caseNumber, target.id, interaction.user.id, reason]
      );

      await interaction.reply({
        content: `✅ **${target.tag}** a été banni.\n**Raison:** ${reason}\n**Cas #${caseNumber}**`,
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de bannir ce membre.',
        ephemeral: true,
      });
    }
  }
}
