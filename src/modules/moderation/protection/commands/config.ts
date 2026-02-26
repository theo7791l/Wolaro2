/**
 * Protection Config Command
 * Configure tous les systèmes de protection
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../../types';
import protectionModule from '../index';
import { logger } from '../../../../utils/logger';

export class ProtectionConfigCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('protection-config')
    .setDescription('Configure les systèmes de protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Voir la configuration actuelle')
    )
    .addSubcommand(sub =>
      sub
        .setName('spam')
        .setDescription('Configurer l\'anti-spam')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver'))
        .addStringOption(opt =>
          opt
            .setName('level')
            .setDescription('Niveau de sensibilité')
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('badwords')
        .setDescription('Configurer le filtre de mots')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver'))
        .addBooleanOption(opt => opt.setName('strict').setDescription('Mode strict'))
    )
    .addSubcommand(sub =>
      sub
        .setName('raid')
        .setDescription('Configurer l\'anti-raid')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver'))
        .addBooleanOption(opt => opt.setName('captcha').setDescription('Activer captcha'))
        .addBooleanOption(opt => opt.setName('auto_lockdown').setDescription('Lockdown auto'))
    )
    .addSubcommand(sub =>
      sub
        .setName('phishing')
        .setDescription('Configurer l\'anti-phishing')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver'))
        .addBooleanOption(opt => opt.setName('check_urls').setDescription('Vérifier URLs externes'))
    )
    .addSubcommand(sub =>
      sub
        .setName('nuke')
        .setDescription('Configurer l\'anti-nuke')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver'))
        .addBooleanOption(opt => opt.setName('protect_admins').setDescription('Protéger admins'))
    )
    .addSubcommand(sub =>
      sub
        .setName('nsfw')
        .setDescription('Configurer détection NSFW')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver'))
        .addNumberOption(opt =>
          opt
            .setName('threshold')
            .setDescription('Seuil de détection (0.5-1.0)')
            .setMinValue(0.5)
            .setMaxValue(1.0)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('lockdown')
        .setDescription('Configurer le système de lockdown')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver'))
        .addBooleanOption(opt => opt.setName('auto_trigger').setDescription('Déclenchement auto'))
    ) as SlashCommandBuilder;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'view') {
        const config = await (protectionModule as any).db.getConfig(interaction.guild.id);

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('⚙️ Configuration Protection')
          .setDescription(`Configuration actuelle pour **${interaction.guild.name}**`)
          .addFields(
            {
              name: '🛡️ Anti-Spam',
              value: `${config.antispam_enabled ? '✅' : '❌'} Enabled\nNiveau: ${config.antispam_level}`,
              inline: true
            },
            {
              name: '🚫 Bad Words',
              value: `${config.badwords_enabled ? '✅' : '❌'} Enabled\nAction: ${config.badwords_action}`,
              inline: true
            },
            {
              name: '🛑 Anti-Raid',
              value:
                `${config.antiraid_enabled ? '✅' : '❌'} Enabled\n` +
                `Captcha: ${config.antiraid_captcha_enabled ? '✅' : '❌'}`,
              inline: true
            },
            {
              name: '🎣 Anti-Phishing',
              value:
                `${config.antiphishing_enabled ? '✅' : '❌'} Enabled\n` +
                `Check URLs: ${config.antiphishing_check_urls ? '✅' : '❌'}`,
              inline: true
            },
            {
              name: '💣 Anti-Nuke',
              value:
                `${config.antinuke_enabled ? '✅' : '❌'} Enabled\n` +
                `Protect Admins: ${config.antinuke_protect_admins ? '✅' : '❌'}`,
              inline: true
            },
            {
              name: '🔞 NSFW Detection',
              value:
                `${config.nsfw_detection_enabled ? '✅' : '❌'} Enabled\n` +
                `Seuil: ${config.nsfw_threshold}`,
              inline: true
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const updates: any = {};

        switch (subcommand) {
          case 'spam': {
            const enabled = interaction.options.getBoolean('enabled');
            const level = interaction.options.getString('level');
            if (enabled !== null) updates.antispam_enabled = enabled;
            if (level) updates.antispam_level = level;
            break;
          }
          case 'badwords': {
            const enabled = interaction.options.getBoolean('enabled');
            const strict = interaction.options.getBoolean('strict');
            if (enabled !== null) updates.badwords_enabled = enabled;
            if (strict !== null) updates.badwords_strict_mode = strict;
            break;
          }
          case 'raid': {
            const enabled = interaction.options.getBoolean('enabled');
            const captcha = interaction.options.getBoolean('captcha');
            const autoLockdown = interaction.options.getBoolean('auto_lockdown');
            if (enabled !== null) updates.antiraid_enabled = enabled;
            if (captcha !== null) updates.antiraid_captcha_enabled = captcha;
            if (autoLockdown !== null) updates.antiraid_auto_lockdown = autoLockdown;
            break;
          }
          case 'phishing': {
            const enabled = interaction.options.getBoolean('enabled');
            const checkUrls = interaction.options.getBoolean('check_urls');
            if (enabled !== null) updates.antiphishing_enabled = enabled;
            if (checkUrls !== null) updates.antiphishing_check_urls = checkUrls;
            break;
          }
          case 'nuke': {
            const enabled = interaction.options.getBoolean('enabled');
            const protectAdmins = interaction.options.getBoolean('protect_admins');
            if (enabled !== null) updates.antinuke_enabled = enabled;
            if (protectAdmins !== null) updates.antinuke_protect_admins = protectAdmins;
            break;
          }
          case 'nsfw': {
            const enabled = interaction.options.getBoolean('enabled');
            const threshold = interaction.options.getNumber('threshold');
            if (enabled !== null) updates.nsfw_detection_enabled = enabled;
            if (threshold !== null) updates.nsfw_threshold = threshold;
            break;
          }
          case 'lockdown': {
            const enabled = interaction.options.getBoolean('enabled');
            const autoTrigger = interaction.options.getBoolean('auto_trigger');
            if (enabled !== null) updates.lockdown_enabled = enabled;
            if (autoTrigger !== null) updates.lockdown_auto_trigger = autoTrigger;
            break;
          }
        }

        if (Object.keys(updates).length === 0) {
          await interaction.reply({
            content: '❌ Aucun paramètre à mettre à jour',
            ephemeral: true
          });
          return;
        }

        await (protectionModule as any).db.updateConfig(interaction.guild.id, updates);

        await interaction.reply({
          content: `✅ Configuration **${subcommand}** mise à jour avec succès !`,
          ephemeral: true
        });

        logger.info(
          `Protection config updated by ${interaction.user.tag} in ${interaction.guild.name}: ${JSON.stringify(updates)}`
        );
      }
    } catch (error) {
      logger.error('Error in protection config command:', error);
      await interaction.reply({
        content: '❌ Erreur lors de la mise à jour de la configuration',
        ephemeral: true
      });
    }
  }
}
