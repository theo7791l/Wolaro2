import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { configManager } from '../utils/config-manager';
import { ConfigValidators } from '../utils/validators';
import { logger } from '../../../utils/logger';
import { pool } from '../../../database';

// Helper functions
export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

export function createErrorEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Erreur')
        .setDescription(description)
        .setTimestamp();
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

// MUSIC HANDLERS
export async function handleMusicConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'dj-role': {
            const role = interaction.options.getRole('role', true);
            await configManager.setSetting(guildId, 'music', 'dj_role', role.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Rôle DJ configuré',
                    `Seuls les membres avec le rôle ${role} pourront contrôler la musique.`
                )]
            });
            break;
        }

        case 'volume-default': {
            const volume = interaction.options.getInteger('volume', true);
            await configManager.setSetting(guildId, 'music', 'volume_default', volume);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Volume par défaut configuré',
                    `Le volume par défaut a été défini à **${volume}%**.`
                )]
            });
            break;
        }

        case 'queue-limit': {
            const limit = interaction.options.getInteger('limit', true);
            await configManager.setSetting(guildId, 'music', 'queue_limit', limit);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Limite de queue configurée',
                    `La queue peut maintenant contenir jusqu'à **${limit} titres**.`
                )]
            });
            break;
        }

        case 'auto-leave': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'music', 'auto_leave', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Déconnexion automatique',
                    `La déconnexion automatique a été ${enabled ? 'activée' : 'désactivée'}.`
                )]
            });
            break;
        }

        case 'auto-leave-time': {
            const seconds = interaction.options.getInteger('seconds', true);
            await configManager.setSetting(guildId, 'music', 'auto_leave_time', seconds);
            const minutes = Math.floor(seconds / 60);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Délai de déconnexion configuré',
                    `Le bot se déconnectera après **${minutes} minute(s)** d'inactivité.`
                )]
            });
            break;
        }

        case 'vote-skip': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'music', 'vote_skip', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Vote skip',
                    `Le vote pour skip a été ${enabled ? 'activé' : 'désactivé'}.`
                )]
            });
            break;
        }

        case 'vote-skip-percent': {
            const percent = interaction.options.getInteger('percent', true);
            await configManager.setSetting(guildId, 'music', 'vote_skip_percent', percent);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Pourcentage de vote configuré',
                    `Il faudra **${percent}%** des auditeurs pour skip une musique.`
                )]
            });
            break;
        }

        case 'restrict-channel': {
            const channel = interaction.options.getChannel('channel', true);
            await configManager.setSetting(guildId, 'music', 'music_channel', channel.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Salon musical restreint',
                    `Les commandes musicales ne fonctionneront que dans ${channel}.`
                )]
            });
            break;
        }

        case 'unrestrict-channel': {
            await configManager.deleteSetting(guildId, 'music', 'music_channel');
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Restriction retirée',
                    'Les commandes musicales fonctionnent maintenant dans tous les salons.'
                )]
            });
            break;
        }
    }
}

