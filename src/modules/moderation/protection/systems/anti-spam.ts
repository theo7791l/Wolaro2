/**
 * Anti-Spam System - Migrated from TheoProtect autoAntiSpam.js
 * Détection avancée spam/flood avec cleanup automatique
 */

import { Message, TextChannel } from 'discord.js';
import { logger } from '../../../../utils/logger';
import { BadWordsFilter } from './bad-words';
import { ProtectionDB } from '../database';
import type { MessageCache, FloodDetection } from '../types';

export class AntiSpamSystem {
  private messageCache = new Map<string, MessageCache[]>();
  private warningsCache = new Map<string, number>();
  private globalMessageCache = new Map<string, FloodDetection['messages']>();
  private floodSanctions = new Map<string, number>();
  private botSpamCache = new Map<string, number>();
  private cleanupInProgress = new Set<string>();
  private badWords: BadWordsFilter;
  private db: ProtectionDB;

  constructor(db: ProtectionDB, badWords: BadWordsFilter) {
    this.db = db;
    this.badWords = badWords;
    
    // Auto-cleanup cache every 60s
    setInterval(() => this.clearCache(), 60000);
  }

  /**
   * Main entry point: check message for all types of spam/flood
   */
  async checkMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;
    
    const config = await this.db.getConfig(message.guild.id);
    if (!config.antispam_enabled) return;
    
    const key = `${message.author.id}-${message.guild.id}`;
    const now = Date.now();
    const isBot = message.author.bot || !!message.webhookId;
    
