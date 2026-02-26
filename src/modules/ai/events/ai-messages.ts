import { IEvent } from '../../../types';
import { Message, TextChannel } from 'discord.js';
import { GroqClient } from '../utils/groq';
import { logger } from '../../../utils/logger';

export class AIMessageHandler implements IEvent {
  name = 'messageCreate';
  module = 'ai';

  async execute(message: Message, context: any): Promise<void> {
    if (message.author.bot || !message.guild) return;

    try {
      // Vérifier que le contexte est bien passé
      if (!context || !context.database) {
        logger.warn('AI event called without context, skipping');
        return;
      }

      // Get AI module config from database
      // context.database.query retourne directement un tableau (rows)
      const moduleConfigRows = await context.database.query(
        'SELECT config FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
        [message.guild.id, 'ai']
      );

      if (!moduleConfigRows || moduleConfigRows.length === 0) return;

      const config = moduleConfigRows[0].config;

      // Module must be enabled
      if (!config?.enabled) return;

      // Use global API key from environment (GROQ_API_KEY maintenant)
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        logger.warn('GROQ_API_KEY not set in environment, skipping AI features');
        return;
      }

      // ✅ FIX: Vérifier autoModEnabled (pas auto_moderate)
      // Correspond maintenant à ce que /automod sauvegarde en BDD
      if (config.autoModEnabled === true) {
        await this.handleAutoModeration(message, config, context, apiKey);
      }

      // Check if chat is enabled in this channel
      // config.chat_channel is a single channel ID (string)
      if (config.chat_channel && message.channel.id === config.chat_channel) {
        await this.handleChatResponse(message, config, context, apiKey);
      }
    } catch (error) {
      logger.error('Error in AI message handler:', error);
    }
  }

  private async handleAutoModeration(
    message: Message,
    config: any,
    context: any,
    apiKey: string
  ): Promise<void> {
    try {
      const groq = new GroqClient(apiKey);
      const toxicityScore = await groq.analyzeToxicity(message.content);

      // ✅ FIX: Utiliser autoModThreshold (pas toxicity_threshold)
      const threshold = config.autoModThreshold || 0.8;

      logger.debug(`Toxicity analysis: ${toxicityScore.toFixed(2)} (threshold: ${threshold})`);

      if (toxicityScore >= threshold) {
        // Delete message
        await message.delete().catch((err) => {
          logger.error('Failed to delete toxic message:', err);
        });

        // Warn user
        await (message.channel as TextChannel)
          .send(
            `⚠️ ${message.author}, votre message a été supprimé (contenu inapproprié détecté par l'IA — score: ${(toxicityScore * 100).toFixed(0)}%).`
          )
          .then((msg: Message) => setTimeout(() => msg.delete().catch(() => {}), 8000))
          .catch((err) => logger.error('Failed to send warning:', err));

        // Log
        await context.database.logAction(
          message.author.id,
          'AI_AUTOMOD_DELETE',
          {
            content: message.content.substring(0, 200),
            toxicityScore: toxicityScore.toFixed(3),
            threshold,
            channelId: message.channel.id,
          },
          message.guild!.id
        );

        logger.warn(
          `AI auto-mod deleted message from ${message.author.tag} in ${message.guild!.name}: toxicity ${toxicityScore.toFixed(2)} >= ${threshold}`
        );
      }
    } catch (error) {
      logger.error('Error in auto-moderation:', error);
    }
  }

  private async handleChatResponse(
    message: Message,
    config: any,
    context: any,
    apiKey: string
  ): Promise<void> {
    try {
      // Check if bot is mentioned
      const mentioned = message.mentions.has(context.client.user.id);

      // Get response chance from config (default 0 = mention-only)
      const responseChance = (config.response_chance || 0) / 100;

      // Trigger response if mentioned OR random chance
      const randomRoll = Math.random();
      const shouldRespond = mentioned || randomRoll < responseChance;

      logger.debug(
        `Chat trigger check: mentioned=${mentioned}, chance=${responseChance}, roll=${randomRoll.toFixed(2)}, respond=${shouldRespond}`
      );

      if (!shouldRespond) return;

      // Show typing indicator (only if channel supports it)
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Get conversation context (last N messages)
      const contextLimit = config.context_messages || 10;
      const messages = await message.channel.messages.fetch({ limit: contextLimit });
      const contextMessages = Array.from(messages.values())
        .reverse()
        .filter((m) => !m.author.bot || m.author.id === context.client.user.id)
        .slice(-contextLimit)
        .map((m) => `${m.author.username}: ${m.content}`)
        .join('\n');

      // Generate response
      const groq = new GroqClient(apiKey);
      const systemPrompt =
        config.system_prompt ||
        "Tu es Wolaro, un assistant Discord utile et amical. Réponds de manière concise et naturelle en français. N'utilise pas de markdown gras (**) dans tes réponses.";

      const fullPrompt = `Contexte de conversation récente:\n${contextMessages}\n\nRéponds au dernier message de ${message.author.username} de manière naturelle et engageante.`;

      const response = await groq.generateText(fullPrompt, {
        maxTokens: 800,
        temperature: config.temperature || 0.8,
        systemPrompt,
      });

      // Reply to message
      await message.reply(response.substring(0, 2000)); // Discord limit

      logger.info(
        `AI chat response sent in ${message.guild!.name}#${(message.channel as TextChannel).name} (triggered by: ${mentioned ? 'mention' : 'random'})`
      );
    } catch (error) {
      logger.error('Error generating chat response:', error);
      // Don't reply with error to avoid spam
    }
  }
}
