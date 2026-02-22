import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { SecurityManager } from '../../../utils/security';

export class ImpersonateCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('impersonate')
    .setDescription('[MASTER] Voir la configuration d\'un serveur')
    .addStringOption((option) =>
      option
        .setName('guild-id')
        .setDescription('L\'ID du serveur')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'admin';
  guildOnly = false;
  cooldown = 0;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    // Master Admin only
    if (!SecurityManager.isMaster(interaction.user.id)) {
      await interaction.reply({
        content: '❌ Cette commande est réservée aux Master Admins.',
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.options.getString('guild-id', true);

    try {
      const config = await context.database.getGuildConfig(guildId);

      if (!config) {
        await interaction.reply({
          content: `❌ Serveur ${guildId} introuvable dans la base de données.`,
          ephemeral: true,
        });
        return;
      }

      const guild = await context.client.guilds.fetch(guildId).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🕵️ Impersonation: ${guild?.name || guildId}`)
        .addFields(
          { name: 'Guild ID', value: guildId, inline: true },
          { name: 'Owner ID', value: config.owner_id, inline: true },
          { name: 'Plan', value: config.plan_type, inline: true },
          { name: 'Membres', value: guild ? guild.memberCount.toString() : 'N/A', inline: true },
          { name: 'Blacklisté', value: config.is_blacklisted ? '✅ Oui' : '❌ Non', inline: true },
          { name: 'Modules actifs', value: config.modules?.filter((m: any) => m.enabled).length.toString() || '0', inline: true }
        )
        .setTimestamp();

      if (config.modules) {
        let modulesList = '';
        for (const module of config.modules) {
          const status = module.enabled ? '✅' : '❌';
          modulesList += `${status} ${module.module_name}\n`;
        }
        embed.addFields({ name: 'Modules', value: modulesList || 'Aucun', inline: false });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });

      // Log impersonation
      await context.database.logAction(
        interaction.user.id,
        'MASTER_IMPERSONATE',
        { targetGuildId: guildId },
        guildId
      );
    } catch (error) {
      await interaction.reply({
        content: '❌ Erreur lors de l\'impersonation.',
        ephemeral: true,
      });
    }
  }
}
