# 🐞 Corrections de Bugs - Wolaro2

Ce document liste toutes les corrections apportées au projet suite à l'audit du 23 février 2026.

## ✅ Bugs Corrigés

### 1. Dépendances manquantes pour le module Canvas dans Docker

**Problème** : Le Dockerfile n'installait pas toutes les dépendances système nécessaires pour compiler le module natif `canvas`.

**Impact** : Le build Docker échouait lors de l'installation de `canvas`.

**Correction** : Ajout des bibliothèques graphiques manquantes dans le Dockerfile :
```dockerfile
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev
```

**Commit** : [08e4a16](https://github.com/theo7791l/Wolaro2/commit/08e4a168fd06c627c0c741f25eb23483babc90b8)

---

### 2. Healthcheck Docker amélioré

**Problème** : Le healthcheck avait un timeout trop court et ne laissait pas assez de temps au bot pour démarrer.

**Impact** : Docker marquait le conteneur comme "unhealthy" pendant le démarrage.

**Correction** : Amélioration des paramètres du healthcheck :
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3
```

**Commit** : [08e4a16](https://github.com/theo7791l/Wolaro2/commit/08e4a168fd06c627c0c741f25eb23483babc90b8)

---

### 3. Variables d'environnement manquantes dans docker-compose.yml

**Problème** : Le docker-compose.yml ne passait pas toutes les variables critiques au conteneur, notamment :
- `DISCORD_PUBLIC_KEY`
- `GEMINI_API_KEY`
- `API_JWT_SECRET`
- `ENCRYPTION_KEY`
- `MASTER_ADMIN_IDS`

**Impact** : Le bot ne pouvait pas démarrer correctement car des variables essentielles étaient manquantes.

**Correction** : Utilisation de `env_file: .env` pour charger automatiquement toutes les variables, avec seulement des overrides pour Docker networking :
```yaml
bot:
  env_file:
    - .env
  environment:
    DB_HOST: postgres
    REDIS_HOST: redis
    NODE_ENV: production
```

**Commit** : [fc2e001](https://github.com/theo7791l/Wolaro2/commit/fc2e00115d2bcb3222dd9b7bf330f2dbe6101a83)

---

### 4. Mot de passe par défaut non sécurisé dans docker-compose.yml

**Problème** : Le fichier utilisait `${DB_PASSWORD:-changeme}` comme fallback, ce qui créait un risque de sécurité en production.

**Impact** : Si `.env` n'est pas configuré, le mot de passe de la base de données est "changeme".

**Correction** : Remplacement par une erreur obligatoire si la variable n'est pas définie :
```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD must be set in .env file}
```

**Commit** : [fc2e001](https://github.com/theo7791l/Wolaro2/commit/fc2e00115d2bcb3222dd9b7bf330f2dbe6101a83)

---

### 5. Ajout de restart policies dans docker-compose.yml

**Problème** : Les services n'avaient pas de politique de redémarrage, sauf le bot.

**Impact** : PostgreSQL et Redis ne redémarraient pas automatiquement en cas de crash.

**Correction** : Ajout de `restart: unless-stopped` à tous les services.

**Commit** : [fc2e001](https://github.com/theo7791l/Wolaro2/commit/fc2e00115d2bcb3222dd9b7bf330f2dbe6101a83)

---

### 6. Nombre de tables incorrect dans README.md

**Problème** : Le README annonçait "22 Tables PostgreSQL" mais listait seulement 21 tables (`shard_stats` était dupliquée).

**Impact** : Incohérence dans la documentation.

**Correction** : Correction du nombre de tables de 22 à 21 et suppression de la duplication.

**Commit** : [07fcdf7](https://github.com/theo7791l/Wolaro2/commit/07fcdf771e5afd1a8c55339880b55f3fe45c80ce)

---

### 7. .dockerignore incomplet

**Problème** : Le fichier .dockerignore n'excluait pas tous les fichiers inutiles, augmentant la taille de l'image Docker.

**Impact** : Build Docker plus lent et images plus volumineuses.

**Correction** : Ajout de nombreuses exclusions :
- Tests et coverage
- Documentation
- Fichiers IDE
- Scripts CI/CD
- Fichiers Docker eux-mêmes

**Commit** : [2c90d4d](https://github.com/theo7791l/Wolaro2/commit/2c90d4d91e3e91514bb014fdbf1d0d060d736560)

---

## 🆕 Nouvelles Fonctionnalités

### 8. Validation des variables d'environnement au démarrage

**Ajout** : Création d'un utilitaire `src/utils/validateEnv.ts` qui valide toutes les variables d'environnement requises au démarrage.

**Fonctionnalités** :
- Vérification de présence des variables obligatoires
- Vérification de longueur minimale (JWT secret, encryption key)
- Vérification de format (numéros, ports)
- Affichage d'un résumé de configuration
- Arrêt propre si configuration invalide

**Utilisation dans `src/index.ts`** :
```typescript
import { validateEnvironmentOrExit, displayEnvironmentSummary } from './utils/validateEnv';

