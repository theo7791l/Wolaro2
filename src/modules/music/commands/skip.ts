import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

export class SkipCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Passer à la musique suivante') as SlashCommandBuilder;

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

    const queue = MusicQueue.get(interaction.guildId!);

    if (!queue || !queue.isPlaying()) {
      await interaction.reply({
        content: '❌ Aucune musique en cours.',
        ephemeral: true,
      });
      return;
    }

    const skipped = queue.skip();

    if (skipped) {
      await interaction.reply('⏭️ Musique suivante !');
    } else {
      await interaction.reply('⏹️ Queue terminée.');
    }
  }
}
