import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { MusicQueue } from '../utils/queue';

export class StopCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arrêter la musique et vider la queue') as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 3;

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

    if (!queue) {
      await interaction.reply({
        content: '❌ Aucune musique en cours.',
        ephemeral: true,
      });
      return;
    }

    queue.stop();
    MusicQueue.delete(interaction.guildId!);

    await interaction.reply('⏹️ Musique arrêtée et queue vidée.');
  }
}
