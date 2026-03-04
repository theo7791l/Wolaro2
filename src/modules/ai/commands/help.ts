import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

// ============================================================
// Toutes les catégories de commandes Wolaro2
// Mise à jour ici quand une commande est ajoutée/supprimée.
// ============================================================

const CATEGORIES: Record<string, { emoji: string; label: string; desc: string; commands: { name: string; desc: string; access: string }[] }> = {
  general: {
    emoji: '🏠',
    label: 'Général',
    desc: 'Commandes de base accessibles à tous.',
    commands: [
      { name: '/help',         desc: 'Afficher ce menu d\'aide',                   access: '👥 Tous' },
      { name: '/support',      desc: 'Poser une question à l\'IA Wolaro',           access: '👥 Tous' },
      { name: '/ask',          desc: 'Poser une question libre à l\'IA (Llama)',    access: '👥 Tous' },
      { name: '/aichat',       desc: 'Chat conversationnel avec l\'IA',             access: '👥 Tous' },
    ],
  },
  economy: {
    emoji: '💰',
    label: 'Économie',
    desc: 'Gagne et dépense des coins sur le serveur.',
    commands: [
      { name: '/balance',      desc: 'Voir ton solde (banque + portefeuille)',      access: '👥 Tous' },
      { name: '/daily',        desc: 'Récompense quotidienne avec streak',          access: '👥 Tous' },
      { name: '/work',         desc: 'Travailler pour gagner des coins',            access: '👥 Tous' },
      { name: '/pay',          desc: 'Transférer des coins à quelqu\'un',           access: '👥 Tous' },
      { name: '/shop',         desc: 'Voir la boutique du serveur',                 access: '👥 Tous' },
      { name: '/inventory',    desc: 'Voir ton inventaire',                         access: '👥 Tous' },
      { name: '/leaderboard',  desc: 'Classement des plus riches',                  access: '👥 Tous' },
    ],
  },
  leveling: {
    emoji: '⭐',
    label: 'Leveling (XP)',
    desc: 'Gagne de l\'XP en discutant et monte de niveau.',
    commands: [
      { name: '/rank',         desc: 'Voir ton niveau et ton XP',                  access: '👥 Tous' },
      { name: '/levels',       desc: 'Voir tous les paliers de récompense',         access: '👥 Tous' },
      { name: '/setxp',        desc: 'Modifier l\'XP d\'un membre',                 access: '🛡️ Admin' },
    ],
  },
  music: {
    emoji: '🎵',
    label: 'Musique',
    desc: 'Écoute de la musique dans les salons vocaux.',
    commands: [
      { name: '/play',         desc: 'Jouer une musique (YouTube, Spotify…)',       access: '👥 Tous' },
      { name: '/stop',         desc: 'Arrêter la musique et vider la file',         access: '👥 Tous' },
      { name: '/skip',         desc: 'Passer à la piste suivante',                  access: '👥 Tous' },
      { name: '/queue',        desc: 'Voir la file d\'attente (max 100)',            access: '👥 Tous' },
      { name: '/nowplaying',   desc: 'Voir la musique en cours',                    access: '👥 Tous' },
      { name: '/volume',       desc: 'Régler le volume (0-100)',                    access: '👥 Tous' },
    ],
  },
  rpg: {
    emoji: '⚔️',
    label: 'RPG',
    desc: 'Système RPG avec combats, classes, quêtes et équipement.',
    commands: [
      { name: '/rpgstart',     desc: 'Créer ton profil RPG et choisir ta classe',   access: '👥 Tous' },
      { name: '/rpgprofile',   desc: 'Voir ton profil RPG (stats, niveau, or)',     access: '👥 Tous' },
      { name: '/battle',       desc: 'Combattre un membre (PvP) ou un monstre (PvE)', access: '👥 Tous' },
      { name: '/rpginventory', desc: 'Voir ton inventaire RPG',                     access: '👥 Tous' },
      { name: '/rpgshop',      desc: 'Boutique RPG (armes, armures, potions)',      access: '👥 Tous' },
      { name: '/quest',        desc: 'Voir et accepter des quêtes',                 access: '👥 Tous' },
      { name: '/rpgdaily',     desc: 'Récompense quotidienne RPG + soins',          access: '👥 Tous' },
    ],
  },
  tickets: {
    emoji: '🎫',
    label: 'Tickets',
    desc: 'Ouvre un ticket pour contacter le support.',
    commands: [
      { name: '/ticket',       desc: 'Créer un ticket de support',                  access: '👥 Tous' },
      { name: '/closeticket',  desc: 'Fermer ton ticket',                           access: '👥 Tous' },
      { name: '/ticketadd',    desc: 'Ajouter quelqu\'un à ton ticket',             access: '👥 Tous' },
      { name: '/ticketremove', desc: 'Retirer quelqu\'un de ton ticket',            access: '👥 Tous' },
      { name: '/transcript',   desc: 'Générer un résumé HTML de ton ticket',        access: '🛡️ Staff' },
    ],
  },
  giveaways: {
    emoji: '🎁',
    label: 'Giveaways',
    desc: 'Crée et gère des concours sur le serveur.',
    commands: [
      { name: '/giveaway',     desc: 'Créer un giveaway',                           access: '🛡️ Modérateur' },
      { name: '/gend',         desc: 'Terminer un giveaway manuellement',           access: '🛡️ Modérateur' },
      { name: '/greroll',      desc: 'Retirer de nouveaux gagnants',                access: '🛡️ Modérateur' },
      { name: '/glist',        desc: 'Voir les giveaways actifs',                   access: '👥 Tous' },
    ],
  },
  moderation: {
    emoji: '🛡️',
    label: 'Modération',
    desc: 'Outils de modération — réservés aux modérateurs.',
    commands: [
      { name: '/ban',          desc: 'Bannir un membre',                            access: '🛡️ Modérateur' },
      { name: '/kick',         desc: 'Expulser un membre',                          access: '🛡️ Modérateur' },
      { name: '/warn',         desc: 'Avertir un membre',                           access: '🛡️ Modérateur' },
      { name: '/timeout',      desc: 'Mettre un membre en sourdine',                access: '🛡️ Modérateur' },
      { name: '/clear',        desc: 'Supprimer des messages en masse',             access: '🛡️ Modérateur' },
      { name: '/lockdown',     desc: 'Verrouiller tous les salons',                 access: '🛡️ Admin' },
      { name: '/cases',        desc: 'Voir l\'historique de modération d\'un membre', access: '🛡️ Modérateur' },
      { name: '/case',         desc: 'Voir un cas de modération précis',            access: '🛡️ Modérateur' },
    ],
  },
  admin: {
    emoji: '⚙️',
    label: 'Administration',
    desc: 'Configuration du bot — réservé aux administrateurs.',
    commands: [
      { name: '/config',       desc: 'Configurer tous les modules du bot',          access: '⚙️ Admin' },
      { name: '/setxp',        desc: 'Modifier l\'XP d\'un membre',                 access: '⚙️ Admin' },
      { name: '/automod',      desc: 'Activer/désactiver l\'auto-modération IA',    access: '⚙️ Admin' },
    ],
  },
};

