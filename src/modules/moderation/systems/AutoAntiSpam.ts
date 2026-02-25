import { Message, TextChannel, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { ModerationConfig, CachedMessage, FloodDetection } from '../types';
import badWords from './BadWordsFilter';
import pool from '../../../utils/database';
import logger from '../../../utils/logger';

/**
 * Système anti-spam avancé avec détection de flood et nettoyage automatique
 * Adapté de TheoProtect pour Wolaro2
 */
export class AutoAntiSpam {
  private messageCache = new Map<string, CachedMessage[]>();
  private warningsCache = new Map<string, number>();
  private globalMessageCache = new Map<string, FloodDetection[]>();
  private floodSanctions = new Map<string, number>();
  private botSpamCache = new Map<string, number>();
  private cleanupInProgress = new Set<string>();

  constructor() {
    // Nettoyage automatique des caches toutes les 5 minutes
    setInterval(() => this.clearCache(), 5 * 60 * 1000);
  }

  /**
   * Vérifie un message pour spam/flood/bad words
   */
  async checkMessage(message: Message, settings: ModerationConfig): Promise<void> {
    if (!message.guild) return;
    if (!settings.antispam_enabled) return;

    const key = `${message.author.id}-${message.guild.id}`;
    const now = Date.now();
    const isBot = message.author.bot || message.webhookId !== null;

    try {
      // 1. Vérifier bad words (humains seulement)
      if (!isBot && settings.badwords_enabled) {
        const badWordCheck = badWords.containsBadWords(message.content);
        if (badWordCheck.detected) {
          await this.handleBadWord(message, badWordCheck);
          return;
        }
      }

      // 2. Vérifier single message flood (tous)
      if (await this.checkSingleMessageFlood(message, isBot)) {
        await this.cleanupChannelFlood(message.channel as TextChannel);
        return;
      }

      // 3. Vérifier global flood (tous)
      if (await this.checkGlobalFlood(message, now)) {
        await this.cleanupChannelFlood(message.channel as TextChannel);
        return;
      }

      // 4. Vérifier spam classique (humains seulement)
      if (!isBot) {
        const spamDetected = await this.checkRegularSpam(message, key, now, settings);
        if (spamDetected) {
          await this.cleanupChannelFlood(message.channel as TextChannel);
        }
      }
    } catch (error) {
      logger.error('[AutoAntiSpam] Error checking message:', error);
    }
  }

  /**
   * Détecte les messages de flood en un seul envoi
   */
  private async checkSingleMessageFlood(message: Message, isBot: boolean): Promise<boolean> {
    const content = message.content;

    const isSingleMessageFlood = (
      content.length > 2000 ||
      content.split('\n').length > 20 ||
      /([A-Z]{50,})|([a-z]{100,})|([0-9]{50,})/.test(content) ||
      /(.)\1{30,}/.test(content) ||
      content.match(/[^\w\s]{20,}/g) !== null
    );

    if (!isSingleMessageFlood) return false;

    logger.info(`[Single Message Flood] Detected from ${message.author.tag} (Bot: ${isBot})`);

    try {
      await message.delete().catch(() => {});

      if (isBot) {
        // Bot spam : log silencieux
        const botKey = `${message.author.id}-${message.channel.id}`;
        const spamCount = (this.botSpamCache.get(botKey) || 0) + 1;
        this.botSpamCache.set(botKey, spamCount);

        setTimeout(() => this.botSpamCache.delete(botKey), 60000);

        await this.logToChannel(message.guild!, {
          color: 0xff6600,
          title: '🤖 Message spam de bot supprimé',
          description:
            `**Bot:** ${message.author.tag} (${message.author.id})\n` +
            `**Salon:** ${message.channel}\n` +
            `**Longueur:** ${content.length} caractères\n` +
            `**Total supprimé:** ${spamCount} message(s)`,
          fields: [
            { name: 'Aperçu du contenu', value: content.substring(0, 500) + (content.length > 500 ? '...' : ''), inline: false }
          ]
        });
      } else {
        // Humain : sanctions progressives
        const key = `${message.author.id}-${message.guild!.id}`;
        const sanctions = (this.floodSanctions.get(key) || 0) + 1;
        this.floodSanctions.set(key, sanctions);

        if (sanctions === 1) {
          await message.member?.timeout(5 * 60 * 1000, '[Auto-Mod] Spam/Flood en un message').catch(() => {});
          await this.updateReputation(message.guild!.id, message.author.id, -20);

          await message.channel.send({
            content: `🚨 ${message.author}, **mute 5 minutes** pour flood/spam. Prochain flood = mute plus long.`,
            allowedMentions: { users: [message.author.id] }
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        } else if (sanctions === 2) {
          await message.member?.timeout(30 * 60 * 1000, '[Auto-Mod] Flood répété').catch(() => {});
          await this.updateReputation(message.guild!.id, message.author.id, -30);

          await message.channel.send({
            content: `🔨 ${message.author}, **mute 30 minutes** pour flood répété. Prochain = kick.`,
            allowedMentions: { users: [message.author.id] }
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        } else {
          try {
            await message.member?.kick('[Auto-Mod] Flood répété (3e fois)');
            await this.updateReputation(message.guild!.id, message.author.id, -50);

            await message.channel.send({
              content: `⛔ ${message.author.tag} a été **kick** pour flood répété.`
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
          } catch (e) {
            logger.error('[Kick failed]:', e);
          }
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
          fields: [
            { name: 'Contenu', value: content.substring(0, 500) + (content.length > 500 ? '...' : ''), inline: false }
          ]
        });
      }

      await this.logAction(message.guild!.id, {
        type: 'single_message_flood',
        user_id: message.author.id,
        is_bot: isBot,
        message_length: content.length,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      logger.error('[Single Message Flood] Error:', error);
      return false;
    }
  }

  /**
   * Nettoie automatiquement le salon après détection de flood
   */
  private async cleanupChannelFlood(channel: TextChannel): Promise<void> {
    const channelKey = channel.id;

    if (this.cleanupInProgress.has(channelKey)) {
      logger.info(`[Cleanup] Already in progress for ${channel.name}, skipping`);
      return;
    }

    this.cleanupInProgress.add(channelKey);
    logger.info(`[Cleanup] 🧹 Scanning ${channel.name} for flood/spam in last 30 seconds...`);

    try {
      const messages = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
      if (messages.size === 0) {
        this.cleanupInProgress.delete(channelKey);
        return;
      }

      const now = Date.now();
      const thirtySecondsAgo = now - (30 * 1000);
      const toDelete: { message: Message; isBot: boolean; author: string }[] = [];

      for (const [, msg] of messages) {
        if (msg.createdTimestamp < thirtySecondsAgo) continue;
        if (msg.author.id === msg.client.user.id) continue;

        const content = msg.content;
        const isFlood = (
          content.length > 2000 ||
          content.split('\n').length > 20 ||
          /([A-Z]{50,})|([a-z]{100,})|([0-9]{50,})/.test(content) ||
          /(.)\1{30,}/.test(content) ||
          content.match(/[^\w\s]{20,}/g) !== null
        );

        if (isFlood) {
          toDelete.push({
            message: msg,
            isBot: msg.author.bot || msg.webhookId !== null,
            author: msg.author.tag
          });
        }
      }

      if (toDelete.length > 0) {
        logger.info(`[Cleanup] 🎯 Found ${toDelete.length} flood/spam message(s) to delete in ${channel.name}`);

        let deletedCount = 0;
        const deletedUsers = new Set<string>();
        const deletedBots = new Set<string>();

        for (const { message: msg, isBot, author } of toDelete) {
          try {
            await msg.delete().catch(() => {});
            deletedCount++;

            if (isBot) {
              deletedBots.add(author);
            } else {
              deletedUsers.add(author);
            }

            await this.logAction(channel.guild.id, {
              type: 'cleanup_flood',
              user_id: msg.author.id,
              is_bot: isBot,
              message_length: msg.content.length,
              timestamp: Date.now()
            });
          } catch (e) {
            logger.error(`[Cleanup] Failed to delete message ${msg.id}:`, e);
          }
        }

        logger.info(`[Cleanup] ✅ Deleted ${deletedCount}/${toDelete.length} flood/spam messages`);

        if (deletedCount > 0) {
          const botList = Array.from(deletedBots).join(', ') || 'Aucun';
          const userList = Array.from(deletedUsers).join(', ') || 'Aucun';

          await this.logToChannel(channel.guild, {
            color: 0xff9900,
            title: '🧹 Nettoyage automatique effectué',
            description:
              `**Salon:** ${channel}\n` +
              `**Messages supprimés:** ${deletedCount}\n` +
              `**Période:** 30 dernières secondes\n` +
              `**Bots:** ${deletedBots.size} (${botList})\n` +
              `**Utilisateurs:** ${deletedUsers.size} (${userList})\n\n` +
              `💡 Le salon a été automatiquement nettoyé après détection de flood/spam.`
          });
        }
      } else {
        logger.info(`[Cleanup] ✅ No additional flood/spam found in ${channel.name}`);
      }
    } catch (error) {
      logger.error('[Cleanup] Error:', error);
    } finally {
      setTimeout(() => this.cleanupInProgress.delete(channelKey), 5000);
    }
  }

  /**
   * Gère les bad words détectés
   */
  private async handleBadWord(message: Message, detection: { word?: string; severity?: string }): Promise<void> {
    try {
      const key = `${message.author.id}-${message.guild!.id}`;
      const warnings = this.warningsCache.get(key) || 0;

      await message.delete().catch(() => {});
      await this.updateReputation(message.guild!.id, message.author.id, -10);

      if (warnings === 0) {
        this.warningsCache.set(key, 1);

        await message.channel.send({
          content: `⚠️ ${message.author}, **Avertissement 1/2** : Langage inapproprié détecté. Prochain avertissement = mute.`,
          allowedMentions: { users: [message.author.id] }
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

        logger.info(`[Bad Words] Warning 1/2 for ${message.author.tag} (word: ${detection.word})`);
      } else {
        this.warningsCache.set(key, 2);

        await message.member?.timeout(10 * 60 * 1000, '[Auto-Mod] Langage inapproprié (2e avertissement)').catch(() => {});

        await message.channel.send({
          content: `🔇 ${message.author} a été **mute 10 minutes** pour langage inapproprié répété.`,
          allowedMentions: { users: [message.author.id] }
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

        setTimeout(() => this.warningsCache.delete(key), 10 * 60 * 1000);

        logger.info(`[Bad Words] Muted ${message.author.tag} for 10 minutes (word: ${detection.word})`);
      }

      await this.logAction(message.guild!.id, {
        type: 'bad_word_detected',
        user_id: message.author.id,
        word: detection.word || 'unknown',
        severity: detection.severity || 'unknown',
        warnings: warnings + 1,
        timestamp: Date.now()
      });

      await this.logToChannel(message.guild!, {
        color: warnings === 0 ? 0xffa500 : 0xff0000,
        title: '🤬 Langage inapproprié détecté',
        description:
          `**Utilisateur:** ${message.author.tag} (${message.author.id})\n` +
          `**Salon:** ${message.channel}\n` +
          `**Mot détecté:** ||${detection.word}||\n` +
          `**Sévérité:** ${detection.severity}\n` +
          `**Avertissement:** ${warnings + 1}/2\n` +
          `**Action:** ${warnings === 0 ? 'Avertissement' : 'Mute 10 minutes'}`,
        fields: [
          { name: 'Message original', value: message.content.substring(0, 1000) || 'Vide', inline: false }
        ]
      });
    } catch (error) {
      logger.error('[Bad Words] Error handling:', error);
    }
  }

  /**
   * Détecte les floods globaux (10+ messages en 5s)
   */
  private async checkGlobalFlood(message: Message, now: number): Promise<boolean> {
    const channelKey = `${message.guild!.id}-${message.channel.id}`;

    if (!this.globalMessageCache.has(channelKey)) {
      this.globalMessageCache.set(channelKey, []);
    }

    const channelMessages = this.globalMessageCache.get(channelKey)!;
    channelMessages.push({
      userId: message.author.id,
      guildId: message.guild!.id,
      messageCount: 1,
      timestamp: now,
      isBot: message.author.bot,
      messageIds: [message.id]
    });

    const recentMessages = channelMessages.filter(m => now - m.timestamp < 5000);
    this.globalMessageCache.set(channelKey, recentMessages);

    if (recentMessages.length >= 10) {
      const botCount = recentMessages.filter(m => m.isBot).length;
      const humanCount = recentMessages.filter(m => !m.isBot).length;
      const isMostlyBots = botCount >= 8;

      logger.info(`[Global Flood] Detected in ${(message.channel as TextChannel).name} (${recentMessages.length} msg, ${botCount} bots, ${humanCount} humans)`);

      const messageIds = recentMessages.flatMap(m => m.messageIds);
      const deletedCount = await this.bulkDeleteMessages(message.channel as TextChannel, messageIds);

      logger.info(`[Global Flood] Deleted ${deletedCount} messages`);

      if (!isMostlyBots && humanCount > 0) {
        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🚨 Flood détecté')
            .setDescription(`**${deletedCount} messages** supprimés pour flood massif.\n\n⚠️ Ralentissez le débit de messages !`)
            .setTimestamp()
            .setFooter({ text: 'Wolaro Auto-Moderation' })]
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
      }

      // Sanctionner les humains
      const uniqueHumans = [...new Set(recentMessages.filter(m => !m.isBot).map(m => m.userId))];
      for (const authorId of uniqueHumans) {
        try {
          const member = await message.guild!.members.fetch(authorId).catch(() => null);
          if (member && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            const key = `${authorId}-${message.guild!.id}`;
            const sanctions = (this.floodSanctions.get(key) || 0) + 1;
            this.floodSanctions.set(key, sanctions);

            if (sanctions === 1) {
              await member.timeout(10 * 60 * 1000, '[Auto-Mod] Participation à un flood').catch(() => {});
              await this.updateReputation(message.guild!.id, authorId, -25);
            } else if (sanctions === 2) {
              await member.timeout(60 * 60 * 1000, '[Auto-Mod] Flood répété').catch(() => {});
              await this.updateReputation(message.guild!.id, authorId, -40);
            } else {
              await member.kick('[Auto-Mod] Flood répété (3e fois)').catch(() => {});
              await this.updateReputation(message.guild!.id, authorId, -60);
            }

            setTimeout(() => this.floodSanctions.delete(key), 2 * 60 * 60 * 1000);
          }
        } catch (e) {
          logger.error('[Global Flood] Sanction error:', e);
        }
      }

      await this.logToChannel(message.guild!, {
        color: isMostlyBots ? 0xff6600 : 0xff0000,
        title: isMostlyBots ? '⚠️ Flood massif de bots supprimé' : '🚨 Flood massif détecté',
        description:
          `**Salon:** ${message.channel}\n` +
          `**Messages supprimés:** ${deletedCount}\n` +
          `**Bots/Webhooks:** ${botCount}\n` +
          `**Utilisateurs:** ${humanCount}\n\n`,
        fields: uniqueHumans.length > 0 ? [
          { name: 'Utilisateurs sanctionnés', value: uniqueHumans.map(id => `<@${id}>`).join(', ') || 'Aucun', inline: false }
        ] : []
      });

      this.globalMessageCache.delete(channelKey);

      await this.logAction(message.guild!.id, {
        type: 'global_flood_detected',
        channel_id: message.channel.id,
        messages_count: deletedCount,
        bot_count: botCount,
        human_count: humanCount,
        timestamp: now
      });

      return true;
    }

    return false;
  }

  /**
   * Supprime massivement des messages
   */
  private async bulkDeleteMessages(channel: TextChannel, messageIds: string[]): Promise<number> {
    let deletedCount = 0;

    const chunks: string[][] = [];
    for (let i = 0; i < messageIds.length; i += 100) {
      chunks.push(messageIds.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        if (chunk.length > 1) {
          await channel.bulkDelete(chunk, true).catch(async () => {
            for (const id of chunk) {
              try {
                const msg = await channel.messages.fetch(id).catch(() => null);
                if (msg) {
                  await msg.delete().catch(() => {});
                  deletedCount++;
                }
              } catch {}
            }
          });
          deletedCount += chunk.length;
        } else if (chunk.length === 1) {
          const msg = await channel.messages.fetch(chunk[0]).catch(() => null);
          if (msg) {
            await msg.delete().catch(() => {});
            deletedCount++;
          }
        }
      } catch (error) {
        logger.error('[Bulk Delete] Error:', error);
      }
    }

    return deletedCount;
  }

  /**
   * Vérifie le spam classique (utilisateurs normaux)
   */
  private async checkRegularSpam(message: Message, key: string, now: number, settings: ModerationConfig): Promise<boolean> {
    if (!this.messageCache.has(key)) {
      this.messageCache.set(key, []);
    }

    const messages = this.messageCache.get(key)!;
    messages.push({ content: message.content, timestamp: now, id: message.id });

    const recentMessages = messages.filter(m => now - m.timestamp < 10000).slice(-10);
    this.messageCache.set(key, recentMessages);

    const thresholds: Record<string, { messages: number; time: number }> = {
      low: { messages: 8, time: 5000 },
      medium: { messages: 6, time: 5000 },
      high: { messages: 5, time: 5000 },
      extreme: { messages: 4, time: 5000 }
    };

    const threshold = thresholds[settings.antispam_level] || thresholds.medium;
    const recentInWindow = recentMessages.filter(m => now - m.timestamp < threshold.time);

    if (recentInWindow.length >= threshold.messages) {
      logger.info(`[Anti-Spam] Detected from ${message.author.tag} (${recentInWindow.length} messages)`);

      for (const msg of recentInWindow) {
        try {
          const toDelete = await message.channel.messages.fetch(msg.id).catch(() => null);
          if (toDelete) await toDelete.delete().catch(() => {});
        } catch {}
      }

      if (message.member) {
        await message.member.timeout(5 * 60 * 1000, '[Auto-Mod] Spam détecté').catch(() => {});
      }

      await this.updateReputation(message.guild!.id, message.author.id, -20);

      await message.channel.send({
        content: `🔇 ${message.author} a été **mute 5 minutes** pour spam.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

      this.messageCache.delete(key);
      return true;
    }

    return false;
  }

  /**
   * Log vers le salon #logs de la guild
   */
  private async logToChannel(guild: any, embedData: { color: number; title: string; description: string; fields?: { name: string; value: string; inline?: boolean }[] }): Promise<void> {
    try {
      const logChannel = guild.channels.cache.find((c: any) =>
        c.name.includes('log') || c.name.includes('mod')
      );

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(embedData.color)
            .setTitle(embedData.title)
            .setDescription(embedData.description)
            .addFields(embedData.fields || [])
            .setTimestamp()
            .setFooter({ text: 'Wolaro Auto-Moderation' })]
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('[Log to channel] Error:', error);
    }
  }

  /**
   * Log une action dans PostgreSQL
   */
  private async logAction(guildId: string, data: any): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO moderation_logs (guild_id, type, user_id, data, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [guildId, data.type, data.user_id, JSON.stringify(data), new Date()]
      );
    } catch (error) {
      logger.error('[LogAction] Error:', error);
    }
  }

  /**
   * Met à jour la réputation d'un utilisateur
   */
  private async updateReputation(guildId: string, userId: string, change: number): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO user_reputation (guild_id, user_id, reputation) VALUES ($1, $2, $3) ON CONFLICT (guild_id, user_id) DO UPDATE SET reputation = user_reputation.reputation + $3',
        [guildId, userId, change]
      );
    } catch (error) {
      logger.error('[UpdateReputation] Error:', error);
    }
  }

  /**
   * Nettoie les caches expirés
   */
  clearCache(): void {
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

    for (const [key] of this.botSpamCache.entries()) {
      this.botSpamCache.delete(key);
    }
  }
}

export default new AutoAntiSpam();
