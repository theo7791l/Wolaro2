import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { SecurityManager } from '../../../utils/security';
import os from 'os';

export class StatsCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('stats')
    .setDescription('[MASTER] Voir les statistiques du bot') as SlashCommandBuilder;

  module = 'admin';
  guildOnly = false;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    if (!SecurityManager.isMaster(interaction.user.id)) {
      await interaction.reply({
        content: '❌ Cette commande est réservée aux Master Admins.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Get database stats
      const dbStats = await context.database.query(`
        SELECT 
          (SELECT COUNT(*) FROM guilds) as total_guilds,
          (SELECT COUNT(*) FROM guilds WHERE is_blacklisted = false) as active_guilds,
          (SELECT COUNT(*) FROM global_profiles) as total_users,
          (SELECT COUNT(*) FROM guilds WHERE plan_type = 'PREMIUM') as premium_guilds,
          (SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours') as actions_24h
      `);

      const stats = dbStats[0];

      // Get bot stats
      const totalMembers = context.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      const uptime = process.uptime();
      const uptimeStr = this.formatUptime(uptime);

      // Get system stats
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const cpuUsage = os.loadavg()[0].toFixed(2);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Statistiques Wolaro')
        .addFields(
          { name: '🏛️ Serveurs', value: `Total: ${context.client.guilds.cache.size}\nActifs: ${stats.active_guilds}\nPremium: ${stats.premium_guilds}`, inline: true },
          { name: '👥 Utilisateurs', value: `Total: ${totalMembers.toLocaleString()}\nProfils: ${stats.total_users}`, inline: true },
          { name: '📊 Activité', value: `Actions 24h: ${stats.actions_24h}`, inline: true },
          { name: '⏱️ Uptime', value: uptimeStr, inline: true },
          { name: '💾 Mémoire', value: `Utilisée: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\nTotal: ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB\nLibre: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`, inline: true },
          { name: '🖥️ CPU', value: `Load: ${cpuUsage}\nCores: ${os.cpus().length}`, inline: true },
          { name: '📦 Version', value: `Node: ${process.version}\nPlatform: ${process.platform}`, inline: true },
          { name: '🎮 Shards', value: `Count: ${context.client.shard?.count || 1}\nID: ${context.client.shard?.ids[0] || 0}`, inline: true },
          { name: '📍 Ping', value: `WS: ${context.client.ws.ping}ms`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: '❌ Erreur lors de la récupération des statistiques.',
        ephemeral: true,
      });
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}j ${hours}h ${minutes}m`;
  }
}
