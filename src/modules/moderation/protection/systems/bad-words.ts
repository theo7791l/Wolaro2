/**
 * Bad Words System - Avec support des mots personnalisés par serveur
 */

import { Message } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';
import type { BadWordDetectionResult } from '../types';

export class BadWordsSystem {
  // Liste par défaut - UNIQUEMENT les insultes graves et vulgarités EXPLICITES
  private defaultBadWords = [
    // Insultes graves en français
    'connard', 'connasse', 'salope', 'pute', 
    'enculé', 'encule', 'enculer', 'enfoiré', 
    'fdp', 'ntm', 'pd', 'tapette', 'pédé', 'pede',
    'batard', 'bâtard', 'fils de pute',
    
    // Racisme (strictement interdit)
    'négro', 'nègre', 'bamboula', 'bougnoule',
    'raton', 'youpin', 'feuj',
    
    // Insultes communes mais graves
    'abruti', 'imbécile', 'crétin', 'débile',
    
    // Vulgarités sexuelles explicites
    'bite', 'couille', 'couilles', 'chatte', 'cul',
    'branler', 'niquer', 'baiser',
    
    // Anglais (insultes graves uniquement)
    'fuck', 'shit', 'bitch', 'ass', 'dick',
    'pussy', 'cock', 'nigga', 'nigger', 'fag', 'faggot',
  ];

  constructor(private db: ProtectionDatabase) {}

  /**
   * Vérifie si le message contient des mots interdits
   * Combine la liste par défaut + les mots personnalisés du serveur
   */
  async check(message: Message): Promise<BadWordDetectionResult> {
    if (!message.guild) {
      return { detected: false, words: [], severity: 'low' };
    }

    const config = await this.db.getConfig(message.guild.id);
    if (!config.badwords_enabled) {
      return { detected: false, words: [], severity: 'low' };
    }

    // Combiner liste par défaut + mots personnalisés
    const customWords = config.badwords_custom_list || [];
    const allBadWords = [...this.defaultBadWords, ...customWords];

    const content = message.content.toLowerCase();
    
    // Découper le message en mots (séparer par espaces, ponctuation, etc.)
    const words = content
      .split(/[\s,.!?;:()\[\]{}"'`\-_=+*\/\\|<>~]+/)
      .filter(w => w.length > 0);
    
    // Chercher les mots interdits (match exact uniquement)
    const detectedWords: string[] = [];
    
    for (const word of words) {
      // Normaliser les caractères spéciaux courants (leet speak basique)
      const normalized = word
        .replace(/[0@]/g, 'o')
        .replace(/[1!i\|]/g, 'i')
        .replace(/[3]/g, 'e')
        .replace(/[4]/g, 'a')
        .replace(/[5\$]/g, 's')
        .replace(/[7]/g, 't')
        .replace(/[8]/g, 'b');
      
      // Vérifier si le mot normalisé correspond à un mot interdit
      for (const badWord of allBadWords) {
        const normalizedBadWord = badWord.toLowerCase();
        
        // Match exact ou avec accents retirés
        if (normalized === normalizedBadWord || 
            word === normalizedBadWord ||
            this.removeDiacritics(normalized) === this.removeDiacritics(normalizedBadWord)) {
          detectedWords.push(word);
          break;
        }
      }
    }

    if (detectedWords.length > 0) {
      return {
        detected: true,
        words: detectedWords,
        severity: detectedWords.length > 2 ? 'high' : 'medium',
      };
    }

    return { detected: false, words: [], severity: 'low' };
  }

  /**
   * Retire les accents d'une chaîne
   */
  private removeDiacritics(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  async handle(message: Message): Promise<void> {
    try {
      // Supprimer le message
      await message.delete();
      await this.db.incrementStat(message.guild!.id, 'badwords_filtered');

      // Envoyer un avertissement temporaire
      if (message.channel.isSendable()) {
        const reply = await message.channel.send({
          content: `⚠️ **${message.author}** Langage inapproprié détecté. Merci de respecter les règles du serveur.`,
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      }

      logger.info(`Bad word filtered in ${message.guild!.name} from ${message.author.tag}`);
    } catch (error) {
      logger.error('Error handling bad words:', error);
    }
  }
}

// Alias for compatibility
export { BadWordsSystem as BadWordsFilter };
