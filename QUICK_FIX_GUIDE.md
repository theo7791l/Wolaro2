# 🔧 Guide de correction rapide

## Problèmes corrigés

### 1. ❌ `context.database.getGuildConfig is not a function`
**Cause :** Le code passait un simple `Pool` pg au lieu d'une instance `DatabaseManager`

**Fix :** `src/index.ts` utilise maintenant `DatabaseManager` avec toutes ses méthodes

### 2. ❌ `Cannot read properties of null (reading 'invalidateGuildConfig')`
**Cause :** `context.redis` était hardcodé à `null`

**Fix :** `src/index.ts` initialise maintenant une vraie instance `RedisManager`

### 3. ⚠️ Vulnérabilités npm
**Cause :** Dépendances obsolètes avec CVE connus

**Fix :** `package.json` mis à jour avec les dernières versions sécurisées

---

## 🚀 Déploiement des corrections

### Sur ton serveur (instance Oracle Cloud)

```bash
# 1. Pull les derniers commits
cd ~/mmmm/Wolaro2
git pull origin main

# 2. Nettoyer et reinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# 3. Rebuild le projet TypeScript
npm run build

# 4. Redémarrer le bot
npm start
# Ou avec PM2 :
pm2 restart all
```

### Sur Pterodactyl (auto-update activé)

**Rien à faire !** Le panel va automatiquement :
1. Pull les derniers commits au prochain redémarrage
2. Installer les nouvelles dépendances
3. Rebuild le code
4. Lancer le bot

Il suffit de **restart le serveur** depuis le panel.

---

## ✅ Vérification

Après le redémarrage, tu dois voir dans les logs :

```
info: Testing database connection...
info: ✅ Database connected
info: ✅ Migrations completed
info: 📦 Loaded 51 commands
info: ✅ Protection module ready
info: ✨ Wolaro2 is ready!
```

**Toutes les commandes doivent maintenant fonctionner** :
- `/ask` → ✅
- `/balance` → ✅  
- `/automod` → ✅
- Toutes les autres commandes → ✅

---

## 🐛 Si tu as encore des erreurs

### Erreur : `must be owner of function update_updated_at_column`

```bash
sudo -u postgres psql -d wolaro
```

Dans psql :
```sql
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

ALTER FUNCTION update_updated_at_column() OWNER TO wolaro;
```

Puis `\q` et redémarre le bot.

### Erreur : `relation "guilds" does not exist`

Reset complet de la DB :

```bash
psql -U wolaro -d wolaro -h localhost
```

Dans psql :
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO wolaro;
GRANT ALL ON SCHEMA public TO public;
```

Puis `\q` et relance :
```bash
psql -U wolaro -d wolaro -h localhost -f src/database/schema.sql
npm start
```

---

## 📝 Commits appliqués

1. **fc27732** - Fix DatabaseManager and RedisManager injection
2. **bb18d62** - Update dependencies (security fixes)

Date : 26 février 2026, 16:44 CET
