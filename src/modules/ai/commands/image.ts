import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { GeminiClient } from '../utils/gemini';

export class ImageCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('aiimage')
    .setDescription('Analyser une image avec l\'IA')
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('L\'image à analyser')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Question sur l\'image (optionnel)')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'ai';
  guildOnly = true;
  cooldown = 10;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const image = interaction.options.getAttachment('image', true);
    const question = interaction.options.getString('question') || 'Décris cette image en détail.';

    if (!image.contentType?.startsWith('image/')) {
      await interaction.reply({
        content: '❌ Veuillez fournir une image valide.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Use global API key from environment
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        await interaction.editReply('❌ Le module IA n\'est pas configuré.');
        return;
      }

      const gemini = new GeminiClient(apiKey);
      const response = await gemini.analyzeImage(image.url, question);

      await interaction.editReply({
        content: `🔍 **Analyse de l'image:**\n\n${response}`,
      });
    } catch (error: any) {
      await interaction.editReply(`❌ Erreur: ${error.message || 'Impossible d\'analyser l\'image'}`);
    }
  }
}
