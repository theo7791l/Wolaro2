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
import { logger } from '../../../../utils/logger';

export class ProtectionConfigCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('protection')
    .setDescription('Configure les systèmes de protection du serveur')
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
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver').setRequired(false))
        .addStringOption(opt =>
          opt
            .setName('level')
            .setDescription('Niveau de sensibilité')
            .setRequired(false)
            .addChoices(
              { name: 'Faible', value: 'low' },
              { name: 'Moyen', value: 'medium' },
              { name: 'Élevé', value: 'high' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('badwords')
        .setDescription('Configurer le filtre de mots')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver').setRequired(false))
        .addBooleanOption(opt => opt.setName('strict').setDescription('Mode strict (détection plus sensible)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('raid')
        .setDescription('Configurer l\'anti-raid')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver').setRequired(false))
        .addBooleanOption(opt => opt.setName('captcha').setDescription('Activer le captcha pour les nouveaux membres').setRequired(false))
        .addBooleanOption(opt => opt.setName('auto_lockdown').setDescription('Lockdown automatique en cas de raid').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('phishing')
        .setDescription('Configurer l\'anti-phishing')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver').setRequired(false))
        .addBooleanOption(opt => opt.setName('check_urls').setDescription('Vérifier les URLs externes').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('nuke')
        .setDescription('Configurer l\'anti-nuke (protection contre les attaques massives)')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver').setRequired(false))
        .addBooleanOption(opt => opt.setName('protect_admins').setDescription('Protéger les administrateurs').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('nsfw')
        .setDescription('Configurer détection NSFW (contenu adulte)')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver').setRequired(false))
        .addNumberOption(opt =>
          opt
            .setName('threshold')
            .setDescription('Seuil de détection (0.5 = permissif, 1.0 = strict)')
            .setRequired(false)
            .setMinValue(0.5)
            .setMaxValue(1.0)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('lockdown')
        .setDescription('Configurer le système de lockdown intelligent')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Activer/désactiver').setRequired(false))
        .addBooleanOption(opt => opt.setName('auto_trigger').setDescription('Déclenchement automatique').setRequired(false))
    ) as SlashCommandBuilder;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Cette commande ne peut être utilisée que dans un serveur.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'view') {
        // Récupérer la config depuis la base de données
        // context.database.query retourne directement un tableau (rows)
        const result = await context.database.query(
          'SELECT * FROM protection_config WHERE guild_id = $1',
          [interaction.guild.id]
        );

        const config = result[0] || {
          antispam_enabled: true,
          antispam_level: 'medium',
          badwords_enabled: true,
          badwords_action: 'delete',
          antiraid_enabled: true,
          antiraid_captcha_enabled: false,
          antiphishing_enabled: true,
          antiphishing_check_urls: true,
          antinuke_enabled: true,
          antinuke_protect_admins: true,
          nsfw_detection_enabled: false,
          nsfw_threshold: 0.8,
          lockdown_enabled: true,
          lockdown_auto_trigger: false
        };

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('⚠️ Configuration Protection')
          .setDescription(`Configuration actuelle pour **${interaction.guild.name}**`)
          .addFields(
            {
              name: '🛡️ Anti-Spam',
              value: `${config.antispam_enabled ? '✅' : '❌'} ${config.antispam_enabled ? 'Activé' : 'Désactivé'}\nNiveau: ${config.antispam_level}`,
              inline: true
            },
            {
              name: '🚫 Bad Words',
              value: `${config.badwords_enabled ? '✅' : '❌'} ${config.badwords_enabled ? 'Activé' : 'Désactivé'}\nAction: ${config.badwords_action}`,
              inline: true
            },
            {
              name: '🛑 Anti-Raid',
              value:
                `${config.antiraid_enabled ? '✅' : '❌'} ${config.antiraid_enabled ? 'Activé' : 'Désactivé'}\n` +
                `Captcha: ${config.antiraid_captcha_enabled ? '✅' : '❌'}`,
              inline: true
            },
            {
              name: '🎣 Anti-Phishing',
              value:
                `${config.antiphishing_enabled ? '✅' : '❌'} ${config.antiphishing_enabled ? 'Activé' : 'Désactivé'}\n` +
                `Vérif URLs: ${config.antiphishing_check_urls ? '✅' : '❌'}`,
              inline: true
            },
            {
              name: '💣 Anti-Nuke',
              value:
                `${config.antinuke_enabled ? '✅' : '❌'} ${config.antinuke_enabled ? 'Activé' : 'Désactivé'}\n` +
                `Protéger admins: ${config.antinuke_protect_admins ? '✅' : '❌'}`,
              inline: true
            },
            {
              name: '🔞 NSFW Detection',
              value:
                `${config.nsfw_detection_enabled ? '✅' : '❌'} ${config.nsfw_detection_enabled ? 'Activé' : 'Désactivé'}\n` +
                `Seuil: ${config.nsfw_threshold}`,
              inline: true
            },
            {
              name: '🔒 Smart Lockdown',
              value:
                `${config.lockdown_enabled ? '✅' : '❌'} ${config.lockdown_enabled ? 'Activé' : 'Désactivé'}\n` +
                `Auto: ${config.lockdown_auto_trigger ? '✅' : '❌'}`,
              inline: true
            }
          )
          .setFooter({ text: 'Utilisez /protection <système> pour configurer chaque module' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        // Mise à jour de la configuration
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 2; // Start at 2 because guild_id is $1

        switch (subcommand) {
          case 'spam': {
            const enabled = interaction.options.getBoolean('enabled');
            const level = interaction.options.getString('level');
            if (enabled !== null) {
              updateFields.push(`antispam_enabled = $${paramIndex++}`);
              updateValues.push(enabled);
            }
            if (level) {
              updateFields.push(`antispam_level = $${paramIndex++}`);
              updateValues.push(level);
            }
            break;
          }
          case 'badwords': {
            const enabled = interaction.options.getBoolean('enabled');
            const strict = interaction.options.getBoolean('strict');
            if (enabled !== null) {
              updateFields.push(`badwords_enabled = $${paramIndex++}`);
              updateValues.push(enabled);
            }
            if (strict !== null) {
              updateFields.push(`badwords_strict_mode = $${paramIndex++}`);
              updateValues.push(strict);
            }
            break;
          }
          case 'raid': {
            const enabled = interaction.options.getBoolean('enabled');
            const captcha = interaction.options.getBoolean('captcha');
            const autoLockdown = interaction.options.getBoolean('auto_lockdown');
            if (enabled !== null) {
              updateFields.push(`antiraid_enabled = $${paramIndex++}`);
              updateValues.push(enabled);
            }
            if (captcha !== null) {
              updateFields.push(`antiraid_captcha_enabled = $${paramIndex++}`);
              updateValues.push(captcha);
            }
            if (autoLockdown !== null) {
              updateFields.push(`antiraid_auto_lockdown = $${paramIndex++}`);
              updateValues.push(autoLockdown);
            }
            break;
          }
          case 'phishing': {
            const enabled = interaction.options.getBoolean('enabled');
            const checkUrls = interaction.options.getBoolean('check_urls');
            if (enabled !== null) {
              updateFields.push(`antiphishing_enabled = $${paramIndex++}`);
              updateValues.push(enabled);
            }
            if (checkUrls !== null) {
              updateFields.push(`antiphishing_check_urls = $${paramIndex++}`);
              updateValues.push(checkUrls);
            }
            break;
          }
          case 'nuke': {
            const enabled = interaction.options.getBoolean('enabled');
            const protectAdmins = interaction.options.getBoolean('protect_admins');
            if (enabled !== null) {
              updateFields.push(`antinuke_enabled = $${paramIndex++}`);
              updateValues.push(enabled);
            }
            if (protectAdmins !== null) {
              updateFields.push(`antinuke_protect_admins = $${paramIndex++}`);
              updateValues.push(protectAdmins);
            }
            break;
          }
          case 'nsfw': {
            const enabled = interaction.options.getBoolean('enabled');
            const threshold = interaction.options.getNumber('threshold');
            if (enabled !== null) {
              updateFields.push(`nsfw_detection_enabled = $${paramIndex++}`);
              updateValues.push(enabled);
            }
            if (threshold !== null) {
              updateFields.push(`nsfw_threshold = $${paramIndex++}`);
              updateValues.push(threshold);
            }
            break;
          }
          case 'lockdown': {
            const enabled = interaction.options.getBoolean('enabled');
            const autoTrigger = interaction.options.getBoolean('auto_trigger');
            if (enabled !== null) {
              updateFields.push(`lockdown_enabled = $${paramIndex++}`);
              updateValues.push(enabled);
            }
            if (autoTrigger !== null) {
              updateFields.push(`lockdown_auto_trigger = $${paramIndex++}`);
              updateValues.push(autoTrigger);
            }
            break;
          }
        }

        if (updateFields.length === 0) {
          await interaction.reply({
            content: '❌ Aucun paramètre à mettre à jour. Spécifiez au moins une option.',
            ephemeral: true
          });
          return;
        }

        // Mise à jour dans la base de données
        const query = `
          INSERT INTO protection_config (guild_id, ${updateFields.map((_, i) => updateFields[i].split(' = ')[0]).join(', ')})
          VALUES ($1, ${updateValues.map((_, i) => `$${i + 2}`).join(', ')})
          ON CONFLICT (guild_id) DO UPDATE SET ${updateFields.join(', ')}
        `;

        await context.database.query(query, [interaction.guild.id, ...updateValues]);

        await interaction.reply({
          content: `✅ Configuration **${subcommand}** mise à jour avec succès !`,
          ephemeral: true
        });

        logger.info(
          `Protection config updated by ${interaction.user.tag} in ${interaction.guild.name}: ${subcommand}`
        );
      }
    } catch (error) {
      logger.error('Error in protection config command:', error);
      await interaction.reply({
        content: '❌ Erreur lors de la mise à jour de la configuration. Vérifiez les logs.',
        ephemeral: true
      });
    }
  }
}
