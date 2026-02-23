import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

export class SkipCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Passer \u00e0 la musique suivante') as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 2;

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

    const currentTrack = queue.currentTrack;
    const skipped = queue.skip();

    if (skipped) {
      await interaction.reply(`\u23ed\ufe0f **${currentTrack?.title || 'Musique'}** pass\u00e9e !`);
    } else {
      await interaction.reply('\u23f9\ufe0f Queue termin\u00e9e.');
    }
  }
}
