import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { getShoukaku, players } from '../manager';
import { logger } from '../../../utils/logger';

export class PlayCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer une musique depuis YouTube, Spotify ou SoundCloud')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('URL ou recherche')
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

    const query = interaction.options.getString('query', true);

    await interaction.deferReply();

    try {
      const shoukaku = getShoukaku();
      const node = shoukaku.getIdealNode();

      if (!node) {
        await interaction.editReply('❌ Aucun serveur audio disponible.');
        return;
      }

      // Chercher la musique
      const result = await node.rest.resolve(query.startsWith('http') ? query : `ytsearch:${query}`);

      if (!result || !result.tracks.length) {
        await interaction.editReply('❌ Aucun résultat trouvé.');
        return;
      }

      // Créer ou récupérer le player
      let player = players.get(interaction.guildId!);

      if (!player) {
        player = await node.joinChannel({
          guildId: interaction.guildId!,
          channelId: voiceChannel.id,
          shardId: interaction.guild!.shardId,
          deaf: true,
        });

        player.queue = [];
        player.textChannel = interaction.channelId;
        players.set(interaction.guildId!, player);

        // Gérer la fin des pistes
        player.on('end', (data: any) => {
          if (data.reason === 'finished') {
            if (player.queue.length > 0) {
              const next = player.queue.shift();
              player.playTrack({ track: { encoded: next.track } });
            } else {
              setTimeout(() => {
                if (player.queue.length === 0) {
                  player.connection.disconnect();
                  players.delete(interaction.guildId!);

                  const channel = interaction.client.channels.cache.get(player.textChannel) as TextChannel;
                  if (channel?.isTextBased()) {
                    channel.send('⏹️ File terminée, je quitte le salon.').catch(() => {});
                  }
                }
              }, 30000); // 30s d'attente
            }
          }
        });

        player.on('start', (data: any) => {
          const channel = interaction.client.channels.cache.get(player.textChannel) as TextChannel;
          if (channel?.isTextBased()) {
            channel.send(`🎶 En lecture : **${data.track.info.title}** par **${data.track.info.author}**`).catch(() => {});
          }
        });
      }

      const track = result.tracks[0];

      if (result.playlistInfo && result.playlistInfo.name) {
        // Playlist
        player.queue.push(...result.tracks.map((t: any) => ({ track: t.encoded, info: t.info })));
        await interaction.editReply(
          `🎶 Playlist ajoutée : **${result.playlistInfo.name}** (${result.tracks.length} pistes)`
        );
      } else {
        // Piste unique
        if (!player.track) {
          // Rien en cours, jouer directement
          await player.playTrack({ track: { encoded: track.encoded } });
          await interaction.editReply(
            `🎵 Lecture de : **${track.info.title}** par **${track.info.author}**`
          );
        } else {
          // Ajouter à la queue
          player.queue.push({ track: track.encoded, info: track.info });
          await interaction.editReply(
            `🎵 Ajouté à la file [#${player.queue.length}] : **${track.info.title}** par **${track.info.author}**`
          );
        }
      }

      // Si queue et rien en cours
      if (player.queue.length > 0 && !player.track) {
        const next = player.queue.shift();
        await player.playTrack({ track: { encoded: next.track } });
      }
    } catch (error: any) {
      logger.error('Error in play command:', error);
      await interaction.editReply(
        `❌ Erreur lors de la lecture : ${error.message}`
      ).catch(() => {});
    }
  }
}
