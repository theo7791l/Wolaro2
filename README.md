# Wolaro - Discord Cloud Engine

> **Multi-tenant Discord bot with advanced SaaS web panel, modular architecture, and enterprise-grade security**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14+-7289DA.svg)](https://discord.js.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D.svg)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

Wolaro is a cutting-edge **single-bot, multi-tenant Discord platform** that revolutionizes how Discord bots are deployed and managed. Instead of spawning multiple bot instances, Wolaro uses a sophisticated **guild-based multi-tenancy system** where one bot serves thousands of servers with isolated configurations.

### Key Features

- 🏛️ **Single Bot Architecture**: One bot token, unlimited servers
- 🔧 **Dynamic Module System**: Hot-reload modules without restarting
- 🌐 **Advanced Web Panel**: SaaS-style dashboard with OAuth2
- 🛡️ **Military-Grade Security**: Rate limiting, anti-raid, encryption
- 👑 **Master Admin System**: God-mode access with impersonation
- 📊 **Real-time Analytics**: Business intelligence for server owners
- 🔌 **WebSocket Sync**: Instant updates between bot and panel
- 🎨 **Components V2 UI**: Modern Discord interaction system

## 🏗️ Architecture

### Technology Stack

```
Frontend:          React + TypeScript + TailwindCSS
Backend API:       Express + TypeScript + Zod validation
Bot Engine:        Discord.js v14+ with Sharding
Database:          PostgreSQL with optimized indexing
Cache Layer:       Redis for sessions & rate limiting
Real-time:         WebSocket (ws) for live updates
Security:          Helmet, bcrypt, JWT, 2FA
Infrastructure:    Docker + PM2/Cluster mode
```

### Multi-Tenant Design

```sql
guilds (guild_id PK) → guild_modules (JSONB)
                    → guild_settings (JSONB)
                    → guild_economy
                    → audit_logs

global_profiles (user_id PK) → Cross-server user data
master_admins (user_id PK)   → Super admin permissions
```

## 📦 Module System

Each module is a self-contained directory:

```
src/modules/
├── moderation/
│   ├── commands/
│   ├── events/
│   ├── config.schema.ts
│   └── index.ts
├── economy/
├── music/
├── ai/
└── rpg/
```

**Dynamic Loading**: Modules can be enabled/disabled per-guild from the web panel without bot restart.

## 🛡️ Security Features

### Rate Limiting
- **Per-IP**: Blocks DDoS attempts
- **Per-User**: Prevents spam abuse
- **Per-Guild**: Protects from server flooding

### Anti-Raid System
- **Join Spike Detection**: Auto-lockdown on mass joins
- **Message Flood Protection**: Automatic slowmode
- **Intelligent Banning**: ML-based pattern recognition

### Master Access
```typescript
isMaster(userId) // Bypass all permission checks
/impersonate <guild_id> // View any server config
/masterban <guild_id> // Global blacklist
```

## 🌍 Web Panel Features

### Bot Builder Interface
- **Toggle Modules**: Enable/disable with one click
- **Visual Config**: Drag-and-drop command designer
- **Custom Commands**: Create slash commands from panel
- **Embed Designer**: Customize colors, messages, variables
- **Template Store**: Share & import server configs

### Analytics Dashboard
- Member retention graphs
- Hourly activity heatmaps
- Module usage statistics
- Command execution metrics

## 🚀 Installation

### Prerequisites
```bash
Node.js >= 18.0.0
PostgreSQL >= 15
Redis >= 7
Docker (optional)
```

### Quick Start

```bash
# Clone repository
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
npm run migrate

# Start development
npm run dev

# Production build
npm run build
npm start

# Cluster mode (recommended for production)
npm run start:cluster
```

### Docker Deployment

```bash
docker-compose up -d
```

## 📖 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Module Development](docs/MODULES.md)
- [Security Best Practices](docs/SECURITY.md)
- [API Reference](docs/API.md)
- [Database Schema](docs/DATABASE.md)

## 🎯 Roadmap

- [ ] Phase 1: Core engine + Basic modules
- [ ] Phase 2: Web panel + OAuth2
- [ ] Phase 3: Advanced AI integration
- [ ] Phase 4: Cross-server networking
- [ ] Phase 5: Marketplace & monetization

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 👨‍💻 Author

**theo7791l** - [GitHub](https://github.com/theo7791l)

## 🌟 Support

If you find this project useful, please consider giving it a ⭐!

---

**Built with ❤️ using TypeScript, Discord.js, and PostgreSQL**
