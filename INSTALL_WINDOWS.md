# 🚀 Installation sous Windows

Guide complet pour installer Wolaro2 sur Windows 10/11.

## 🛠️ Prérequis

### 1. Node.js 20+

Téléchargez et installez Node.js depuis [nodejs.org](https://nodejs.org/) (version LTS recommandée).

```powershell
# Vérifiez l'installation
node --version  # Doit afficher v20.x.x ou supérieur
npm --version   # Doit afficher v9.x.x ou supérieur
```

### 2. Git

Téléchargez depuis [git-scm.com](https://git-scm.com/download/win).

```powershell
git --version
```

### 3. Build Tools (CRITIQUE pour les modules natifs)

Ouvrez **PowerShell en tant qu'Administrateur** et exécutez :

```powershell
# Option 1 : Installer les build tools Windows (recommandé)
npm install --global windows-build-tools

# Option 2 : Installer Visual Studio Build Tools
# Téléchargez depuis : https://visualstudio.microsoft.com/fr/downloads/
# Sélectionnez "Build Tools pour Visual Studio 2022"
# Cochez "Développement Desktop en C++"
```

### 4. Python 3

Téléchargez depuis [python.org](https://www.python.org/downloads/) et **cochez "Add Python to PATH"** lors de l'installation.

```powershell
python --version  # Doit afficher Python 3.x.x
```

## 💻 Installation Locale (Sans Docker)

### Étape 1 : Cloner le dépôt

```powershell
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
```

### Étape 2 : Configuration

```powershell
# Copier le fichier d'exemple
copy .env.example .env

# Éditer le fichier .env avec Notepad
notepad .env
```

**Remplissez au minimum :**
```env
DISCORD_TOKEN=votre_token_discord
DISCORD_CLIENT_ID=votre_client_id
DISCORD_CLIENT_SECRET=votre_client_secret

DB_HOST=localhost
DB_PORT=5432
DB_NAME=wolaro
DB_USER=wolaro
DB_PASSWORD=votre_mot_de_passe_securise

REDIS_HOST=localhost
REDIS_PORT=6379

GEMINI_API_KEY=votre_cle_gemini
```

### Étape 3 : Installer PostgreSQL

Téléchargez depuis [postgresql.org/download/windows](https://www.postgresql.org/download/windows/).

Après installation :

```powershell
# Ouvrez psql (PostgreSQL Shell)
psql -U postgres

# Dans psql :
CREATE DATABASE wolaro;
CREATE USER wolaro WITH ENCRYPTED PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE wolaro TO wolaro;
\q
```

### Étape 4 : Installer Redis

**Option 1 : Via Memurai (Redis pour Windows)**

Téléchargez [Memurai](https://www.memurai.com/get-memurai) (gratuit pour développement).

**Option 2 : Via WSL2 (recommandé)**

```powershell
# Installer WSL2
wsl --install

# Dans WSL2 :
sudo apt update
sudo apt install redis-server
sudo service redis-server start
```

### Étape 5 : Installer les dépendances

```powershell
# Dans le dossier Wolaro2
npm install
```

**Si vous rencontrez des erreurs de compilation :**

```powershell
# Nettoyer le cache npm
npm cache clean --force

# Réinstaller
rm -r node_modules
npm install
```

### Étape 6 : Appliquer le schéma de base de données

```powershell
# Via psql
psql -U wolaro -d wolaro -f src/database/schema.sql

# OU via le script (nécessite Git Bash)
bash scripts/migrate.sh
```

### Étape 7 : Compiler TypeScript

```powershell
npm run build
```

### Étape 8 : Démarrer le bot

```powershell
# Mode développement (avec hot-reload)
npm run dev

# Mode production
npm start
```

## 🐳 Installation Docker (Recommandé)

### Prérequis Docker

1. **Docker Desktop pour Windows**
   - Téléchargez depuis [docker.com](https://www.docker.com/products/docker-desktop/)
   - Activez WSL2 pendant l'installation

2. **Vérifiez Docker**

```powershell
docker --version
docker-compose --version
```

### Installation avec Docker

```powershell
# 1. Cloner le dépôt
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# 2. Copier et configurer .env
copy .env.example .env
notepad .env

# 3. Démarrer tous les services (PostgreSQL + Redis + Bot)
docker-compose up -d

# 4. Voir les logs
docker-compose logs -f bot
```

### Commandes Docker utiles

```powershell
# Arrêter les services
docker-compose down

# Redémarrer le bot
docker-compose restart bot

# Reconstruire après modification du code
docker-compose up -d --build

# Voir les logs PostgreSQL
docker-compose logs -f postgres

# Voir les logs Redis
docker-compose logs -f redis

# Accéder au shell du bot
docker exec -it wolaro-bot sh

# Nettoyer tout (attention : supprime les données)
docker-compose down -v
```

## ⚠️ Troubleshooting

### Erreur : "node-gyp" non trouvé

```powershell
npm install --global node-gyp
npm config set msvs_version 2022
npm install
```

### Erreur : "python" non trouvé

```powershell
npm config set python "C:\Python311\python.exe"
```

### Erreur de compilation de "canvas"

```powershell
# Installer les dépendances GTK depuis
# https://github.com/Automattic/node-canvas/wiki/Installation:-Windows

# Ou utiliser Docker à la place
```

### Erreur : "Cannot find module 'discord.js'"

```powershell
rm -r node_modules package-lock.json
npm install
```

### Le bot ne se connecte pas à PostgreSQL

Vérifiez que PostgreSQL est démarré :

```powershell
# Services Windows
services.msc
# Cherchez "postgresql-x64-15" et démarrez-le

# Ou via commande
net start postgresql-x64-15
```

### Le bot ne se connecte pas à Redis

```powershell
# Si vous utilisez Memurai
net start memurai

# Si vous utilisez WSL2
wsl
sudo service redis-server start
```

### Port 3000 ou 3001 déjà utilisé

```powershell
# Trouver le processus utilisant le port
netstat -ano | findstr :3000

# Tuer le processus (remplacez PID par l'ID du processus)
taskkill /PID <PID> /F
```

## 🛡️ Sécurité Windows Defender

Windows Defender peut ralentir `npm install`. Ajoutez des exclusions :

1. Ouvrez **Sécurité Windows**
2. **Protection contre les virus et menaces** > **Gérer les paramètres**
3. **Exclusions** > **Ajouter une exclusion**
4. Ajoutez ces dossiers :
   - `C:\Users\VotreNom\AppData\Roaming\npm`
   - `C:\Users\VotreNom\AppData\Local\node-gyp`
   - Le dossier de votre projet `Wolaro2`

## 🚀 Démarrage Rapide (Résumé)

### Avec Docker (plus simple)

```powershell
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
copy .env.example .env
# Éditez .env avec vos tokens
docker-compose up -d
```

### Sans Docker

```powershell
# En tant qu'administrateur
npm install --global windows-build-tools

# Normalement
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
copy .env.example .env
# Éditez .env
npm install
npm run build
npm start
```

## 📞 Support

Si vous rencontrez toujours des problèmes :

1. Vérifiez les [Issues GitHub](https://github.com/theo7791l/Wolaro2/issues)
2. Créez une nouvelle issue avec :
   - Version de Node.js (`node --version`)
   - Version de npm (`npm --version`)
   - Version de Windows
   - Message d'erreur complet
   - Logs du bot

---

**Astuce** : Docker est **fortement recommandé** sous Windows car il évite tous les problèmes de compilation de modules natifs !
