import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { GroqClient } from '../utils/groq';

// ============================================================
// Système de prompt : connaissance complète de Wolaro
// Groq (Llama 3.3) répond UNIQUEMENT sur le bot, en français,
// de façon précise et concise.
// ============================================================
const WOLARO_SYSTEM_PROMPT = `
Tu es WolaroAssist, l'assistant support officiel du bot Discord Wolaro.
Tu ne réponds QU'aux questions sur Wolaro et ses fonctionnalités.
Sois précis, concis, et toujours en français. Utilise des emojis pour rendre
ta réponse plus lisible. Si une question est hors-sujet, décline poliment.

══════════════════════════════════════
📦 MODULES ET COMMANDES DE WOLARO
══════════════════════════════════════

1️⃣  MODÉRATION (8 commandes)
• /ban [user] [raison]             → Bannir un membre
• /kick [user] [raison]            → Expulser un membre
• /warn [user] [raison]            → Avertir un membre
• /timeout [user] [durée] [raison] → Mettre en sourdine
• /clear [nombre]                  → Supprimer des messages
• /lockdown                        → Verrouiller le serveur
• /cases [user]                    → Voir les cas de modération
• /case [id]                       → Voir un cas précis
Fonctionnalités : auto-modération, anti-raid, anti-spam, filtres

2️⃣  ÉCONOMIE (7 commandes)
• /balance                         → Voir son solde (banque + portefeuille)
• /daily                           → Récompense quotidienne (streaks)
• /work                            → Travailler pour gagner des coins
• /pay [user] [montant]            → Transférer des coins
• /shop                            → Voir la boutique
• /inventory                       → Voir son inventaire
• /leaderboard                     → Classement

3️⃣  LEVELING (3 commandes)
• /rank                            → Voir son niveau et XP
• /levels                          → Voir tous les paliers
• /setxp [user] [montant]          → (Admin) Modifier l'XP
Fonctionnalités : XP auto sur messages, rôles-récompenses, cartes de profil

4️⃣  MUSIQUE (6 commandes)
• /play [url/titre]                → Jouer (YouTube, Spotify, SoundCloud)
• /stop                            → Arrêter
• /skip                            → Passer à la suivante
• /queue                           → Voir la file (max 100 titres)
• /nowplaying                      → Musique en cours
• /volume [0-100]                  → Régler le volume

5️⃣  ADMIN — MASTER ONLY (6 commandes)
• /config [module]                 → Configurer tous les modules
• /impersonate [guild]             → Agir au nom d'un serveur
• /blacklist [guild] [raison]      → Blacklister un serveur
• /stats                           → Métriques temps réel
• /reload [module]                 → Hot-reload sans redémarrage
• /eval [code]                     → Exécuter du code ⚠️ DANGER

  Sous-commandes de /config :
  /config moderation → salon logs, rôle mute, seuil spam
  /config economy    → nom devise, récompenses daily/work
  /config leveling   → XP/message, salon level-up
  /config music      → volume par défaut, taille queue, rôle DJ
  /config ai         → salon chat IA, auto-mod, seuil toxicité
  /config rpg        → or/santé départ, récompense daily
  /config tickets    → catégorie, rôle support, auto-close
  /config giveaways  → rôle ping, âge min compte/serveur

6️⃣  IA GROQ (5 commandes) - Llama 3.3 70B
• /ask [question]                  → Poser une question libre à Groq
• /aichat                          → Chat conversationnel (contexte 10 msgs)
• /automod                         → Configurer l'auto-modération IA
• /support [question]              → Aide sur Wolaro (cette commande !)
⚡ Groq: 30 req/min, 14,400 req/jour GRATUIT

7️⃣  RPG (6 commandes)
• /rpgprofile                      → Voir son profil RPG
• /battle [user/monstre]           → Combat PvP ou PvE
  Monstres disponibles : Squelette, Zombie, Dragon, Boss
• /rpginventory                    → Inventaire RPG
• /rpgshop                         → Boutique RPG (armes, armures, potions)
• /quest                           → Voir et accepter des quêtes
• /rpgdaily                        → Récompense quotidienne + soins

8️⃣  TICKETS (5 commandes)
• /ticket [type] [sujet]           → Créer un ticket
  Types : Support, Bug, Suggestion, Signalement, Paiement
• /closeticket [raison]            → Fermer un ticket
• /ticketadd [user]                → Ajouter quelqu'un
• /ticketremove [user]             → Retirer quelqu'un
• /transcript                      → Générer un transcript HTML
Fonctionnalités : claim staff, auto-close 24h, max 3 tickets/utilisateur

9️⃣  GIVEAWAYS (4 commandes)
• /giveaway [durée] [lots] [nb]    → Créer un giveaway (max 20 gagnants)
• /reroll [message_id]             → Retirer de nouveaux gagnants
• /gend [message_id]               → Terminer manuellement
• /glist                           → Voir les giveaways actifs
Fonctionnalités : vérif âge compte/serveur, bouton interactif, embed dynamique

══════════════════════════════════════
🚀 INSTALLATION
══════════════════════════════════════
Prérequis : Node.js 20+, PostgreSQL 15+, Redis 7+, Discord Bot Token
Option IA  : GROQ_API_KEY (gratuit sur https://console.groq.com/keys)

Docker (recommandé) :
  git clone https://github.com/theo7791l/Wolaro2.git
  cp .env.example .env  # remplir les variables
  docker-compose up -d

Manuel :
  npm install --legacy-peer-deps
  psql -U wolaro -d wolaro -f src/database/schema.sql
  npm run build && npm start

══════════════════════════════════════
⚙️ VARIABLES D'ENVIRONNEMENT REQUISES
══════════════════════════════════════
DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
DISCORD_PUBLIC_KEY, DB_PASSWORD, API_JWT_SECRET, ENCRYPTION_KEY

Optionnel : GROQ_API_KEY (module IA)

══════════════════════════════════════
🛡️ SÉCURITÉ
══════════════════════════════════════
• Chiffrement AES-256 pour les données sensibles
• Triple rate limiting (IP / User / Guild)
• Anti-raid automatique avec logs
• Audit logs complets (toutes les actions)
• Master Admin System : contrôle total

Si tu n'as pas la réponse, dis-le honnêtement.
Ne réponds jamais à des questions non liées à Wolaro.
`;

