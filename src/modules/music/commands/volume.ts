import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

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
        content: '\u274c Vous devez \u00eatre dans un salon vocal.',
        ephemeral: true,
      });
      return;
    }

    const queue = MusicQueue.get(interaction.guildId!);

    if (!queue || !queue.isPlaying()) {
      await interaction.reply({
        content: '\u274c Aucune musique en cours.',
        ephemeral: true,
      });
      return;
    }

    const volume = interaction.options.getInteger('niveau', true);
    queue.setVolume(volume);

    await interaction.reply(`\ud83d\udd0a Volume r\u00e9gl\u00e9 \u00e0 **${volume}%**`);
  }
}
