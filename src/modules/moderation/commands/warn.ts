import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class WarnCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertir un membre')
    .addUserOption((option) =>
      option
        .setName('membre')
        .setDescription('Le membre à avertir')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('La raison de l\'avertissement')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'moderation';
  permissions = [PermissionFlagsBits.ModerateMembers];
  guildOnly = true;
  cooldown = 2;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('membre', true);
    const reason = interaction.options.getString('raison', true);

    try {
      const caseResult = await context.database.query(
        'SELECT COALESCE(MAX(case_number), 0) + 1 as next_case FROM moderation_cases WHERE guild_id = $1',
        [interaction.guildId!]
      );
      const caseNumber = caseResult[0].next_case;

      await context.database.query(
        `INSERT INTO moderation_cases (guild_id, case_number, user_id, moderator_id, action_type, reason)
         VALUES ($1, $2, $3, $4, 'WARN', $5)`,
        [interaction.guildId!, caseNumber, target.id, interaction.user.id, reason]
      );

      // Count warnings
      const warnings = await context.database.query(
        `SELECT COUNT(*) as count FROM moderation_cases 
         WHERE guild_id = $1 AND user_id = $2 AND action_type = 'WARN' AND is_active = true`,
        [interaction.guildId!, target.id]
      );

      const warnCount = parseInt(warnings[0].count);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ Avertissement')
        .addFields(
          { name: 'Membre', value: `${target.tag}`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Cas', value: `#${caseNumber}`, inline: true },
          { name: 'Raison', value: reason },
          { name: 'Total d\'avertissements', value: `${warnCount}` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // DM the user
      try {
        await target.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('Vous avez reçu un avertissement')
              .setDescription(`**Serveur:** ${interaction.guild!.name}\n**Raison:** ${reason}\n**Avertissements:** ${warnCount}`)
              .setTimestamp(),
          ],
        });
      } catch {
        // User has DMs disabled
      }
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible d\'avertir ce membre.',
        ephemeral: true,
      });
    }
  }
}