// AI HANDLERS
export async function handleAIConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'add-channel': {
            const channel = interaction.options.getChannel('channel', true);
            const channels = await configManager.getSetting(guildId, 'ai', 'ai_channels') || [];
            
            if (!channels.includes(channel.id)) {
                channels.push(channel.id);
                await configManager.setSetting(guildId, 'ai', 'ai_channels', channels);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Salon IA ajouté',
                        `L'IA répondra automatiquement dans ${channel}.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce salon est déjà configuré pour l\'IA.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'remove-channel': {
            const channel = interaction.options.getChannel('channel', true);
            let channels = await configManager.getSetting(guildId, 'ai', 'ai_channels') || [];
            
            if (channels.includes(channel.id)) {
                channels = channels.filter((id: string) => id !== channel.id);
                await configManager.setSetting(guildId, 'ai', 'ai_channels', channels);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Salon IA retiré',
                        `L'IA ne répondra plus automatiquement dans ${channel}.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce salon n\'est pas configuré pour l\'IA.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'list-channels': {
            const channels = await configManager.getSetting(guildId, 'ai', 'ai_channels') || [];
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🤖 Salons IA actifs')
                .setTimestamp();

            if (channels.length === 0) {
                embed.setDescription('Aucun salon configuré.');
            } else {
                const description = channels.map((id: string, i: number) => `${i + 1}. <#${id}>`).join('\n');
                embed.setDescription(description);
                embed.setFooter({ text: `Total: ${channels.length} salon(s)` });
            }

            await interaction.reply({ embeds: [embed] });
            break;
        }

        case 'response-chance': {
            const percent = interaction.options.getInteger('percent', true);
            await configManager.setSetting(guildId, 'ai', 'response_chance', percent);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Chance de réponse configurée',
                    `L'IA répondra avec **${percent}%** de chance aux messages (hors mentions).`
                )]
            });
            break;
        }

        case 'toxicity-threshold': {
            const threshold = interaction.options.getNumber('threshold', true);
            await configManager.setSetting(guildId, 'ai', 'toxicity_threshold', threshold);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Seuil de toxicité configuré',
                    `Les messages avec un score de toxicité > **${threshold}** seront signalés.`
                )]
            });
            break;
        }

        case 'auto-moderation': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'ai', 'auto_moderation', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Auto-modération IA',
                    `L'auto-modération IA a été ${enabled ? 'activée' : 'désactivée'}.`
                )]
            });
            break;
        }

        case 'context-length': {
            const length = interaction.options.getInteger('length', true);
            await configManager.setSetting(guildId, 'ai', 'context_length', length);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Longueur du contexte configurée',
                    `L'IA gardera les **${length} derniers messages** en contexte.`
                )]
            });
            break;
        }

        case 'system-prompt': {
            const prompt = interaction.options.getString('prompt', true);
            if (prompt.length > 1000) {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Le prompt système est trop long (max 1000 caractères).')],
                    ephemeral: true
                });
                return;
            }
            await configManager.setSetting(guildId, 'ai', 'system_prompt', prompt);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Prompt système configuré',
                    'Le prompt système personnalisé a été défini.'
                )]
            });
            break;
        }

        case 'reset-prompt': {
            await configManager.deleteSetting(guildId, 'ai', 'system_prompt');
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Prompt réinitialisé',
                    'Le prompt système par défaut a été restauré.'
                )]
            });
            break;
        }

        case 'max-tokens': {
            const tokens = interaction.options.getInteger('tokens', true);
            await configManager.setSetting(guildId, 'ai', 'max_tokens', tokens);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Tokens max configurés',
                    `Les réponses de l'IA seront limitées à **${tokens} tokens**.`
                )]
            });
            break;
        }
    }
}

