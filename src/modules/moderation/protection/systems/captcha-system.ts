/**
 * Captcha System - Version avec fallback si canvas non disponible
 * Compatible hébergement sans canvas
 */

import { GuildMember, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../../../utils/logger';

let Canvas: any = null;
try {
  Canvas = require('canvas');
  logger.info('✅ Canvas module loaded - Captcha images enabled');
} catch (error) {
  logger.warn('⚠️ Canvas not available - Using text-based captcha fallback');
}

export class CaptchaSystem {
  private pendingCaptchas = new Map<string, {
    code: string;
    attempts: number;
    expiresAt: number;
  }>();

  private readonly CAPTCHA_LENGTH = 6;
  private readonly MAX_ATTEMPTS = 3;
  private readonly TIMEOUT = 300000; // 5 minutes
  private readonly CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /**
   * Generate random captcha code
   */
  private generateCode(): string {
    let code = '';
    for (let i = 0; i < this.CAPTCHA_LENGTH; i++) {
      code += this.CHARACTERS.charAt(
        Math.floor(Math.random() * this.CHARACTERS.length)
      );
    }
    return code;
  }

  /**
   * Create captcha image (if canvas available)
   */
  private async createCaptchaImage(code: string): Promise<Buffer | null> {
    if (!Canvas) return null;

    try {
      const canvas = Canvas.createCanvas(300, 100);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#2C2F33';
      ctx.fillRect(0, 0, 300, 100);

      // Add noise
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
        ctx.fillRect(
          Math.random() * 300,
          Math.random() * 100,
          2,
          2
        );
      }

      // Text
      ctx.font = 'bold 48px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Distortion
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
      const expiresAt = Date.now() + this.TIMEOUT;

      this.pendingCaptchas.set(member.id, {
        code,
        attempts: 0,
        expiresAt
      });

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

      // Try to create image if canvas available
      const imageBuffer = await this.createCaptchaImage(code);

      if (imageBuffer) {
        // Send with image
        const attachment = new AttachmentBuilder(imageBuffer, {
          name: 'captcha.png'
        });
        embed.setImage('attachment://captcha.png');
        await member.send({ embeds: [embed], files: [attachment] });
      } else {
        // Fallback: text-based captcha
        embed.addFields({
          name: '📝 Code Captcha',
          value: `\`\`\`\n${code}\`\`\``,
          inline: false
        });
        embed.setDescription(
          embed.data.description +
          '\n\n⚠️ **Recopiez exactement le code ci-dessous**'
        );
        await member.send({ embeds: [embed] });
      }

      // Set timeout to kick if not verified
      setTimeout(async () => {
        if (this.pendingCaptchas.has(member.id)) {
          this.pendingCaptchas.delete(member.id);
          try {
            await member.kick('Captcha non complété dans les temps');
            logger.info(`Kicked ${member.user.tag} for captcha timeout`);
          } catch (error) {
            logger.error('Error kicking member for timeout:', error);
          }
        }
      }, this.TIMEOUT);

      return true;
    } catch (error) {
      logger.error('Error sending captcha:', error);
      // Don't kick member if we can't send DM
      this.pendingCaptchas.delete(member.id);
      return false;
    }
  }

  /**
   * Verify captcha response
   */
  async verifyCaptcha(
    memberId: string,
    response: string
  ): Promise<{ success: boolean; message: string }> {
    const captcha = this.pendingCaptchas.get(memberId);

    if (!captcha) {
      return {
        success: false,
        message: '❌ Aucun captcha en attente ou expiré'
      };
    }

    if (Date.now() > captcha.expiresAt) {
      this.pendingCaptchas.delete(memberId);
      return {
        success: false,
        message: '⏱️ Le captcha a expiré'
      };
    }

    if (response.toUpperCase() === captcha.code) {
      this.pendingCaptchas.delete(memberId);
      return {
        success: true,
        message: '✅ Captcha vérifié avec succès !'
      };
    }

    captcha.attempts++;

    if (captcha.attempts >= this.MAX_ATTEMPTS) {
      this.pendingCaptchas.delete(memberId);
      return {
        success: false,
        message: `❌ Trop de tentatives échouées (${this.MAX_ATTEMPTS}/${this.MAX_ATTEMPTS})`
      };
    }

    return {
      success: false,
      message: `❌ Code incorrect. Tentatives restantes: ${this.MAX_ATTEMPTS - captcha.attempts}/${this.MAX_ATTEMPTS}`
    };
  }

  /**
   * Check if member has pending captcha
   */
  hasPendingCaptcha(memberId: string): boolean {
    return this.pendingCaptchas.has(memberId);
  }

  /**
   * Cancel captcha
   */
  cancelCaptcha(memberId: string): void {
    this.pendingCaptchas.delete(memberId);
  }
}
