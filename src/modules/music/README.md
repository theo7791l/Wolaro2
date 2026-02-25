# 🎵 Module Musique Wolaro2

## Fonctionnalités

- 🔎 **Recherche YouTube** via play-dl (pas de sudo requis !)
- 🎯 **Sélection interactive** : Choisissez parmi 10 résultats
- 🎶 **Lecture audio** en haute qualité
- 📋 **Système de queue** fonctionnel
- ⏸️ **Contrôles** : play, skip, stop, queue, nowplaying

## Installation

### 1. Installer les dépendances Node.js

```bash
cd ~/mmmm/Wolaro2
npm install
```

**C'est tout !** ✅ Pas besoin de sudo ou de packages système

### 2. Vérifier l'installation

```bash
npm run build
npm start
```

## Utilisation

### Commandes disponibles

#### `/play <titre>`
Recherche et joue une musique depuis YouTube.

**Exemple** :
```
/play never gonna give you up
```

**Processus** :
1. Le bot recherche sur YouTube et affiche 10 résultats
2. Vous tapez un numéro entre **1** et **10** pour choisir
3. Le bot rejoint votre salon vocal et joue la musique

#### `/skip`
Passe à la musique suivante dans la queue.

#### `/stop`
Arrête la musique et quitte le salon vocal.

#### `/queue`
Affiche la file d'attente des musiques.

#### `/nowplaying` ou `/np`
Affiche la musique en cours de lecture.

#### `/volume <1-100>`
Change le volume de lecture.

## Compatibilité hébergement

✅ **Compatible avec** :
- Hébergement gratuit (Skybots, Replit, etc.)
- VPS sans accès root
- Docker
- Serveurs dédiés

❌ **Pas besoin de** :
- `sudo` ou accès root
- `yt-dlp` ou autres outils externes
- `ffmpeg` installé sur le système

Tout fonctionne avec les packages Node.js **déjà installés** !

## Architecture technique

### Fichiers

```
src/modules/music/
├── commands/
│   ├── play.ts         # Commande de lecture avec sélection
│   ├── skip.ts         # Passer à la suivante
│   ├── stop.ts         # Arrêter et déconnecter
│   ├── queue.ts        # Afficher la queue
│   ├── nowplaying.ts   # Musique actuelle
│   └── volume.ts       # Contrôle du volume
│
├── utils/
│   ├── newpipe.ts      # Extracteur YouTube (play-dl)
│   └── player.ts       # Player audio + queue manager
│
├── index.ts            # Export du module
└── README.md           # Ce fichier
```

### Fonctionnement

#### YouTube Extractor (`utils/newpipe.ts`)

- **`search(query, limit)`** : Recherche sur YouTube via play-dl
  - Retourne : ID, titre, chaîne, durée, URL, thumbnail
  
- **`getAudioUrl(videoUrl)`** : Extrait l'URL audio directe
  - Utilise `play.stream()` pour obtenir l'audio haute qualité
  - Retourne une URL streamable

#### Music Player (`utils/player.ts`)

- **Gestionnaire par guild** : Un player par serveur Discord
- **Queue management** : File d'attente avec ordre FIFO
- **AudioPlayer** : Utilise `@discordjs/voice` pour streamer
- **Auto-play** : Joue automatiquement la prochaine piste

## Dépendances utilisées

```json
{
  "discord.js": "^14.14.1",
  "@discordjs/voice": "^0.16.1",
  "@discordjs/opus": "^0.9.0",
  "libsodium-wrappers": "^0.7.13",
  "play-dl": "^1.9.7",
  "ffmpeg-static": "^5.2.0"
}
```

## Dépannage

### Erreur : "play-dl not available"

```bash
npm install play-dl
npm run build
```

### Erreur : "Impossible de rejoindre le salon vocal"

Vérifiez que le bot a les permissions :
- **Connect** (Se connecter)
- **Speak** (Parler)
- **Use Voice Activity** (Utiliser la détection de la voix)

### Erreur : "Failed to play track"

1. Vérifiez que **libsodium-wrappers** est installé :
```bash
npm list libsodium-wrappers
```

2. Vérifiez que **@discordjs/voice** est installé :
```bash
npm list @discordjs/voice
```

3. Regardez les logs du bot pour plus de détails

### Erreur : "Rate limit exceeded"

YouTube limite le nombre de requêtes. Attendez quelques minutes.

## Améliorations futures

- [ ] Support Spotify (conversion vers YouTube)
- [ ] Support SoundCloud
- [ ] Contrôle du volume dynamique
- [ ] Boutons de contrôle (pause/resume)
- [ ] Playlists
- [ ] Boucle de lecture
- [ ] Shuffle
- [ ] Historique de lecture
- [ ] Favoris par utilisateur

## Crédits

- **play-dl** : Library d'extraction YouTube/Spotify
- **Discord.js** : Library Discord
- **@discordjs/voice** : Module audio Discord