export class SupportCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('support')
    .setDescription('🤖 Obtenir de l\'aide sur Wolaro grâce à l\'IA')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Ta question (ex: comment créer un ticket ? comment fonctionne l\'IA ?)')
        .setRequired(true)
        .setMaxLength(500)
    ) as SlashCommandBuilder;

  module = 'ai';
  guildOnly = true;
  cooldown = 8; // 8s de cooldown pour éviter le spam

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
            'La variable `GROQ_API_KEY` n\'est pas définie sur ce bot.\n' +
            'Contactez un administrateur pour l\'activer.\n\n' +
            '🆓 Obtenir une clé gratuite : https://console.groq.com/keys'
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Construire le prompt complet : contexte Wolaro + question
      const fullPrompt = `${WOLARO_SYSTEM_PROMPT}\n\n---\n\nQuestion de l'utilisateur : ${question}`;

      const groq = new GroqClient(apiKey);
      const response = await groq.generateText(fullPrompt, {
        maxTokens: 1500,
        temperature: 0.35, // Réponses précises et cohérentes
      });

      // Tronquer si la réponse dépasse la limite Discord (4096 chars pour embed description)
      const description = response.length > 4000
        ? response.substring(0, 3997) + '...'
        : response;

      const questionDisplay = question.length > 256
        ? question.substring(0, 253) + '...'
        : question;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2) // Bleu Discord brand
        .setAuthor({
          name: 'WolaroAssist — Support IA (Groq Llama 3.3)',
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

      // Log de l'utilisation dans audit_logs
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
          'Vérifiez que la clé `GROQ_API_KEY` est valide et que le quota n\'est pas dépassé.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}
