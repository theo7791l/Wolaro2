import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { configManager } from '../utils/config-manager';
import { ConfigValidators } from '../utils/validators';
import { logger } from '../../../utils/logger';

export const configCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configuration centralisée de tous les modules du bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        
        // MODERATION
        .addSubcommandGroup(group => group
            .setName('moderation')
            .setDescription('Configuration du module de modération')
            .addSubcommand(cmd => cmd
                .setName('log-channel')
                .setDescription('Définir le salon des logs de modération')
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Le salon de logs')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('mute-role')
                .setDescription('Définir le rôle de mute')
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('Le rôle mute')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('automod')
                .setDescription('Activer/désactiver l\'auto-modération')
                .addStringOption(option => option
                    .setName('status')
                    .setDescription('Statut')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Activé', value: 'on' },
                        { name: 'Désactivé', value: 'off' }
                    )))
            .addSubcommand(cmd => cmd
                .setName('spam-threshold')
                .setDescription('Définir le seuil de détection de spam')
                .addIntegerOption(option => option
                    .setName('messages')
                    .setDescription('Nombre de messages en 5 secondes')
                    .setRequired(true)
                    .setMinValue(3)
                    .setMaxValue(20)))
            .addSubcommand(cmd => cmd
                .setName('raid-threshold')
                .setDescription('Définir le seuil de détection de raid')
                .addIntegerOption(option => option
                    .setName('joins')
                    .setDescription('Nombre de joins en 10 secondes')
                    .setRequired(true)
                    .setMinValue(5)
                    .setMaxValue(50)))
            .addSubcommand(cmd => cmd
                .setName('add-filter')
                .setDescription('Ajouter un mot à filtrer')
                .addStringOption(option => option
                    .setName('word')
                    .setDescription('Le mot à filtrer')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('remove-filter')
                .setDescription('Retirer un mot du filtre')
                .addStringOption(option => option
                    .setName('word')
                    .setDescription('Le mot à retirer')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('list-filters')
                .setDescription('Liste des mots filtrés'))
            .addSubcommand(cmd => cmd
                .setName('warn-threshold')
                .setDescription('Nombre de warns avant sanction')
                .addIntegerOption(option => option
                    .setName('count')
                    .setDescription('Nombre de warns')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(10)))
            .addSubcommand(cmd => cmd
                .setName('warn-action')
                .setDescription('Action après seuil de warns')
                .addStringOption(option => option
                    .setName('action')
                    .setDescription('Type d\'action')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Mute', value: 'mute' },
                        { name: 'Kick', value: 'kick' },
                        { name: 'Ban', value: 'ban' }
                    )))
        )
        
        // ECONOMY
        .addSubcommandGroup(group => group
            .setName('economy')
            .setDescription('Configuration du module économie')
            .addSubcommand(cmd => cmd
                .setName('daily-amount')
                .setDescription('Définir le montant du daily')
                .addIntegerOption(option => option
                    .setName('amount')
                    .setDescription('Montant en coins')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(10000)))
            .addSubcommand(cmd => cmd
                .setName('work-rewards')
                .setDescription('Définir les gains du work')
                .addIntegerOption(option => option
                    .setName('min')
                    .setDescription('Gain minimum')
                    .setRequired(true)
                    .setMinValue(1))
                .addIntegerOption(option => option
                    .setName('max')
                    .setDescription('Gain maximum')
                    .setRequired(true)
                    .setMinValue(1)))
            .addSubcommand(cmd => cmd
                .setName('work-cooldown')
                .setDescription('Définir le cooldown du work')
                .addIntegerOption(option => option
                    .setName('seconds')
                    .setDescription('Durée en secondes')
                    .setRequired(true)
                    .setMinValue(60)
                    .setMaxValue(86400)))
            .addSubcommand(cmd => cmd
                .setName('global-economy')
                .setDescription('Économie globale ou par serveur')
                .addStringOption(option => option
                    .setName('status')
                    .setDescription('Type d\'\u00e9conomie')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Globale (entre tous les serveurs)', value: 'on' },
                        { name: 'Par serveur', value: 'off' }
                    )))
            .addSubcommand(cmd => cmd
                .setName('starting-balance')
                .setDescription('Définir l\'argent de départ')
                .addIntegerOption(option => option
                    .setName('amount')
                    .setDescription('Montant initial')
                    .setRequired(true)
                    .setMinValue(0)
                    .setMaxValue(10000)))
            .addSubcommand(cmd => cmd
                .setName('bank-limit')
                .setDescription('Définir la limite de la banque')
                .addIntegerOption(option => option
                    .setName('amount')
                    .setDescription('Montant maximum')
                    .setRequired(true)
                    .setMinValue(1000)
                    .setMaxValue(1000000)))
            .addSubcommand(cmd => cmd
                .setName('reset')
                .setDescription('Reset toute l\'\u00e9conomie du serveur (IRREVERSIBLE!)')
                .addStringOption(option => option
                    .setName('confirm')
                    .setDescription('Tapez RESET pour confirmer')
                    .setRequired(true)))
        )
        
        // LEVELING
        .addSubcommandGroup(group => group
            .setName('leveling')
            .setDescription('Configuration du système de niveaux')
            .addSubcommand(cmd => cmd
                .setName('xp-per-message')
                .setDescription('Définir l\'XP par message')
                .addIntegerOption(option => option
                    .setName('amount')
                    .setDescription('Quantité d\'XP')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100)))
            .addSubcommand(cmd => cmd
                .setName('xp-cooldown')
                .setDescription('Définir le cooldown XP (anti-spam)')
                .addIntegerOption(option => option
                    .setName('seconds')
                    .setDescription('Durée en secondes')
                    .setRequired(true)
                    .setMinValue(10)
                    .setMaxValue(300)))
            .addSubcommand(cmd => cmd
                .setName('levelup-channel')
                .setDescription('Définir le salon des annonces de level up')
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Le salon')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('levelup-dm')
                .setDescription('Envoyer un DM lors du level up')
                .addStringOption(option => option
                    .setName('status')
                    .setDescription('Statut')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Activé', value: 'on' },
                        { name: 'Désactivé', value: 'off' }
                    )))
            .addSubcommand(cmd => cmd
                .setName('xp-multiplier')
                .setDescription('Définir le multiplicateur d\'XP')
                .addNumberOption(option => option
                    .setName('multiplier')
                    .setDescription('Multiplicateur (1.0 = normal)')
                    .setRequired(true)
                    .setMinValue(0.1)
                    .setMaxValue(5.0)))
            .addSubcommand(cmd => cmd
                .setName('add-reward')
                .setDescription('Ajouter une récompense de niveau')
                .addIntegerOption(option => option
                    .setName('level')
                    .setDescription('Niveau requis')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100))
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('Rôle récompense')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('remove-reward')
                .setDescription('Retirer une récompense de niveau')
                .addIntegerOption(option => option
                    .setName('level')
                    .setDescription('Niveau')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('list-rewards')
                .setDescription('Liste des récompenses de niveau'))
            .addSubcommand(cmd => cmd
                .setName('reward-mode')
                .setDescription('Mode de récompense des rôles')
                .addStringOption(option => option
                    .setName('mode')
                    .setDescription('Type de mode')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Stack (cumuler les rôles)', value: 'stack' },
                        { name: 'Replace (remplacer le rôle)', value: 'replace' }
                    )))
            .addSubcommand(cmd => cmd
                .setName('ignore-channel')
                .setDescription('Ignorer un salon pour l\'XP')
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Le salon à ignorer')
                    .setRequired(true)))
            .addSubcommand(cmd => cmd
                .setName('unignore-channel')
                .setDescription('Réactiver l\'XP dans un salon')
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Le salon')
                    .setRequired(true)))
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ Cette commande ne peut être utilisée qu\'en serveur.', ephemeral: true });
        }

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        try {
            // Route to appropriate handler
            if (group === 'moderation') {
                await handleModerationConfig(interaction, subcommand);
            } else if (group === 'economy') {
                await handleEconomyConfig(interaction, subcommand);
            } else if (group === 'leveling') {
                await handleLevelingConfig(interaction, subcommand);
            }
        } catch (error) {
            logger.error('Error in config command:', error);
            await interaction.reply({ 
                content: '❌ Une erreur s\'est produite lors de la configuration.', 
                ephemeral: true 
            });
        }
    }
};

