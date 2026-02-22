import { IEvent } from '../../../types';
import { Interaction, ButtonInteraction } from 'discord.js';
import { TicketManager } from '../utils/manager';
import { logger } from '../../../utils/logger';

export class TicketButtonHandler implements IEvent {
  name = 'interactionCreate';
  module = 'tickets';

  async execute(interaction: Interaction, context: any): Promise<void> {
    if (!interaction.isButton()) return;

    const button = interaction as ButtonInteraction;

    if (button.customId === 'ticket_close') {
      await this.handleClose(button, context);
    } else if (button.customId === 'ticket_claim') {
      await this.handleClaim(button, context);
    }
  }

  private async handleClose(button: ButtonInteraction, context: any): Promise<void> {
    try {
      await button.deferReply();

      await TicketManager.closeTicket(
        button.channelId,
        button.user.id,
        'Fermé via bouton',
        context
      );

      await button.editReply('✅ Le ticket sera fermé dans 5 secondes...');

      setTimeout(async () => {
        await button.channel?.delete();
      }, 5000);
    } catch (error) {
      logger.error('Error closing ticket:', error);
      await button.editReply('❌ Erreur lors de la fermeture du ticket.');
    }
  }

  private async handleClaim(button: ButtonInteraction, context: any): Promise<void> {
    try {
      const ticket = await context.database.query(
        'SELECT * FROM tickets WHERE guild_id = $1 AND channel_id = $2 AND status = $3',
        [button.guildId!, button.channelId, 'open']
      );

      if (ticket.length === 0) return;

      if (ticket[0].claimed_by) {
        await button.reply({
          content: '❌ Ce ticket a déjà été revendiqué.',
          ephemeral: true,
        });
        return;
      }

      await context.database.query(
        'UPDATE tickets SET claimed_by = $1, claimed_at = NOW() WHERE channel_id = $2',
        [button.user.id, button.channelId]
      );

      await button.reply(`✅ ${button.user} a revendiqué ce ticket et va s'en occuper.`);
    } catch (error) {
      logger.error('Error claiming ticket:', error);
      await button.reply({
        content: '❌ Erreur lors de la revendication.',
        ephemeral: true,
      });
    }
  }
}
