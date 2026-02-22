# Wolaro - Advanced Multi-Tenant Discord Bot

<div align="center">

![Wolaro Logo](https://via.placeholder.com/200x200?text=WOLARO)

**Un bot Discord modulaire ultra-performant avec architecture multi-tenant**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.14-blurple)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

</div>

## 🌟 Fonctionnalités

### 💻 Core Features

- **Multi-Tenant Architecture**: Un bot, des milliers de serveurs avec configurations isolées
- **Module System**: Chargement dynamique avec hot-reload
- **Master Admin System**: Contrôle total avec impersonation et blacklist
- **Security First**: Rate limiting triple couche, anti-raid, anti-spam
- **Performance**: Redis cache, connection pooling, cluster mode
- **Real-time**: WebSocket API pour synchronisation instantanée
- **Production Ready**: Docker, PM2, health checks, logging avancé

### 🛡️ Modules Disponibles

#### Moderation
- `/ban`, `/kick`, `/warn`, `/timeout` avec hiérarchie de rôles
- `/clear` avec filtres utilisateur et date
- `/lockdown` pour verrouillage de salon
- Auto-modération avec détection de patterns
- Système de cas numérotés
- Anti-raid et anti-spam automatiques

#### Economy
- `/balance`, `/daily`, `/work`, `/pay`
- Système de banque et portefeuille
- Daily streaks avec bonus progressifs
- Boutique configurable
- Inventaire utilisateur
- Leaderboard des plus riches

#### Leveling
- `/rank` avec cartes de progression
- `/levels` pour classement XP
- Gain d'XP automatique sur messages
- Rôles de récompense par niveau
- Configuration XP par message et cooldown
- Stack ou remplacement de rôles

#### Admin (Master Only)
- `/impersonate` pour voir config de n'importe quel serveur
- `/blacklist` pour bannir des serveurs
- `/stats` avec métriques système et bot
- `/reload` pour hot-reload de modules
- `/eval` pour exécution de code (danger!)

## 🚀 Quick Start

### Prérequis

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Discord Bot Token

### Installation

```bash
# Cloner le repository
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# Installation automatique
chmod +x scripts/setup.sh
./scripts/setup.sh

# Configurer .env
cp .env.example .env
nano .env
```

### Configuration

```env
# Discord
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wolaro
DB_USER=wolaro
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# API
API_PORT=3000
API_JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# Master Admins (Discord User IDs)
MASTER_ADMIN_IDS=123456789012345678,987654321098765432
```

### Lancement

```bash
# Développement
npm run dev

# Production simple
npm start

# Production cluster (recommandé)
npm run start:cluster

# Docker (recommandé)
docker-compose up -d
```

## 📚 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) - Diagrammes et design patterns
- [Module Development](docs/MODULES.md) - Créer vos propres modules
- [API Reference](docs/API.md) - REST API et WebSocket
- [Security Guide](docs/SECURITY.md) - Best practices de sécurité
- [Deployment Guide](docs/DEPLOYMENT.md) - Guide de production

## 📦 Structure du Projet

```
Wolaro2/
├── src/
│   ├── api/              # REST API Express
│   │   ├── routes/       # Endpoints
│   │   └── middlewares/  # Auth, rate limit, etc.
│   ├── cache/            # Redis manager
│   ├── commands/         # Command handler
│   ├── database/         # PostgreSQL manager
│   ├── events/           # Event handler
│   ├── modules/          # Modules dynamiques
│   │   ├── moderation/
│   │   ├── economy/
│   │   ├── leveling/
│   │   └── admin/
│   ├── utils/            # Utilitaires (logger, security)
│   ├── websocket/        # WebSocket server
│   ├── cluster.ts        # Cluster manager
│   ├── config.ts         # Configuration
│   ├── index.ts          # Entry point
│   └── types.ts          # TypeScript types
├── docs/               # Documentation complète
├── scripts/            # Scripts d'installation
├── Dockerfile          # Image Docker
├── docker-compose.yml  # Stack complète
├── ecosystem.config.js # PM2 cluster
└── package.json
```

