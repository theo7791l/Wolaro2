# 🛡️ Système de Protection Wolaro2

## Vue d'ensemble

Le système de protection est un sous-module intégré dans le module `moderation`. Il offre 8 systèmes de protection avancés pour sécuriser ton serveur Discord.

## ✅ Systèmes actifs

### 1. 🛡️ Anti-Spam
- Détecte les messages répétitifs
- Limite les messages par seconde
- 3 niveaux de sensibilité : Low, Medium, High
- Action : Timeout automatique ou avertissement

### 2. 🚫 Bad Words (Filtre de mots)
- Filtre les mots interdits configurés
- Mode strict avec détection de variantes
- Actions : Suppression + timeout/warn
- Liste personnalisable par serveur

### 3. 🛑 Anti-Raid
- Détecte les raids de masse (joins rapides)
- Captcha automatique pour nouveaux membres
- Lockdown auto si raid détecté
- Seuil configurable

### 4. 🎣 Anti-Phishing
- Détecte les liens de phishing connus
- Vérifie les URLs suspectes
- Base de données de domaines malveillants
- Suppression instantanée

### 5. 💣 Anti-Nuke
- Protège contre suppressions massives
- Bloque suppression channels/roles en masse
- Protection des administrateurs
- Rollback automatique

### 6. 🔞 NSFW Detection
- Détection d'images NSFW
- Seuil de confiance configurable (0.5-1.0)
- **Nécessite une API externe (optionnel)**
- Mode désactivé par défaut si pas d'API

### 7. 🔒 Smart Lockdown
- Lockdown intelligent du serveur
- Fermeture temporaire de tous les salons
- Déclenchement manuel ou auto
- Réouverture automatique après durée

### 8. 🧩 Captcha System
- Captcha visuel pour nouveaux membres
- Génération d'images aléatoires
- Timeout automatique si échec
- Intégration avec anti-raid

## 🛠️ Configuration

### Commande principale

```
/protection-config view
```
Affiche la configuration actuelle de tous les systèmes.

### Configurer chaque système

#### Anti-Spam
```
/protection-config spam enabled:true level:medium
```
- `enabled`: true/false
- `level`: low, medium, high

#### Bad Words
```
/protection-config badwords enabled:true strict:true
```
- `enabled`: true/false
- `strict`: Mode strict pour détecter variantes

#### Anti-Raid
```
/protection-config raid enabled:true captcha:true auto_lockdown:false
```
- `enabled`: true/false
- `captcha`: Activer captcha pour nouveaux membres
- `auto_lockdown`: Lockdown auto si raid détecté

#### Anti-Phishing
```
/protection-config phishing enabled:true check_urls:true
```
- `enabled`: true/false
- `check_urls`: Vérifier toutes les URLs

#### Anti-Nuke
```
/protection-config nuke enabled:true protect_admins:true
```
- `enabled`: true/false
- `protect_admins`: Protéger même les admins

#### NSFW Detection
```
/protection-config nsfw enabled:false threshold:0.8
```
- `enabled`: true/false (⚠️ Nécessite API externe)
- `threshold`: Seuil de détection (0.5-1.0)

#### Smart Lockdown
```
/protection-config lockdown enabled:true auto_trigger:false
```
- `enabled`: true/false
- `auto_trigger`: Déclenchement automatique

## 💾 Base de données

### Tables créées

Le système utilise les tables suivantes :
- `protection_config` - Configuration par serveur
- `protection_badwords` - Liste mots interdits
- `protection_whitelist` - URLs/domaines whitelisés
- `protection_logs` - Logs des actions

### Migration

Si tu upgrads depuis une ancienne version, exécute :
```bash
npm run migrate:protection
```

Ou manuellement avec le fichier SQL :
```bash
psql $DATABASE_URL -f MIGRATION_THEOPROTECT.sql
```

## 🔄 Architecture

