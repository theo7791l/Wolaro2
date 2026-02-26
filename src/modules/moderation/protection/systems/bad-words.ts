/**
 * Bad Words System - Version corrigée avec liste réelle
 */

import { Message } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';
import type { BadWordDetectionResult } from '../types';

export class BadWordsSystem {
  // Liste de mots interdits (français)
  private badWords = [
    // Insultes graves
    'connard', 'connasse', 'salope', 'pute', 'putain',
    'enculer', 'enculé', 'enfoiré', 'fdp', 'ntm',
    'pd', 'tapette', 'tantouze', 'pédé',
    'batard', 'bâtard', 'fils de pute',
    
    // Racisme et discrimination
    'négro', 'nègre', 'bamboula', 'bougnoule',
    'raton', 'youpin', 'feuj',
    
    // Autres insultes
    'con', 'conne', 'débile', 'crétin', 'idiot',
    'abruti', 'imbécile', 'taré', 'attardé',
    
    // Vulgarités sexuelles
    'bite', 'couille', 'chatte', 'cul', 'foutre',
    'branler', 'sucer', 'niquer', 'baiser',
    
    // Variations anglaises communes
    'fuck', 'shit', 'bitch', 'ass', 'dick',
    'pussy', 'cock', 'nigga', 'nigger', 'fag',
  ];

  constructor(private db: ProtectionDatabase) {}

  /**
   * Vérifie si le message contient des mots interdits
   * Détection par mots entiers uniquement (pas de sous-chaînes)
   */
  async check(message: Message): Promise<BadWordDetectionResult> {
    if (!message.guild) {
      return { detected: false, words: [], severity: 'low' };
    }

    const config = await this.db.getConfig(message.guild.id);
    if (!config.badwords_enabled) {
      return { detected: false, words: [], severity: 'low' };
    }

    const content = message.content.toLowerCase();
    
    // Découper le message en mots (séparer par espaces, ponctuation, etc.)
    const words = content
      .split(/[\s,.!?;:()\[\]{}"'`]+/)
      .filter(w => w.length > 0);
    
    // Chercher les mots interdits (match exact uniquement)
    const detectedWords: string[] = [];
    
    for (const word of words) {
      // Normaliser les caractères spéciaux courants (leet speak basique)
      const normalized = word
        .replace(/[0@]/g, 'o')
        .replace(/[1!i]/g, 'i')
        .replace(/[3]/g, 'e')
        .replace(/[4]/g, 'a')
        .replace(/[5]/g, 's')
        .replace(/[7]/g, 't');
      
      // Vérifier si le mot normalisé correspond à un mot interdit
      if (this.badWords.some(badWord => {
        const normalizedBadWord = badWord.toLowerCase();
        return normalized === normalizedBadWord || 
               word === normalizedBadWord ||
               // Permettre les variations avec accents
               this.removeDiacritics(normalized) === this.removeDiacritics(normalizedBadWord);
      })) {
        detectedWords.push(word);
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
      await message.delete();
      await this.db.incrementStat(message.guild!.id, 'badwords_filtered');

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
