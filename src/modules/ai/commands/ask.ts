import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { GeminiClient } from '../utils/gemini';

export class AskCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Poser une question à l\'IA Gemini')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Votre question')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'ai';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const question = interaction.options.getString('question', true);

    await interaction.deferReply();

    try {
      // Use global API key from environment
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        await interaction.editReply('❌ Le module IA n\'est pas configuré. Veuillez configurer GEMINI_API_KEY dans les variables d\'environnement.');
        return;
      }

      // Get module config for optional settings
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const aiModule = config?.modules?.find((m: any) => m.module_name === 'ai');

      const gemini = new GeminiClient(apiKey);
      const response = await gemini.generateText(question, {
        maxTokens: aiModule?.config?.maxTokens || 2000,
        temperature: aiModule?.config?.temperature || 0.7,
      });

      // Split response if too long
      if (response.length > 2000) {
        const chunks = this.splitMessage(response, 2000);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length && i < 3; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.editReply(response);
      }

      // Log usage
      await context.database.logAction(
        interaction.user.id,
        'AI_QUERY',
        {
          question: question.substring(0, 200),
          responseLength: response.length,
        },
        interaction.guildId!
      );
    } catch (error: any) {
      await interaction.editReply(`❌ Erreur: ${error.message || 'Impossible de contacter l\'IA'}`);
    }
  }

  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const lines = text.split('\n');
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
