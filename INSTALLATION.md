# 🛠️ Installation Guide - Wolaro2

Guide d'installation complet pour déployer Wolaro2 en production.

---

## 💻 Systèmes supportés

- **Linux** (Ubuntu 20.04+, Debian 11+, RHEL 8+)
- **macOS** (Big Sur 11+)
- **Windows 10/11** (via WSL2 recommandé, voir [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md))

---

## 📌 Prérequis système

### Logiciels requis

- **Node.js** 18.0.0 ou supérieur ([télécharger](https://nodejs.org/))
- **PostgreSQL** 14.0 ou supérieur ([installer](https://www.postgresql.org/download/))
- **Git** ([installer](https://git-scm.com/))
- **PM2** (optionnel, pour production)

### Vérification des versions

```bash
node --version   # v18.0.0+
npm --version    # 8.0.0+
psql --version   # 14.0+
```

---

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration de la base de données

#### Créer la base PostgreSQL

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer la base et l'utilisateur
CREATE DATABASE wolaro;
CREATE USER wolaro_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE wolaro TO wolaro_user;
\q
```

#### Importer le schéma

```bash
psql -U wolaro_user -d wolaro -f database/schema.sql
```

### 4. Configuration des variables d'environnement

Copier et éditer `.env` :

```bash
cp .env.example .env
nano .env
```

**Configuration minimale** :

```env
# Discord Bot (requis)
DISCORD_BOT_TOKEN=your_bot_token_here

# Database (requis)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wolaro
DB_USER=wolaro_user
DB_PASSWORD=your_secure_password

# Groq AI (optionnel - module AI)
# Free tier: 30 req/min, 14,400 req/day
# Get key: https://console.groq.com/keys
GROQ_API_KEY=your_groq_api_key_here

# Cloudflare R2 (optionnel - stockage)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ACCESS_KEY_ID=
CLOUDFLARE_SECRET_ACCESS_KEY=

# Logs
LOG_LEVEL=info
```

### 5. Créer un bot Discord

1. Aller sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créer une nouvelle application
3. Onglet **Bot** → **Add Bot**
4. Copier le **Token** et le mettre dans `.env` (`DISCORD_BOT_TOKEN`)
5. Activer les **Privileged Gateway Intents** :
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

### 6. Inviter le bot sur votre serveur

URL d'invitation (remplacez `YOUR_CLIENT_ID`) :

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=8
```

Permissions recommandées : **Administrator** (ou ajustez selon vos besoins)

---

## 🛠️ Compilation et lancement

### Mode développement

```bash
npm run dev
```

### Mode production

```bash
# Compiler TypeScript
npm run build

# Lancer le bot
npm start
```

### Avec PM2 (recommandé en production)

```bash
# Installer PM2
npm install -g pm2

# Lancer avec PM2
pm2 start npm --name "wolaro" -- start

# Démarrage automatique au boot
pm2 startup
pm2 save

# Monitorer
pm2 monit
pm2 logs wolaro
```

---

## 📦 Configuration des modules

Après avoir invité le bot sur votre serveur :

```bash
# Activer le module AI (Groq)
/module enable module:ai

# Configurer l'automod IA
/automod activer:true seuil:0.8

# Activer la modération
/module enable module:moderation

# Voir tous les modules
/module list
```

---

## 🔑 Obtenir une clé API Groq (gratuite)

1. Aller sur [Groq Console](https://console.groq.com/keys)
2. Se connecter / créer un compte
3. Créer une nouvelle API Key
4. Copier la clé dans `.env` (`GROQ_API_KEY`)

**Limites gratuites** :
- 30 requêtes/minute
- 14 400 requêtes/jour
- Modèle : Llama 3.3 70B

---

## 🔧 Troubleshooting

### Erreur de connexion PostgreSQL

```bash
# Vérifier que PostgreSQL est démarré
sudo systemctl status postgresql

# Redémarrer si nécessaire
sudo systemctl restart postgresql

# Tester la connexion
psql -U wolaro_user -d wolaro -c "SELECT 1;"
```

### Erreur "GROQ_API_KEY not set"

Cette erreur apparaît uniquement si vous utilisez le module AI. Si vous ne souhaitez pas utiliser l'IA, ignorez cette erreur.

Sinon, ajoutez `GROQ_API_KEY` dans `.env`.

### Le bot ne répond pas aux commandes

1. Vérifiez que les **Privileged Gateway Intents** sont activés
2. Redémarrez le bot
3. Vérifiez les logs : `pm2 logs wolaro`

### Erreur "Module not found"

```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📚 Documentation supplémentaire

- **Démarrage rapide** : [QUICKSTART.md](QUICKSTART.md)
- **Installation Windows** : [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)
- **Architecture** : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **API Reference** : [docs/API.md](docs/API.md)

---

## 👥 Support

- **GitHub Issues** : [Ouvrir une issue](https://github.com/theo7791l/Wolaro2/issues)
- **Documentation** : [Wiki GitHub](https://github.com/theo7791l/Wolaro2/wiki)

---

## 🎉 Félicitations !

Votre bot Wolaro2 est maintenant opérationnel ! 🎉

Prochaines étapes :
1. Configurer les modules selon vos besoins
2. Personnaliser les rôles et permissions
3. Activer l'automod IA pour une modération automatique
