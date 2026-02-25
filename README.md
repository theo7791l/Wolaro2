# 🤖 Wolaro - Discord Bot Multi-Fonctions

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.14-5865F2.svg)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Bot Discord modulaire avancé avec système d'économie, RPG, modération IA, musique et bien plus.

## ✨ Fonctionnalités

- 🛡️ **Modération** - Anti-spam, auto-mod, logs, avertissements
- 🤖 **Intelligence Artificielle** - Chatbot Gemini, auto-modération IA, analyse d'images
- 💰 **Économie** - Monnaie virtuelle, daily, work, shop, inventaire
- 📈 **Système de niveaux** - XP par message, rôles-récompenses
- 🎵 **Musique** - YouTube, Spotify, SoundCloud, queue, filtres audio
- ⚔️ **RPG** - Combat PvP/PvE, quêtes, inventaire, progression
- 🎫 **Tickets** - Support, transcripts automatiques
- 🎉 **Giveaways** - Concours automatiques, multi-gagnants
- 🌐 **Panel Web** - Dashboard avec WebSocket temps réel
- 🔐 **Sécurité** - JWT, chiffrement AES-256, rate limiting

## 🚀 Installation rapide

### Prérequis

- Node.js ≥ 20.0.0
- PostgreSQL ≥ 14
- Redis ≥ 6
- FFmpeg (pour la musique)

### 1. Clone et install

```bash
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
npm install
```

### 2. Configuration

```bash
cp .env.example .env
nano .env
```

**⚠️ IMPORTANT : Configuration de la clé API Gemini**

Pour que les fonctionnalités IA fonctionnent, vous DEVEZ configurer `GEMINI_API_KEY` :

1. Rendez-vous sur [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Connectez-vous avec votre compte Google
3. Cliquez sur **"Create API Key"** → **"Create API key in new project"**
4. Copiez la clé (format `AIzaSy...`)
5. Dans `.env`, remplacez :
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   par votre vraie clé :
   ```env
   GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

**Vérification :** Au démarrage du bot, vous devriez voir :
```
: Gemini client initialized with model: gemini-2.5-flash, API key: AIzaSyXX...
```

Si vous voyez `API key:` (vide), la clé n'est pas chargée.

### 3. Base de données

```bash
psql -U postgres
CREATE DATABASE wolaro;
CREATE USER wolaro WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE wolaro TO wolaro;
\q

npm run migrate
```

### 4. Build et démarrage

```bash
npm run build
npm start

# OU en mode développement avec hot-reload
npm run dev
```

### 5. Déploiement des commandes

```bash
# Déploiement global (1h de propagation Discord)
npm run deploy-commands

# OU déploiement instantané sur un serveur de test
GUILD_ID=1234567890 npm run deploy-commands
```

## 📦 Scripts disponibles

```bash
npm run dev                # Développement avec hot-reload
npm run build              # Compile TypeScript → JavaScript
npm start                  # Démarre le bot en production
npm run deploy-commands    # Enregistre les slash commands
npm run lint               # Vérifie le code
npm run lint:fix           # Corrige automatiquement les erreurs
npm run format             # Formate le code avec Prettier
npm test                   # Lance les tests
npm run migrate            # Applique les migrations de base de données
```

## 🔧 Configuration des modules

Une fois le bot démarré, configurez chaque module avec `/config` :

```
/config → Sélectionnez un module → Remplissez le formulaire
```

**Exemple de configuration AI :**
- Activé : `true`
- Salon chat IA : `1234567890` (ID du salon)
- Auto-modération IA : `true`
- Seuil toxicité : `0.6` (0.0-1.0)
- Chance de réponse : `50` (% de chance de réponse automatique)

## 🐳 Déploiement Docker (optionnel)

```bash
# Build l'image
docker build -t wolaro .

# Lance avec docker-compose
docker-compose up -d
```

## 🛠️ Architecture

```
src/
├── modules/          # Modules (admin, ai, economy, etc.)
│   ├── admin/
│   │   ├── commands/ # Slash commands
│   │   └── events/   # Event handlers
│   └── ai/
│       ├── commands/
│       ├── events/
│       └── utils/    # GeminiClient, etc.
├── core/             # Core système (CommandHandler, EventHandler)
├── utils/            # Utilitaires (logger, database, redis)
├── types/            # Types TypeScript
└── index.ts          # Point d'entrée
```

## 📝 Variables d'environnement essentielles

```env
# Discord
DISCORD_TOKEN=your_token
DISCORD_CLIENT_ID=your_client_id

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wolaro
DB_USER=wolaro
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API
API_PORT=3000
API_JWT_SECRET=your_jwt_secret_32_chars_min

# AI (REQUIS pour fonctionnalités IA)
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## 🔍 Troubleshooting

### Le bot démarre mais l'IA ne fonctionne pas

**Symptôme :** Logs montrent `API key:` (vide)

**Solution :**
1. Vérifiez que `GEMINI_API_KEY` est dans `.env`
2. Pas de guillemets autour de la clé
3. Redémarrez le bot après modification du `.env`
4. Testez avec `/ask question: Dis bonjour`

### Erreur "tsx: not found"

**Solution :** Exécutez `npm install` (tsx est maintenant en dépendance de production)

### Les commandes n'apparaissent pas sur Discord

**Solutions :**
1. Attendez jusqu'à 1h (déploiement global)
2. OU utilisez `GUILD_ID=xxx npm run deploy-commands` (instantané)
3. Rechargez Discord (Ctrl+R)
4. Vérifiez que le bot a le scope `applications.commands`

### La musique ne fonctionne pas

**Solution :** Installez FFmpeg :
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

## 📚 Documentation

- [Guide de configuration](docs/CONFIGURATION.md)
- [Guide des modules](docs/MODULES.md)
- [API Documentation](docs/API.md)
- [Architecture système](docs/ARCHITECTURE.md)

## 🤝 Contribution

Les pull requests sont les bienvenues ! Pour des changements majeurs, ouvrez d'abord une issue.

```bash
git checkout -b feature/ma-fonctionnalité
git commit -m "feat: ajout de ma fonctionnalité"
git push origin feature/ma-fonctionnalité
```

## 📄 Licence

[MIT](LICENSE) © theo7791l

## 🔗 Liens

- [Site web](https://wolaro.fr)
- [Discord](https://discord.gg/wolaro)
- [Documentation](https://docs.wolaro.fr)

---

**Développé avec ❤️ par theo7791l**
