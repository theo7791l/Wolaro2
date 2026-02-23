import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

export class StopCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arr\u00eater la musique et vider la queue') as SlashCommandBuilder;

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

    if (!queue) {
      await interaction.reply({
        content: '\u274c Aucune musique en cours.',
        ephemeral: true,
      });
      return;
    }

    queue.stop();
    MusicQueue.delete(interaction.guildId!);

    await interaction.reply('\u23f9\ufe0f Musique arr\u00eat\u00e9e et queue vid\u00e9e.');
  }
}
