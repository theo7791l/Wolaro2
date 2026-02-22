# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-02-22

### Fixed
- **`database/manager.ts`** — `updateGlobalXP`: la formule de calcul du niveau utilisait `global_xp` (valeur *avant* ajout) au lieu de `global_xp + $2` (valeur *après* ajout), causant un retard d'un palier dans la mise à jour du niveau
- **`database/manager.ts`** — `constructor`: `max` du pool de connexions était hardcodé à `20` au lieu d'utiliser `config.database.maxConnections` lu depuis `.env`
- **`database/manager.ts`** — `getBalance`: remplacé le pattern double-requête (`INSERT ... DO NOTHING` + `SELECT` séparé) par un seul `UPSERT DO UPDATE RETURNING balance` toujours fiable

### Changed
- **`src/index.ts`** — Suppression du commentaire de développement `(fix: config.token, not config.discord.token)` sur la ligne `client.login`
- **`src/config.ts`** — Suppression du commentaire trompeur `// Read WS_ENABLED and PANEL_URL from .env.example` sur le champ `wsEnabled`

---

## [1.0.0] - 2026-02-22

### Added

#### Core Features
- Multi-tenant architecture with guild isolation
- Dynamic module loading system with hot-reload
- Master Admin system with impersonation and blacklist
- Triple-layer rate limiting (IP/User/Guild)
- Redis caching with intelligent TTL
- PostgreSQL connection pooling
- WebSocket real-time synchronization
- Cluster mode for horizontal scaling

#### Modules
- **Moderation Module**
  - `/ban`, `/kick`, `/warn`, `/timeout` commands
  - `/clear` with user and date filters
  - `/lockdown` for channel security
  - Auto-moderation with pattern detection
  - Anti-raid and anti-spam systems
  - Numbered case system

- **Economy Module**
  - `/balance`, `/daily`, `/work`, `/pay` commands
  - Bank and wallet system
  - Daily streak bonuses
  - Configurable shop system
  - User inventory
  - Rich leaderboard

- **Leveling Module**
  - `/rank` with progress bars
  - `/levels` leaderboard
  - `/setxp` admin command
  - Automatic XP on messages
  - Level role rewards
  - Stack or replace roles option

- **Music Module**
  - `/play`, `/stop`, `/skip` commands
  - `/queue` and `/nowplaying` displays
  - `/volume` control
  - Queue management system
  - Support for YouTube, Spotify, SoundCloud

- **Admin Module** (Master Only)
  - `/impersonate` for guild inspection
  - `/blacklist` guild management
  - `/stats` system metrics
  - `/reload` module hot-reload
  - `/eval` code execution

#### API & WebSocket
- REST API with 20+ endpoints
- Authentication with Discord OAuth2 + JWT
- Guild management endpoints
- Module toggle and configuration
- Analytics and metrics
- Admin endpoints for master users
- WebSocket server for real-time updates

#### Security
- Input sanitization and validation
- SQL injection prevention
- XSS protection
- Rate limiting on all endpoints
- Master admin IP whitelist
- Encryption for sensitive data
- Audit logging for all actions

#### Deployment
- Dockerfile and docker-compose.yml
- PM2 ecosystem configuration
- Kubernetes manifests
- Nginx reverse proxy config
- Automated backup scripts
- Health check endpoints

#### Documentation
- Comprehensive README
- Architecture guide with diagrams
- Module development guide
- Security best practices
- Complete API reference
- Deployment guide (Docker, K8s, PM2)

#### Testing
- Jest test configuration
- Security utility tests
- Database manager tests
- Test coverage reporting

### Changed
- N/A (Initial release)

### Deprecated
- N/A (Initial release)

### Removed
- N/A (Initial release)

### Fixed
- N/A (Initial release)

### Security
- Implemented comprehensive security measures from day one
- All inputs sanitized and validated
- Rate limiting on all endpoints
- Encrypted sensitive data storage

---

## [Unreleased]

### Planned for 1.1.0
- AI module with chatbot and auto-moderation
- RPG module with combat and quests
- Ticket system for support
- Giveaway system
- Web panel with React
- Template marketplace
- Multi-language support

### Planned for 1.2.0
- Command designer (drag-and-drop)
- Advanced analytics dashboard
- Custom bot branding per guild
- Webhook integrations

### Planned for 2.0.0
- Microservices architecture
- GraphQL API
- Mobile app
- Voice AI features

---

## Version History

- **1.0.0** (2026-02-22): Initial production release

---

For detailed changes, see the [commit history](https://github.com/theo7791l/Wolaro2/commits/main).
