# Module Musique - Wolaro2

## 🎵 Installation

Après avoir mis à jour le code, installe les nouvelles dépendances :

```bash
npm install
```

Cela va installer :
- `play-dl` : Pour la recherche et le streaming YouTube/Spotify
- `ffmpeg-static` : Pour l'encodage audio
- `@discordjs/voice` : Pour la connexion vocale Discord (déjà présent)
- `@discordjs/opus` : Pour l'encodage Opus (déjà présent)

## 🔧 Configuration requise

### Intents Discord

Assure-toi que ton bot a les intents nécessaires dans `src/index.ts` :

```typescript
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // ← Nécessaire pour la musique
    GatewayIntentBits.GuildMessages,
    // ... autres intents
  ],
});
```

### Permissions du bot

Le bot doit avoir ces permissions Discord :
- `Connect` (Se connecter aux salons vocaux)
- `Speak` (Parler dans les salons vocaux)
- `Use Voice Activity` (Utiliser la détection de voix)

## 🎮 Commandes disponibles

### `/play <recherche>`
Joue une musique depuis YouTube ou Spotify
- **Exemples** :
  - `/play https://www.youtube.com/watch?v=dQw4w9WgXcQ`
  - `/play never gonna give you up`
  - `/play https://open.spotify.com/track/...`

### `/skip`
Passe à la musique suivante dans la queue

### `/stop`
Arrête la musique et vide complètement la queue

### `/queue`
Affiche la liste des musiques en attente

### `/nowplaying`
Affiche la musique en cours de lecture

### `/volume <niveau>`
Ajuste le volume (1-100)

## 🔍 Dépannage

### "Aucune musique ne joue"

1. **Vérifie les logs** : Regarde dans la console si des erreurs apparaissent
2. **Vérifie ffmpeg** : `play-dl` a besoin de ffmpeg. Vérifie avec `ffmpeg -version`
3. **Permissions Discord** : Le bot doit avoir les permissions vocales
4. **Intents** : Vérifie que `GuildVoiceStates` est activé

### "Cannot find module 'play-dl'"

Lance `npm install` pour installer les dépendances

### "Error: FFMPEG not found"

Installe ffmpeg sur ton système :

**Windows** :
```bash
choco install ffmpeg
```

**macOS** :
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian)** :
```bash
sudo apt update
sudo apt install ffmpeg
```

Ou laisse `ffmpeg-static` gérer ça automatiquement (déjà dans les dépendances).

### "Bot se déconnecte après quelques secondes"

C'est normal si aucune musique n'est dans la queue - le bot quitte automatiquement après 5 minutes d'inactivité.

## ⚙️ Configuration avancée

### Cookies YouTube (optionnel)

Si tu veux accéder à des vidéos avec restriction d'âge :

```typescript
import { setToken } from 'play-dl';

// Dans ton fichier d'initialisation
await setToken({
  youtube: {
    cookie: 'tes_cookies_youtube_ici'
  }
});
```

### Spotify (optionnel)

Pour une meilleure intégration Spotify, configure les credentials :

```typescript
import { setToken } from 'play-dl';

await setToken({
  spotify: {
    client_id: 'ton_client_id',
    client_secret: 'ton_client_secret',
    refresh_token: 'ton_refresh_token',
    market: 'FR'
  }
});
```

## 📝 Notes techniques

- **Streaming** : La musique est streamée en temps réel, pas téléchargée complètement
- **Qualité** : Audio en Opus 48kHz stéréo
- **Queue** : Chaque serveur a sa propre queue indépendante
- **Auto-disconnect** : Le bot quitte après 5 minutes sans musique
- **Mémoire** : Utilise `play-dl` qui est optimisé pour la performance

## 🚀 Prochaines améliorations possibles

- [ ] Commande `/pause` et `/resume`
- [ ] Commande `/loop` pour répéter
- [ ] Commande `/shuffle` pour mélanger la queue
- [ ] Commande `/remove <position>` pour retirer une musique
- [ ] Filtres audio (bassboost, nightcore, etc.)
- [ ] Playlists sauvegardées en base de données
- [ ] Système de vote pour skip
- [ ] Affichage avec boutons interactifs
