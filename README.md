# 🤖 Wolaro - Discord Bot Multi-Tenant Enterprise

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.7.3-blue.svg)
![Status](https://img.shields.io/badge/status-production%20ready-brightgreen.svg)

**Wolaro** est un bot Discord professionnel avec architecture multi-tenant, 9 modules complets, IA Gemini, système RPG, tickets de support et giveaways automatiques.

## ⚠️ MISE À JOUR CRITIQUE - 25 Février 2026 06h18

🎉 **COMMANDE /CONFIG AJO TOUTÉE ET BUGS CORRIGÉS !**

### Dernières corrections (25 février 06h18)
- ✅ Commande `/config` ajoutée au module admin
- ✅ Bug #1: Validation work_min > work_max
- ✅ Bug #2: Vérification existence guild (FK violation)
- ✅ Bug #3: Transaction avec lock (race condition)
- ✅ Bug #4: Audit log non-bloquant
- ✅ Bug #5: Vérification permissions channels
- ✅ Bug #6: Documentation type Number vs Integer

### Corrections précédentes (23 février 18h30)
- ✅ Table `raid_events` ajoutée au schéma SQL
- ✅ Bug regex dans `security.ts` corrigé
- ✅ Variable shadowing dans WebSocket corrigée
- ✅ Méthode `start()` WebSocket ajoutée
- ✅ Shutdown WebSocket complet
- ✅ Requête SQL WebSocket optimisée

**👉 Voir tous les détails : [BUG_FIXES_CRITICAL.md](BUG_FIXES_CRITICAL.md)**

**📍 Documentation complète :**
- [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) - Guide d'installation pas à pas
- [FIXES_APPLIED.md](FIXES_APPLIED.md) - Détail des premières corrections
- [BUG_FIXES_CRITICAL.md](BUG_FIXES_CRITICAL.md) - Bugs critiques récents corrigés

---

## ✨ Fonctionnalités Principales

### 🏭 Architecture Enterprise
- **Multi-tenant** : Un seul bot pour des milliers de serveurs
- **Modules dynamiques** : Hot-reload sans redémarrage
- **Scalabilité** : Cluster mode avec auto-scaling
- **Cache Redis** : Performance optimale (<5ms)
- **PostgreSQL** : Base de données robuste (22 tables)
- **API REST + WebSocket** : Interface complète

### 🛡️ Sécurité Militaire
- **Master Admin System** : Contrôle total par owner
- **Rate Limiting** : Triple couche (IP/User/Guild)
- **Anti-Raid** : Détection automatique avec logging
- **Anti-Spam** : Protection temps réel
- **Encryption AES-256** : Données sensibles
- **Audit Logs** : Traçabilité complète

### 📦 9 Modules Complets (49 Commandes)

#### 1️⃣ Moderation (8 commandes)
```
/ban, /kick, /warn, /timeout, /clear, /lockdown, /cases, /case
```
- Auto-modération avec patterns
- Système de cases numérotés
- Anti-raid et anti-spam intégrés
- Filtres personnalisables

#### 2️⃣ Economy (7 commandes)
```
/balance, /daily, /work, /pay, /shop, /inventory, /leaderboard
```
- Système banque + portefeuille
- Streaks quotidiens avec bonus
- Boutique configurable par serveur
- Leaderboard global et par serveur

#### 3️⃣ Leveling (3 commandes)
```
/rank, /levels, /setxp
```
- XP automatique sur messages
- Récompenses par niveaux (rôles)
- Cartes de profil personnalisées
- Stack ou replace roles

#### 4️⃣ Music (6 commandes)
```
/play, /stop, /skip, /queue, /nowplaying, /volume
```
- Support YouTube, Spotify, SoundCloud
- Queue de 100 titres
- Filtres audio (bass boost, nightcore)
- Auto-leave configurable

#### 5️⃣ Admin - Master Only (6 commandes) 🆕
```
/config, /impersonate, /blacklist, /stats, /reload, /eval
```
- **⚙️ `/config`** : **Configurer tous les modules du bot** 🆕
  - `/config moderation` - Salon de logs, rôle mute, seuil spam
  - `/config economy` - Nom devise, récompenses daily/work
  - `/config leveling` - XP par message, salon level-up
  - `/config music` - Volume par défaut, taille queue, rôle DJ
  - `/config ai` - Salon chat IA, auto-modération, toxicité
  - `/config rpg` - Or/santé de départ, récompense daily
  - `/config tickets` - Catégorie, rôle support, auto-close
  - `/config giveaways` - Rôle ping, âge minimum compte/serveur
- `/impersonate` - Usurper n'importe quel serveur
- `/blacklist` - Blacklister des guilds avec raison
- `/stats` - Métriques système temps réel
- `/reload` - Hot-reload modules
- `/eval` - Code eval (danger zone)

#### 6️⃣ AI - Gemini (4 commandes) 🆕
```
/ask, /aichat, /aiimage, /automod
```
- **Chatbot conversationnel** avec contexte (10 derniers messages)
- **Analyse d'images** via Gemini Vision
- **Auto-modération IA** : Détection toxicité (0.0-1.0)
- **Chat automatique** dans salons configurés (10% chance ou mention)
- **Prompt système** personnalisable

#### 7️⃣ RPG (6 commandes) 🆕
```
/rpgprofile, /battle, /rpginventory, /rpgshop, /quest, /rpgdaily
```
- **Combat PvP** : Joueur vs Joueur avec dégâts ATK/DEF
- **Combat PvE** : 4 monstres (Squelette, Zombie, Dragon, Boss)
- **Progression** : Level, XP, Or, Santé, Attaque, Défense
- **Inventaire** : Armes, Armures, Potions, Accessoires
- **Quêtes** : 3 quêtes avec récompenses
- **Daily** : Récompense quotidienne + heal complet

#### 8️⃣ Tickets (5 commandes) 🆕
```
/ticket, /closeticket, /ticketadd, /ticketremove, /transcript
```
- **5 types** : Support, Bug, Suggestion, Signalement, Paiement
- **Permissions** : Support roles configurables
- **Transcripts HTML** : Historique complet avec timestamps
- **Claim system** : Revendication par staff
- **Auto-close** : Inactivité configurable (24h par défaut)
- **Max tickets** : Limite par utilisateur (3 par défaut)

#### 9️⃣ Giveaways (4 commandes) 🆕
```
/giveaway, /reroll, /gend, /glist
```
- **Sélection automatique** : Checker toutes les 10 secondes
- **Vérifications** : Âge compte, âge serveur, rôle requis
- **Reroll illimité** : Retirer nouveaux gagnants
- **Multi-gagnants** : Jusqu'à 20 gagnants
- **Bouton interactif** : Participation 1-click
- **Embed dynamique** : Mise à jour participants en temps réel

---

## 🚀 Installation Rapide

### 📍 Guide Complet

**Pour un guide d'installation détaillé avec toutes les étapes et la résolution des problèmes :**

👉 **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)**

