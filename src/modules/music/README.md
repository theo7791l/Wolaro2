# 🎵 Module Musique Wolaro2

## Fonctionnalités

- 🔎 **Recherche YouTube** via NewPipe (yt-dlp)
- 🎯 **Sélection interactive** : Choisissez parmi 10 résultats
- 🎶 **Lecture audio** en haute qualité
- 📋 **Système de queue** fonctionnel
- ⏸️ **Contrôles** : play, skip, stop, queue, nowplaying

## Installation

### 1. Installer yt-dlp (NewPipe backend)

**Ubuntu/Debian** :
```bash
sudo apt update
sudo apt install -y yt-dlp

# Ou via pip pour la dernière version
pip install -U yt-dlp
```

**macOS** :
```bash
brew install yt-dlp
```

**Windows** :
```bash
pip install -U yt-dlp
```

### 2. Installer ffmpeg (requis pour l'audio)

**Ubuntu/Debian** :
```bash
sudo apt install -y ffmpeg
```

**macOS** :
```bash
brew install ffmpeg
```

**Windows** :
Télécharger depuis [ffmpeg.org](https://ffmpeg.org/download.html)

### 3. Installer les dépendances Node.js

```bash
npm install @discordjs/voice libsodium-wrappers
```

**Pour Ubuntu, installer aussi** :
```bash
sudo apt install -y libsodium-dev
```

### 4. Vérifier l'installation

```bash
yt-dlp --version
ffmpeg -version
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
│   ├── newpipe.ts      # Extracteur YouTube (yt-dlp)
│   └── player.ts       # Player audio + queue manager
│
├── index.ts            # Export du module
└── README.md           # Ce fichier
```

### Fonctionnement

#### NewPipe Extractor (`utils/newpipe.ts`)

- **`search(query, limit)`** : Recherche sur YouTube via yt-dlp
  - Retourne : ID, titre, chaîne, durée, URL, thumbnail
  
- **`getAudioUrl(videoUrl)`** : Extrait l'URL audio directe
  - Utilise `yt-dlp -f bestaudio` pour la meilleure qualité
  - Retourne une URL streamable

#### Music Player (`utils/player.ts`)

- **Gestionnaire par guild** : Un player par serveur Discord
- **Queue management** : File d'attente avec ordre FIFO
- **AudioPlayer** : Utilise `@discordjs/voice` pour streamer
- **Auto-play** : Joue automatiquement la prochaine piste

## Dépannage

### Erreur : "yt-dlp n'est pas installé"

```bash
pip install -U yt-dlp
# Vérifier
yt-dlp --version
```

### Erreur : "Impossible de rejoindre le salon vocal"

Vérifiez que le bot a les permissions :
- **Connect** (Se connecter)
- **Speak** (Parler)
- **Use Voice Activity** (Utiliser la détection de la voix)

### Erreur : "Failed to play track"

1. Vérifiez que **ffmpeg** est installé :
```bash
ffmpeg -version
```

2. Vérifiez que **libsodium** est installé :
```bash
npm list libsodium-wrappers
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

- **NewPipe** : Backend d'extraction YouTube
- **yt-dlp** : Outil de téléchargement vidéo
- **Discord.js** : Library Discord
- **@discordjs/voice** : Module audio Discord