    try {
      // 1. Check bad words (humans only)
      if (!isBot && config.badwords_enabled) {
        const badWordCheck = this.badWords.containsBadWords(message.content);
        if (badWordCheck.detected) {
          await this.handleBadWord(message, badWordCheck);
          return;
        }
      }
      
      // 2. Check single message flood (ALL messages)
      if (await this.checkSingleMessageFlood(message, isBot)) {
        await this.cleanupChannelFlood(message.channel as TextChannel);
        return;
      }
      
      // 3. Check global flood (ALL messages)
      if (await this.checkGlobalFlood(message, now)) {
        await this.cleanupChannelFlood(message.channel as TextChannel);
        return;
      }
      
      // 4. Check regular spam (users only)
      if (!isBot) {
        const spamDetected = await this.checkRegularSpam(message, key, now, config);
        if (spamDetected) {
          await this.cleanupChannelFlood(message.channel as TextChannel);
        }
      }
    } catch (error) {
      logger.error('[AntiSpam] Error checking message:', error);
    }
  }

  /**
   * Detect single message flood (very long, repetitive, special chars)
   */
  private async checkSingleMessageFlood(message: Message, isBot: boolean): Promise<boolean> {
    const content = message.content;
    
    const isSingleMessageFlood = (
      content.length > 2000 ||
      content.split('\n').length > 20 ||
      /([A-Z]{50,})|([a-z]{100,})|([0-9]{50,})/.test(content) ||
      /(.)\1{30,}/.test(content) ||
      content.match(/[^\w\s]{20,}/g)
    );
    
    if (!isSingleMessageFlood) return false;
    
    logger.info(`[Single Message Flood] Detected from ${message.author.tag} (Bot: ${isBot})`);
    
    try {
      await message.delete();
      
      if (isBot) {
        // Bot spam: silent deletion + log
        const botKey = `${message.author.id}-${message.channel.id}`;
        const count = (this.botSpamCache.get(botKey) || 0) + 1;
        this.botSpamCache.set(botKey, count);
        setTimeout(() => this.botSpamCache.delete(botKey), 60000);
        
        await this.logToChannel(message.guild!, {
          color: 0xff6600,
          title: '🤖 Message spam de bot supprimé',
          description:
            `**Bot:** ${message.author.tag} (${message.author.id})\n` +
            `**Salon:** ${message.channel}\n` +
            `**Longueur:** ${content.length} caractères\n` +
            `**Total supprimé:** ${count} message(s)`,
          fields: [{
            name: 'Aperçu du contenu',
            value: content.substring(0, 500) + (content.length > 500 ? '...' : '')
          }]
        });
      } else {
        // Human flood: progressive sanctions
        await this.handleUserFlood(message, content);
      }
      
      await this.db.logAction({
        guild_id: message.guild!.id,
        user_id: message.author.id,
        type: 'flood_detected',
        action: 'message_deleted',
        reason: 'Single message flood',
        details: { message_length: content.length, is_bot: isBot }
      });
      
      await this.db.incrementStat(message.guild!.id, 'flood_detected');
      
      return true;
    } catch (error) {
      logger.error('[Single Message Flood] Error:', error);
      return false;
    }
  }

  /**
   * Handle user flood with progressive sanctions
   */
  private async handleUserFlood(message: Message, content: string): Promise<void> {
    const key = `${message.author.id}-${message.guild!.id}`;
    const sanctions = (this.floodSanctions.get(key) || 0) + 1;
    this.floodSanctions.set(key, sanctions);
    
    const member = message.member;
    if (!member) return;
    
    if (sanctions === 1) {
      await member.timeout(5 * 60 * 1000, '[Auto-Mod] Spam/Flood').catch(console.error);
      await message.channel.send({
        content: `🚨 ${message.author}, **mute 5 minutes** pour flood. Prochain = mute plus long.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    } else if (sanctions === 2) {
      await member.timeout(30 * 60 * 1000, '[Auto-Mod] Flood répété').catch(console.error);
      await message.channel.send({
        content: `🔨 ${message.author}, **mute 30 minutes** pour flood répété. Prochain = kick.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    } else {
      await member.kick('[Auto-Mod] Flood répété (3e fois)').catch(console.error);
      await message.channel.send({
        content: `⛔ ${message.author.tag} a été **kick** pour flood répété.`
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
    }
    
    setTimeout(() => this.floodSanctions.delete(key), 60 * 60 * 1000);
    
    await this.logToChannel(message.guild!, {
      color: 0xff0000,
      title: '🚨 Flood utilisateur détecté',
      description:
        `**Utilisateur:** ${message.author.tag} (${message.author.id})\n` +
        `**Salon:** ${message.channel}\n` +
        `**Longueur:** ${content.length} caractères\n` +
        `**Sanction:** ${sanctions === 1 ? 'Mute 5 min' : sanctions === 2 ? 'Mute 30 min' : 'Kick'}`,
      fields: [{
        name: 'Contenu',
        value: content.substring(0, 500) + (content.length > 500 ? '...' : '')
      }]
    });
  }

  /**
   * Check global flood (10+ messages in 5 seconds)
   */
  private async checkGlobalFlood(message: Message, now: number): Promise<boolean> {
    const channelKey = `${message.guild!.id}-${message.channel.id}`;
    
    if (!this.globalMessageCache.has(channelKey)) {
      this.globalMessageCache.set(channelKey, []);
    }
    
    const channelMessages = this.globalMessageCache.get(channelKey)!;
    channelMessages.push({
      id: message.id,
      author_id: message.author.id,
      author_tag: message.author.tag,
      timestamp: now,
      is_bot: message.author.bot,
      is_webhook: !!message.webhookId
    });
    
    const recentMessages = channelMessages.filter(m => now - m.timestamp < 5000);
    this.globalMessageCache.set(channelKey, recentMessages);
    
    if (recentMessages.length >= 10) {
      logger.info(`[Global Flood] ${recentMessages.length} messages in ${message.channel}`);
      
      await this.handleGlobalFlood(message, recentMessages);
      this.globalMessageCache.delete(channelKey);
      
      return true;
    }
    
    return false;
  }

  /**
   * Handle global flood detection
   */
  private async handleGlobalFlood(
    message: Message,
    recentMessages: FloodDetection['messages']
  ): Promise<void> {
    const botCount = recentMessages.filter(m => m.is_bot || m.is_webhook).length;
    const humanCount = recentMessages.filter(m => !m.is_bot && !m.is_webhook).length;
    
    // Delete all flood messages
    const deletedCount = await this.bulkDeleteMessages(
      message.channel as TextChannel,
      recentMessages.map(m => m.id)
    );
    
    // Send warning if mostly humans
    if (humanCount > 0) {
      await message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: '🚨 Flood détecté',
          description: `**${deletedCount} messages** supprimés pour flood massif.\n\n⚠️ Ralentissez le débit !`,
          timestamp: new Date().toISOString()
        }]
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
    }
    
    // Sanction unique humans
    const uniqueHumans = [...new Set(
      recentMessages.filter(m => !m.is_bot && !m.is_webhook).map(m => m.author_id)
    )];
    
    for (const userId of uniqueHumans) {
      await this.sanctionFloodUser(message, userId);
    }
    
    await this.db.logAction({
      guild_id: message.guild!.id,
      user_id: message.author.id,
      type: 'flood_detected',
      action: 'cleanup',
      reason: 'Global flood',
      details: { deleted_count: deletedCount, bot_count: botCount, human_count: humanCount }
    });
    
    await this.db.incrementStat(message.guild!.id, 'flood_detected');
  }

  /**
   * Cleanup channel: delete all flood messages from last 30s
   */
  private async cleanupChannelFlood(channel: TextChannel): Promise<void> {
    const channelKey = channel.id;
    
    if (this.cleanupInProgress.has(channelKey)) return;
    
    this.cleanupInProgress.add(channelKey);
    logger.info(`[Cleanup] 🧹 Scanning ${channel.name} for flood (30s window)`);
    
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const now = Date.now();
      const thirtySecondsAgo = now - 30000;
      const toDelete: Message[] = [];
      
      for (const [, msg] of messages) {
        if (msg.createdTimestamp < thirtySecondsAgo) continue;
        if (msg.author.id === msg.client.user?.id) continue;
        
        const content = msg.content;
        const isFlood = (
          content.length > 2000 ||
          content.split('\n').length > 20 ||
          /([A-Z]{50,})|([a-z]{100,})|([0-9]{50,})/.test(content) ||
          /(.)\1{30,}/.test(content) ||
          content.match(/[^\w\s]{20,}/g)
        );
        
        if (isFlood) toDelete.push(msg);
      }
      
      if (toDelete.length > 0) {
        let deleted = 0;
        for (const msg of toDelete) {
          await msg.delete().catch(() => {});
          deleted++;
        }
        
        logger.info(`[Cleanup] ✅ Deleted ${deleted} flood messages`);
        
        await this.logToChannel(channel.guild, {
          color: 0xff9900,
          title: '🧹 Nettoyage automatique',
          description:
            `**Salon:** ${channel}\n` +
            `**Messages supprimés:** ${deleted}\n` +
            `**Période:** 30 dernières secondes`
        });
      }
    } catch (error) {
      logger.error('[Cleanup] Error:', error);
    } finally {
      setTimeout(() => this.cleanupInProgress.delete(channelKey), 5000);
    }
  }

  /**
   * Bulk delete messages
   */
  private async bulkDeleteMessages(channel: TextChannel, messageIds: string[]): Promise<number> {
    let deleted = 0;
    
    for (let i = 0; i < messageIds.length; i += 100) {
      const chunk = messageIds.slice(i, i + 100);
      
      try {
        if (chunk.length > 1) {
          await channel.bulkDelete(chunk, true);
          deleted += chunk.length;
        } else if (chunk.length === 1) {
          const msg = await channel.messages.fetch(chunk[0]).catch(() => null);
          if (msg) {
            await msg.delete();
            deleted++;
          }
        }
      } catch (error) {
        logger.error('[Bulk Delete] Error:', error);
      }
    }
    
    return deleted;
  }

  /**
   * Check regular spam (repeated messages)
   */
  private async checkRegularSpam(
    message: Message,
    key: string,
    now: number,
    config: any
  ): Promise<boolean> {
    if (!this.messageCache.has(key)) {
      this.messageCache.set(key, []);
    }
    
    const messages = this.messageCache.get(key)!;
    messages.push({
      id: message.id,
      content: message.content,
      timestamp: now,
      channel_id: message.channel.id
    });
    
    const recentMessages = messages
      .filter(m => now - m.timestamp < config.antispam_threshold_time)
      .slice(-10);
    
    this.messageCache.set(key, recentMessages);
    
    if (recentMessages.length >= config.antispam_threshold_messages) {
      logger.info(`[Spam] Detected from ${message.author.tag}`);
      
      // Delete spam messages
      for (const msg of recentMessages) {
        const toDelete = await message.channel.messages.fetch(msg.id).catch(() => null);
        if (toDelete) await toDelete.delete().catch(() => {});
      }
      
      // Timeout user
      if (message.member) {
        await message.member.timeout(5 * 60 * 1000, '[Auto-Mod] Spam').catch(() => {});
      }
      
      await message.channel.send({
        content: `🔇 ${message.author} **mute 5 minutes** pour spam.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      
      this.messageCache.delete(key);
      
      await this.db.incrementStat(message.guild!.id, 'spam_detected');
      
      return true;
    }
    
    return false;
  }

  /**
   * Handle bad word detection
   */
  private async handleBadWord(message: Message, detection: any): Promise<void> {
    const key = `${message.author.id}-${message.guild!.id}`;
    const warnings = this.warningsCache.get(key) || 0;
    
    await message.delete();
    
    if (warnings === 0) {
      this.warningsCache.set(key, 1);
      await message.channel.send({
        content: `⚠️ ${message.author}, **Avertissement 1/2** : Langage inapproprié. Prochain = mute.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    } else {
      this.warningsCache.set(key, 2);
      if (message.member) {
        await message.member.timeout(10 * 60 * 1000, '[Auto-Mod] Langage inapproprié');
      }
      await message.channel.send({
        content: `🔇 ${message.author} **mute 10 minutes** pour langage inapproprié répété.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      
      setTimeout(() => this.warningsCache.delete(key), 10 * 60 * 1000);
    }
    
    await this.db.logAction({
      guild_id: message.guild!.id,
      user_id: message.author.id,
      type: 'bad_word_detected',
      action: warnings === 0 ? 'warn' : 'timeout',
      reason: 'Langage inapproprié',
      details: { word: detection.word, severity: detection.severity, warnings: warnings + 1 }
    });
    
    await this.db.incrementStat(message.guild!.id, 'bad_words_detected');
  }

  /**
   * Sanction user for flood participation
   */
  private async sanctionFloodUser(message: Message, userId: string): Promise<void> {
    try {
      const member = await message.guild!.members.fetch(userId).catch(() => null);
      if (!member || member.permissions.has('Administrator')) return;
      
      const key = `${userId}-${message.guild!.id}`;
      const sanctions = (this.floodSanctions.get(key) || 0) + 1;
      this.floodSanctions.set(key, sanctions);
      
      if (sanctions === 1) {
        await member.timeout(10 * 60 * 1000, '[Auto-Mod] Participation flood');
      } else if (sanctions === 2) {
        await member.timeout(60 * 60 * 1000, '[Auto-Mod] Flood répété');
      } else {
        await member.kick('[Auto-Mod] Flood répété (3e fois)');
      }
      
      setTimeout(() => this.floodSanctions.delete(key), 2 * 60 * 60 * 1000);
    } catch (error) {
      logger.error('[Sanction] Error:', error);
    }
  }

  /**
   * Log to guild's log channel
   */
  private async logToChannel(guild: any, embedData: any): Promise<void> {
    try {
      const config = await this.db.getConfig(guild.id);
      if (!config.log_channel_id) return;
      
      const logChannel = guild.channels.cache.get(config.log_channel_id);
      if (!logChannel?.isTextBased()) return;
      
      await logChannel.send({
        embeds: [{
          ...embedData,
          timestamp: new Date().toISOString(),
          footer: { text: 'Wolaro Protection System' }
        }]
      });
    } catch (error) {
      logger.error('[Log Channel] Error:', error);
    }
  }

  /**
   * Clear old cache entries
   */
  private clearCache(): void {
    const now = Date.now();
    
    for (const [key, messages] of this.messageCache.entries()) {
      const recent = messages.filter(m => now - m.timestamp < 60000);
      if (recent.length === 0) {
        this.messageCache.delete(key);
      } else {
        this.messageCache.set(key, recent);
      }
    }
    
    for (const [key, messages] of this.globalMessageCache.entries()) {
      const recent = messages.filter(m => now - m.timestamp < 60000);
      if (recent.length === 0) {
        this.globalMessageCache.delete(key);
      } else {
        this.globalMessageCache.set(key, recent);
      }
    }
  }
}
