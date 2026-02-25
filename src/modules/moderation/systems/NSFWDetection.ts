import { Message, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import logger from '../../../utils/logger';

/**
 * Système de détection NSFW pour les images/vidéos
 * Utilise une API externe (ex: Sightengine, AWS Rekognition, etc.)
 */
export class NSFWDetectionSystem {
  private cache = new Map<string, { isNSFW: boolean; confidence: number; timestamp: number }>();
  private readonly cacheTimeout = 3600000; // 1 heure

  /**
   * Analyse une image pour détecter du contenu NSFW
   * NOTE: Vous devez configurer une API externe (Sightengine recommandé)
   */
  private async analyzeImage(url: string): Promise<{ isNSFW: boolean; confidence: number; categories?: string[] } | null> {
    // Vérifier le cache
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return { isNSFW: cached.isNSFW, confidence: cached.confidence };
    }

    const apiKey = process.env.SIGHTENGINE_API_KEY;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.warn('[NSFW Detection] API keys not configured');
      return null;
    }

    try {
      const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
        params: {
          url,
          models: 'nudity-2.0,offensive',
          api_user: apiKey,
          api_secret: apiSecret
        },
        timeout: 10000
      });

      const data = response.data;

      // Analyser les résultats
      const nudityScore = data.nudity?.sexual_activity || 0;
      const offensiveScore = data.offensive?.prob || 0;

      const maxScore = Math.max(nudityScore, offensiveScore);
      const isNSFW = maxScore > 0.6; // Seuil : 60%

      const categories: string[] = [];
      if (nudityScore > 0.6) categories.push('Nudity');
      if (offensiveScore > 0.6) categories.push('Offensive');

      // Mettre en cache
      this.cache.set(url, {
        isNSFW,
        confidence: maxScore,
        timestamp: Date.now()
      });

      return { isNSFW, confidence: maxScore, categories };
    } catch (error) {
      logger.error('[NSFW Detection] API error:', error);
      return null;
    }
  }

  /**
   * Vérifie un message pour du contenu NSFW
   */
  async checkMessage(message: Message): Promise<{ isNSFW: boolean; attachments: { url: string; confidence: number; categories?: string[] }[] }> {
    if (message.attachments.size === 0) {
      return { isNSFW: false, attachments: [] };
    }

    const results: { url: string; confidence: number; categories?: string[] }[] = [];

    for (const [, attachment] of message.attachments) {
      // Vérifier uniquement images et vidéos
      if (!attachment.contentType?.startsWith('image/') && !attachment.contentType?.startsWith('video/')) {
        continue;
      }

      const analysis = await this.analyzeImage(attachment.url);
      if (analysis && analysis.isNSFW) {
        results.push({
          url: attachment.url,
          confidence: analysis.confidence,
          categories: analysis.categories
        });
      }
    }

    return {
      isNSFW: results.length > 0,
      attachments: results
    };
  }

  /**
   * Exécute une action suite à une détection NSFW
   */
  async executeAction(message: Message, detection: { attachments: { url: string; confidence: number; categories?: string[] }[] }): Promise<void> {
    try {
      // Supprimer le message
      await message.delete();

      const maxConfidence = Math.max(...detection.attachments.map(a => a.confidence));
      const allCategories = [...new Set(detection.attachments.flatMap(a => a.categories || []))];

      // Déterminer l'action
      if (maxConfidence > 0.9) {
        // Confiance très élevée : ban
        await message.member?.ban({ reason: '[Auto-Mod] Contenu NSFW explicite détecté', deleteMessageSeconds: 86400 });

        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🔨 Contenu NSFW détecté')
            .setDescription(
              `${message.author.tag} a été **banni** pour partage de contenu NSFW explicite.\n\n` +
              `**Catégories détectées:** ${allCategories.join(', ')}\n` +
              `**Confiance:** ${(maxConfidence * 100).toFixed(1)}%`
            )]
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
      } else if (maxConfidence > 0.7) {
        // Confiance élevée : mute
        await message.member?.timeout(60 * 60 * 1000, '[Auto-Mod] Contenu NSFW détecté');

        await message.channel.send({
          content: `🔇 ${message.author} a été **mute 1 heure** pour contenu inapproprié.`,
          allowedMentions: { users: [message.author.id] }
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      } else {
        // Confiance moyenne : avertissement
        await message.channel.send({
          content: `⚠️ ${message.author}, votre message a été supprimé pour contenu potentiellement inapproprié.`,
          allowedMentions: { users: [message.author.id] }
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      }

      logger.info(`[NSFW Detection] Action taken for ${message.author.tag} (confidence: ${maxConfidence})`);
    } catch (error) {
      logger.error('[NSFW Detection] Execute action error:', error);
    }
  }

  /**
   * Nettoie le cache expiré
   */
  clearCache(): void {
    const now = Date.now();
    for (const [url, data] of this.cache.entries()) {
      if (now - data.timestamp > this.cacheTimeout) {
        this.cache.delete(url);
      }
    }
  }
}

export default new NSFWDetectionSystem();
