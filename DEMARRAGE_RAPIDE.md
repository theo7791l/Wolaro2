# 🚀 Démarrage Rapide - Wolaro2

## 🐛 Problèmes résolus

✅ Commandes TypeScript non chargées (classes)
✅ Base de données manquante (mode optionnel)
✅ Migration TheoProtect automatique
✅ Déploiement des commandes corrigé

---

## 🛠️ Installation sur VPS Oracle (Recommandé)

### 1. **Migrer la base de données**

```bash
cd ~/mmmm/Wolaro2
git pull origin main

# Exécuter la migration
node scripts/migrate-db.js
```

### 2. **Compiler et démarrer le bot**

```bash
# Installer les dépendances
npm install

# Compiler TypeScript
npm run build

# Déployer les commandes
node dist/deploy-commands.js

# Démarrer le bot
npm start
```

### 3. **Utiliser PM2 (pour redémarrage automatique)**

```bash
# Installer PM2
npm install -g pm2

# Démarrer avec PM2
pm2 start npm --name "wolaro2" -- start

# Sauvegarder la config PM2
pm2 save
pm2 startup
```

---

## 📦 Installation sur Skybots/Pterodactyl

### ⚠️ **Important : Configuration de la base de données**

Skybots doit pouvoir accéder à ta base de données. Deux options :

#### **Option A : Utiliser une DB externe (Recommandé)**

1. Crée une DB gratuite sur [Neon](https://neon.tech) ou [Supabase](https://supabase.com)
2. Configure `DATABASE_URL` dans les variables d'environnement Skybots

#### **Option B : Ouvrir ton PostgreSQL Oracle**

Sur ton VPS Oracle :

```bash
# Éditer postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf
# Changer: listen_addresses = '*'

# Éditer pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Ajouter: host all all 0.0.0.0/0 md5

# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

Puis **ouvrir le port 5432** dans Oracle Cloud Console → Security Lists.

### **Déploiement sur Skybots**

1. Le bot se mettra à jour automatiquement avec `git pull`
2. Redémarre simplement le bot sur le panel Skybots

---

## 🔧 Commandes utiles

### **Vérifier les tables créées**

```bash
PGPASSWORD=jXYAbUZu3euMlRTD psql -h localhost -U wolaro -d wolaro -c "\dt"
```

### **Voir les logs en temps réel**

```bash
# Avec PM2
pm2 logs wolaro2

# Sans PM2
npm start
```

### **Reconstruire après modifications**

```bash
git pull
npm install
npm run build
pm2 restart wolaro2
```

---

## 🎯 Architecture du projet

```
Wolaro2/
├── src/
│   ├── index.ts                 # Point d'entrée principal
│   ├── deploy-commands.ts       # Déploiement des commandes
│   ├── modules/                 # Modules du bot
│   │   ├── admin/              # Commandes admin
│   │   ├── ai/                 # IA (Gemini)
│   │   ├── economy/            # Système d'économie
│   │   ├── moderation/         # Modération + TheoProtect
│   │   ├── music/              # Musique
│   │   └── ...
│   ├── database/               # Gestion DB
│   └── utils/                  # Utilitaires
├── dist/                       # Code compilé (généré)
├── scripts/
│   └── migrate-db.js           # Script de migration
├── MIGRATION_THEOPROTECT.sql  # SQL de migration
└── package.json
```

---

## 🐛 Dépannage

### **Erreur : "0 commandes trouvées"**

✅ **CORRIGÉ** - Les commandes se chargent maintenant correctement.

Si le problème persiste :

```bash
rm -rf dist/
npm run build
node dist/deploy-commands.js
```

### **Erreur : "ECONNREFUSED" (DB)**

- Vérifie que PostgreSQL tourne : `sudo systemctl status postgresql`
- Vérifie tes variables d'environnement dans `.env`
- Exécute la migration : `node scripts/migrate-db.js`

### **Le bot démarre mais ne répond pas**

- Vérifie que les commandes sont déployées : `node dist/deploy-commands.js`
- Attends 5 minutes (Discord peut mettre du temps à synchroniser)
- Redémarre Discord (cache)

---

## ✨ Fonctionnalités principales

### **TheoProtect (Système de protection)**
- Anti-spam intelligent
- Anti-raid avec captcha
- Détection de phishing
- Anti-nuke
- Filtrage de contenu NSFW (optionnel)
- Lockdown automatique

### **Modules disponibles**
- 🔒 **Admin** : Gestion avancée du bot
- 🤖 **IA** : Intégration Gemini (chat, images, support)
- 💰 **Économie** : Système de monnaie virtuelle
- 🎁 **Giveaways** : Concours et tirages au sort
- 🏆 **Leveling** : Système XP et niveaux
- 🛡️ **Modération** : Outils de modération complets
- 🎵 **Musique** : Lecteur audio
- ⚔️ **RPG** : Système de jeu de rôle
- 🎫 **Tickets** : Support utilisateur

---

## 📞 Support

Si tu as des problèmes :
1. Vérifie les logs : `pm2 logs wolaro2` ou `npm start`
2. Vérifie que toutes les dépendances sont installées : `npm install`
3. Vérifie ta config `.env`

---

## 📅 Dernières modifications

**26 février 2026**
- ✅ Correction du chargement des commandes TypeScript (classes)
- ✅ Base de données optionnelle (le bot démarre sans DB)
- ✅ Script de migration automatique ajouté
- ✅ Deploy-commands amélioré pour supporter les classes
- ✅ Gestion d'erreurs améliorée

---

**🚀 Ton bot est maintenant prêt à fonctionner !**
