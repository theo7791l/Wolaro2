# Guide d'installation Wolaro2

## Prérequis

### Logiciels requis

1. **Node.js 20 LTS ou supérieur**
   - Télécharger : https://nodejs.org/
   - Vérifier : `node --version` (doit afficher v20.x.x ou supérieur)

2. **PostgreSQL 14 ou supérieur**
   - Windows : https://www.postgresql.org/download/windows/
   - Linux : `sudo apt install postgresql postgresql-contrib`
   - Vérifier : `psql --version`

3. **Redis 6 ou supérieur**
   - Windows : https://github.com/microsoftarchive/redis/releases
   - Linux : `sudo apt install redis-server`
   - Vérifier : `redis-cli --version`

4. **Git**
   - Télécharger : https://git-scm.com/downloads
   - Vérifier : `git --version`

### Outils de build (Windows uniquement)

Sur Windows, les dépendances natives nécessitent des outils de compilation :

```powershell
# Exécuter en tant qu'Administrateur dans PowerShell
npm install --global windows-build-tools
```

Ou installer manuellement :
- Visual Studio Build Tools 2022
- Python 3.x (ajouté au PATH)

## Installation

### Étape 1 : Cloner le repository

```bash
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
```

### Étape 2 : Installer les dépendances

**Option 1 : Installation standard**
```bash
npm install
```

**Option 2 : Si vous rencontrez des erreurs de dépendances**
```bash
npm install --legacy-peer-deps
```

**Option 3 : Si les dépendances natives échouent**
```bash
# Ignorer les dépendances optionnelles
npm install --no-optional --legacy-peer-deps
```

### Étape 3 : Configuration de l'environnement

1. **Copier le fichier d'exemple**
```bash
cp .env.example .env
```

2. **Éditer le fichier .env**

Ouvrir `.env` et remplir **OBLIGATOIREMENT** ces valeurs :

```env
# Discord (requis)
DISCORD_TOKEN=ton_token_discord_ici
DISCORD_CLIENT_ID=ton_client_id_ici
DISCORD_CLIENT_SECRET=ton_client_secret_ici
DISCORD_PUBLIC_KEY=ta_public_key_ici

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

### Étape 4 : Configuration de PostgreSQL

1. **Créer l'utilisateur et la base de données**

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Dans psql:
CREATE USER wolaro WITH PASSWORD 'ton_mot_de_passe';
CREATE DATABASE wolaro OWNER wolaro;
GRANT ALL PRIVILEGES ON DATABASE wolaro TO wolaro;
\q
```

2. **Initialiser le schéma**

```bash
psql -U wolaro -d wolaro -f src/database/schema.sql
```

### Étape 5 : Configuration de Redis

**Linux :**
```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Windows :**
- Démarrer le service Redis depuis les Services Windows
- Ou exécuter `redis-server.exe`

### Étape 6 : Compiler le projet

```bash
npm run build
```

Si vous rencontrez des erreurs TypeScript, utilisez :
```bash
npm run build:force
```

### Étape 7 : Démarrer le bot

**Mode développement (avec rechargement automatique) :**
```bash
npm run dev
```

**Mode production :**
```bash
npm start
```

**Avec PM2 (recommandé pour production) :**
```bash
npm run pm2:start
npm run pm2:logs  # Voir les logs
```

## Résolution des problèmes

### Erreur : "Cannot find module 'canvas'"

La dépendance `canvas` nécessite des bibliothèques système.

**Linux (Ubuntu/Debian) :**
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install canvas
```

**Windows :**
- Installer windows-build-tools (voir ci-dessus)
- Ou désactiver temporairement canvas en le retirant de package.json

### Erreur : "@discordjs/opus install failed"

```bash
# Solution 1 : Installer les outils de build
npm install --global windows-build-tools

# Solution 2 : Ignorer cette dépendance (la musique fonctionnera quand même)
npm install --no-optional
```

### Erreur : "DISCORD_PUBLIC_KEY is required"

Le `DISCORD_PUBLIC_KEY` est maintenant **obligatoire** pour la sécurité.

1. Aller sur https://discord.com/developers/applications
2. Sélectionner votre application
3. **General Information** > **Public Key**
4. Copier et coller dans `.env`

### Erreur : "Connection to database failed"

Vérifier que :
1. PostgreSQL est bien démarré : `sudo systemctl status postgresql`
2. Les identifiants dans `.env` sont corrects
3. La base de données existe : `psql -U wolaro -d wolaro -c "SELECT 1"`

### Erreur : "Redis connection refused"

Vérifier que :
1. Redis est bien démarré : `redis-cli ping` (doit répondre "PONG")
2. Le port 6379 est ouvert
3. Les paramètres Redis dans `.env` sont corrects

### Erreur de compilation TypeScript

Si vous avez des erreurs de types après avoir activé le mode strict :

```bash
# Compilation forcée (ignore les erreurs de types)
npm run build:force
```

**Note :** Il est recommandé de corriger les erreurs de types plutôt que de les ignorer.

## Vérification de l'installation

Après le démarrage, vous devriez voir :

```
[Wolaro] Starting Wolaro Discord Cloud Engine...
[Wolaro] ✓ Database connected
[Wolaro] ✓ Redis connected
[Wolaro] ✓ Modules loaded
[Wolaro] ✓ Handlers initialized
[Wolaro] ✓ WebSocket server started
[Wolaro] ✓ API server started
[Wolaro] ✓ Bot logged in successfully
[Wolaro] Logged in as VotreBot#1234
[Wolaro] Serving X guilds
```

## Docker (Alternative)

Si vous préférez utiliser Docker :

```bash
# Construire l'image
npm run docker:build

# Démarrer les services
npm run docker:up

# Voir les logs
npm run docker:logs
```

## Support

Si vous rencontrez des problèmes :
1. Vérifier les logs : `npm run pm2:logs` ou consulter `./logs/`
2. Ouvrir une issue sur GitHub : https://github.com/theo7791l/Wolaro2/issues
3. Vérifier que toutes les variables `.env` sont correctement remplies

## Prochaines étapes

Après l'installation réussie :
1. Inviter le bot sur votre serveur Discord
2. Utiliser `/help` pour voir toutes les commandes
3. Configurer les modules via le panel web (https://wolaro.fr/panel)
4. Consulter la documentation complète dans le dossier `docs/`
