/**
 * Bad Words Filter - Migrated from TheoProtect badWords.js
 * Détection intelligente de langage inapproprié avec whitelist
 */

import type { BadWordDetectionResult } from '../types';

export class BadWordsFilter {
  private frenchWords: string[];
  private englishWords: string[];
  private patterns: RegExp[];
  private whitelist: string[];

  constructor() {
    // French bad words (complete list from TheoProtect)
    this.frenchWords = [
      'con', 'cons', 'connard', 'connards', 'connarde', 'connardes', 'connasse', 'connasses',
      'salope', 'salopes', 'salopard', 'salopards', 'saloperie', 'saloperies',
      'pute', 'putes', 'putain', 'putains',
      'enculé', 'enculée', 'enculés', 'enculées', 'encule', 'enculer',
      'pd', 'pédé', 'pédés', 'pede', 'pedes', 'tapette', 'tapettes', 'tafiole', 'tafioles',
      'enfoiré', 'enfoirés', 'enfoirée', 'enfoirées',
      'batard', 'batards', 'batarde', 'batardes', 'bâtard', 'bâtards',
      'fdp', 'ntm', 'tg', 'ftg', 'ntr',
      'fils de pute', 'nique ta mère', 'nique ta race', 'ferme ta gueule', 'ta gueule',
      'nique', 'niquer', 'niker',
      'salaud', 'salauds', 'salop', 'salops',
      'merde', 'merdes', 'chier', 'chieur', 'chieuse',
      'bite', 'bites', 'couille', 'couilles', 'cul', 'culs', 'chatte', 'chattes'
    ];

    // English bad words
    this.englishWords = [
      'fuck', 'fucking', 'fucker', 'fuckers', 'fucked', 'fck', 'fuk', 'fking',
      'shit', 'shits', 'bullshit', 'bitch', 'bitches', 'bastard', 'bastards',
      'asshole', 'assholes', 'ass', 'dick', 'cock', 'pussy', 'cunt',
      'whore', 'slut', 'motherfucker', 'damn', 'dammit',
      'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'queer',
      'retard', 'retarded', 'kys', 'kill yourself'
    ];

    // Regex patterns for variations
    this.patterns = [
      /\bn+[i1!]+[gq]+[e3]+r+s?\b/gi,
      /\bf+[u*@]+[c*]+k+[si]*(ng|er|ed)?\b/gi,
      /\bb+[i1!]+t+[c*]+h+[es]*\b/gi,
      /\b[s5]+[h]+[i1!]+t+[sy]?\b/gi,
      /\bp+[u*]+t+[e3a@4]+s?\b/gi
    ];

    // Whitelist (false positives)
    this.whitelist = [
      'balcon', 'bacon', 'contenu', 'container', 'contrat', 'contre',
      'concours', 'conclusion', 'concret', 'condition', 'conduire',
      'confiance', 'confirmer', 'conflit', 'confort', 'confusion',
      'connaissance', 'connexion', 'conquête', 'conscience', 'conseil',
      'conséquence', 'conservation', 'considérer', 'consigne', 'consolider',
      'consommateur', 'conspiration', 'constater', 'constellation',
      'constitution', 'construction', 'consulter', 'consumer', 'contagieux',
      'contaminer', 'contempler', 'contemporain', 'content', 'contest',
      'concombre', 'class', 'pass', 'glass', 'grass', 'mass', 'assignment',
      'passion', 'compassion', 'discussion', 'assessment', 'assistance',
      'update', 'contain', 'contract', 'control', 'contribute', 'continue',
      'contact', 'context', 'connect'
    ];
  }

  /**
   * Check if message contains bad words
   */
  containsBadWords(message: string): BadWordDetectionResult {
    const normalized = this.normalizeText(message);
    const words = normalized.split(' ');

    // Check individual words
    for (const word of words) {
      if (this.whitelist.some(w => w.toLowerCase() === word)) continue;

      // Check exact matches
      for (const badWord of [...this.frenchWords, ...this.englishWords]) {
        if (word === badWord) {
          return {
            detected: true,
            word: badWord,
            language: this.frenchWords.includes(badWord) ? 'fr' : 'en',
            severity: this.getSeverity(badWord)
          };
        }
      }
    }

    // Check multi-word expressions
    for (const badWord of [...this.frenchWords, ...this.englishWords]) {
      if (badWord.includes(' ') && normalized.includes(badWord)) {
        if (!this.whitelist.some(w => normalized.includes(w.toLowerCase()))) {
          return {
            detected: true,
            word: badWord,
            language: this.frenchWords.includes(badWord) ? 'fr' : 'en',
            severity: this.getSeverity(badWord)
          };
        }
      }
    }

    // Check patterns
    for (const pattern of this.patterns) {
      const match = message.match(pattern);
      if (match) {
        const matchedWord = match[0].toLowerCase();
        if (!this.whitelist.some(w => matchedWord.includes(w.toLowerCase()))) {
          return {
            detected: true,
            word: match[0],
            language: 'pattern',
            severity: 'high'
          };
        }
      }
    }

    return { detected: false };
  }

  /**
   * Normalize text for detection
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-zàâäéèêëïîôùûüÿæœç0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get severity level
   */
  private getSeverity(word: string): 'low' | 'medium' | 'high' {
    const highSeverity = [
      'nigger', 'faggot', 'cunt', 'motherfucker', 'négro', 'youpin',
      'nique ta mère', 'fils de pute', 'kill yourself'
    ];

    const mediumSeverity = [
      'fuck', 'shit', 'bitch', 'asshole', 'connard', 'salope', 'enculé', 'pute', 'con'
    ];

    if (highSeverity.some(w => word.includes(w))) return 'high';
    if (mediumSeverity.some(w => word.includes(w))) return 'medium';
    return 'low';
  }
}
