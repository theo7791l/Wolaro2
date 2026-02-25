import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { getPlayer, deletePlayer } from '../utils/player';
import { logger } from '../../../utils/logger';

export class StopCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arrêter la musique et quitter le salon vocal') as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 2;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Vous devez être dans un salon vocal.',
        ephemeral: true,
      });
      return;
    }

    try {
      const player = getPlayer(interaction.guildId!);

      if (!player.isConnected()) {
        await interaction.reply({
          content: '❌ Aucune musique en cours de lecture.',
          ephemeral: true,
        });
        return;
      }

      player.disconnect();
      deletePlayer(interaction.guildId!);

      await interaction.reply('⏹️ Musique arrêtée et déconnecté du salon vocal.');
    } catch (error: any) {
      logger.error('Error in stop command:', error);
      await interaction.reply({
        content: '❌ Erreur lors de l\'arrêt de la musique.',
        ephemeral: true,
      });
    }
  }
}
