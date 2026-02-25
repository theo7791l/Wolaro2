import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class PayCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Envoyer de l\'argent à un autre utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur à qui envoyer de l\'argent')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('montant')
        .setDescription('Le montant à envoyer')
        .setMinValue(1)
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'economy';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('utilisateur', true);
    const amount = interaction.options.getInteger('montant', true);

    if (target.bot) {
      await interaction.reply({
        content: '❌ Vous ne pouvez pas envoyer d\'argent à un bot.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ Vous ne pouvez pas vous envoyer de l\'argent à vous-même.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Check sender balance
      const senderBalance = await context.database.getBalance(interaction.guildId!, interaction.user.id);
      
      if (senderBalance < amount) {
        await interaction.reply({
          content: `❌ Vous n'avez pas assez d'argent. Solde actuel : **${senderBalance} coins**.,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Execute transaction
      const client = await context.database.getClient();
      try {
        await client.query('BEGIN');

        // Remove from sender
        await client.query(
          `UPDATE guild_economy SET balance = balance - $3
           WHERE guild_id = $1 AND user_id = $2`,
          [interaction.guildId!, interaction.user.id, amount]
        );

        // Add to receiver (create if doesn't exist)
        await client.query(
          `INSERT INTO guild_economy (guild_id, user_id, balance)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, user_id)
           DO UPDATE SET balance = guild_economy.balance + $3`,
          [interaction.guildId!, target.id, amount]
        );

        await client.query('COMMIT');

        await interaction.reply(
          `✅ Vous avez envoyé **${amount} coins** à ${target}.`
        );

        // Log transaction
        await context.database.logAction(
          interaction.user.id,
          'ECONOMY_TRANSFER',
          {
            from: interaction.user.id,
            to: target.id,
            amount,
          },
          interaction.guildId!
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de transférer l\'argent.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
