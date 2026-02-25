import { logger } from '../../../utils/logger';

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export class GeminiClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model = 'gemini-2.0-flash-exp'; // Modèle mis à jour (gemini-pro est déprécié)

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured. Please set a valid API key in your .env file.');
    }
    this.apiKey = apiKey;
    logger.info(`Gemini client initialized with model: ${this.model}, API key: ${apiKey.substring(0, 8)}...`);
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      logger.debug('Gemini API request:', {
        model: this.model,
        url: url.replace(this.apiKey, 'REDACTED'),
        promptLength: prompt.length,
      });

      const response = await fetch(url, {
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
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Gemini API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          model: this.model,
          url: url.replace(this.apiKey, 'REDACTED'),
        });
        
        // Messages d'erreur plus clairs
        if (response.status === 400) {
          throw new Error('❌ Clé API Gemini invalide ou requête mal formée. Vérifiez votre GEMINI_API_KEY dans .env');
        } else if (response.status === 403) {
          throw new Error('❌ Accès refusé à l\'API Gemini. Vérifiez que votre clé API a les bonnes permissions.');
        } else if (response.status === 404) {
          throw new Error(`❌ Modèle ${this.model} non trouvé. Votre clé API Gemini est peut-être invalide ou le modèle n\'est pas disponible.`);
        } else if (response.status === 429) {
          throw new Error('⏳ Limite de requêtes atteinte. Attendez quelques minutes.');
        } else {
          throw new Error(`❌ Erreur API Gemini: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json() as any;
      
      logger.debug('Gemini API response:', {
        hasCandidates: !!data.candidates,
        candidatesCount: data.candidates?.length || 0,
      });
      
      // Vérifier que la réponse contient bien le texte
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        logger.error('Gemini response structure invalid:', JSON.stringify(data));
        throw new Error('❌ Réponse API Gemini invalide (pas de contenu)');
      }
      
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      logger.error('Gemini API error:', error.message || error);
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

      // Utiliser le même modèle pour la vision (gemini-2.0-flash supporte les images)
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
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
      });

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
