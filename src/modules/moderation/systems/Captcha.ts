import { GuildMember, AttachmentBuilder, EmbedBuilder, TextChannel } from 'discord.js';
import { createCanvas } from 'canvas';
import logger from '../../../utils/logger';

/**
 * Système de captcha pour vérifier les nouveaux membres
 * Génère un captcha visuel et attend la réponse en DM
 */
export class CaptchaSystem {
  private pendingVerifications = new Map<string, { code: string; timestamp: number; guildId: string }>();
  private readonly verificationTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Génère un code aléatoire pour le captcha
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Pas de O/0, I/1 pour éviter confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * Génère une image de captcha
   */
  private async generateCaptchaImage(code: string): Promise<Buffer> {
    const canvas = createCanvas(300, 100);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#2f3136';
    ctx.fillRect(0, 0, 300, 100);

    // Bruit de fond
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
      ctx.fillRect(Math.random() * 300, Math.random() * 100, 2, 2);
    }

    // Lignes aléatoires
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 300, Math.random() * 100);
      ctx.lineTo(Math.random() * 300, Math.random() * 100);
      ctx.stroke();
    }

    // Texte du code
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Chaque lettre avec une rotation/couleur aléatoire
    for (let i = 0; i < code.length; i++) {
      ctx.save();
      const x = 50 + i * 40;
      const y = 50;
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.4);
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 60%)`;
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * Envoie un captcha à un nouveau membre
   */
  async sendCaptcha(member: GuildMember, verifiedRoleId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const code = this.generateCode();
      const image = await this.generateCaptchaImage(code);

      this.pendingVerifications.set(member.id, {
        code,
        timestamp: Date.now(),
        guildId: member.guild.id
      });

      const attachment = new AttachmentBuilder(image, { name: 'captcha.png' });

      await member.send({
        embeds: [new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🔒 Vérification - ${member.guild.name}`)
          .setDescription(
            `Bienvenue sur **${member.guild.name}** !\n\n` +
            `Pour accéder au serveur, vous devez compléter cette vérification.\n\n` +
            `📝 **Répondez avec le code ci-dessous** (sensible à la casse) :\n` +
            `Vous avez **5 minutes** pour répondre.`
          )
          .setImage('attachment://captcha.png')
          .setTimestamp()
          .setFooter({ text: 'Wolaro Vérification' })],
        files: [attachment]
      });

      // Kick automatique après timeout
      setTimeout(async () => {
        const pending = this.pendingVerifications.get(member.id);
        if (pending) {
          this.pendingVerifications.delete(member.id);
          try {
            await member.kick('Captcha non complété dans le temps imparti');
            await member.send({
              embeds: [new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('⚠️ Vérification expirée')
                .setDescription(
                  `Vous avez été expulsé de **${member.guild.name}** car vous n'avez pas complété la vérification.\n\n` +
                  `Vous pouvez rejoindre à nouveau et réessayer.`
                )]
            }).catch(() => {});
          } catch (error) {
            logger.error('[Captcha] Kick timeout error:', error);
          }
        }
      }, this.verificationTimeout);

      logger.info(`[Captcha] Sent to ${member.user.tag} (${member.guild.name})`);
      return { success: true, message: 'Captcha envoyé' };
    } catch (error) {
      logger.error('[Captcha] Send error:', error);
      return { success: false, message: String(error) };
    }
  }

  /**
   * Vérifie une réponse de captcha
   */
  async verifyCaptcha(userId: string, response: string, verifiedRoleId?: string): Promise<{ success: boolean; message: string; guildId?: string }> {
    const pending = this.pendingVerifications.get(userId);
    if (!pending) {
      return { success: false, message: 'Aucune vérification en attente' };
    }

    if (Date.now() - pending.timestamp > this.verificationTimeout) {
      this.pendingVerifications.delete(userId);
      return { success: false, message: 'Vérification expirée' };
    }

    if (response.toUpperCase() !== pending.code) {
      return { success: false, message: 'Code incorrect' };
    }

    this.pendingVerifications.delete(userId);

    try {
      // Trouver le membre et lui donner le rôle vérifié
      const guild = await global.client?.guilds.fetch(pending.guildId);
      if (!guild) {
        return { success: false, message: 'Serveur introuvable' };
      }

      const member = await guild.members.fetch(userId);
      if (!member) {
        return { success: false, message: 'Membre introuvable' };
      }

      if (verifiedRoleId) {
        const role = guild.roles.cache.get(verifiedRoleId);
        if (role) {
          await member.roles.add(role);
        }
      }

      logger.info(`[Captcha] ✅ Verified: ${member.user.tag}`);
      return { success: true, message: 'Vérification réussie !', guildId: pending.guildId };
    } catch (error) {
      logger.error('[Captcha] Verification error:', error);
      return { success: false, message: String(error) };
    }
  }

  /**
   * Annule une vérification en attente
   */
  cancelVerification(userId: string): void {
    this.pendingVerifications.delete(userId);
  }

  /**
   * Vérifie si un utilisateur a une vérification en attente
   */
  hasPendingVerification(userId: string): boolean {
    return this.pendingVerifications.has(userId);
  }
}

export default new CaptchaSystem();
