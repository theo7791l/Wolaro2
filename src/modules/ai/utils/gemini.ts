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
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw new Error('Failed to generate text with Gemini');
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
        throw new Error(`Gemini Vision API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      logger.error('Gemini Vision API error:', error);
      throw new Error('Failed to analyze image');
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
