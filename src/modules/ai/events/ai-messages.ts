import { IEvent } from '../../../types';
import { Message, TextChannel } from 'discord.js';
import { GroqClient } from '../utils/groq';
import { logger } from '../../../utils/logger';

// Prompt système pour Xavier (documentation complète de Wolaro2)
const XAVIER_DEV_PROMPT = `Tu es Xavier, l'assistant développeur IA expert de Wolaro2.
Tu es spécialisé dans le développement full-stack et tu connais parfaitement toute l'architecture, le code source et la documentation de Wolaro2.

ARCHITECTURE WOLARO2:

- Stack: Node.js 20+ avec TypeScript 5.x, discord.js v14, PostgreSQL 15+, Redis 7+
- Modules: moderation, economy, leveling, music, rpg, tickets, giveaways, ai, admin
- Base de données: tables guilds, guild_modules, users, guild_members, audit_logs, moderation_cases, protection_config, economy_transactions, rpg_profiles, tickets, giveaways
- Architecture modulaire: Chaque module implémente IModule avec commands et events
- DatabaseManager: query(), logAction(), initializeGuild()
- GroqClient: generateText() avec useCases: chat, moderation, support, dev

TON ROLE:
1. Génération de code TypeScript complet et fonctionnel
2. Debugging et optimisation de performance
3. Conseil en architecture et design patterns
4. Documentation et explications claires

Réponds de manière précise, concise et actionnable.
Pour du code, utilise des blocs markdown.
Tu es l'expert ultime de Wolaro2.`;

export class AIMessageHandler implements IEvent {
  name = 'messageCreate';
  module = 'ai';

  async execute(message: Message, context: any): Promise<void> {
    if (message.author.bot || !message.guild) return;

    try {
      if (!context || !context.database) {
        logger.warn('AI event called without context, skipping');
        return;
      }

      const moduleConfigRows = await context.database.query(
        'SELECT config FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
        [message.guild.id, 'ai']
      );

      if (!moduleConfigRows || moduleConfigRows.length === 0) return;

      const config = moduleConfigRows[0].config;

      if (!config?.enabled) return;

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        logger.warn('GROQ_API_KEY not set in environment, skipping AI features');
        return;
      }

      // XAVIER DEV CHANNEL - Priorité maximale
      if (config.devChannel && message.channel.id === config.devChannel) {
        await this.handleXavierResponse(message, config, context, apiKey);
        return;
      }

      // Auto-moderation
      if (config.autoModEnabled === true) {
        await this.handleAutoModeration(message, config, context, apiKey);
      }

      // Chat channel
      if (config.chat_channel && message.channel.id === config.chat_channel) {
        await this.handleChatResponse(message, config, context, apiKey);
      }
    } catch (error) {
      logger.error('Error in AI message handler:', error);
    }
  }

  private async handleXavierResponse(
    message: Message,
    config: any,
    context: any,
    apiKey: string
  ): Promise<void> {
    try {
      await message.channel.sendTyping();

      const contextLimit = 15;
      const messages = await message.channel.messages.fetch({ limit: contextLimit });
      const conversationHistory = Array.from(messages.values())
        .reverse()
        .filter((m) => !m.author.bot || m.author.id === context.client.user.id)
        .slice(-contextLimit)
        .map((m) => m.author.username + ': ' + m.content)
        .join('\n');

      const groq = new GroqClient(apiKey);
      
      const fullPrompt = 'Conversation actuelle:\n' + conversationHistory + '\n\nReponds a la derniere question/demande de ' + message.author.username + ' en tant qu\'expert developpeur Wolaro2.';

      const response = await groq.generateText(fullPrompt, {
        maxTokens: 3000,
        temperature: 0.3,
        systemPrompt: XAVIER_DEV_PROMPT,
        useCase: 'dev',
      });

      const chunks = this.splitMessage(response, 1990);
      
      for (const chunk of chunks) {
        await message.reply(chunk);
      }

      logger.info('Xavier responded in ' + message.guild!.name + '#' + (message.channel as TextChannel).name + ' to ' + message.author.tag);
    } catch (error: any) {
      logger.error('Error in Xavier response:', error);
      
      if (error.message && error.message.includes('429')) {
        await message.reply(
          'WARNING: Xavier est temporairement indisponible (quota de 1000 req/jour atteint).\n' +
          'Reessayez dans quelques heures ou utilisez /ask pour des questions simples.'
        ).catch(() => {});
      } else {
        await message.reply(
          'ERROR: Une erreur est survenue: ' + (error.message || 'Erreur inconnue')
        ).catch(() => {});
      }
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
      const threshold = config.autoModThreshold || 0.8;

      logger.debug('Toxicity analysis: ' + toxicityScore.toFixed(2) + ' (threshold: ' + threshold + ')');

      if (toxicityScore >= threshold) {
        await message.delete().catch((err) => {
          logger.error('Failed to delete toxic message:', err);
        });

        const warningMsg = 'WARNING: ' + message.author.toString() + ', votre message a ete supprime (contenu inapproprie detecte par l\'IA - score: ' + (toxicityScore * 100).toFixed(0) + '%).';
        
        await (message.channel as TextChannel)
          .send(warningMsg)
          .then((msg: Message) => setTimeout(() => msg.delete().catch(() => {}), 8000))
          .catch((err) => logger.error('Failed to send warning:', err));

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

        logger.warn('AI auto-mod deleted message from ' + message.author.tag + ' in ' + message.guild!.name + ': toxicity ' + toxicityScore.toFixed(2) + ' >= ' + threshold);
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
      const mentioned = message.mentions.has(context.client.user.id);
      const responseChance = (config.response_chance || 0) / 100;
      const randomRoll = Math.random();
      const shouldRespond = mentioned || randomRoll < responseChance;

      logger.debug('Chat trigger check: mentioned=' + mentioned + ', chance=' + responseChance + ', roll=' + randomRoll.toFixed(2) + ', respond=' + shouldRespond);

      if (!shouldRespond) return;

      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const contextLimit = config.context_messages || 10;
      const messages = await message.channel.messages.fetch({ limit: contextLimit });
      const contextMessages = Array.from(messages.values())
        .reverse()
        .filter((m) => !m.author.bot || m.author.id === context.client.user.id)
        .slice(-contextLimit)
        .map((m) => m.author.username + ': ' + m.content)
        .join('\n');

      const groq = new GroqClient(apiKey);
      const systemPrompt =
        config.system_prompt ||
        "Tu es Wolaro, un assistant Discord utile et amical. Reponds de maniere concise et naturelle en francais. N'utilise pas de markdown gras (**) dans tes reponses.";

      const fullPrompt = 'Contexte de conversation recente:\n' + contextMessages + '\n\nReponds au dernier message de ' + message.author.username + ' de maniere naturelle et engageante.';

      const response = await groq.generateText(fullPrompt, {
        maxTokens: 800,
        temperature: config.temperature || 0.8,
        systemPrompt,
        useCase: 'chat',
      });

      await message.reply(response.substring(0, 2000));

      logger.info('AI chat response sent in ' + message.guild!.name + '#' + (message.channel as TextChannel).name + ' (triggered by: ' + (mentioned ? 'mention' : 'random') + ')');
    } catch (error) {
      logger.error('Error generating chat response:', error);
    }
  }

  private splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    let currentChunk = '';
    
    const lines = text.split('\n');
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    
    return chunks;
  }
}
