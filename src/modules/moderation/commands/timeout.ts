import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class TimeoutCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Mettre un membre en timeout')
    .addUserOption((option) =>
      option
        .setName('membre')
        .setDescription('Le membre à timeout')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('durée')
        .setDescription('Durée en minutes (max 40320 = 28 jours)')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('La raison du timeout')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'moderation';
  permissions = [PermissionFlagsBits.ModerateMembers];
  guildOnly = true;
  cooldown = 2;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('membre', true);
    const duration = interaction.options.getInteger('durée', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

    try {
      const member = await interaction.guild!.members.fetch(target.id);

      if (member.roles.highest.position >= (interaction.member as GuildMember).roles.highest.position) {
        await interaction.reply({
          content: '❌ Vous ne pouvez pas timeout ce membre (rôle supérieur ou égal).',
          ephemeral: true,
        });
        return;
      }

      const durationMs = duration * 60 * 1000;
      await member.timeout(durationMs, reason);

      const caseResult = await context.database.query(
        'SELECT COALESCE(MAX(case_number), 0) + 1 as next_case FROM moderation_cases WHERE guild_id = $1',
        [interaction.guildId!]
      );
      const caseNumber = caseResult[0].next_case;

      const expiresAt = new Date(Date.now() + durationMs);

      await context.database.query(
        `INSERT INTO moderation_cases (guild_id, case_number, user_id, moderator_id, action_type, reason, duration, expires_at)
         VALUES ($1, $2, $3, $4, 'MUTE', $5, $6, $7)`,
        [interaction.guildId!, caseNumber, target.id, interaction.user.id, reason, `${duration} minutes`, expiresAt]
      );

      await interaction.reply({
        content: `✅ **${target.tag}** a été mis en timeout pour **${duration} minutes**.\n**Raison:** ${reason}\n**Cas #${caseNumber}**`,
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de timeout ce membre.',
        ephemeral: true,
      });
    }
  }
}
