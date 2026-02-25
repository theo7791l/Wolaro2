# Wolaro2 🤖

> Bot Discord multifonction nouvelle génération avec système de protection avancée

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.14-blurple)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

## ✨ Fonctionnalités

### 🛡️ Protection Avancée (TheoProtect Integration)

Wolaro2 intègre tous les systèmes de protection de **TheoProtect** migrés en TypeScript :

- **Anti-Spam** : Détection intelligente avec nettoyage automatique
- **Bad Words Filter** : Filtrage FR/EN avec bypass detection
- **Anti-Raid** : 6 facteurs de risque + système de captcha
- **Anti-Phishing** : Détection par patterns + vérifications externes (Google Safe Browsing, PhishTank)
- **Anti-Nuke** : Protection contre destruction massive (channels, roles, bans)
- **NSFW Detection** : IA Sightengine pour détection contenu explicite (optionnel)
- **Smart Lockdown** : Verrouillage serveur 4 niveaux avec escalade auto

### 📊 Dashboard Web

- Interface d'administration temps réel
- Statistiques détaillées par système
- Configuration graphique
- Logs live stream
- Charts et graphiques

### 🎮 Autres Modules

- **Modération** : Sanctions, logs, cas
- **Tickets** : Système de support
- **Niveaux** : XP et classements
- **Économie** : Monnaie virtuelle
- **Musique** : Lecture audio

## 🚀 Installation

### Prérequis

- Node.js 20+
- PostgreSQL 14+
- Redis 7+ (optionnel)
- Yarn ou npm

### Configuration

```bash
# Cloner le repo
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# Installer les dépendances
yarn install

# Copier .env.example
cp .env.example .env

# Configurer les variables
nano .env
```

### Variables d'environnement

```bash
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/wolaro2
REDIS_URL=redis://localhost:6379

# APIs (Optionnelles)
GOOGLE_SAFE_BROWSING_KEY=xxx          # Anti-Phishing amélioré
SIGHTENGINE_API_USER=xxx              # NSFW Detection
SIGHTENGINE_API_SECRET=xxx

# Dashboard
WEB_PORT=3000
WEB_SECRET=random_secret_key
```

### Lancement

```bash
# Développement
yarn dev

# Production
yarn build
yarn start

# Dashboard (terminal séparé)
cd dashboard
yarn dev
```

## 📖 Utilisation

### Commandes Protection

```bash
# Configuration
/protection-config view                          # Voir config
/protection-config spam [enabled] [level]        # Config anti-spam
/protection-config raid [enabled] [captcha]      # Config anti-raid
/protection-config phishing [enabled]            # Config anti-phishing
/protection-config nuke [enabled]                # Config anti-nuke
/protection-config nsfw [enabled] [threshold]    # Config NSFW

# Lockdown
/protection-lockdown activate [level] [reason]   # Activer
/protection-lockdown deactivate                  # Désactiver
/protection-lockdown status                      # Voir status

# Monitoring
/protection-stats [period] [type]                # Statistiques
/protection-logs [limit] [type]                  # Logs récents

# Whitelist
/protection-whitelist add [user|role]            # Ajouter
/protection-whitelist remove [user|role]         # Retirer
/protection-whitelist list                       # Lister
```

### Dashboard

Accédez à `http://localhost:3000` après avoir lancé le dashboard.

- **Overview** : Statistiques globales
- **Protection** : Config + stats par système
- **Logs** : Stream temps réel
- **Lockdown** : Contrôle lockdown
- **Settings** : Configuration générale

## 🏗️ Architecture

```
src/
├── modules/
│   ├── moderation/
│   │   └── protection/          # Module Protection
│   │       ├── systems/         # 8 systèmes de protection
│   │       ├── commands/        # Commandes slash
│   │       ├── events/          # Event handlers
│   │       ├── database.ts      # Gestion BDD
│   │       ├── types.ts         # Interfaces TypeScript
│   │       └── index.ts         # Point d'entrée
│   ├── tickets/
│   ├── levels/
│   └── ...
├── utils/
├── types/
└── index.ts

dashboard/
├── src/
│   ├── pages/
│   ├── components/
│   └── api/
└── ...
```

## 📊 Systèmes de Protection

| Système | Lignes | Fonctionnalités |
|---------|--------|----------------|
| Anti-Spam | 600 | Duplicate detection, rate limiting, cleanup auto |
| Bad Words | 400 | Filtres FR/EN, bypass detection, whitelist |
| Anti-Raid | 600 | 6 risk factors, captcha, auto-actions |
| Anti-Phishing | 450 | Patterns, APIs externes, cache intelligent |
| Anti-Nuke | 300 | 7 actions trackées, ban auto attaquant |
| NSFW Detection | 350 | AI Sightengine, 3 modèles, cache 1h |
| Smart Lockdown | 300 | 4 niveaux, auto-escalade, restore perms |
| **Total** | **~3000** | **Module complet TypeScript** |

## 🎯 Roadmap

- [x] Migration TheoProtect → Wolaro2
- [x] Dashboard web intégré
- [x] APIs REST + WebSocket
- [ ] Mobile app React Native
- [ ] Machine Learning détection avancée
- [ ] Multi-langue (i18n)
- [ ] Plugin system

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📄 License

MIT © [theo7791l](https://github.com/theo7791l)

## 🔗 Liens

- [Documentation](https://docs.wolaro.dev)
- [Discord Support](https://discord.gg/wolaro)
- [Changelog](./CHANGELOG.md)

---

**Made with ❤️ by theo7791l**
