import { TextChannel, Collection, Message } from 'discord.js';
import { logger } from '../../../utils/logger';

export class TicketManager {
  static async closeTicket(
    channelId: string,
    closedBy: string,
    reason: string,
    context: any
  ): Promise<void> {
    try {
      // Update ticket status
      await context.database.query(
        'UPDATE tickets SET status = $1, closed_by = $2, closed_at = NOW(), close_reason = $3 WHERE channel_id = $4',
        ['closed', closedBy, reason, channelId]
      );

      // Get ticket data
      const ticket = await context.database.query(
        'SELECT * FROM tickets WHERE channel_id = $1',
        [channelId]
      );

      if (ticket.length === 0) return;

      // Get config
      const config = await context.database.getGuildConfig(ticket[0].guild_id);
      const ticketsModule = config?.modules?.find((m: any) => m.module_name === 'tickets');

      // Generate and send transcript if configured
      if (ticketsModule?.config?.transcriptsChannel) {
        const channel = await context.client.channels.fetch(channelId) as TextChannel;
        if (channel) {
          const transcript = await this.generateTranscript(channel, ticket[0], context);
          
          const transcriptsChannel = await context.client.channels.fetch(
            ticketsModule.config.transcriptsChannel
          ) as TextChannel;

          if (transcriptsChannel) {
            await transcriptsChannel.send({
              content: `📜 Transcript du ticket #${ticket[0].ticket_number}`,
              files: [{
                attachment: Buffer.from(transcript, 'utf-8'),
                name: `ticket-${ticket[0].ticket_number}.html`,
              }],
            });
          }
        }
      }

      logger.info(`Ticket #${ticket[0].ticket_number} closed by ${closedBy}`);
    } catch (error) {
      logger.error('Error closing ticket:', error);
      throw error;
    }
  }

  static async generateTranscript(
    channel: any,
    ticket: any,
    context: any
  ): Promise<string> {
    try {
      // Fetch all messages
      let messages: Collection<string, Message> = new Collection();
      let lastId: string | undefined;

      while (true) {
        const options: any = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);
        messages = messages.concat(batch);

        if (batch.size < 100) break;
        lastId = batch.last()?.id;
      }

      // Sort messages
      const sortedMessages = Array.from(messages.values()).reverse();

      // Generate HTML
      let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket #${ticket.ticket_number} Transcript</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #36393f;
      color: #dcddde;
      padding: 20px;
    }
    .header {
      background: #202225;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .message {
      background: #2f3136;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
      border-left: 3px solid #7289da;
    }
    .author {
      color: #7289da;
      font-weight: bold;
    }
    .timestamp {
      color: #72767d;
      font-size: 12px;
    }
    .content {
      margin-top: 8px;
      line-height: 1.6;
    }
    .attachment {
      color: #00b0f4;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 Ticket #${ticket.ticket_number}</h1>
    <p><strong>Sujet:</strong> ${ticket.subject}</p>
    <p><strong>Type:</strong> ${ticket.type}</p>
    <p><strong>Créé:</strong> ${new Date(ticket.created_at).toLocaleString()}</p>
    <p><strong>Fermé:</strong> ${ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : 'Ouvert'}</p>
    ${ticket.close_reason ? `<p><strong>Raison:</strong> ${ticket.close_reason}</p>` : ''}
  </div>
`;

      for (const message of sortedMessages) {
        html += `
  <div class="message">
    <div>
      <span class="author">${message.author.tag}</span>
      <span class="timestamp">${message.createdAt.toLocaleString()}</span>
    </div>
    <div class="content">${this.escapeHtml(message.content)}</div>
`;

        if (message.attachments.size > 0) {
          message.attachments.forEach((attachment) => {
            html += `    <div class="attachment">📎 <a href="${attachment.url}" target="_blank">${attachment.name}</a></div>\n`;
          });
        }

        html += '  </div>\n';
      }

      html += `
</body>
</html>
`;

      return html;
    } catch (error) {
      logger.error('Error generating transcript:', error);
      throw error;
    }
  }

  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
