/**
 * Anti-Spam System - Fixed constructor
 */

import { Message, GuildMember } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';
import type { MessageCache } from '../types';

export class AntiSpamSystem {
  private messageCache = new Map<string, MessageCache[]>();
  private userWarnings = new Map<string, number>();

  constructor(private db: ProtectionDatabase) {}

  async checkSpam(message: Message): Promise<boolean> {
    if (!message.guild) return false;

    const config = await this.db.getConfig(message.guild.id);
    if (!config.antispam_enabled) return false;

    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();

    if (!this.messageCache.has(key)) {
      this.messageCache.set(key, []);
    }

    const messages = this.messageCache.get(key)!;
    const cached: MessageCache = {
      id: message.id,
      author_id: message.author.id,
      content: message.content,
      timestamp: now,
      is_bot: message.author.bot,
      is_webhook: message.webhookId !== null,
    };

    messages.push(cached);

    const recent = messages.filter(m => now - m.timestamp < config.antispam_time_window);
    this.messageCache.set(key, recent);

    if (recent.length >= config.antispam_message_limit) {
      await this.db.incrementStat(message.guild.id, 'spam_detected');
      return true;
    }

    return false;
  }

  async handleSpam(message: Message): Promise<void> {
    try {
      await message.delete();

      if (message.channel.isSendable()) {
        const reply = await message.channel.send({
          content: `⚠️ **${message.author}** Ralentis ! Spam détecté.`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      }

      const warnings = (this.userWarnings.get(message.author.id) || 0) + 1;
      this.userWarnings.set(message.author.id, warnings);

      if (warnings >= 3 && message.member) {
        await message.member.timeout(300000, 'Spam répété');
        this.userWarnings.delete(message.author.id);
      }
    } catch (error) {
      logger.error('Error handling spam:', error);
    }
  }
}
