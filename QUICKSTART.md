# 🚀 Quickstart - Wolaro2

Démarrage rapide en **5 minutes** pour tester Wolaro2 en local.

---

## 📌 Prérequis

- **Node.js 18+** et **npm**
- **PostgreSQL 14+**
- **Discord Bot Token** ([créer un bot](https://discord.com/developers/applications))

---

## ⚡ Installation rapide

### 1️⃣ Cloner et installer

```bash
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2
npm install
```

### 2️⃣ Configuration minimale

Créez `.env` :

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wolaro
DB_USER=postgres
DB_PASSWORD=your_password

# Optionnel - Module AI avec Groq
GROQ_API_KEY=your_groq_api_key  # Gratuit: https://console.groq.com/keys
```

### 3️⃣ Base de données

```bash
# Créer la base
psql -U postgres -c "CREATE DATABASE wolaro;"

# Importer le schéma
psql -U postgres -d wolaro -f database/schema.sql
```

### 4️⃣ Lancer le bot

```bash
npm run build
npm start
```

✅ **Le bot est en ligne !**

---

## 🎯 Configuration Discord

1. **Inviter le bot** :
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_BOT_ID&scope=bot%20applications.commands&permissions=8
   ```

2. **Activer des modules** :
   ```
   /module enable module:moderation
   /module enable module:ai
   ```

3. **Tester** :
   ```
   /ping
   /ask question:Bonjour !
   /help
   ```

---

## 📦 Modules disponibles

| Module | Description | Commandes principales |
|--------|-------------|----------------------|
| **core** | Système de base | `/help`, `/ping`, `/module` |
| **moderation** | Modération avancée | `/ban`, `/kick`, `/warn` |
| **ai** | IA Groq (Llama 3.3) | `/ask`, `/chat`, `/automod` |
| **welcome** | Messages de bienvenue | `/setwelcome` |
| **logs** | Logs d'événements | `/logs` |

---

## 🔧 Troubleshooting

### Le bot ne démarre pas
```bash
# Vérifier les variables d'environnement
node -e "require('dotenv').config(); console.log(process.env.DISCORD_BOT_TOKEN)"

# Vérifier la connexion PostgreSQL
psql -U postgres -d wolaro -c "SELECT 1;"
```

### Erreur "Module non activé"
```
/module enable module:ai
```

### Erreur "GROQ_API_KEY not set"
Ajoutez `GROQ_API_KEY` dans `.env` (optionnel pour le module AI uniquement).

---

## 📚 Documentation complète

- **Installation détaillée** : [INSTALLATION.md](INSTALLATION.md)
- **Guide Windows** : [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)
- **Architecture** : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 🎉 Prochaines étapes

1. **Configurer l'automod IA** : `/automod activer:true seuil:0.8`
2. **Personnaliser le bot** : Modifier `src/config.ts`
3. **Ajouter des modules** : Créer dans `src/modules/`

👉 **Besoin d'aide ?** Ouvre une issue sur [GitHub](https://github.com/theo7791l/Wolaro2/issues)
