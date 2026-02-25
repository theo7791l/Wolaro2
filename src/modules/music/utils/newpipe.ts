import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../../utils/logger';

const execAsync = promisify(exec);

export interface NewPipeSearchResult {
  id: string;
  title: string;
  uploader: string;
  duration: string;
  url: string;
  thumbnail: string;
}

export interface NewPipeAudioInfo {
  url: string;
  title: string;
  duration: string;
  uploader: string;
}

export class NewPipeExtractor {
  /**
   * Recherche des vidéos sur YouTube via yt-dlp (NewPipe backend)
   */
  async search(query: string, limit: number = 10): Promise<NewPipeSearchResult[]> {
    try {
      logger.debug(`Searching YouTube for: ${query}`);

      // Utiliser yt-dlp pour rechercher (NewPipe utilise le même backend)
      const command = `yt-dlp "ytsearch${limit}:${query}" --dump-json --no-warnings --default-search "ytsearch" --skip-download`;

      const { stdout } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 30000, // 30s timeout
      });

      // Chaque ligne est un JSON
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      const results: NewPipeSearchResult[] = [];

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          results.push({
            id: data.id || '',
            title: data.title || 'Sans titre',
            uploader: data.uploader || data.channel || 'Inconnu',
            duration: this.formatDuration(data.duration || 0),
            url: data.webpage_url || `https://www.youtube.com/watch?v=${data.id}`,
            thumbnail: data.thumbnail || '',
          });
        } catch (parseError) {
          logger.warn('Failed to parse search result:', parseError);
        }
      }

      logger.info(`Found ${results.length} results for: ${query}`);
      return results;
    } catch (error: any) {
      logger.error('NewPipe search error:', error);
      throw new Error(`Impossible de rechercher: ${error.message}`);
    }
  }

  /**
   * Extrait l'URL audio streamable d'une vidéo YouTube
   */
  async getAudioUrl(videoUrl: string): Promise<NewPipeAudioInfo> {
    try {
      logger.debug(`Extracting audio URL for: ${videoUrl}`);

      // Extraire uniquement l'audio avec la meilleure qualité
      const command = `yt-dlp "${videoUrl}" -f "bestaudio" --get-url --get-title --get-duration --dump-json`;

      const { stdout } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 5,
        timeout: 20000,
      });

      const lines = stdout.trim().split('\n');
      
      // La dernière ligne est généralement le JSON avec toutes les infos
      let jsonData: any = {};
      for (const line of lines) {
        try {
          jsonData = JSON.parse(line);
          break;
        } catch {
          // Pas un JSON, continuer
        }
      }

      // Si on a le JSON, on peut extraire les infos
      if (jsonData.url) {
        return {
          url: jsonData.url,
          title: jsonData.title || 'Sans titre',
          duration: this.formatDuration(jsonData.duration || 0),
          uploader: jsonData.uploader || jsonData.channel || 'Inconnu',
        };
      }

      // Sinon, fallback sur les lignes simples
      const audioUrl = lines.find(line => line.startsWith('http')) || '';
      
      if (!audioUrl) {
        throw new Error('Aucune URL audio trouvée');
      }

      return {
        url: audioUrl,
        title: 'Sans titre',
        duration: '00:00',
        uploader: 'Inconnu',
      };
    } catch (error: any) {
      logger.error('Failed to extract audio URL:', error);
      throw new Error(`Impossible d'extraire l'audio: ${error.message}`);
    }
  }

  /**
   * Formate une durée en secondes vers MM:SS ou HH:MM:SS
   */
  private formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Vérifie si yt-dlp est installé
   */
  async checkInstallation(): Promise<boolean> {
    try {
      await execAsync('yt-dlp --version');
      return true;
    } catch {
      return false;
    }
  }
}

// Instance singleton
export const newpipe = new NewPipeExtractor();