// Helper function to create success embed
function createSuccessEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

// Helper function to create error embed
function createErrorEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Erreur')
        .setDescription(description)
        .setTimestamp();
}

// MODERATION HANDLERS
async function handleModerationConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'log-channel': {
            const channel = interaction.options.getChannel('channel', true);
            await configManager.setSetting(guildId, 'moderation', 'log_channel', channel.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Salon de logs configuré',
                    `Le salon ${channel} a été défini comme salon de logs de modération.`
                )]
            });
            break;
        }

        case 'mute-role': {
            const role = interaction.options.getRole('role', true);
            await configManager.setSetting(guildId, 'moderation', 'mute_role', role.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Rôle mute configuré',
                    `Le rôle ${role} a été défini comme rôle mute.`
                )]
            });
            break;
        }

        case 'automod': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'moderation', 'automod_enabled', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Auto-modération',
                    `L'auto-modération a été ${enabled ? 'activée' : 'désactivée'}.`
                )]
            });
            break;
        }

        case 'spam-threshold': {
            const messages = interaction.options.getInteger('messages', true);
            await configManager.setSetting(guildId, 'moderation', 'spam_threshold', messages);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Seuil de spam configuré',
                    `Le seuil de détection de spam a été défini à **${messages} messages en 5 secondes**.`
                )]
            });
            break;
        }

        case 'raid-threshold': {
            const joins = interaction.options.getInteger('joins', true);
            await configManager.setSetting(guildId, 'moderation', 'raid_threshold', joins);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Seuil de raid configuré',
                    `Le seuil de détection de raid a été défini à **${joins} joins en 10 secondes**.`
                )]
            });
            break;
        }

        case 'add-filter': {
            const word = interaction.options.getString('word', true);
            const currentFilters = await configManager.getSetting(guildId, 'moderation', 'filter_words') || [];
            if (!currentFilters.includes(word.toLowerCase())) {
                currentFilters.push(word.toLowerCase());
                await configManager.setSetting(guildId, 'moderation', 'filter_words', currentFilters);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Mot ajouté au filtre',
                        `Le mot "${word}" a été ajouté à la liste des mots filtrés.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce mot est déjà dans la liste des filtres.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'remove-filter': {
            const word = interaction.options.getString('word', true);
            let currentFilters = await configManager.getSetting(guildId, 'moderation', 'filter_words') || [];
            if (currentFilters.includes(word.toLowerCase())) {
                currentFilters = currentFilters.filter((w: string) => w !== word.toLowerCase());
                await configManager.setSetting(guildId, 'moderation', 'filter_words', currentFilters);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Mot retiré du filtre',
                        `Le mot "${word}" a été retiré de la liste des mots filtrés.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce mot n\'est pas dans la liste des filtres.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'list-filters': {
            const filters = await configManager.getSetting(guildId, 'moderation', 'filter_words') || [];
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📄 Liste des mots filtrés')
                .setDescription(filters.length > 0 ? filters.map((w: string, i: number) => `${i + 1}. ${w}`).join('\n') : 'Aucun mot filtré.')
                .setFooter({ text: `Total: ${filters.length} mot(s)` })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            break;
        }

        case 'warn-threshold': {
            const count = interaction.options.getInteger('count', true);
            await configManager.setSetting(guildId, 'moderation', 'warn_threshold', count);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Seuil de warns configuré',
                    `Le seuil a été défini à **${count} warns** avant sanction automatique.`
                )]
            });
            break;
        }

        case 'warn-action': {
            const action = interaction.options.getString('action', true);
            await configManager.setSetting(guildId, 'moderation', 'warn_action', action);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Action de sanction configurée',
                    `L'action après seuil de warns a été définie sur **${action}**.`
                )]
            });
            break;
        }
    }
}

