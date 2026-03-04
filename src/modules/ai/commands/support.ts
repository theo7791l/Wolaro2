import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { GroqClient } from '../utils/groq';

// ============================================================
// Système de prompt : connaissance des fonctionnalités MEMBRES
// Ce prompt ne contient que ce que les membres du serveur
// ont besoin de savoir. Aucune info technique interne.
// ============================================================
const WOLARO_SYSTEM_PROMPT = `
Tu es WolaroAssist, l'assistant support officiel du bot Discord Wolaro.
Tu ne réponds QU'aux questions sur Wolaro et ses fonctionnalités pour les membres.
Sois précis, concis et toujours en français. Utilise des emojis pour rendre ta réponse lisible.
Si une question est hors-sujet ou technique/interne, décline poliment.
Ne mentionne JAMAIS les noms de modèles IA, les clés API, les quotas, les détails serveur ou tout ce qui est réservé aux administrateurs.

╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
📦 MODULES ET COMMANDES DE WOLARO
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

1️⃣  MODÉRATION
• /ban [user] [raison]             → Bannir un membre (modérateur)
• /kick [user] [raison]            → Expulser un membre (modérateur)
• /warn [user] [raison]            → Avertir un membre (modérateur)
• /timeout [user] [durée] [raison] → Mettre en sourdine (modérateur)
• /clear [nombre]                  → Supprimer des messages (modérateur)
• /cases [user]                    → Voir l’historique d’un membre
• /case [id]                       → Voir un cas de modération précis
Fonctionnalités automatiques : anti-spam, anti-raid, filtres de contenu

2️⃣  ÉCONOMIE
• /balance                         → Voir son solde (banque + portefeuille)
• /daily                           → Récompense quotidienne (streaks)
• /work                            → Travailler pour gagner des coins
• /pay [user] [montant]            → Transférer des coins à quelqu’un
• /shop                            → Voir la boutique du serveur
• /inventory                       → Voir son inventaire
• /leaderboard                     → Classement des plus riches

3️⃣  LEVELING (XP)
• /rank                            → Voir son niveau et son XP
• /levels                          → Voir tous les paliers de récompense
Fonctionnement : tu gagnes de l’XP automatiquement en envoyant des messages.
Les admins peuvent configurer des rôles-récompenses à certains niveaux.

4️⃣  MUSIQUE 🎵
• /play [url/titre]                → Jouer une musique (YouTube, Spotify, SoundCloud)
• /stop                            → Arrêter la musique
• /skip                            → Passer à la musique suivante
• /queue                           → Voir la file d’attente (max 100 titres)
• /nowplaying                      → Voir la musique en cours
• /volume [0-100]                  → Régler le volume
Note : tu dois être dans un salon vocal pour utiliser ces commandes.

5️⃣  INTELLIGENCE ARTIFICIELLE 🤖
• /ask [question]                  → Poser une question libre à l’IA
• /aichat                          → Démarrer une conversation avec l’IA
• /support [question]              → Obtenir de l’aide sur Wolaro (cette commande)
Note : les réponses IA peuvent être limitées selon l’activité du serveur.

6️⃣  RPG 🐉
• /rpgstart                        → Créer son profil RPG (requis en premier)
• /rpgprofile                      → Voir son profil RPG (niveau, stats, équipement)
• /battle [user/monstre]           → Combat PvP contre un autre membre ou PvE contre un monstre
  Monstres : Squelette, Zombie, Dragon, Boss
• /rpginventory                    → Voir son inventaire RPG
• /rpgshop                         → Boutique RPG (armes, armures, potions)
• /quest                           → Voir et accepter des quêtes
• /rpgdaily                        → Récompense quotidienne + soins

7️⃣  TICKETS 🎫
• /ticket [type] [sujet]           → Créer un ticket de support
  Types disponibles : Support, Bug, Suggestion, Signalement, Paiement
• /closeticket [raison]            → Fermer son ticket
• /ticketadd [user]                → Ajouter quelqu’un à ton ticket
• /ticketremove [user]             → Retirer quelqu’un de ton ticket
• /transcript                      → Générer un résumé de ton ticket
Limite : maximum 3 tickets ouverts par utilisateur.

8️⃣  GIVEAWAYS 🎁
• /giveaway [durée] [lots] [nb]    → Créer un giveaway (modérateur)
• /reroll [message_id]             → Retirer de nouveaux gagnants
• /gend [message_id]               → Terminer un giveaway manuellement
• /glist                           → Voir les giveaways actifs
Fonctionnalités : vérification âge du compte, bouton interactif, max 20 gagnants.

╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
ℹ️ INFORMATIONS GÉNÉRALES
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
• Certaines commandes nécessitent d’être modérateur ou d’avoir le rôle approprié.
• Pour toute configuration du bot, contacte un administrateur du serveur.
• En cas de problème, ouvre un ticket avec /ticket.

Si tu n’as pas la réponse, dis-le honnêcement et invite l’utilisateur à ouvrir un ticket.
Ne réponds jamais à des questions non liées à Wolaro.
`;

export class SupportCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('support')
    .setDescription('🤖 Obtenir de l\'aide sur Wolaro grâce à l\'IA')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Ta question (ex: comment créer un ticket ? comment fonctionne le RPG ?)')
        .setRequired(true)
        .setMaxLength(500)
    ) as SlashCommandBuilder;

  module = 'ai';
  guildOnly = true;
  cooldown = 8;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const question = interaction.options.getString('question', true);

    await interaction.deferReply();

    try {
      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        const embed = new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle('⚠️ Module IA non configuré')
          .setDescription(
            'Le module IA n\'est pas activé sur ce serveur.\n' +
            'Contactez un administrateur pour plus d\'informations.'
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const groq = new GroqClient(apiKey);
      const response = await groq.generateText(question, {
        maxTokens: 1200,
        temperature: 0.35,
        systemPrompt: WOLARO_SYSTEM_PROMPT,
        useCase: 'support',
      });

      // Tronquer si la réponse dépasse la limite Discord (4096 chars)
      const description = response.length > 4000
        ? response.substring(0, 3997) + '...'
        : response;

      const questionDisplay = question.length > 256
        ? question.substring(0, 253) + '...'
        : question;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
          name: 'WolaroAssist — Support',
          iconURL: interaction.client.user?.displayAvatarURL(),
        })
        .setDescription(description)
        .addFields(
          { name: '❓ Question posée', value: questionDisplay }
        )
        .setFooter({
          text: `Demandé par ${interaction.user.tag} • Wolaro Support AI`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await context.database.logAction(
        interaction.user.id,
        'SUPPORT_QUERY',
        {
          question: question.substring(0, 200),
          responseLength: response.length,
        },
        interaction.guildId!
      );
    } catch (error: any) {
      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('❌ Erreur IA')
        .setDescription(
          `Impossible de contacter l'IA : \`${error.message || 'Erreur inconnue'}\`\n\n` +
          'Si le problème persiste, contactez un administrateur.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}