function buildEmbed(categoryKey: string): EmbedBuilder {
  const cat = CATEGORIES[categoryKey];
  const lines = cat.commands.map(
    c => `\`${c.name}\` — ${c.desc} *(${c.access})*`
  );

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(`${cat.desc}\n\u200b`)
    .addFields({ name: '📋 Commandes', value: lines.join('\n') })
    .setFooter({ text: 'Wolaro2 • Sélectionne une catégorie dans le menu ci-dessous' })
    .setTimestamp();
}

function buildMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = Object.entries(CATEGORIES).map(([key, cat]) => ({
    label: `${cat.emoji} ${cat.label}`,
    description: cat.desc.substring(0, 100),
    value: key,
  }));

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('📂 Choisir une catégorie…')
      .addOptions(options)
  );
}

export class HelpCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Voir toutes les commandes de Wolaro2 par catégorie') as SlashCommandBuilder;

  module = 'ai';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, _context: ICommandContext): Promise<void> {
    const embed  = buildEmbed('general');
    const menu   = buildMenu();

    const reply = await interaction.reply({
      embeds: [embed],
      components: [menu],
      fetchReply: true,
    });

    // Listen for menu interactions for 2 minutes
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      const selected = i.values[0];
      await i.update({
        embeds: [buildEmbed(selected)],
        components: [buildMenu()],
      });
    });

    collector.on('end', async () => {
      const disabledMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        StringSelectMenuBuilder.from(menu.components[0]).setDisabled(true)
      );
      await interaction.editReply({ components: [disabledMenu] }).catch(() => {});
    });
  }
}
