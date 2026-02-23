import { logger } from '../../../utils/logger';

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export class GeminiClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: options.systemPrompt
                      ? `${options.systemPrompt}\n\n${prompt}`
                      : prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: options.maxTokens || 2000,
              temperature: options.temperature || 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Gemini API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        // Messages d'erreur plus clairs
        if (response.status === 400) {
          throw new Error('Clé API Gemini invalide ou requête mal formée. Vérifiez votre GEMINI_API_KEY dans .env');
        } else if (response.status === 403) {
          throw new Error('Accès refusé à l\'API Gemini. Vérifiez que votre clé API a les bonnes permissions.');
        } else if (response.status === 429) {
          throw new Error('Limite de requêtes atteinte. Attendez quelques minutes.');
        } else {
          throw new Error(`Erreur API Gemini: ${response.statusText}`);
        }
      }

      const data = await response.json() as any;
      
      // Vérifier que la réponse contient bien le texte
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        logger.error('Gemini response structure invalid:', data);
        throw new Error('Réponse API Gemini invalide (pas de contenu)');
      }
      
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      logger.error('Gemini API error:', error);
      // Propager l'erreur avec le message détaillé
      throw error;
    }
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      // Download image
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro-vision:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Gemini Vision API error:', errorData);
        throw new Error(`Erreur API Gemini Vision: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      logger.error('Gemini Vision API error:', error);
      throw new Error('Impossible d\'analyser l\'image');
    }
  }

  async analyzeToxicity(text: string): Promise<number> {
    try {
      const prompt = `Analyze the following message for toxicity, harassment, hate speech, or inappropriate content. Respond ONLY with a number between 0.0 and 1.0, where 0.0 is completely safe and 1.0 is extremely toxic.\n\nMessage: "${text}"\n\nToxicity score:`;

      const response = await this.generateText(prompt, {
        maxTokens: 10,
        temperature: 0.1,
      });

      const score = parseFloat(response.trim());
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.error('Toxicity analysis error:', error);
      return 0; // Default to safe if error
    }
  }
}
