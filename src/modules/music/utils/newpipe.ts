import play from 'play-dl';
import { logger } from '../../../utils/logger';

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
   * Recherche des vidéos sur YouTube via play-dl
   */
  async search(query: string, limit: number = 10): Promise<NewPipeSearchResult[]> {
    try {
      logger.debug(`Searching YouTube for: ${query}`);

      // Utiliser play-dl pour rechercher
      const searched = await play.search(query, { limit });

      const results: NewPipeSearchResult[] = searched.map((video) => ({
        id: video.id || '',
        title: video.title || 'Sans titre',
        uploader: video.channel?.name || 'Inconnu',
        duration: this.formatDuration(video.durationInSec || 0),
        url: video.url,
        thumbnail: video.thumbnails?.[0]?.url || '',
      }));

      logger.info(`Found ${results.length} results for: ${query}`);
      return results;
    } catch (error: any) {
      logger.error('Play-dl search error:', error);
      throw new Error(`Impossible de rechercher: ${error.message}`);
    }
  }

  /**
   * Extrait l'URL audio streamable d'une vidéo YouTube
   */
  async getAudioUrl(videoUrl: string): Promise<NewPipeAudioInfo> {
    try {
      logger.debug(`Extracting audio URL for: ${videoUrl}`);

      // Vérifier le type d'URL
      const urlType = play.yt_validate(videoUrl);
      
      if (urlType !== 'video') {
        throw new Error('URL invalide, seules les vidéos YouTube sont supportées');
      }

      // Obtenir les infos de la vidéo
      const info = await play.video_info(videoUrl);
      
      // Obtenir le stream audio
      const stream = await play.stream(videoUrl, {
        quality: 2, // Audio haute qualité
      });

      return {
        url: stream.stream.url,
        title: info.video_details.title || 'Sans titre',
        duration: this.formatDuration(info.video_details.durationInSec || 0),
        uploader: info.video_details.channel?.name || 'Inconnu',
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
   * Vérifie si play-dl est installé
   */
  async checkInstallation(): Promise<boolean> {
    try {
      // Vérifier si on peut accéder à play-dl
      const test = await play.search('test', { limit: 1 });
      return test.length >= 0; // Retourne true même si 0 résultats
    } catch (error) {
      logger.error('play-dl not available:', error);
      return false;
    }
  }
}

// Instance singleton
export const newpipe = new NewPipeExtractor();
