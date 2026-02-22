import crypto from 'crypto';
import { config } from '../config';

/**
 * Master Admin Security Module
 * Provides god-mode access control for super administrators
 */
export class SecurityManager {
  /**
   * Check if a user is a Master Admin
   * Uses config.masterAdmins (top-level array of Discord user IDs)
   */
  static isMaster(userId: string): boolean {
    return config.masterAdmins.includes(userId);
  }

  /**
   * Check if IP is whitelisted for admin access
   * Falls back to allow-all if whitelist is empty
   */
  static isIPWhitelisted(ip: string): boolean {
    if (config.security.ipWhitelist.length === 0) return true;
    return config.security.ipWhitelist.includes(ip);
  }

  /**
   * Sanitize user input to prevent XSS/Injection attacks
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>"'&]/g, (char) => {
        const escapeMap: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
          '&': '&amp;',
        };
        return escapeMap[char] || char;
      })
      .trim();
  }

  /**
   * Validate Discord Snowflake ID
   */
  static isValidSnowflake(id: string): boolean {
    return /^\d{17,19}$/.test(id);
  }

  /**
   * Generate secure token
   */
  static generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify Discord interaction signature (ed25519)
   * FIX: utiliser DISCORD_PUBLIC_KEY depuis l'env (pas config.discord.clientSecret qui n'existe pas)
   * La clé publique Discord (ed25519) est disponible dans le portail Discord Developer
   */
  static verifySignature(signature: string, timestamp: string, body: string): boolean {
    try {
      const publicKey = process.env.DISCORD_PUBLIC_KEY;
      if (!publicKey) {
        return false;
      }
      const message = Buffer.from(timestamp + body);
      const sig = Buffer.from(signature, 'hex');
      const key = Buffer.from(publicKey, 'hex');
      return crypto.verify(
        null,
        message,
        { key, format: 'der', type: 'spki', dsaEncoding: 'ieee-p1363' } as any,
        sig
      );
    } catch {
      return false;
    }
  }

  /**
   * Check for suspicious patterns (basic anti-raid detection)
   */
  static detectSuspiciousPattern(text: string): boolean {
    const suspiciousPatterns = [
      /discord\.gg\/[a-zA-Z0-9]+/gi,
      /(http|https):\/\/[^\s]+/gi,
      /@everyone|@here/gi,
      /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g,
    ];
    return suspiciousPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Rate limit key generator
   */
  static getRateLimitKey(type: 'ip' | 'user' | 'guild', identifier: string): string {
    return `ratelimit:${type}:${identifier}`;
  }

  /**
   * Encrypt sensitive configuration data
   */
  static encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(config.api.jwtSecret, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive configuration data
   */
  static decrypt(encrypted: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(config.api.jwtSecret, 'salt', 32);
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

/**
 * Anti-Raid Detection System
 */
export class AntiRaidManager {
  private static joinSpikes = new Map<string, number[]>();
  private static messageSpikes = new Map<string, Map<string, number>>();

  /**
   * Track member join and detect spike
   */
  static trackJoin(guildId: string): { isSpike: boolean; joinCount: number } {
    const now = Date.now();
    const windowMs = 10000; // 10 seconds

    if (!this.joinSpikes.has(guildId)) {
      this.joinSpikes.set(guildId, []);
    }

    const joins = this.joinSpikes.get(guildId)!;
    joins.push(now);

    const recentJoins = joins.filter((time) => now - time < windowMs);
    this.joinSpikes.set(guildId, recentJoins);

    return {
      isSpike: recentJoins.length > 10,
      joinCount: recentJoins.length,
    };
  }

  /**
   * Track message spam per user
   */
  static trackMessage(guildId: string, userId: string): { isSpam: boolean; count: number } {
    const now = Date.now();
    const windowMs = 5000; // 5 seconds

    if (!this.messageSpikes.has(guildId)) {
      this.messageSpikes.set(guildId, new Map());
    }

    const guildMessages = this.messageSpikes.get(guildId)!;
    const userKey = `${userId}:${Math.floor(now / windowMs)}`;
    const count = (guildMessages.get(userKey) || 0) + 1;
    guildMessages.set(userKey, count);

    // Clean up old entries
    const currentWindow = Math.floor(now / windowMs);
    for (const [key] of guildMessages.entries()) {
      const keyWindow = parseInt(key.split(':')[1]);
      if (currentWindow - keyWindow > 2) {
        guildMessages.delete(key);
      }
    }

    return {
      isSpam: count > 5,
      count,
    };
  }
}
