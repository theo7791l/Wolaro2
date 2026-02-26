import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { getPlayer } from '../utils/player';
import { logger } from '../../../utils/logger';

export class VolumeCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajuster le volume de la musique')
    .addIntegerOption((option) =>
      option
        .setName('niveau')
        .setDescription('Niveau de volume (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ) as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, _context: ICommandContext): Promise<void> {
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

      const current = player.getCurrentTrack();
      if (!current) {
        await interaction.reply({
          content: '❌ Aucune musique en cours de lecture.',
          ephemeral: true,
        });
        return;
      }

      const volume = interaction.options.getInteger('niveau', true);
      const volumeDecimal = volume / 100; // Convertir 1-100 en 0.01-1.0
      
      player.setVolume(volumeDecimal);

      await interaction.reply(`🔊 Volume réglé à **${volume}%**`);
    } catch (error: any) {
      logger.error('Error in volume command:', error);
      await interaction.reply({
        content: '❌ Erreur lors du changement de volume.',
        ephemeral: true,
      });
    }
  }
}
