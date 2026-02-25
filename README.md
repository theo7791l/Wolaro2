# Wolaro2

🤖 Bot Discord multifonctionnel nouvelle génération avec système de protection avancé.

## ✨ Fonctionnalités

### 🛡️ Protection (Migré de TheoProtect)
- ✅ **Anti-Spam** : Détection intelligente avec sanctions progressives
- ✅ **Anti-Raid** : Analyse des nouveaux membres avec captcha optionnel
- ✅ **Anti-Nuke** : Protection contre les suppressions massives
- ✅ **Anti-Phishing** : Détection de liens malveillants
- ✅ **Bad Words** : Filtrage de contenu inapproprié
- ✅ **NSFW Detection** : Analyse d'images (API optionnelle)
- ✅ **Smart Lockdown** : Verrouillage intelligent du serveur
- ✅ **Captcha System** : Vérification visuelle (Canvas optionnel)

### 📦 Modules
- 🎵 **Music** : Lecture YouTube/Spotify
- 💰 **Economy** : Système économique complet
- 🎮 **RPG** : Système de jeu de rôle
- 🎁 **Giveaways** : Gestion de concours
- 📊 **Leveling** : XP et niveaux
- 🎫 **Tickets** : Support utilisateur
- 🤖 **AI** : Intégration OpenAI
- ⚙️ **Admin** : Outils d'administration

## 🚀 Installation Rapide

### Pré-requis
- Node.js 18+
- PostgreSQL 13+
- Redis (optionnel)

### Configuration

```bash
# Cloner le repo
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# Installer les dépendances (sans build auto)
npm install --omit=dev

# Configurer .env
cp .env.example .env
nano .env
```

### Configuration .env

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
DATABASE_URL=postgresql://user:password@localhost:5432/wolaro2
REDIS_URL=redis://localhost:6379
```

### Compilation

**⚠️ IMPORTANT pour serveurs avec peu de RAM :**

```bash
# Option 1 : Compiler en local puis uploader dist/
npm run build

# Option 2 : Compiler sur le serveur avec limite mémoire
node --max-old-space-size=512 node_modules/typescript/bin/tsc

# Option 3 : Utiliser la version pré-compilée (à venir)
```

### Démarrage

```bash
# Déployer les commandes (une seule fois)
npm run deploy-commands

# Lancer le bot
npm start
```

## 📋 Migration depuis TheoProtect

Le système de protection est **100% compatible** avec TheoProtect. Les tables seront créées automatiquement au démarrage.

```bash
# Migration auto au premier démarrage
npm start
```

Les migrations créent :
- `protection_config` : Configuration par serveur
- `protection_logs` : Historique des actions
- `protection_stats` : Statistiques de protection
- `raid_detections` : Détection de raids
- `captcha_sessions` : Sessions captcha actives

## 🐳 Docker (Recommandé pour production)

```bash
# Build
docker build -t wolaro2 .

# Run
docker run -d \
  --name wolaro2 \
  -e DISCORD_TOKEN=xxx \
  -e DATABASE_URL=xxx \
  wolaro2
```

## 📊 Panels d'hébergement

### Pterodactyl / Pelican

**Startup Command:**
```bash
if [[ ! -d .git ]]; then git clone https://github.com/theo7791l/Wolaro2 .; fi; 
if [[ -d .git ]] && [[ ${AUTO_UPDATE} == "1" ]]; then git pull; fi; 
npm install --omit=dev; 
if [[ ! -d dist ]]; then npm run build; fi; 
node dist/deploy-commands.js; 
node dist/index.js
```

**Variables:**
- `AUTO_UPDATE` : `1` pour auto-update git
- `NODE_ARGS` : Arguments Node.js additionnels

### Recommandations

| Resource | Minimum | Recommandé |
|----------|---------|------------|
| RAM | 512 MB | 1 GB |
| CPU | 1 core | 2 cores |
| Disk | 500 MB | 1 GB |

⚠️ **Si compilation échoue (RAM insuffisante) :**

1. Compiler en local
2. Upload le dossier `dist/` via SFTP
3. Redémarrer sans rebuild

## 🔧 Commandes Utiles

```bash
# Rebuild complet
npm run build

# Redéployer commandes
npm run deploy-commands

# Dev mode avec hot-reload
npm run dev

# Migrations manuelles
npm run migrate
```

## 📝 Logs

Les logs incluent :
- ✅ Statut de connexion DB
- ✅ Migrations appliquées
- ✅ Modules chargés
- ✅ Commandes enregistrées
- ✅ Erreurs détaillées

## 🆘 Dépannage

### "Killed" pendant `npm install`
**Cause :** RAM insuffisante pour compiler TypeScript

**Solution :**
```bash
# Désactiver auto-build
npm install --omit=dev --ignore-scripts

# Compiler avec limite mémoire
node --max-old-space-size=512 node_modules/.bin/tsc
```

### "Unexpected token 'export'"
**Cause :** Le bot charge des fichiers `.d.ts` au lieu de `.js`

**Solution :**
```bash
# Vérifier que dist/ existe
ls -la dist/

# Rebuild si nécessaire
npm run build
```

### "Server exceeding disk space"
**Cause :** Espace disque insuffisant

**Solution :**
```bash
# Nettoyer node_modules
rm -rf node_modules
npm install --omit=dev

# Supprimer les logs
rm -rf logs/
```

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir [LICENSE](LICENSE)

## 🔗 Liens

- [Documentation](https://github.com/theo7791l/Wolaro2/wiki)
- [Issues](https://github.com/theo7791l/Wolaro2/issues)
- [Discord Support](https://discord.gg/your-server)

---

⭐ **Star le projet si tu l'utilises !**
