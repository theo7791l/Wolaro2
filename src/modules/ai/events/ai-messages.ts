import { IEvent } from '../../../types';
import { Message, TextChannel } from 'discord.js';
import { GroqClient } from '../utils/groq';
import { logger } from '../../../utils/logger';

// Prompt système pour Xavier (documentation complète de Wolaro2)
const XAVIER_DEV_PROMPT = `
Tu es Xavier, l'assistant développeur IA expert de Wolaro2.
Tu es spécialisé dans le développement full-stack et tu connais parfaitement
toute l'architecture, le code source et la documentation de Wolaro2.

Ton rôle : Aider les développeurs à implémenter des fonctionnalités,
déboguer, optimiser, et générer du code de qualité production.

╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
🏛️ ARCHITECTURE WOLARO2
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

## Stack Technique
- **Runtime**: Node.js 20+ avec TypeScript 5.x
- **Framework Discord**: discord.js v14
- **Base de données**: PostgreSQL 15+ (pg package)
- **Cache**: Redis 7+ (optionnel via RedisManager)
- **Build**: TypeScript -> JavaScript dans dist/

## Structure Modulaire

Chaque module suit ce pattern :

\`\`\`typescript
// src/modules/[nom]/index.ts
export default class MonModule implements IModule {
  name = 'mon_module';
  description = 'Description du module';
  version = '1.0.0';
  configSchema = z.object({ ... });  // Validation Zod
  defaultConfig = { ... };
  
  commands = [ new MaCommande() ];    // Array de ICommand
  events = [ new MonEvent() ];        // Array de IEvent
  
  constructor(client, database, redis) {}
}
\`\`\`

## Système de Base de Données

### DatabaseManager API

\`\`\`typescript
// Requêtes SQL
const rows = await context.database.query(
  'SELECT * FROM users WHERE user_id = $1',
  [userId]
);

// Logging d'actions
await context.database.logAction(
  userId,
  'ACTION_TYPE',
  { key: 'value' },  // Métadonnées JSON
  guildId
);
\`\`\`

### Tables Principales

- **guilds** : Configuration par serveur
- **guild_modules** : Config JSON de chaque module (JSONB)
- **users** : Profils utilisateurs globaux
- **guild_members** : Données membres par serveur (XP, coins, etc.)
- **audit_logs** : Logs de toutes les actions
- **moderation_cases** : Cas de modération (ban, kick, warn)
- **protection_config** : Configuration anti-raid/spam
- **economy_transactions** : Historique économie
- **rpg_profiles**, **rpg_inventory**, **quests** : Système RPG
- **tickets** : Système de support
- **giveaways**, **giveaway_entries** : Concours

## Module IA (Groq)

### Architecture Hybride Multi-Modèles

\`\`\`typescript
// src/modules/ai/utils/groq.ts
const groq = new GroqClient(apiKey);

// Chat conversationnel
await groq.generateText(prompt, {
  useCase: 'chat',      // Llama 3.3 70B -> fallback Llama 3.1 8B
});

// Modération
await groq.analyzeToxicity(text);  // Llama Guard 3 8B

// Support technique
await groq.generateText(prompt, {
  useCase: 'support'    // Qwen 32B
});

// Développement
await groq.generateText(prompt, {
  useCase: 'dev'        // GPT-OSS-120B
});
\`\`\`

## Bonnes Pratiques

### 1. Gestion des Interactions

\`\`\`typescript
// TOUJOURS déférer si traitement > 3s
await interaction.deferReply({ ephemeral: true });

// Puis répondre
await interaction.editReply({ content: 'Done!' });
\`\`\`

### 2. Embeds Discord

\`\`\`typescript
const embed = new EmbedBuilder()
  .setColor(0x5865f2)
  .setTitle('🚀 Titre')
  .setDescription('Description...')
  .setTimestamp();
\`\`\`

### 3. Configuration Modules

\`\`\`typescript
// Récupérer config
const rows = await context.database.query(
  'SELECT config FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
  [guildId, 'ai']
);
const config = rows[0]?.config || {};

// Sauvegarder config
await context.database.query(
  \`INSERT INTO guild_modules (guild_id, module_name, config)
   VALUES ($1, $2, $3)
   ON CONFLICT (guild_id, module_name) 
   DO UPDATE SET config = $3, updated_at = NOW()\`,
  [guildId, 'ai', JSON.stringify(newConfig)]
);
\`\`\`

╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
🛠️ TON RÔLE EN TANT QUE XAVIER
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

1. **Génération de Code**
   - Fournis du code TypeScript complet et fonctionnel
   - Respecte les patterns existants de Wolaro2
   - Inclus gestion d'erreurs et types corrects

2. **Debugging & Optimisation**
   - Analyse les erreurs et propose des solutions
   - Suggère des optimisations de performance

3. **Architecture & Design**
   - Conseille sur l'organisation du code
   - Respecte les principes SOLID

4. **Documentation**
   - Explique le fonctionnement du code
   - Fournis des exemples d'utilisation

Sois **précis**, **concis**, et **actionnable**.
Pour du code, utilise des blocs markdown avec \`\`\`typescript

Tu es l'expert ultime de Wolaro2. Let's code! 🚀
`;

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
      const moduleConfigRows = await context.database.query(
        'SELECT config FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
        [message.guild.id, 'ai']
      );

      if (!moduleConfigRows || moduleConfigRows.length === 0) return;

      const config = moduleConfigRows[0].config;

      // Module must be enabled
      if (!config?.enabled) return;

      // Use global API key from environment
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        logger.warn('GROQ_API_KEY not set in environment, skipping AI features');
        return;
      }

      // 🧑‍💻 XAVIER DEV CHANNEL - Priorité maximale
      if (config.devChannel && message.channel.id === config.devChannel) {
        await this.handleXavierResponse(message, config, context, apiKey);
        return; // Ne pas traiter d'autres handlers
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
      // Show typing indicator
      await message.channel.sendTyping();

      // Get conversation context (derniers 15 messages pour plus de contexte)
      const contextLimit = 15;
      const messages = await message.channel.messages.fetch({ limit: contextLimit });
      const conversationHistory = Array.from(messages.values())
        .reverse()
        .filter((m) => !m.author.bot || m.author.id === context.client.user.id)
        .slice(-contextLimit)
        .map((m) => `${m.author.username}: ${m.content}`)
        .join('\n');

      // Generate response avec GPT-OSS-120B (Xavier)
      const groq = new GroqClient(apiKey);
      
      const fullPrompt = `Conversation actuelle:\n${conversationHistory}\n\nRéponds à la dernière question/demande de ${message.author.username} en tant qu'expert développeur Wolaro2.`;

      const response = await groq.generateText(fullPrompt, {
        maxTokens: 3000,        // Permet de générer beaucoup de code
        temperature: 0.3,       // Réponses précises
        systemPrompt: XAVIER_DEV_PROMPT,
        useCase: 'dev',         // Utilise GPT-OSS-120B
      });

      // Split response si trop long (limite Discord: 2000 chars)
      const chunks = this.splitMessage(response, 1990);
      
      for (const chunk of chunks) {
        await message.reply(chunk);
      }

      logger.info(
        `Xavier responded in ${message.guild!.name}#${(message.channel as TextChannel).name} to ${message.author.tag}`
      );
    } catch (error: any) {
      logger.error('Error in Xavier response:', error);
      
      // Informer l'utilisateur en cas d'erreur
      if (error.message && error.message.includes('429')) {
        await message.reply(
          '⚠️ **Xavier est temporairement indisponible** (quota de 1000 req/jour atteint).\n' +
          'Réessayez dans quelques heures ou utilisez `/ask` pour des questions simples.'
        ).catch(() => {});
      } else {
        await message.reply(
          `❌ Une erreur est survenue : \`${error.message || 'Erreur inconnue'}\`
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

      logger.debug(`Toxicity analysis: ${toxicityScore.toFixed(2)} (threshold: ${threshold})`);

      if (toxicityScore >= threshold) {
        await message.delete().catch((err) => {
          logger.error('Failed to delete toxic message:', err);
        });

        await (message.channel as TextChannel)
          .send(
            `⚠️ ${message.author}, votre message a été supprimé (contenu inapproprié détecté par l'IA — score: ${(toxicityScore * 100).toFixed(0)}%).`
          )
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
      const mentioned = message.mentions.has(context.client.user.id);
      const responseChance = (config.response_chance || 0) / 100;
      const randomRoll = Math.random();
      const shouldRespond = mentioned || randomRoll < responseChance;

      logger.debug(
        `Chat trigger check: mentioned=${mentioned}, chance=${responseChance}, roll=${randomRoll.toFixed(2)}, respond=${shouldRespond}`
      );

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
        .map((m) => `${m.author.username}: ${m.content}`)
        .join('\n');

      const groq = new GroqClient(apiKey);
      const systemPrompt =
        config.system_prompt ||
        "Tu es Wolaro, un assistant Discord utile et amical. Réponds de manière concise et naturelle en français. N'utilise pas de markdown gras (**) dans tes réponses.";

      const fullPrompt = `Contexte de conversation récente:\n${contextMessages}\n\nRéponds au dernier message de ${message.author.username} de manière naturelle et engageante.`;

      const response = await groq.generateText(fullPrompt, {
        maxTokens: 800,
        temperature: config.temperature || 0.8,
        systemPrompt,
        useCase: 'chat',
      });

      await message.reply(response.substring(0, 2000));

      logger.info(
        `AI chat response sent in ${message.guild!.name}#${(message.channel as TextChannel).name} (triggered by: ${mentioned ? 'mention' : 'random'})`
      );
    } catch (error) {
      logger.error('Error generating chat response:', error);
    }
  }

  // Utilitaire pour split les messages longs
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