## 🔧 Commandes NPM

```bash
npm run dev          # Développement avec hot-reload
npm run build        # Compiler TypeScript
npm start            # Production (single instance)
npm run start:cluster # Production (cluster mode)
npm run migrate      # Migrations base de données
npm run lint         # Linter ESLint
npm test             # Tests (TODO)
```

## 👥 Multi-Tenant Design

### Isolation par Serveur

Chaque serveur Discord a :
- Configuration de modules indépendante
- Économie locale (ou globale selon config)
- Logs de modération séparés
- Settings personnalisés

### Cache Intelligent

```typescript
// Exemple de flux
1. Requête: GET /api/guilds/:id
2. Check Redis: guild:config:{id} (TTL: 1h)
3. Si absent: PostgreSQL + mise en cache
4. WebSocket notify sur update
5. Invalidation cache automatique
```

## 🔒 Sécurité

### Rate Limiting

- **IP**: 100 req/min
- **User**: 200 req/min
- **Guild**: Cooldowns par commande (3-30s)

### Master Admin

```typescript
if (SecurityManager.isMaster(userId)) {
  // Bypass all permissions
  // Access all guilds
  // View all audit logs
}
```

### Anti-Raid

- Détection de join spike (>10 en 10s)
- Auto-lockdown configurable
- Message spam détection
- Auto-timeout des spammers

## 📊 Performance

### Benchmarks (Attendus)

- **Command Response**: <100ms
- **Database Query**: <50ms (cached: <5ms)
- **Module Toggle**: <200ms
- **Concurrent Commands**: 1000+/s

### Optimisations

- Connection pooling (max 20)
- Redis cache multi-niveaux
- Query batching
- Lazy loading des modules
- Cluster mode auto-scaling

## 🚀 Deployment

### Docker (Recommandé)

```bash
# Lancer stack complète
docker-compose up -d

# Voir les logs
docker-compose logs -f bot

# Arrêter
docker-compose down
```

### PM2 Cluster

```bash
# Installer PM2
npm install -g pm2

# Lancer en cluster
pm2 start ecosystem.config.js

# Monitoring
pm2 monit

# Logs
pm2 logs wolaro-bot
```

### Kubernetes (Avancé)

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) pour manifests K8s.

## 🧑‍💻 Développement

### Créer un Module

```bash
# Créer la structure
mkdir -p src/modules/my-module/commands
touch src/modules/my-module/index.ts

# Voir docs/MODULES.md pour le template
```

### Hot Reload

```typescript
// Master admin command
await moduleLoader.reloadModule('my-module');
```

### Tests

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

## 📡 API & WebSocket

### REST API

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/guilds/123456789
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event.type);
});
```

Voir [docs/API.md](docs/API.md) pour documentation complète.

## 📝 Roadmap

### Version 1.1
- [ ] Music module (lecteur audio)
- [ ] AI module (chatbot + auto-mod IA)
- [ ] RPG module (combats + quêtes)
- [ ] Panel web React

### Version 1.2
- [ ] Template marketplace
- [ ] Command designer drag-and-drop
- [ ] Analytics dashboard
- [ ] Multi-language support

### Version 2.0
- [ ] Microservices architecture
- [ ] Kubernetes native
- [ ] GraphQL API
- [ ] Mobile app

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📜 License

MIT License - voir [LICENSE](LICENSE) pour détails.

## 💬 Support

- Discord: [Rejoindre le serveur](https://discord.gg/wolaro)
- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/theo7791l/Wolaro2/issues)

## ❤️ Credits

Développé avec ❤️ par [theo7791l](https://github.com/theo7791l)

---

<div align="center">

**Wolaro** - The Next Generation Discord Bot Framework

[Documentation](docs/) · [API Reference](docs/API.md) · [Discord Server](https://discord.gg/wolaro)

</div>
