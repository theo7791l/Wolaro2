# 🤖 Wolaro - Discord Bot Multi-Tenant Enterprise

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.7.3-blue.svg)
![Windows](https://img.shields.io/badge/Windows-compatible-blue.svg)

**Wolaro** est un bot Discord professionnel avec architecture multi-tenant, 9 modules complets, IA Gemini, système RPG, tickets de support et giveaways automatiques.

## ✨ Fonctionnalités Principales

### 🏗️ Architecture Enterprise
- **Multi-tenant** : Un seul bot pour des milliers de serveurs
- **Modules dynamiques** : Hot-reload sans redémarrage
- **Scalabilité** : Cluster mode avec auto-scaling
- **Cache Redis** : Performance optimale (<5ms)
- **PostgreSQL** : Base de données robuste (20 tables)
- **API REST + WebSocket** : Interface complète

### 🛡️ Sécurité Militaire
- **Master Admin System** : Contrôle total par owner
- **Rate Limiting** : Triple couche (IP/User/Guild)
- **Anti-Raid** : Détection automatique
- **Anti-Spam** : Protection temps réel
- **Encryption AES-256** : Données sensibles
- **Audit Logs** : Traçabilité complète

### 📦 9 Modules Complets (48 Commandes)

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

#### 5️⃣ Admin - Master Only (5 commandes)
```
/impersonate, /blacklist, /stats, /reload, /eval
```
- Impersonate n'importe quel serveur
- Blacklist guilds avec raison
- Métriques système temps réel
- Hot-reload modules
- Code eval (danger zone)

#### 6️⃣ AI - Gemini (4 commandes) 🆕
```
/ask, /aichat, /aiimage, /automod
```
- **Chatbot conversationnel** avec contexte (10 derniers messages)
- **Analyse d'images** via Gemini Vision
- **Auto-modération IA** : Détection toxicité (0.0-1.0)
- **Chat automatique** dans salons configurés (10% chance ou mention)
- **Prompt système** personnalisable

**Configuration requise** :
```env
GEMINI_API_KEY=your_api_key_here
```

**Utilisation** :
```
/ask question:"Explique-moi la théorie quantique"
/aichat activer:true  # Dans le salon à activer
/aiimage image:[fichier] question:"Que vois-tu?"
/automod activer:true seuil:0.8  # 80% toxicité = suppression
```

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

**Mécaniques de combat** :
```
Dégâts = max(1, ATK_attaquant - DEF_défenseur + random(-5, +5))
Victoire PvE = Or + XP
Victoire PvP = Win/Loss ratio
```

**Utilisation** :
```
/battle monstre:dragon  # PvE
/battle adversaire:@User  # PvP
/rpgdaily  # Heal + 50 or + 100 XP
```

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

**Configuration** :
```javascript
{
  categoryId: '123456789',  // Catégorie Discord
  supportRoles: ['987654321'],  // Rôles staff
  transcriptsChannel: '111222333',  // Salon logs
  maxTicketsPerUser: 3,
  autoCloseInactive: true,
  inactivityTimeout: 86400  // 24h
}
```

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

**Utilisation** :
```
/giveaway prix:"Discord Nitro" durée:86400 gagnants:3
/reroll message_id:123456789012345678
/gend message_id:123456789012345678  # Fin anticipée
```

## 🚀 Installation Rapide

### Prérequis
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Discord Bot Token
- Gemini API Key (pour module AI)

### 👨‍💻 Installation Windows

**👉 Voir le guide complet : [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)**

Installation rapide avec Docker (recommandé) :

```powershell
# 1. Cloner le dépôt
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# 2. Configuration
copy .env.example .env
notepad .env  # Remplissez vos tokens

# 3. Démarrer avec Docker
docker-compose up -d
```

Sans Docker (nécessite build tools) :

```powershell
# En tant qu'administrateur
npm install --global windows-build-tools

# Installation normale
npm install
npm run build
npm start
```

### 🐧 Installation Linux/Mac

```bash
# 1. Cloner le dépôt
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# 2. Installer les dépendances
npm install

# 3. Configuration
cp .env.example .env
nano .env

# 4. Lancer les migrations
npm run migrate

# 5. Démarrer le bot
npm run dev
```

### 🐳 Installation Docker (Recommandé - Toutes plateformes)

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

### Production (PM2 Cluster)

```bash
# Installation
npm install
npm run build

# Lancer en cluster mode
npm run pm2:start

# Monitoring
npm run pm2:monit

# Logs temps réel
npm run pm2:logs
```

## ⚙️ Configuration

### Variables d'Environnement

```env
# ==========================================
# Discord
# ==========================================
DISCORD_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_PUBLIC_KEY=your_public_key  # Pour vérification signatures
DISCORD_REDIRECT_URI=https://wolaro.fr/api/auth/callback  # OAuth2

# ==========================================
# Database (PostgreSQL)
# ==========================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wolaro
DB_USER=wolaro
DB_PASSWORD=your_password
DB_MAX_CONNECTIONS=20

# ==========================================
# Redis
# ==========================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ==========================================
# API
# ==========================================
API_PORT=3000
API_JWT_SECRET=your_jwt_secret_min_32_chars
API_CORS_ORIGIN=https://wolaro.fr,http://localhost:3001

# Panel Configuration
PANEL_URL=https://wolaro.fr/panel
PANEL_SESSION_DURATION=604800

# WebSocket
WS_PORT=3001
WS_ENABLED=true

# ==========================================
# Master Admins
# ==========================================
MASTER_ADMIN_IDS=123456789012345678,987654321098765432

# ==========================================
# AI Module (Gemini)
# ==========================================
GEMINI_API_KEY=your_gemini_api_key
FEATURE_AI_ENABLED=true

# ==========================================
# Feature Flags
# ==========================================
FEATURE_MUSIC_ENABLED=true
FEATURE_RPG_ENABLED=true
FEATURE_TICKETS_ENABLED=true
FEATURE_GIVEAWAYS_ENABLED=true

# ==========================================
# Security
# ==========================================
ENCRYPTION_KEY=your_32_char_encryption_key
IP_WHITELIST=127.0.0.1,::1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# ==========================================
# Cluster Configuration
# ==========================================
CLUSTER_ENABLED=false
CLUSTER_SHARD_COUNT=auto

# ==========================================
# Logging
# ==========================================
LOG_LEVEL=info
LOG_FILE_ENABLED=true
LOG_DIR=./logs

# ==========================================
# Environment
# ==========================================
NODE_ENV=production

# ==========================================
# Domain & SSL
# ==========================================
MAIN_DOMAIN=wolaro.fr
API_DOMAIN=api.wolaro.fr
SSL_ENABLED=true
SSL_CERT_PATH=/etc/letsencrypt/live/wolaro.fr/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/wolaro.fr/privkey.pem

# ==========================================
# Backup
# ==========================================
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=7

# ==========================================
# External Services (Optional)
# ==========================================
SENTRY_DSN=
ANALYTICS_ENABLED=false
ANALYTICS_ID=
```

### Configuration des Modules

Chaque module peut être configuré via l'API ou la base de données :

```sql
-- Activer module AI
INSERT INTO guild_modules (guild_id, module_name, enabled, config) 
VALUES (
  '123456789',
  'ai',
  true,
  '{
    "geminiApiKey": "your_key",
    "chatEnabled": true,
    "autoModEnabled": true,
    "autoModThreshold": 0.8
  }'
);
```

## 📊 Base de Données

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
✓ guild_economy             # Économie par serveur
✓ global_economy            # Économie globale
✓ moderation_cases          # Cas de modération
✓ rpg_profiles              # Profils RPG 🆕
✓ tickets                   # Système tickets 🆕
✓ giveaways                 # Concours 🆕
✓ giveaway_participants     # Participants 🆕
✓ leveling_profiles         # Profiles système leveling
✓ custom_commands           # Commandes custom
✓ guild_analytics           # Analytics
✓ shard_stats               # Statistiques sharding
✓ backdoor_logs             # Logs master admin
✓ shard_stats               # Stats infrastructure sharding
```

### Migrations

```bash
# Appliquer le schéma
psql -U wolaro -d wolaro -f src/database/schema.sql

# Ou via script
bash scripts/migrate.sh
```

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

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Mode watch
npm run test:watch

# Avec coverage
npm run test:coverage
```

### Structure des Tests

```
tests/
├── security.test.ts       # SecurityManager tests
├── database.test.ts       # DatabaseManager tests
├── commands/
│   ├── moderation.test.ts
│   ├── economy.test.ts
│   └── rpg.test.ts
└── integration/
    └── api.test.ts
```

## 📚 Documentation

- **[INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)** - Guide installation Windows complet
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Design patterns et diagrammes
- **[MODULES.md](docs/MODULES.md)** - Guide création de modules
- **[SECURITY.md](docs/SECURITY.md)** - Best practices sécurité
- **[API.md](docs/API.md)** - Documentation API complète
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Guide déploiement production
- **[PANEL_INTEGRATION.md](docs/PANEL_INTEGRATION.md)** - Intégration panel web
- **[REALTIME_SYNC.md](docs/REALTIME_SYNC.md)** - Synchronisation temps réel
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Guide contribution

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

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md)

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📜 Licence

Ce projet est sous licence MIT - voir [LICENSE](LICENSE)

## 🙏 Remerciements

- Discord.js pour l'API Discord
- Google Gemini pour l'IA
- PostgreSQL & Redis pour la performance
- La communauté open-source

## 📞 Support

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