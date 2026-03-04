import { logger } from '../../../utils/logger';

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  useCase?: 'chat' | 'moderation' | 'support' | 'dev';
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

  // ⚡ ARCHITECTURE HYBRIDE MULTI-MODÈLES
  // Chat: llama-3.3-70b-versatile (30 RPM, 1000 RPD) -> fallback llama-3.1-8b-instant
  // Moderation: llama-3.1-8b-instant — remplacement de llama-guard-3-8b (déprécié)
  // Support: qwen/qwen3-32b — reasoning model, <think> strippé automatiquement
  // Dev: openai/gpt-oss-120b — code & raisonnement avancé
  private chatPrimaryModel = 'llama-3.3-70b-versatile';
  private chatFallbackModel = 'llama-3.1-8b-instant';
  private moderationModel = 'llama-3.1-8b-instant';
  private supportModel = 'qwen/qwen3-32b';
  private devModel = 'openai/gpt-oss-120b';

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      throw new Error('GROQ_API_KEY is not configured. Please set a valid API key in your .env file.');
    }
    this.apiKey = apiKey;
    logger.info(`🚀 Groq client initialized with hybrid architecture:`);
    logger.info(`   - Chat: ${this.chatPrimaryModel} (fallback: ${this.chatFallbackModel})`);
    logger.info(`   - Moderation: ${this.moderationModel}`);
    logger.info(`   - Support: ${this.supportModel}`);
    logger.info(`   - Dev: ${this.devModel}`);
  }

  private selectModel(useCase?: string): string {
    switch (useCase) {
      case 'moderation': return this.moderationModel;
      case 'support':    return this.supportModel;
      case 'dev':        return this.devModel;
      case 'chat':
      default:           return this.chatPrimaryModel;
    }
  }

  /**
   * Supprime les blocs <think>...</think> générés par les reasoning models (Qwen3, DeepSeek, etc.)
   * Ces blocs contiennent le raisonnement interne du modèle — jamais à afficher aux utilisateurs.
   */
  private stripThinking(text: string): string {
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '') // supprime les blocs <think>
      .replace(/^\s*\n+/, '')                      // supprime les lignes vides en début
      .trim();
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const selectedModel = this.selectModel(options.useCase);

    try {
      return await this.executeRequest(selectedModel, prompt, options);
    } catch (error: any) {
      // Fallback uniquement pour le chat si erreur 429 (rate limit)
      if (options.useCase === 'chat' && error.message && error.message.includes('429')) {
        logger.warn(`⚠️ Rate limit atteint sur ${this.chatPrimaryModel}, fallback vers ${this.chatFallbackModel}`);
        try {
          return await this.executeRequest(this.chatFallbackModel, prompt, options);
        } catch (fallbackError: any) {
          logger.error('Fallback model also failed:', fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  private async executeRequest(model: string, prompt: string, options: GenerateOptions): Promise<string> {
    try {
      const url = `${this.baseUrl}/chat/completions`;

      logger.debug('Groq API request:', {
        model,
        useCase: options.useCase || 'default',
        promptLength: prompt.length,
      });

      const messages: any[] = [];

      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      messages.push({ role: 'user', content: prompt });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
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
          model,
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
          errorMessage = `⏳ Limite de requêtes atteinte (429) - Modèle: ${model}\n${details}\nℹ️ Attendez 60 secondes ou vérifiez votre quota`;
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
        model,
        hasChoices: !!data.choices,
        choicesCount: data.choices?.length || 0,
      });

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        logger.error('Groq response structure invalid:', JSON.stringify(data));
        throw new Error('❌ Réponse API Groq invalide (pas de contenu)\nℹ️ La réponse ne contient pas de texte généré');
      }

      // Supprimer les blocs <think> (reasoning models comme Qwen3, DeepSeek)
      return this.stripThinking(data.choices[0].message.content);

    } catch (error: any) {
      if (error.message && error.message.includes('❌')) throw error;
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
          useCase: 'moderation',
        }
      );

      const score = parseFloat(response.trim());
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.error('Toxicity analysis error:', error);
      return 0;
    }
  }
}
