# 🚀 Installation Guide - Wolaro Bot

## ⚡ Quick Start (Recommended)

```bash
# 1. Clone le repo
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# 2. Installation automatique
npm install

# 3. Configuration
cp .env.example .env
nano .env  # Édite avec tes credentials

# 4. Migration base de données
npm run migrate

# 5. Démarrage
npm run dev
```

## 📋 Prérequis

- **Node.js** 20+ (vérifie : `node -v`)
- **PostgreSQL** 15+ (base de données)
- **Redis** 7+ (cache)
- **npm** 9+ (gestionnaire de paquets)

### Installation des prérequis (Ubuntu/Debian)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null
sudo apt update
sudo apt install -y postgresql-15

# Redis 7
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

## 🔧 Configuration détaillée

### 1. Créer un bot Discord

1. Va sur https://discord.com/developers/applications
2. Clique sur "New Application"
3. Dans **Bot** → copie le **Token**
4. Dans **OAuth2** → copie **Client ID** et **Client Secret**
5. Dans **General Information** → copie **Public Key**
6. Active toutes les **Privileged Gateway Intents**

### 2. Configuration de la base de données PostgreSQL

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer utilisateur et base de données
CREATE USER wolaro WITH PASSWORD 'ton_password_secure';
CREATE DATABASE wolaro OWNER wolaro;
GRANT ALL PRIVILEGES ON DATABASE wolaro TO wolaro;
\q
```

### 3. Configurer `.env`

```bash
cp .env.example .env
```

Édite `.env` et remplis **AU MINIMUM** :

```env
# REQUIS
DISCORD_TOKEN=ton_token_bot
DISCORD_CLIENT_ID=ton_client_id
DISCORD_CLIENT_SECRET=ton_client_secret
DISCORD_PUBLIC_KEY=ta_public_key

# Base de données
DB_PASSWORD=ton_password_postgres

# Sécurité (génère des clés fortes !)
ENCRYPTION_KEY=$(openssl rand -hex 32)
API_JWT_SECRET=$(openssl rand -hex 32)

# Admin (ton Discord User ID)
MASTER_ADMIN_IDS=ton_user_id_discord

# AI (optionnel)
GEMINI_API_KEY=ta_cle_gemini
```

### 4. Appliquer le schéma de base de données

```bash
npm run migrate
```

### 5. Build et démarrage

```bash
# Build TypeScript
npm run build

# Démarrage en développement
npm run dev

# OU en production avec PM2
npm run pm2:start
```

## 🐳 Installation Docker (Alternative)

```bash
# Build et démarrage
docker-compose up -d

# Logs
docker-compose logs -f bot

# Arrêt
docker-compose down
```

## 🔥 Dépannage des erreurs d'installation

### Erreur : "canvas" ne compile pas

```bash
# Ubuntu/Debian
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# OU ignore canvas (optionnel)
npm install --no-optional
```

### Erreur : "Cannot find module 'discord.js'"

```bash
# Supprime node_modules et réinstalle
rm -rf node_modules package-lock.json
npm install
```

### Erreur : "ECONNREFUSED" (PostgreSQL/Redis)

```bash
# Vérifie que les services tournent
sudo systemctl status postgresql
sudo systemctl status redis-server

# Démarre-les si nécessaire
sudo systemctl start postgresql redis-server
```

### Erreur : Build TypeScript échoue

```bash
# Force le build en ignorant les erreurs non-bloquantes
npm run build:force
```

## 📚 Commandes utiles

```bash
# Développement
npm run dev              # Démarre avec ts-node (hot reload)
npm run build            # Compile TypeScript
npm run lint             # Vérifie le code
npm run test             # Lance les tests

# Production PM2
npm run pm2:start        # Démarre avec PM2
npm run pm2:logs         # Voir les logs
npm run pm2:restart      # Redémarre
npm run pm2:stop         # Arrête

# Docker
npm run docker:up        # Démarre tous les services
npm run docker:logs      # Voir les logs
npm run docker:down      # Arrête tout

# Maintenance
npm run migrate          # Applique le schema SQL
npm run backup           # Backup de la BDD
npm run update           # Met à jour le bot
```

## 🎯 Vérifier que tout fonctionne

1. Le bot doit apparaître **en ligne** sur Discord
2. Tape `/ping` dans un serveur → le bot doit répondre
3. Va sur http://localhost:3000/health → doit retourner `{"status":"ok"}`
4. Vérifie les logs : `npm run pm2:logs` ou `docker-compose logs -f bot`

## ❓ Besoin d'aide ?

- **GitHub Issues** : https://github.com/theo7791l/Wolaro2/issues
- **Discord Support** : Rejoins le serveur de support
- **Documentation** : Voir `/docs`

---

✅ **Installation réussie !** Le bot est prêt à être utilisé 🚀
