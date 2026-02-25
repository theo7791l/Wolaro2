# 📦 Guide d'Installation Wolaro2

## Pour Panel d'Hébergement (Skybots, etc.)

### 🎯 **Installation Simple**

1. **Upload les fichiers**
   - Télécharge le repo : `git clone https://github.com/theo7791l/Wolaro2.git`
   - OU télécharge le ZIP depuis GitHub
   - Upload tout dans le panel

2. **Configure .env**
   ```env
   DISCORD_TOKEN=ton_token_discord
   DISCORD_CLIENT_ID=ton_client_id
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```

3. **Installe les dépendances**
   ```bash
   npm install
   ```
   
   Si canvas échoue (normal sur hosting gratuit) :
   ```bash
   npm install --no-optional
   ```
   Le bot marchera quand même ! Le captcha sera en mode texte.

4. **Démarre le bot**
   ```bash
   npm start
   ```
   
   Les tables PostgreSQL sont créées **automatiquement** au premier démarrage ! ✨

### ⚙️ **Configuration Panel**

**Commande de démarrage** :
```bash
npm start
```

**Variables d'environnement** (dans le panel) :
```
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DATABASE_URL=postgresql://...
```

**Node Version** : 18.x ou 20.x

### 🔧 **Troubleshooting Hébergement**

#### ❌ Erreur "canvas not found"
**Solution** : C'est normal sur hosting gratuit !
```bash
npm install --no-optional
```
Le captcha utilisera du texte au lieu d'images.

#### ❌ Erreur "Cannot find module typescript"
**Solution** :
```bash
npm install typescript tsx --save
npm run build
```

#### ❌ Erreur "Permission denied"
**Solution** : Le panel doit avoir les droits d'écriture.
Contacte le support du panel.

#### ❌ Erreur "ECONNREFUSED database"
**Solution** : Vérifie DATABASE_URL dans .env.
Format : `postgresql://user:pass@host:5432/dbname`

### 📊 **Vérification Installation**

```bash
# Dans les logs du panel, tu dois voir :
Starting Wolaro2...
✅ Database connected
Running database migrations...
✅ Protection migration completed
✅ Protection module ready
✨ Wolaro2 is ready!
Logged in as Wolaro2#1234
```

Si tu vois ça, **tout marche !** ✅

### 🎮 **Première Utilisation**

Dans Discord :
```bash
/protection-config view
```

Si la commande apparaît, l'installation est réussie ! 🎉

---

## Pour VPS / Serveur Dédié

### Installation Complète

```bash
# Clone le repo
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# Installe Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installe PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Crée la base de données
sudo -u postgres createdb wolaro2

# Installe les dépendances
npm install

# Configure
cp .env.example .env
nano .env

# Build & Start
npm run build
npm start
```

### Avec PM2 (Production)

```bash
# Installe PM2
npm install -g pm2

# Démarre le bot
pm2 start dist/index.js --name wolaro2

# Auto-restart au reboot
pm2 startup
pm2 save

# Logs
pm2 logs wolaro2
```

---

## 🆘 Support

- **GitHub Issues** : [github.com/theo7791l/Wolaro2/issues](https://github.com/theo7791l/Wolaro2/issues)
- **Discord** : Contacte theo7791l

---

## ✅ Checklist Installation

- [ ] Fichiers uploadés dans le panel
- [ ] .env configuré avec TOKEN + DATABASE_URL
- [ ] `npm install` exécuté
- [ ] Base PostgreSQL créée
- [ ] Bot démarré avec `npm start`
- [ ] Logs affichent "Wolaro2 is ready!"
- [ ] Commande `/protection-config view` fonctionne

**Si tous les points sont ✅, c'est bon !** 🎉
