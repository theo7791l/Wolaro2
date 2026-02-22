import { IEvent } from '../../../types';
import { Message } from 'discord.js';
import { GeminiClient } from '../utils/gemini';
import { logger } from '../../../utils/logger';

export class AIMessageHandler implements IEvent {
  name = 'messageCreate';
  module = 'ai';

  async execute(message: Message, context: any): Promise<void> {
    if (message.author.bot || !message.guild) return;

    try {
      const config = await context.database.getGuildConfig(message.guild.id);
      const aiModule = config?.modules?.find((m: any) => m.module_name === 'ai');

      if (!aiModule?.enabled || !aiModule?.config?.geminiApiKey) return;

      // Check if auto-moderation is enabled
      if (aiModule.config.autoModEnabled) {
        await this.handleAutoModeration(message, aiModule.config, context);
      }

      // Check if chat is enabled in this channel
      if (aiModule.config.chatEnabled && aiModule.config.chatChannels?.includes(message.channel.id)) {
        await this.handleChatResponse(message, aiModule.config, context);
      }
    } catch (error) {
      logger.error('Error in AI message handler:', error);
    }
  }

  private async handleAutoModeration(message: Message, config: any, context: any): Promise<void> {
    try {
      const gemini = new GeminiClient(config.geminiApiKey);
      const toxicityScore = await gemini.analyzeToxicity(message.content);

      if (toxicityScore >= config.autoModThreshold) {
        // Delete message
        await message.delete();

        // Warn user
        await message.channel.send(
          `⚠️ ${message.author}, votre message a été supprimé (contenu inapproprié détecté par l'IA).`
        ).then((msg) => setTimeout(() => msg.delete(), 5000));

        // Log
        await context.database.logAction(
          message.author.id,
          'AI_AUTOMOD_DELETE',
          {
            content: message.content.substring(0, 100),
            toxicityScore,
            channelId: message.channel.id,
          },
          message.guild!.id
        );

        logger.warn(`AI auto-mod deleted message from ${message.author.tag}: toxicity ${toxicityScore}`);
      }
    } catch (error) {
      logger.error('Error in auto-moderation:', error);
    }
  }

  private async handleChatResponse(message: Message, config: any, context: any): Promise<void> {
    try {
      // Only respond if mentioned or random chance
      const mentioned = message.mentions.has(context.client.user.id);
      const randomChance = Math.random() < 0.1; // 10% chance

      if (!mentioned && !randomChance) return;

      // Get conversation context
      const messages = await message.channel.messages.fetch({ limit: config.contextMessages || 10 });
      const contextMessages = Array.from(messages.values())
        .reverse()
        .filter((m) => !m.author.bot || m.author.id === context.client.user.id)
        .map((m) => `${m.author.username}: ${m.content}`)
        .join('\n');

      // Generate response
      const gemini = new GeminiClient(config.geminiApiKey);
      const systemPrompt = config.systemPrompt || 
        'Tu es un assistant Discord utile et amical. Réponds de manière concise et naturelle.';

      const response = await gemini.generateText(
        `Contexte de conversation:\n${contextMessages}\n\nRéponds au dernier message de manière naturelle.`,
        {
          maxTokens: 500,
          temperature: config.temperature || 0.7,
          systemPrompt,
        }
      );

      await message.reply(response);
    } catch (error) {
      logger.error('Error generating chat response:', error);
    }
  }
}