```
src/modules/moderation/
├── index.ts                    # Module moderation principal
├── commands/                   # Commandes moderation basiques
└── protection/                 # Sous-module protection
    ├── index.ts                # Point d'entrée protection
    ├── database.ts             # Gestion DB protection
    ├── commands/
    │   └── config.ts           # Commande /protection-config
    ├── events/                 # Handlers d'événements
    │   ├── message-create.ts   # Spam, badwords, phishing, nsfw
    │   ├── member-add.ts       # Anti-raid, captcha
    │   ├── channel-delete.ts   # Anti-nuke
    │   └── role-delete.ts      # Anti-nuke
    └── systems/                # Systèmes de protection
        ├── anti-spam.ts
        ├── bad-words.ts
        ├── anti-raid.ts
        ├── anti-phishing.ts
        ├── anti-nuke.ts
        ├── nsfw-detection.ts
        ├── smart-lockdown.ts
        └── captcha.ts
```

## ⚡ Activation

Le système est **automatiquement activé** au démarrage du bot :

1. Le module `moderation` est chargé
2. Le sous-module `protection` s'initialise
3. Tous les systèmes se connectent à la DB
4. Les événements sont enregistrés
5. La commande `/protection-config` devient disponible

### Vérifier l'activation

Dans les logs au démarrage, tu dois voir :
```
✓ Protection module initialized successfully
  → Anti-Spam: ✅ Active
  → Bad Words: ✅ Active
  → Anti-Raid: ✅ Active
  → Anti-Phishing: ✅ Active
  → Anti-Nuke: ✅ Active
  → NSFW Detection: ⚠️  Disabled (API not configured)
  → Smart Lockdown: ✅ Active
  → Captcha System: ✅ Active
```

## 🐞 Dépannage

### La commande `/protection-config` n'apparaît pas

1. Redéployer les commandes :
   ```bash
   npm run deploy:commands
   ```

2. Vérifier que le module moderation est activé :
   ```sql
   SELECT * FROM guild_config WHERE guild_id = 'TON_SERVER_ID';
   ```

### Erreur "getGuildConfig is not a function"

Ce problème est résolu dans les derniers commits. Redémarre le bot :
```bash
npm run build
npm start
```

### Les systèmes ne se déclenchent pas

1. Vérifie la config :
   ```
   /protection-config view
   ```

2. Active le système concerné :
   ```
   /protection-config spam enabled:true
   ```

3. Vérifie les logs serveur pour erreurs

## 🔐 Permissions requises

### Bot
- `MANAGE_MESSAGES` - Supprimer messages (spam, badwords)
- `MODERATE_MEMBERS` - Timeout membres (spam, raid)
- `BAN_MEMBERS` - Ban en cas de raid sévère
- `MANAGE_CHANNELS` - Lockdown
- `MANAGE_ROLES` - Anti-nuke

### Utilisateur (pour `/protection-config`)
- `ADMINISTRATOR` - Seuls les admins peuvent configurer

## 📊 Logs

Toutes les actions sont logées dans :
- Table `protection_logs` en DB
- Logs console du bot
- (Optionnel) Salon de logs si configuré

## ℹ️ Notes importantes

1. **NSFW Detection** nécessite une API externe (non incluse par défaut)
2. Le **Captcha** génère des images à la volée (canvas/sharp)
3. L'**Anti-Nuke** peut parfois bloquer des admins légitimes (ajuster config)
4. Les systèmes utilisent Redis pour cache (optionnel mais recommandé)

## 🚀 Prochaines améliorations

- [ ] Dashboard web pour config
- [ ] Stats temps réel des détections
- [ ] Whitelist utilisateurs/rôles
- [ ] Logs dans salon Discord dédié
- [ ] Export logs en CSV
- [ ] Intégration ML pour détection avancée

---

**Derniers commits :**
- ✅ Fix DatabaseManager injection
- ✅ Conversion commandes en classes
- ✅ Conversion événements en classes
- ✅ Intégration dans module moderation
- ✅ Documentation complète