// RPG HANDLERS
export async function handleRPGConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'starting-gold': {
            const amount = interaction.options.getInteger('amount', true);
            await configManager.setSetting(guildId, 'rpg', 'starting_gold', amount);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Or de départ configuré',
                    `Les nouveaux aventuriers commenceront avec **${amount} or**.`
                )]
            });
            break;
        }

        case 'starting-health': {
            const amount = interaction.options.getInteger('amount', true);
            await configManager.setSetting(guildId, 'rpg', 'starting_health', amount);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Santé de départ configurée',
                    `Les nouveaux aventuriers commenceront avec **${amount} HP**.`
                )]
            });
            break;
        }

        case 'daily-reward': {
            const amount = interaction.options.getInteger('amount', true);
            await configManager.setSetting(guildId, 'rpg', 'daily_reward', amount);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Récompense daily configurée',
                    `Le daily RPG donnera **${amount} or**.`
                )]
            });
            break;
        }

        case 'battle-cooldown': {
            const seconds = interaction.options.getInteger('seconds', true);
            await configManager.setSetting(guildId, 'rpg', 'battle_cooldown', seconds);
            const minutes = Math.floor(seconds / 60);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Cooldown de combat configuré',
                    `Les combats auront un cooldown de **${minutes} minute(s)** (${seconds}s).`
                )]
            });
            break;
        }

        case 'pvp': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'rpg', 'pvp_enabled', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'PvP',
                    `Les combats joueur contre joueur sont maintenant **${enabled ? 'activés' : 'désactivés'}**.`
                )]
            });
            break;
        }

        case 'monster-difficulty': {
            const difficulty = interaction.options.getString('difficulty', true);
            await configManager.setSetting(guildId, 'rpg', 'monster_difficulty', difficulty);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Difficulté configurée',
                    `La difficulté des monstres a été définie sur **${difficulty}**.`
                )]
            });
            break;
        }

        case 'quest-refresh': {
            const hours = interaction.options.getInteger('hours', true);
            await configManager.setSetting(guildId, 'rpg', 'quest_refresh_hours', hours);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Rafraîchissement des quêtes configuré',
                    `Les quêtes se rafraîchiront toutes les **${hours} heure(s)**.`
                )]
            });
            break;
        }

        case 'death-penalty': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'rpg', 'death_penalty', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Pénalité de mort',
                    `Les joueurs ${enabled ? 'perdront de l\'or' : 'ne perdront rien'} en mourant.`
                )]
            });
            break;
        }
    }
}

// TICKETS HANDLERS
export async function handleTicketsConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'ticket-category': {
            const category = interaction.options.getChannel('category', true);
            await configManager.setSetting(guildId, 'tickets', 'category_id', category.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Catégorie configurée',
                    `Les tickets seront créés dans la catégorie ${category}.`
                )]
            });
            break;
        }

        case 'support-role': {
            const role = interaction.options.getRole('role', true);
            await configManager.setSetting(guildId, 'tickets', 'support_role', role.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Rôle support configuré',
                    `Le rôle ${role} a été défini comme rôle support principal.`
                )]
            });
            break;
        }

        case 'add-support-role': {
            const role = interaction.options.getRole('role', true);
            const roles = await configManager.getSetting(guildId, 'tickets', 'support_roles') || [];
            
            if (!roles.includes(role.id)) {
                roles.push(role.id);
                await configManager.setSetting(guildId, 'tickets', 'support_roles', roles);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Rôle support ajouté',
                        `Le rôle ${role} peut maintenant gérer les tickets.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce rôle est déjà un rôle support.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'remove-support-role': {
            const role = interaction.options.getRole('role', true);
            let roles = await configManager.getSetting(guildId, 'tickets', 'support_roles') || [];
            
            if (roles.includes(role.id)) {
                roles = roles.filter((id: string) => id !== role.id);
                await configManager.setSetting(guildId, 'tickets', 'support_roles', roles);
                await interaction.reply({ 
                    embeds: [createSuccessEmbed(
                        'Rôle support retiré',
                        `Le rôle ${role} ne peut plus gérer les tickets.`
                    )]
                });
            } else {
                await interaction.reply({ 
                    embeds: [createErrorEmbed('Ce rôle n\'est pas un rôle support.')],
                    ephemeral: true
                });
            }
            break;
        }

        case 'list-support-roles': {
            const roles = await configManager.getSetting(guildId, 'tickets', 'support_roles') || [];
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎫 Rôles support')
                .setTimestamp();

            if (roles.length === 0) {
                embed.setDescription('Aucun rôle support configuré.');
            } else {
                const description = roles.map((id: string, i: number) => `${i + 1}. <@&${id}>`).join('\n');
                embed.setDescription(description);
                embed.setFooter({ text: `Total: ${roles.length} rôle(s)` });
            }

            await interaction.reply({ embeds: [embed] });
            break;
        }

        case 'max-tickets': {
            const count = interaction.options.getInteger('count', true);
            await configManager.setSetting(guildId, 'tickets', 'max_tickets', count);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Limite de tickets configurée',
                    `Les utilisateurs peuvent avoir jusqu'à **${count} tickets** ouverts simultanément.`
                )]
            });
            break;
        }

        case 'ticket-channel': {
            const channel = interaction.options.getChannel('channel', true);
            await configManager.setSetting(guildId, 'tickets', 'ticket_channel', channel.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Salon de création configuré',
                    `Les utilisateurs pourront créer des tickets depuis ${channel}.`
                )]
            });
            break;
        }

        case 'auto-close-time': {
            const hours = interaction.options.getInteger('hours', true);
            await configManager.setSetting(guildId, 'tickets', 'auto_close_hours', hours);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Fermeture automatique configurée',
                    `Les tickets inactifs seront fermés après **${hours} heure(s)**.`
                )]
            });
            break;
        }

        case 'transcripts': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'tickets', 'transcripts_enabled', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Transcripts',
                    `Les transcripts sont maintenant **${enabled ? 'activés' : 'désactivés'}**.`
                )]
            });
            break;
        }

        case 'transcript-channel': {
            const channel = interaction.options.getChannel('channel', true);
            await configManager.setSetting(guildId, 'tickets', 'transcript_channel', channel.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Salon transcripts configuré',
                    `Les transcripts seront envoyés dans ${channel}.`
                )]
            });
            break;
        }
    }
}

