/**
 * Captcha System for Anti-Raid
 * Génération de captcha visuel pour vérification humaine
 */

import { GuildMember, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { createCanvas } from 'canvas';
import { logger } from '../../../../utils/logger';
import { ProtectionDB } from '../database';
import type { CaptchaSession } from '../types';

export class CaptchaSystem {
  private sessions = new Map<string, CaptchaSession>();
  private db: ProtectionDB;

  constructor(db: ProtectionDB) {
    this.db = db;
    
    // Cleanup expired sessions every 60s
    setInterval(() => this.cleanupExpiredSessions(), 60000);
  }

  /**
   * Send captcha challenge to member via DM
   */
  async sendCaptcha(member: GuildMember): Promise<void> {
    try {
      // Generate captcha code
      const code = this.generateCode();
      const imageBuffer = await this.generateCaptchaImage(code);

      // Create session
      const session: CaptchaSession = {
        guild_id: member.guild.id,
        user_id: member.id,
        code,
        image_buffer: imageBuffer,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        attempts: 0
      };

      this.sessions.set(`${member.guild.id}-${member.id}`, session);

      // Send DM
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'captcha.png' });
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🔐 Vérification Anti-Raid')
        .setDescription(
          `Bienvenue sur **${member.guild.name}** !\n\n` +
          `Pour des raisons de sécurité, veuillez entrer le code ci-dessous.\n\n` +
          `**Instructions :**\n` +
          `• Envoyez le code visible dans l'image\n` +
          `• Vous avez **5 minutes** et **3 tentatives**\n` +
          `• Le code contient 6 caractères (majuscules)\n\n` +
          `⚠️ Si vous échouez, vous serez automatiquement expulsé du serveur.`
        )
        .setImage('attachment://captcha.png')
        .setFooter({ text: 'Wolaro Protection System' })
        .setTimestamp();

      await member.send({ embeds: [embed], files: [attachment] });

      logger.info(`[Captcha] Sent to ${member.user.tag} in ${member.guild.name}`);

      // Auto-kick after 5 minutes if not verified
      setTimeout(async () => {
        if (this.sessions.has(`${member.guild.id}-${member.id}`)) {
          await this.handleCaptchaTimeout(member);
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      logger.error('[Captcha] Error sending:', error);
      // If DM fails, kick member
      await member.kick('Captcha DM failed').catch(() => {});
    }
  }

  /**
   * Verify captcha code
   */
  async verifyCaptcha(member: GuildMember, code: string): Promise<boolean> {
    const sessionKey = `${member.guild.id}-${member.id}`;
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return false;
    }

    session.attempts++;

    if (code.toUpperCase() === session.code) {
      // Success!
      this.sessions.delete(sessionKey);

      // Add verified role
      const verifiedRole = member.guild.roles.cache.find(r => r.name === 'Vérifié');
      if (verifiedRole) {
        await member.roles.add(verifiedRole).catch(() => {});
      }

      await member.send({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Vérification réussie',
          description: `Bienvenue sur **${member.guild.name}** ! Vous avez maintenant accès au serveur.`
        }]
      }).catch(() => {});

      await this.db.logAction({
        guild_id: member.guild.id,
        user_id: member.id,
        type: 'captcha_passed',
        action: 'none',
        reason: 'Captcha vérifié avec succès',
        details: { attempts: session.attempts }
      });

      logger.info(`[Captcha] ✅ ${member.user.tag} verified`);
      return true;
    }

    // Wrong code
    if (session.attempts >= 3) {
      // Max attempts reached
      this.sessions.delete(sessionKey);
      await this.handleCaptchaFailure(member, 'Trop de tentatives échouées');
      return false;
    }

    // Allow retry
    await member.send({
      embeds: [{
        color: 0xff0000,
        title: '❌ Code incorrect',
        description: `Tentative ${session.attempts}/3. Réessayez.`
      }]
    }).catch(() => {});

    return false;
  }

  /**
   * Handle captcha timeout
   */
  private async handleCaptchaTimeout(member: GuildMember): Promise<void> {
    const sessionKey = `${member.guild.id}-${member.id}`;
    this.sessions.delete(sessionKey);

    try {
      await member.send({
        embeds: [{
          color: 0xff0000,
          title: '⏱️ Temps écoulé',
          description: 'Vous n\'avez pas vérifié le captcha à temps. Vous avez été expulsé du serveur.'
        }]
      }).catch(() => {});

      await member.kick('Captcha timeout');

      await this.db.logAction({
        guild_id: member.guild.id,
        user_id: member.id,
        type: 'captcha_failed',
        action: 'kick',
        reason: 'Timeout captcha (5 minutes)',
        details: {}
      });

      logger.info(`[Captcha] ⏱️ ${member.user.tag} kicked (timeout)`);
    } catch (error) {
      logger.error('[Captcha] Error handling timeout:', error);
    }
  }

  /**
   * Handle captcha failure
   */
  private async handleCaptchaFailure(member: GuildMember, reason: string): Promise<void> {
    try {
      await member.send({
        embeds: [{
          color: 0xff0000,
          title: '❌ Vérification échouée',
          description: `${reason}. Vous avez été expulsé du serveur.`
        }]
      }).catch(() => {});

      await member.kick(reason);

      await this.db.logAction({
        guild_id: member.guild.id,
        user_id: member.id,
        type: 'captcha_failed',
        action: 'kick',
        reason,
        details: {}
      });

      logger.info(`[Captcha] ❌ ${member.user.tag} kicked (${reason})`);
    } catch (error) {
      logger.error('[Captcha] Error handling failure:', error);
    }
  }

  /**
   * Generate random 6-character code
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (I, O, 0, 1)
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate captcha image with distortion
   */
  private async generateCaptchaImage(code: string): Promise<Buffer> {
    const width = 300;
    const height = 100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Add noise lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = this.randomColor();
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    // Add noise dots
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = this.randomColor();
      ctx.fillRect(
        Math.random() * width,
        Math.random() * height,
        2,
        2
      );
    }

    // Draw code with distortion
    ctx.font = 'bold 48px Arial';
    const spacing = width / (code.length + 1);

    for (let i = 0; i < code.length; i++) {
      ctx.save();

      const x = spacing * (i + 1);
      const y = height / 2 + (Math.random() - 0.5) * 20;

      // Random rotation
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.4);

      // Random color
      ctx.fillStyle = this.randomColor();
      ctx.fillText(code[i], 0, 0);

      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * Generate random color
   */
  private randomColor(): string {
    const r = Math.floor(Math.random() * 150);
    const g = Math.floor(Math.random() * 150);
    const b = Math.floor(Math.random() * 150);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [key, session] of this.sessions.entries()) {
      if (session.expires_at < now) {
        this.sessions.delete(key);
      }
    }
  }

  /**
   * Get active session for member
   */
  getSession(guildId: string, userId: string): CaptchaSession | undefined {
    return this.sessions.get(`${guildId}-${userId}`);
  }
}
