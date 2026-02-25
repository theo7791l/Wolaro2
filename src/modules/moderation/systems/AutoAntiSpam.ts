import { Message, GuildMember, TextChannel } from 'discord.js';
import pool from '../../../utils/database';
import { logger } from '../../../utils/logger';

export class AutoAntiSpam {
  private messageCache = new Map<string, any[]>();

  async checkSpam(message: Message): Promise<boolean> {
    if (!message.guild) return false;

    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();

    if (!this.messageCache.has(key)) {
      this.messageCache.set(key, []);
    }

    const messages = this.messageCache.get(key)!;
    messages.push({ content: message.content, timestamp: now });

    // Clean old messages
    const recent = messages.filter((m: any) => now - m.timestamp < 5000);
    this.messageCache.set(key, recent);

    return recent.length >= 5;
  }

  async handleSpam(message: Message): Promise<void> {
    try {
      await message.delete();
      
      if (message.channel.isSendable()) {
        const reply = await message.channel.send({
          content: `⚠️ **${message.author}** Ralentis ! Ne spam pas.`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      }
    } catch (error) {
      logger.error('Error handling spam:', error);
    }
  }
}