### Prérequis
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Discord Bot Token
- Gemini API Key (pour module AI)

### Installation Standard

```bash
# 1. Cloner le dépôt
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# 2. Installer les dépendances
npm install --legacy-peer-deps

# 3. Configuration
cp .env.example .env
nano .env  # Remplir toutes les variables requises

# 4. Initialiser la base de données
psql -U wolaro -d wolaro -f src/database/schema.sql

# 5. Compiler et démarrer
npm run build
npm start
```

### 👨‍💻 Installation Windows

**Sur Windows, il faut installer les outils de build :**

```powershell
# Exécuter en tant qu'Administrateur
npm install --global windows-build-tools

# Puis installation normale
npm install --legacy-peer-deps
npm run build
npm start
```

**👉 Guide Windows complet : [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)**

### 🐳 Installation Docker (Recommandé)

```bash
# 1. Cloner et configurer
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
cp .env.example .env
nano .env  # ou notepad .env sur Windows

# 2. Lancer la stack complète (PostgreSQL + Redis + Bot)
docker-compose up -d

# 3. Voir les logs
docker-compose logs -f bot
```

---

## ⚙️ Configuration

### Variables d'Environnement Obligatoires

```env
# Discord (requis)
DISCORD_TOKEN=ton_token_discord_ici
DISCORD_CLIENT_ID=ton_client_id_ici
DISCORD_CLIENT_SECRET=ton_client_secret_ici
DISCORD_PUBLIC_KEY=ta_public_key_ici  # ⚠️ OBLIGATOIRE maintenant

# Base de données (requis)
DB_PASSWORD=ton_mot_de_passe_postgresql_ici

# Sécurité (requis)
API_JWT_SECRET=genere_une_chaine_aleatoire_de_32_caracteres_minimum
ENCRYPTION_KEY=genere_exactement_32_caracteres_pour_AES256

# IA (optionnel mais recommandé)
GEMINI_API_KEY=ta_cle_api_gemini_ici
```

**Comment obtenir les clés Discord :**
1. Aller sur https://discord.com/developers/applications
2. Créer une nouvelle application ou sélectionner une existante
3. **Bot** > Token : `DISCORD_TOKEN`
4. **OAuth2** > Client ID : `DISCORD_CLIENT_ID`
5. **OAuth2** > Client Secret : `DISCORD_CLIENT_SECRET`
6. **General Information** > Public Key : `DISCORD_PUBLIC_KEY`

