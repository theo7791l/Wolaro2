import { logger } from '../../../utils/logger';

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

interface GeminiErrorResponse {
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
}

export class GeminiClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  // ⚡ OPTIMISATION: Flash-Lite = 15 RPM + 1000 RPD gratuit (vs Flash = 10 RPM + 250 RPD)
  // Parfait pour chatbot Discord avec beaucoup d'utilisateurs
  private model = 'gemini-2.5-flash-lite'; // 15 req/min, 1000 req/jour GRATUIT !

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured. Please set a valid API key in your .env file.');
    }
    this.apiKey = apiKey;
    logger.info(`🚀 Gemini client initialized with model: ${this.model} (15 RPM, 1000 RPD free), API key: ${apiKey.substring(0, 8)}...`);
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
            maxOutputTokens: options.maxTokens || 8192, // Flash-Lite supporte jusqu'à 65K tokens output
            temperature: options.temperature !== undefined ? options.temperature : 1.0,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as GeminiErrorResponse;
        
        // Log détaillé pour déboguer
        logger.error('Gemini API error details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          model: this.model,
          apiKeyPrefix: this.apiKey.substring(0, 12),
          url: url.replace(this.apiKey, 'REDACTED'),
        });
        
        // Messages d'erreur plus clairs avec détails
        let errorMessage = '';
        
        if (response.status === 400) {
          const details = errorData?.error?.message || JSON.stringify(errorData);
          errorMessage = `❌ Requête invalide (400): ${details}\nℹ️ Vérifiez votre GEMINI_API_KEY dans .env`;
        } else if (response.status === 403) {
          const details = errorData?.error?.message || 'Accès refusé';
          errorMessage = `❌ Accès refusé (403): ${details}\nℹ️ Vérifiez que votre clé API Gemini a les bonnes permissions`;
        } else if (response.status === 404) {
          const details = errorData?.error?.message || 'Modèle non trouvé';
          errorMessage = `❌ Modèle "${this.model}" non trouvé (404): ${details}\nℹ️ Votre clé API est invalide ou expirée. Créez-en une nouvelle sur https://aistudio.google.com/apikey`;
        } else if (response.status === 429) {
          const details = errorData?.error?.message || 'Trop de requêtes';
          errorMessage = `⏳ Limite de requêtes atteinte (429) - Flash-Lite: 15/min, 1000/jour\n${details}\nℹ️ Attendez 60 secondes ou vérifiez votre quota sur https://aistudio.google.com/apikey`;
        } else if (response.status === 500 || response.status === 503) {
          errorMessage = `⚠️ Erreur serveur Gemini (${response.status})\nℹ️ Réessayez dans quelques instants`;
        } else {
          const details = errorData?.error?.message || response.statusText;
          errorMessage = `❌ Erreur API Gemini (${response.status}): ${details}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json() as any;
      
      logger.debug('Gemini API response:', {
        hasCandidates: !!data.candidates,
        candidatesCount: data.candidates?.length || 0,
      });
      
      // Vérifier que la réponse contient bien le texte
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        logger.error('Gemini response structure invalid:', JSON.stringify(data));
        throw new Error('❌ Réponse API Gemini invalide (pas de contenu)\nℹ️ La réponse ne contient pas de texte généré');
      }
      
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      // Si c'est déjà une erreur formatée, on la propage directement
      if (error.message && error.message.includes('❌')) {
        logger.error('Gemini API error:', error.message);
        throw error;
      }
      
      // Sinon, erreur réseau ou autre
      logger.error('Gemini API unexpected error:', error);
      throw new Error(`❌ Erreur inattendue: ${error.message || 'Impossible de contacter l\'API Gemini'}`);
    }
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      // Download image
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Impossible de télécharger l'image: ${imageResponse.statusText}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      // Utiliser le même modèle pour la vision (Flash-Lite supporte les images)
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
        const errorData = await response.json().catch(() => ({})) as GeminiErrorResponse;
        logger.error('Gemini Vision API error:', {
          status: response.status,
          error: errorData,
        });
        
        const details = errorData?.error?.message || response.statusText;
        throw new Error(`Erreur API Gemini Vision (${response.status}): ${details}`);
      }

      const data = await response.json() as any;
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Réponse API Gemini Vision invalide');
      }
      
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      logger.error('Gemini Vision API error:', error);
      throw new Error(`❌ Impossible d'analyser l'image: ${error.message}`);
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
