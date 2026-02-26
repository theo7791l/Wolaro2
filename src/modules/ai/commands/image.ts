import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { GroqClient } from '../utils/groq';

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
      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        await interaction.editReply('❌ Le module IA n\'est pas configuré.');
        return;
      }

      // Note: Groq/Llama ne supporte pas directement l'analyse d'image
      // Cette fonctionnalité nécessite un modèle multimodal (Gemini/GPT-4V)
      // Pour l'instant, on retourne une erreur explicative
      await interaction.editReply({
        content: '⚠️ **Analyse d\'image temporairement indisponible**\n\n' +
          'Groq (Llama 3.3) ne supporte pas l\'analyse d\'images pour le moment.\n' +
          'Cette fonctionnalité sera réactivée avec un modèle multimodal (GPT-4V ou Gemini Vision).\n\n' +
          'Utilisez `/ask` pour des questions textuelles ! 🚀',
      });
    } catch (error: any) {
      await interaction.editReply(`❌ Erreur: ${error.message || 'Impossible d\'analyser l\'image'}`);
    }
  }
}
