import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class KickCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .addUserOption((option) =>
      option
        .setName('membre')
        .setDescription('Le membre à expulser')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('La raison de l\'expulsion')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'moderation';
  permissions = [PermissionFlagsBits.KickMembers];
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('membre', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

    try {
      const member = await interaction.guild!.members.fetch(target.id);

      if (member.roles.highest.position >= interaction.member!.roles.highest.position) {
        await interaction.reply({
          content: '❌ Vous ne pouvez pas expulser ce membre (rôle supérieur ou égal).',
          ephemeral: true,
        });
        return;
      }

      await member.kick(reason);

      const caseResult = await context.database.query(
        'SELECT COALESCE(MAX(case_number), 0) + 1 as next_case FROM moderation_cases WHERE guild_id = $1',
        [interaction.guildId!]
      );
      const caseNumber = caseResult[0].next_case;

      await context.database.query(
        `INSERT INTO moderation_cases (guild_id, case_number, user_id, moderator_id, action_type, reason)
         VALUES ($1, $2, $3, $4, 'KICK', $5)`,
        [interaction.guildId!, caseNumber, target.id, interaction.user.id, reason]
      );

      await interaction.reply({
        content: `✅ **${target.tag}** a été expulsé.\n**Raison:** ${reason}\n**Cas #${caseNumber}**`,
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible d\'expulser ce membre.',
        ephemeral: true,
      });
    }
  }
}