// GIVEAWAYS HANDLERS
export async function handleGiveawaysConfig(interaction: ChatInputCommandInteraction, subcommand: string) {
    const guildId = interaction.guild!.id;

    switch (subcommand) {
        case 'giveaway-role': {
            const role = interaction.options.getRole('role', true);
            await configManager.setSetting(guildId, 'giveaways', 'required_role', role.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Rôle requis configuré',
                    `Seuls les membres avec ${role} pourront participer aux giveaways.`
                )]
            });
            break;
        }

        case 'remove-giveaway-role': {
            await configManager.deleteSetting(guildId, 'giveaways', 'required_role');
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Condition retirée',
                    'Tous les membres peuvent maintenant participer aux giveaways.'
                )]
            });
            break;
        }

        case 'min-account-age': {
            const days = interaction.options.getInteger('days', true);
            await configManager.setSetting(guildId, 'giveaways', 'min_account_age_days', days);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Âge de compte minimum configuré',
                    `Les comptes doivent avoir au moins **${days} jour(s)** pour participer.`
                )]
            });
            break;
        }

        case 'min-server-age': {
            const days = interaction.options.getInteger('days', true);
            await configManager.setSetting(guildId, 'giveaways', 'min_server_age_days', days);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Ancienneté serveur minimum configurée',
                    `Les membres doivent être sur le serveur depuis au moins **${days} jour(s)**.`
                )]
            });
            break;
        }

        case 'max-winners': {
            const count = interaction.options.getInteger('count', true);
            await configManager.setSetting(guildId, 'giveaways', 'max_winners', count);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Gagnants max configurés',
                    `Les giveaways pourront avoir jusqu'à **${count} gagnants**.`
                )]
            });
            break;
        }

        case 'dm-winners': {
            const status = interaction.options.getString('status', true);
            const enabled = ConfigValidators.parseBoolean(status);
            await configManager.setSetting(guildId, 'giveaways', 'dm_winners', enabled);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'DM aux gagnants',
                    `Les gagnants ${enabled ? 'recevront' : 'ne recevront pas'} de DM.`
                )]
            });
            break;
        }

        case 'host-role': {
            const role = interaction.options.getRole('role', true);
            await configManager.setSetting(guildId, 'giveaways', 'host_role', role.id);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(
                    'Rôle hôte configuré',
                    `Seuls les membres avec ${role} pourront créer des giveaways.`
                )]
            });
            break;
        }
    }
}
