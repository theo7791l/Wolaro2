import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { getMusicManager } from '../manager';
import { logger } from '../../../utils/logger';

export class PlayCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer une musique depuis YouTube, Spotify, Deezer ou SoundCloud')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('URL ou recherche')
        .setRequired(true)
        .setAutocomplete(true),
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

    const query = interaction.options.getString('query', true);

    await interaction.deferReply();

    try {
      const manager = getMusicManager();
      
      // Créer ou récupérer le player
      let player = manager.players.get(interaction.guildId!);
      
      if (!player) {
        player = manager.create({
          guild: interaction.guildId!,
          voiceChannel: voiceChannel.id,
          textChannel: interaction.channelId,
          selfDeafen: true,
        });
      }

      // Connecter si nécessaire
      if (player.state !== 'CONNECTED') {
        player.connect();
      }

      // Rechercher la musique
      const res = await manager.search(
        query,
        interaction.user
      );

      if (res.loadType === 'LOAD_FAILED' || res.loadType === 'NO_MATCHES') {
        await interaction.editReply('❌ Aucun résultat trouvé.');
        
        if (!player.queue.current) {
          player.destroy();
        }
        
        return;
      }

      if (res.loadType === 'PLAYLIST_LOADED') {
        player.queue.add(res.tracks);

        await interaction.editReply(
          `🎶 Playlist ajoutée : **${res.playlist?.name}** (${res.tracks.length} pistes)`
        );
      } else {
        const track = res.tracks[0];
        player.queue.add(track);

        await interaction.editReply(
          `🎵 Ajouté à la file : **${track.title}** par **${track.author}**`
        );
      }

      // Jouer si rien n'est en cours
      if (!player.playing && !player.paused) {
        player.play();
      }
    } catch (error: any) {
      logger.error('Error in play command:', error);
      await interaction.editReply(
        `❌ Erreur lors de la lecture : ${error.message}`
      ).catch(() => {});
    }
  }

  async autocomplete(interaction: any): Promise<void> {
    const focusedValue = interaction.options.getFocused();

    if (!focusedValue || focusedValue.length < 2) {
      await interaction.respond([]);
      return;
    }

    try {
      const manager = getMusicManager();
      const res = await manager.search(focusedValue, interaction.user);

      const choices = res.tracks.slice(0, 10).map((track: any) => ({
        name: `${track.title} - ${track.author}`.substring(0, 100),
        value: track.uri,
      }));

      await interaction.respond(choices);
    } catch (error) {
      logger.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  }
}