// ECONOMY HANDLERS
async function handleEconomyConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'daily-amount': {
            const amount = interaction.options.getInteger('amount', true);
            await configManager.setSetting(guildId, 'economy', 'daily_amount', amount);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Montant du daily configuré',
                    `Le daily donnera désormais **${amount} coins**.`
                )]
            });
            break;
        }

        case 'work-rewards': {
            const min = interaction.options.getInteger('min', true);
            const max = interaction.options.getInteger('max', true);
            
            if (min >= max) {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Le gain minimum doit être inférieur au gain maximum.')],
                    ephemeral: true
                });
                return;
            }

            await configManager.setSetting(guildId, 'economy', 'work_min', min);
            await configManager.setSetting(guildId, 'economy', 'work_max', max);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Gains du work configurés',
                    `Le work donnera entre **${min}** et **${max} coins**.`
                )]
            });
            break;
        }

        case 'work-cooldown': {
            const seconds = interaction.options.getInteger('seconds', true);
            await configManager.setSetting(guildId, 'economy', 'work_cooldown', seconds);
            const minutes = Math.floor(seconds / 60);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Cooldown du work configuré',
                    `Le cooldown du work a été défini à **${minutes} minute(s)** (${seconds}s).`
                )]
            });
            break;
        }

        case 'global-economy': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'economy', 'global_economy', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Économie configurée',
                    `L'économie est maintenant **${enabled ? 'globale (partagée entre serveurs)' : 'locale (par serveur)'}**.`
                )]
            });
            break;
        }

        case 'starting-balance': {
            const amount = interaction.options.getInteger('amount', true);
            await configManager.setSetting(guildId, 'economy', 'starting_balance', amount);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Balance de départ configurée',
                    `Les nouveaux membres commenceront avec **${amount} coins**.`
                )]
            });
            break;
        }

        case 'bank-limit': {
            const amount = interaction.options.getInteger('amount', true);
            await configManager.setSetting(guildId, 'economy', 'bank_limit', amount);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Limite de banque configurée',
                    `La limite de la banque a été définie à **${amount} coins**.`
                )]
            });
            break;
        }

        case 'reset': {
            const confirm = interaction.options.getString('confirm', true);
            if (confirm !== 'RESET') {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Vous devez taper exactement "RESET" pour confirmer.')],
                    ephemeral: true
                });
                return;
            }

            // Reset economy
            const { pool } = await import('../../../database');
            await pool.query('DELETE FROM guild_economy WHERE guild_id = $1', [guildId]);
            
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Économie réinitialisée',
                    'Toute l\'\u00e9conomie du serveur a été réinitialisée. Tous les balances ont été supprimés.'
                )]
            });
            break;
        }
    }
}

