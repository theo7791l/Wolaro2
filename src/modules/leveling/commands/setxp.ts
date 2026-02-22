import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class SetXPCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Définir l\'XP d\'un utilisateur (Admin seulement)')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur cible')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('xp')
        .setDescription('Le montant d\'XP à définir')
        .setMinValue(0)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('Action à effectuer')
        .addChoices(
          { name: 'Définir', value: 'set' },
          { name: 'Ajouter', value: 'add' },
          { name: 'Retirer', value: 'remove' }
        )
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'leveling';
  permissions = [PermissionFlagsBits.Administrator];
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('utilisateur', true);
    const xp = interaction.options.getInteger('xp', true);
    const action = interaction.options.getString('action', true);

    try {
      let query = '';
      let actionText = '';

      switch (action) {
        case 'set':
          query = `UPDATE global_profiles 
                   SET global_xp = $2, 
                       global_level = FLOOR(POWER($2 / 100, 0.5)) + 1
                   WHERE user_id = $1`;
          actionText = `défini à ${xp}`;
          break;
        case 'add':
          query = `UPDATE global_profiles 
                   SET global_xp = global_xp + $2,
                       global_level = FLOOR(POWER((global_xp + $2) / 100, 0.5)) + 1
                   WHERE user_id = $1`;
          actionText = `augmenté de ${xp}`;
          break;
        case 'remove':
          query = `UPDATE global_profiles 
                   SET global_xp = GREATEST(global_xp - $2, 0),
                       global_level = FLOOR(POWER(GREATEST(global_xp - $2, 0) / 100, 0.5)) + 1
                   WHERE user_id = $1`;
          actionText = `réduit de ${xp}`;
          break;
      }

      // Ensure user profile exists
      await context.database.getOrCreateGlobalProfile(target.id, target.username);

      await context.database.query(query, [target.id, xp]);

      // Get updated stats
      const updated = await context.database.query(
        'SELECT global_xp, global_level FROM global_profiles WHERE user_id = $1',
        [target.id]
      );

      await interaction.reply(
        `✅ XP de ${target} ${actionText}.\nNouveau total: **${updated[0].global_xp.toLocaleString()} XP** (Niveau ${updated[0].global_level})`
      );

      // Log action
      await context.database.logAction(
        interaction.user.id,
        'XP_MODIFIED',
        {
          target: target.id,
          action,
          amount: xp,
          newTotal: updated[0].global_xp,
        },
        interaction.guildId!
      );
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de modifier l\'XP.',
        ephemeral: true,
      });
    }
  }
}
