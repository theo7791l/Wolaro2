import { GuildMember } from 'discord.js';
import { logger } from '../../../utils/logger';

// Canvas fallback
let createCanvas: any = null;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
} catch (e) {
  logger.warn('Canvas not available - text captcha only');
}

export class Captcha {
  async sendCaptcha(member: GuildMember): Promise<void> {
    try {
      const code = this.generateCode();
      await member.send(`Votre code captcha : \`${code}\``);
    } catch (error) {
      logger.error('Error sending captcha:', error);
    }
  }

  private generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