// LEVELING HANDLERS  
async function handleLevelingConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'xp-per-message': {
            const amount = interaction.options.getInteger('amount', true);
            await configManager.setSetting(guildId, 'leveling', 'xp_per_message', amount);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'XP par message configuré',
                    `Les utilisateurs gagneront **${amount} XP** par message.`
                )]
            });
            break;
        }

        case 'xp-cooldown': {
            const seconds = interaction.options.getInteger('seconds', true);
            await configManager.setSetting(guildId, 'leveling', 'xp_cooldown', seconds);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Cooldown XP configuré',
                    `Le cooldown entre les gains d'XP a été défini à **${seconds} secondes**.`
                )]
            });
            break;
        }

        case 'levelup-channel': {
            const channel = interaction.options.getChannel('channel', true);
            await configManager.setSetting(guildId, 'leveling', 'levelup_channel', channel.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Salon de level up configuré',
                    `Les annonces de level up seront envoyées dans ${channel}.`
                )]
            });
            break;
        }

        case 'levelup-dm': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'leveling', 'levelup_dm', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'DM de level up',
                    `Les DM de level up sont maintenant **${enabled ? 'activés' : 'désactivés'}**.`
                )]
            });
            break;
        }

        case 'xp-multiplier': {
            const multiplier = interaction.options.getNumber('multiplier', true);
            await configManager.setSetting(guildId, 'leveling', 'xp_multiplier', multiplier);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Multiplicateur d\'XP configuré',
                    `Le multiplicateur d'XP a été défini à **x${multiplier}**.`
                )]
            });
            break;
        }

        case 'add-reward': {
            const level = interaction.options.getInteger('level', true);
            const role = interaction.options.getRole('role', true);
            
            const rewards = await configManager.getSetting(guildId, 'leveling', 'level_rewards') || {};
            rewards[level] = role.id;
            await configManager.setSetting(guildId, 'leveling', 'level_rewards', rewards);
            
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Récompense ajoutée',
                    `Le rôle ${role} sera donné au niveau **${level}**.`
                )]
            });
            break;
        }

        case 'remove-reward': {
            const level = interaction.options.getInteger('level', true);
            const rewards = await configManager.getSetting(guildId, 'leveling', 'level_rewards') || {};
            
            if (rewards[level]) {
                delete rewards[level];
                await configManager.setSetting(guildId, 'leveling', 'level_rewards', rewards);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Récompense retirée',
                        `La récompense du niveau **${level}** a été retirée.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Aucune récompense n\'existe pour ce niveau.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'list-rewards': {
            const rewards = await configManager.getSetting(guildId, 'leveling', 'level_rewards') || {};
            const entries = Object.entries(rewards).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
            
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🏆 Récompenses de niveau')
                .setTimestamp();

            if (entries.length === 0) {
                embed.setDescription('Aucune récompense configurée.');
            } else {
                const description = entries.map(([level, roleId]) => {
                    return `**Niveau ${level}** : <@&${roleId}>`;
                }).join('\n');
                embed.setDescription(description);
                embed.setFooter({ text: `Total: ${entries.length} récompense(s)` });
            }

            await interaction.reply({ embeds: [embed] });
            break;
        }

        case 'reward-mode': {
            const mode = interaction.options.getString('mode', true);
            await configManager.setSetting(guildId, 'leveling', 'reward_mode', mode);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Mode de récompense configuré',
                    `Le mode est maintenant **${mode}** (${mode === 'stack' ? 'les rôles s\'accumulent' : 'le rôle est remplacé'}).`
                )]
            });
            break;
        }

        case 'ignore-channel': {
            const channel = interaction.options.getChannel('channel', true);
            const ignored = await configManager.getSetting(guildId, 'leveling', 'ignored_channels') || [];
            
            if (!ignored.includes(channel.id)) {
                ignored.push(channel.id);
                await configManager.setSetting(guildId, 'leveling', 'ignored_channels', ignored);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Salon ignoré',
                        `Les messages dans ${channel} ne donneront plus d'XP.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce salon est déjà ignoré.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'unignore-channel': {
            const channel = interaction.options.getChannel('channel', true);
            let ignored = await configManager.getSetting(guildId, 'leveling', 'ignored_channels') || [];
            
            if (ignored.includes(channel.id)) {
                ignored = ignored.filter((id: string) => id !== channel.id);
                await configManager.setSetting(guildId, 'leveling', 'ignored_channels', ignored);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Salon réactivé',
                        `Les messages dans ${channel} donneront à nouveau de l'XP.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce salon n\'est pas ignoré.')],
                    ephemeral: true
                });
            }
            break;
        }
    }
}
