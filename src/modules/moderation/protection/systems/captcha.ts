/**
 * Captcha System - Fixed imports
 */

import { GuildMember, AttachmentBuilder, EmbedBuilder, Guild, Message } from 'discord.js';
import { ProtectionDatabase } from '../database';
import { logger } from '../../../../utils/logger';
import type { CaptchaSession } from '../types';

// Try to import canvas, fallback gracefully
let createCanvas: any = null;
try {
  const canvasModule = require('canvas');
  createCanvas = canvasModule.createCanvas;
  logger.info('✅ Canvas module loaded - Image captcha enabled');
} catch (error) {
  logger.warn('⚠️ Canvas not available - Using text-based captcha');
}

export class CaptchaSystem {
  private pendingSessions = new Map<string, CaptchaSession>();
  private readonly CAPTCHA_LENGTH = 6;
  private readonly MAX_ATTEMPTS = 3;
  private readonly TIMEOUT = 300000; // 5 minutes

  constructor(private db: ProtectionDatabase) {}

  /**
   * Generate captcha code
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < this.CAPTCHA_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create captcha image if canvas available
   */
  private async createCaptchaImage(code: string): Promise<Buffer | null> {
    if (!createCanvas) return null;

    try {
      const canvas = createCanvas(300, 100);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#2C2F33';
      ctx.fillRect(0, 0, 300, 100);

      // Noise
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
        ctx.fillRect(Math.random() * 300, Math.random() * 100, 2, 2);
      }

      // Text with distortion
      ctx.font = 'bold 48px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < code.length; i++) {
        ctx.save();
        const x = 50 + i * 40;
        const y = 50 + (Math.random() - 0.5) * 20;
        const angle = (Math.random() - 0.5) * 0.4;
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(code[i], 0, 0);
        ctx.restore();
      }

      return canvas.toBuffer('image/png');
    } catch (error) {
      logger.error('Error creating captcha image:', error);
      return null;
    }
  }

  /**
   * Send captcha to member
   */
  async sendCaptcha(member: GuildMember): Promise<boolean> {
    try {
      const code = this.generateCode();
      const session: CaptchaSession = {
        member_id: member.id,
        guild_id: member.guild.id,
        code,
        attempts: 0,
        expires_at: new Date(Date.now() + this.TIMEOUT),
      };

      this.pendingSessions.set(member.id, session);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🔐 Vérification Captcha')
        .setDescription(
          `Bienvenue sur **${member.guild.name}** !\n\n` +
          `Pour accéder au serveur, merci de répondre avec le code captcha.\n\n` +
          `⏱️ Temps restant: 5 minutes\n` +
          `🔄 Tentatives: ${this.MAX_ATTEMPTS}`
        )
        .setFooter({ text: 'Répondez dans ce message privé avec le code' })
        .setTimestamp();

      const imageBuffer = await this.createCaptchaImage(code);

      if (imageBuffer) {
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'captcha.png' });
        embed.setImage('attachment://captcha.png');
        await member.send({ embeds: [embed], files: [attachment] });
      } else {
        embed.addFields({
          name: '📝 Code Captcha',
          value: `\`\`\`\n${code}\`\`\``,
          inline: false,
        });
        await member.send({ embeds: [embed] });
      }

      setTimeout(async () => {
        if (this.pendingSessions.has(member.id)) {
          this.pendingSessions.delete(member.id);
          try {
            await member.kick('Captcha non complété');
          } catch (error) {
            logger.error('Error kicking for captcha timeout:', error);
          }
        }
      }, this.TIMEOUT);

      return true;
    } catch (error) {
      logger.error('Error sending captcha:', error);
      this.pendingSessions.delete(member.id);
      return false;
    }
  }

  /**
   * Verify captcha
   */
  verifyCaptcha(memberId: string, response: string): { success: boolean; message: string } {
    const session = this.pendingSessions.get(memberId);

    if (!session) {
      return { success: false, message: '❌ Aucun captcha en attente' };
    }

    if (Date.now() > session.expires_at.getTime()) {
      this.pendingSessions.delete(memberId);
      return { success: false, message: '⏱️ Captcha expiré' };
    }

    if (response.toUpperCase() === session.code) {
      this.pendingSessions.delete(memberId);
      return { success: true, message: '✅ Captcha vérifié !' };
    }

    session.attempts++;

    if (session.attempts >= this.MAX_ATTEMPTS) {
      this.pendingSessions.delete(memberId);
      return { success: false, message: '❌ Trop de tentatives' };
    }

    return {
      success: false,
      message: `❌ Code incorrect (${this.MAX_ATTEMPTS - session.attempts} restantes)`,
    };
  }

  hasPendingCaptcha(memberId: string): boolean {
    return this.pendingSessions.has(memberId);
  }
}