validateEnvironmentOrExit();
displayEnvironmentSummary();
```

**Commit** : [d9a52eb](https://github.com/theo7791l/Wolaro2/commit/d9a52ebca19849acdf8a85264d1d21235bccab9e)

---

### 9. docker-compose.override.yml pour le développement

**Ajout** : Création d'un fichier `docker-compose.override.yml.example` pour faciliter le développement.

**Fonctionnalités** :
- Hot-reload avec `npm run dev`
- Montage du code source en lecture seule
- Variables d'environnement de développement
- Pas de restart automatique

**Utilisation** :
```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker-compose up
```

**Commit** : [ce637e4](https://github.com/theo7791l/Wolaro2/commit/ce637e4975f85edda095ff9247ad890a708dddab)

---

### 10. Script PowerShell pour Windows

**Ajout** : Création d'un script `scripts/setup.ps1` pour automatiser l'installation sur Windows.

**Fonctionnalités** :
- Vérification des prérequis (Node.js, npm, Git, Docker)
- Création automatique du fichier .env
- Choix entre installation Docker ou locale
- Installation des dépendances
- Build du projet
- Instructions post-installation

**Utilisation** :
```powershell
.\scripts\setup.ps1
```

**Commit** : [dfa5d07](https://github.com/theo7791l/Wolaro2/commit/dfa5d07307a09c4aed8289db31008a354324ec78)

---

## 📝 Résumé des Modifications

### Fichiers Modifiés
1. `Dockerfile` - Dépendances canvas + healthcheck amélioré
2. `docker-compose.yml` - Variables d'environnement + sécurité
3. `README.md` - Correction du nombre de tables
4. `.dockerignore` - Exclusions complètes

### Fichiers Créés
1. `src/utils/validateEnv.ts` - Validation d'environnement
2. `docker-compose.override.yml.example` - Config développement
3. `scripts/setup.ps1` - Script d'installation Windows
4. `BUGFIXES.md` - Ce fichier

### Commits
- Total : 7 commits
- Bugs corrigés : 7
- Nouvelles fonctionnalités : 3

---

## 🔍 Vérification Post-Correction

### Tests à Effectuer

#### 1. Build Docker
```bash
docker-compose build --no-cache
```
**Attendu** : Build réussi sans erreurs de compilation canvas.

#### 2. Démarrage Docker
```bash
docker-compose up -d
docker-compose logs -f bot
```
**Attendu** : 
- PostgreSQL healthy
- Redis healthy
- Bot démarre sans erreur de variables manquantes
- Healthcheck passe au vert après 60 secondes

#### 3. Validation d'environnement
```bash
npm run dev
```
**Attendu** : Message de validation avec résumé de configuration.

#### 4. Installation Windows
```powershell
.\scripts\setup.ps1
```
**Attendu** : Installation interactive réussie.

---

## 🚀 Prochaines Étapes Recommandées

1. **Tester le build Docker complet** sur un environnement propre
2. **Vérifier que le schema.sql s'applique correctement** au premier démarrage
3. **Tester l'intégration de validateEnv.ts** dans src/index.ts
4. **Documenter l'utilisation de docker-compose.override.yml** dans README.md
5. **Créer des scripts Bash** équivalents pour Linux/Mac :
   - `scripts/setup.sh`
   - `scripts/migrate.sh`
   - `scripts/backup.sh`
   - `scripts/update.sh`

---

## 📞 Support

Pour toute question ou problème lié à ces corrections :
- [Issues GitHub](https://github.com/theo7791l/Wolaro2/issues)
- [Pull Requests](https://github.com/theo7791l/Wolaro2/pulls)

---

**Date de l'audit** : 23 février 2026  
**Auteur des corrections** : theo7791l  
**Version** : 1.0.0