**Générer des clés aléatoires :**
```bash
# API_JWT_SECRET (32+ caractères)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (exactement 32 caractères)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**👉 Voir `.env.example` pour toutes les variables disponibles**

---

## 📊Base de Données

### 22 Tables PostgreSQL

```
✓ guilds                    # Multi-tenant core
✓ guild_members             # Permissions panel & sync
✓ guild_modules             # Configuration modules
✓ guild_settings            # Paramètres serveur
✓ panel_sessions            # Sessions panel wolaro.fr
✓ global_profiles           # Profils utilisateurs
✓ master_admins             # Super admins
✓ audit_logs                # Logs sécurité
✓ rate_limits               # Rate limiting
✓ raid_events               # Anti-raid detection 🆕
✓ guild_economy             # Économie par serveur
✓ global_economy            # Économie globale
✓ moderation_cases          # Cas de modération
✓ rpg_profiles              # Profils RPG
✓ tickets                   # Système tickets
✓ giveaways                 # Concours
✓ giveaway_participants     # Participants
✓ leveling_profiles         # Profiles système leveling
✓ custom_commands           # Commandes custom
✓ guild_analytics           # Analytics
✓ backdoor_logs             # Logs master admin
✓ shard_stats               # Stats infrastructure sharding
```

---

## 🔌 API REST

### Endpoints Disponibles

```
GET    /api/health              # Health check
POST   /api/auth/login          # OAuth2 Discord
GET    /api/auth/me             # User info

GET    /api/guilds              # List guilds
GET    /api/guilds/:id          # Guild details
PATCH  /api/guilds/:id          # Update guild

GET    /api/guilds/:id/modules  # List modules
PATCH  /api/guilds/:id/modules/:name  # Toggle/config module

GET    /api/admin/stats         # System stats (master only)
POST   /api/admin/blacklist     # Blacklist guild (master only)
POST   /api/admin/reload        # Reload module (master only)
```

### WebSocket Events

```javascript
// Connection
ws://localhost:3001

// Events
'guild:update'       // Guild config changed
'module:toggle'      // Module enabled/disabled
'command:executed'   // Command used
'analytics:update'   // Metrics update
```

---

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Mode watch
npm run test:watch

# Avec coverage
npm run test:coverage
```

---

## 📚 Documentation

- **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)** - Guide d'installation complet avec troubleshooting 🆕
- **[FIXES_APPLIED.md](FIXES_APPLIED.md)** - Détail des premières corrections (16h00) 🆕
- **[BUG_FIXES_CRITICAL.md](BUG_FIXES_CRITICAL.md)** - Bugs critiques récents (18h30) 🆕
- **[INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)** - Guide installation Windows avec Docker
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Design patterns et diagrammes
- **[MODULES.md](docs/MODULES.md)** - Guide création de modules
- **[SECURITY.md](docs/SECURITY.md)** - Best practices sécurité
- **[API.md](docs/API.md)** - Documentation API complète
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Guide déploiement production
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Guide contribution

---

## 🎯 Roadmap

### Version 1.1.0 (Q2 2026)
- [ ] Panel web React avec OAuth2
- [ ] Command Designer drag-and-drop
- [ ] Template Marketplace
- [ ] Multi-language support (i18n)
- [ ] Voice AI features

### Version 1.2.0 (Q3 2026)
- [ ] Analytics dashboard avancé
- [ ] Custom bot branding per guild
- [ ] Webhook integrations
- [ ] Mobile app companion

### Version 2.0.0 (Q4 2026)
- [ ] Microservices architecture
- [ ] GraphQL API
- [ ] Kubernetes native
- [ ] AI voice channels

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md)

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

---

## 📜 Licence

Ce projet est sous licence MIT - voir [LICENSE](LICENSE)

---

## 🙏 Remerciements

- Discord.js pour l'API Discord
- Google Gemini pour l'IA
- PostgreSQL & Redis pour la performance
- La communauté open-source

---

## 📞 Support

- **Guide d'installation** : [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)
- **Corrections 16h00** : [FIXES_APPLIED.md](FIXES_APPLIED.md)
- **Corrections 18h30** : [BUG_FIXES_CRITICAL.md](BUG_FIXES_CRITICAL.md)
- **Documentation** : [docs/](docs/)
- **Guide Windows** : [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)
- **Issues** : [GitHub Issues](https://github.com/theo7791l/Wolaro2/issues)
- **Discord** : [Join our server](https://discord.gg/wolaro)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/theo7791l">theo7791l</a>
</p>

<p align="center">
  <a href="#-wolaro---discord-bot-multi-tenant-enterprise">⬆ Retour en haut</a>
</p>
