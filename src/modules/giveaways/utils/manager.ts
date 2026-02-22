import { EmbedBuilder } from 'discord.js';
import { logger } from '../../../utils/logger';

export class GiveawayManager {
  static async endGiveaway(giveawayId: string, context: any): Promise<void> {
    try {
      // Get giveaway
      const giveaway = await context.database.query(
        'SELECT * FROM giveaways WHERE id = $1',
        [giveawayId]
      );

      if (giveaway.length === 0) return;

      // Get participants
      const participants = await context.database.query(
        'SELECT user_id FROM giveaway_participants WHERE giveaway_id = $1',
        [giveawayId]
      );

      const channel = await context.client.channels.fetch(giveaway[0].channel_id);
      const message = await (channel as any).messages.fetch(giveaway[0].message_id);

      if (participants.length === 0) {
        // No participants
        const embed = EmbedBuilder.from(message.embeds[0])
          .setColor('#808080')
          .setDescription(
            `**Prix:** ${giveaway[0].prize}\n\n` +
            '❌ Aucun participant valide.\n\n' +
            '**Giveaway terminé**'
          );

        await message.edit({ embeds: [embed], components: [] });
        await (channel as any).send('😔 Aucun participant pour ce giveaway.');
      } else {
        // Select winners
        const winnersCount = Math.min(giveaway[0].winners_count, participants.length);
        const winners: string[] = [];

        const shuffled = [...participants].sort(() => Math.random() - 0.5);
        for (let i = 0; i < winnersCount; i++) {
          winners.push(shuffled[i].user_id);
        }

        // Update message
        const embed = EmbedBuilder.from(message.embeds[0])
          .setColor('#00FF00')
          .setDescription(
            `**Prix:** ${giveaway[0].prize}\n\n` +
            `**Gagnant(s):** ${winners.map((w) => `<@${w}>`).join(', ')}\n\n` +
            '**Giveaway terminé**'
          );

        await message.edit({ embeds: [embed], components: [] });

        // Announce winners
        await (channel as any).send(
          `🎉 Félicitations ${winners.map((w) => `<@${w}>`).join(', ')} ! Vous avez gagné **${giveaway[0].prize}** ! 🎉`
        );

        // Save winners
        for (const winner of winners) {
          await context.database.query(
            'UPDATE giveaway_participants SET is_winner = true WHERE giveaway_id = $1 AND user_id = $2',
            [giveawayId, winner]
          );
        }
      }

      // Update giveaway status
      await context.database.query(
        'UPDATE giveaways SET status = $1, ended_at = NOW() WHERE id = $2',
        ['ended', giveawayId]
      );

      logger.info(`Giveaway ${giveawayId} ended with ${participants.length} participants`);
    } catch (error) {
      logger.error('Error ending giveaway:', error);
    }
  }
}
