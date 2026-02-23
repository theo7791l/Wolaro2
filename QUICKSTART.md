# 🚀 Démarrage Rapide - Wolaro2

Guide express pour faire tourner Wolaro2 en **moins de 5 minutes** avec Docker.

---

## 📋 Prérequis

- ✅ **Docker** et **Docker Compose** installés
- ✅ **Git** (pour cloner le dépôt)
- ✅ Un **bot Discord** créé sur [discord.com/developers](https://discord.com/developers/applications)
- ✅ Une **clé API Gemini** (optionnel) sur [makersuite.google.com](https://makersuite.google.com/app/apikey)

---

## 🛠️ Installation en 3 étapes

### 1️⃣ Cloner le projet

```bash
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
```

---

### 2️⃣ Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer avec votre éditeur préféré
nano .env  # Linux/Mac
notepad .env  # Windows
```

**Variables OBLIGATOIRES à remplir** :

```env
# Discord (obtenir sur https://discord.com/developers/applications)
DISCORD_TOKEN=votre_token_bot_ici
DISCORD_CLIENT_ID=votre_client_id_ici
DISCORD_CLIENT_SECRET=votre_client_secret_ici
DISCORD_PUBLIC_KEY=votre_public_key_ici

# Base de données (choisissez un mot de passe fort)
DB_PASSWORD=votre_mot_de_passe_securise

# Sécurité (générez des clés aléatoires de 32+ caractères)
API_JWT_SECRET=votre_secret_jwt_minimum_32_caracteres
ENCRYPTION_KEY=votre_cle_encryption_32_caracteres

# Admin (votre ID Discord)
MASTER_ADMIN_IDS=123456789012345678

# IA Gemini (optionnel)
GEMINI_API_KEY=votre_cle_gemini_si_module_ai_active
```

**Astuce** : Pour générer des secrets aléatoires :
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

### 3️⃣ Démarrer avec Docker

```bash
# Lancer tous les services (PostgreSQL + Redis + Bot)
docker-compose up -d

# Surveiller les logs en temps réel
docker-compose logs -f bot
```

**Résultat attendu** :
```
🔍 Validating environment variables...
✅ Environment validation passed!

📋 Environment Configuration Summary:
   • Environment: production
   • Database: postgres:5432/wolaro
   • Redis: redis:6379
   • API Port: 3000
   • WebSocket Port: 3001

Starting Wolaro Discord Cloud Engine...
✓ Database connected
✓ Redis connected
✓ Modules loaded
✓ Handlers initialized
✓ WebSocket server started
✓ API server started
✓ Bot logged in successfully
Logged in as YourBot#1234
Serving 0 guilds
```

---

## ✅ Vérification

### Tester l'API

```bash
curl http://localhost:3000/api/health
```

**Réponse attendue** :
```json
{"status":"ok","timestamp":"2026-02-23T12:00:00.000Z"}
```

### Vérifier les conteneurs

```bash
docker ps
```

**Statuts attendus** :
- ✅ `wolaro-postgres` - Up (healthy)
- ✅ `wolaro-redis` - Up (healthy)
- ✅ `wolaro-bot` - Up (healthy)

---

## 🤖 Inviter le bot sur votre serveur

### 1. Générer le lien d'invitation

Remplacez `YOUR_CLIENT_ID` par votre `DISCORD_CLIENT_ID` :

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=8
```

**Permissions recommandées** :
- Administrator (8) - Pour tous les modules
- Ou sélection personnalisée selon vos besoins

### 2. Tester une commande

Sur votre serveur Discord :
```
/ping
```

Le bot devrait répondre avec le temps de latence.

---

## 🔧 Commandes utiles

### Arrêter le bot

```bash
docker-compose down
```

### Redémarrer le bot

```bash
docker-compose restart bot
```

### Voir les logs

```bash
# Bot
docker-compose logs -f bot

# PostgreSQL
docker-compose logs -f postgres

# Redis
docker-compose logs -f redis

# Tous les services
docker-compose logs -f
```

### Reconstruire après modification du code

```bash
docker-compose up -d --build
```

### Nettoyer complètement (attention : supprime les données)

```bash
docker-compose down -v
```

### Accéder à la base de données

```bash
docker exec -it wolaro-postgres psql -U wolaro -d wolaro
```

Commandes PostgreSQL utiles :
```sql
\dt              -- Lister les tables
\d guilds        -- Décrire la table guilds
SELECT * FROM guilds;  -- Voir les serveurs
\q               -- Quitter
```

### Accéder à Redis

```bash
docker exec -it wolaro-redis redis-cli
```

Commandes Redis utiles :
```
PING             # Tester la connexion
KEYS *           # Lister toutes les clés
GET cle          # Obtenir une valeur
exit             # Quitter
```

---

## 🐞 Problèmes courants

### Erreur : "DB_PASSWORD must be set in .env file"

➡️ **Solution** : Vérifiez que `DB_PASSWORD` est bien défini dans `.env`

```bash
grep DB_PASSWORD .env
```

---

### Erreur : "port is already allocated"

➡️ **Solution** : Un autre service utilise le port. Changez le port dans `.env` :

```env
API_PORT=3010  # Au lieu de 3000
WS_PORT=3011   # Au lieu de 3001
```

Ou arrêtez le service qui utilise le port :

```bash
# Linux/Mac
lsof -i :3000
kill -9 PID

# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

---

### Le bot ne se connecte pas à Discord

➡️ **Causes possibles** :

1. **Token invalide** : Vérifiez `DISCORD_TOKEN` dans `.env`
2. **Intents manquants** : Activez tous les intents sur [discord.com/developers](https://discord.com/developers/applications)
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent

---

### Erreur de build Docker (canvas)

➡️ **Solution** : Les dépendances canvas sont maintenant installées automatiquement. Si le problème persiste :

```bash
# Rebuild complètement sans cache
docker-compose build --no-cache
```

---

### Validation environnement échouée

➡️ **Solution** : Le bot affiche les variables manquantes ou invalides. Exemple :

```
❌ Environment validation failed!

The following environment variables have issues:

  • API_JWT_SECRET: API JWT Secret must be at least 32 characters (current: 16)
  • ENCRYPTION_KEY: Encryption Key is required but not set
```

Corrigez les variables dans `.env` et redémarrez :

```bash
docker-compose restart bot
```

---

## 📦 Modules disponibles

Tous les modules sont activés par défaut. Pour désactiver un module, modifiez `.env` :

```env
FEATURE_MUSIC_ENABLED=false      # Désactiver le module musique
FEATURE_AI_ENABLED=false         # Désactiver l'IA Gemini
FEATURE_RPG_ENABLED=false        # Désactiver le RPG
FEATURE_TICKETS_ENABLED=false    # Désactiver les tickets
FEATURE_GIVEAWAYS_ENABLED=false  # Désactiver les giveaways
```

### Liste des modules

1. **Moderation** (8 commandes) - `/ban`, `/kick`, `/warn`, etc.
2. **Economy** (7 commandes) - `/balance`, `/daily`, `/work`, etc.
3. **Leveling** (3 commandes) - `/rank`, `/levels`, `/setxp`
4. **Music** (6 commandes) - `/play`, `/stop`, `/skip`, etc.
5. **Admin** (5 commandes) - `/impersonate`, `/blacklist`, `/stats`
6. **AI Gemini** (4 commandes) - `/ask`, `/aichat`, `/aiimage`
7. **RPG** (6 commandes) - `/battle`, `/rpgprofile`, `/quest`
8. **Tickets** (5 commandes) - `/ticket`, `/closeticket`
9. **Giveaways** (4 commandes) - `/giveaway`, `/reroll`, `/gend`

**Total** : **48 commandes**

---

## 📚 Documentation complète

- 📘 **[README.md](README.md)** - Documentation complète du projet
- 👨‍💻 **[INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)** - Guide installation Windows
- 🐞 **[BUGFIXES.md](BUGFIXES.md)** - Liste des corrections apportées
- ✅ **[VERIFICATION_REPORT.md](VERIFICATION_REPORT.md)** - Rapport de vérification complète
- 🔧 **[scripts/setup.ps1](scripts/setup.ps1)** - Script d'installation Windows

---

## 👥 Support

Besoin d'aide ?

- 📖 **Documentation** : [docs/](docs/)
- 🐛 **Issues** : [GitHub Issues](https://github.com/theo7791l/Wolaro2/issues)
- 💬 **Discord** : [Join our server](https://discord.gg/wolaro)

---

## 🎉 Félicitations !

Votre bot Wolaro2 est maintenant opérationnel ! 🎊

Prochaines étapes :
1. ✅ Configurer les modules via les commandes `/setup`
2. ✅ Personnaliser les rôles et permissions
3. ✅ Activer l'auto-modération IA avec `/automod`
4. ✅ Créer votre première économie avec `/shop`
5. ✅ Lancer un giveaway avec `/giveaway`

**Bon amusement avec Wolaro2 !** 🚀

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/theo7791l">theo7791l</a>
</p>
