import { logger } from '../../../utils/logger';

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

interface GroqErrorResponse {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

export class GroqClient {
  private apiKey: string;
  private baseUrl = 'https://api.groq.com/openai/v1';
  // ⚡ GROQ: 30 RPM + 14400 RPD GRATUIT (vs Gemini 15 RPM + 1000 RPD)
  // Llama 3.3 70B = qualité équivalente GPT-4 pour modération
  private model = 'llama-3.3-70b-versatile'; // Alternative: llama-3.1-8b-instant (+ rapide)

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      throw new Error('GROQ_API_KEY is not configured. Please set a valid API key in your .env file.');
    }
    this.apiKey = apiKey;
    logger.info(`🚀 Groq client initialized with model: ${this.model} (30 RPM, 14400 RPD free), API key: ${apiKey.substring(0, 8)}...`);
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    try {
      const url = `${this.baseUrl}/chat/completions`;
      
      logger.debug('Groq API request:', {
        model: this.model,
        url: url.replace(this.apiKey, 'REDACTED'),
        promptLength: prompt.length,
      });

      const messages: any[] = [];
      
      if (options.systemPrompt) {
        messages.push({
          role: 'system',
          content: options.systemPrompt,
        });
      }
      
      messages.push({
        role: 'user',
        content: prompt,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: options.maxTokens || 8192,
          temperature: options.temperature !== undefined ? options.temperature : 1.0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as GroqErrorResponse;
        
        logger.error('Groq API error details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          model: this.model,
          apiKeyPrefix: this.apiKey.substring(0, 12),
        });
        
        let errorMessage = '';
        
        if (response.status === 400) {
          const details = errorData?.error?.message || JSON.stringify(errorData);
          errorMessage = `❌ Requête invalide (400): ${details}\nℹ️ Vérifiez votre GROQ_API_KEY dans .env`;
        } else if (response.status === 401) {
          errorMessage = `❌ API Key invalide (401)\nℹ️ Créez une nouvelle clé sur https://console.groq.com/keys`;
        } else if (response.status === 429) {
          const details = errorData?.error?.message || 'Trop de requêtes';
          errorMessage = `⏳ Limite de requêtes atteinte (429) - Groq: 30/min, 14400/jour\n${details}\nℹ️ Attendez 60 secondes ou vérifiez votre quota`;
        } else if (response.status === 500 || response.status === 503) {
          errorMessage = `⚠️ Erreur serveur Groq (${response.status})\nℹ️ Réessayez dans quelques instants`;
        } else {
          const details = errorData?.error?.message || response.statusText;
          errorMessage = `❌ Erreur API Groq (${response.status}): ${details}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json() as any;
      
      logger.debug('Groq API response:', {
        hasChoices: !!data.choices,
        choicesCount: data.choices?.length || 0,
      });
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        logger.error('Groq response structure invalid:', JSON.stringify(data));
        throw new Error('❌ Réponse API Groq invalide (pas de contenu)\nℹ️ La réponse ne contient pas de texte généré');
      }
      
      return data.choices[0].message.content;
    } catch (error: any) {
      if (error.message && error.message.includes('❌')) {
        logger.error('Groq API error:', error.message);
        throw error;
      }
      
      logger.error('Groq API unexpected error:', error);
      throw new Error(`❌ Erreur inattendue: ${error.message || "Impossible de contacter l'API Groq"}`);
    }
  }

  async analyzeToxicity(text: string): Promise<number> {
    try {
      const response = await this.generateText(
        `Analyze the following message for toxicity, harassment, hate speech, or inappropriate content. Respond ONLY with a number between 0.0 and 1.0, where 0.0 is completely safe and 1.0 is extremely toxic.\n\nMessage: "${text}"\n\nToxicity score:`,
        {
          maxTokens: 10,
          temperature: 0.1,
          systemPrompt: 'You are a toxicity analyzer. Respond ONLY with a decimal number between 0.0 and 1.0.',
        }
      );

      const score = parseFloat(response.trim());
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.error('Toxicity analysis error:', error);
      return 0; // Default to safe if error
    }
  }
}
