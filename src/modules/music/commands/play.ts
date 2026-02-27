import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  TextChannel,
  Message,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { logger } from '../../../utils/logger';
import { newpipe, NewPipeSearchResult } from '../utils/newpipe';
import { getPlayer } from '../utils/player';

export class PlayCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer une musique depuis YouTube avec NewPipe')
    .addStringOption((option) =>
      option
        .setName('titre')
        .setDescription('Titre de la musique à rechercher')
        .setRequired(true),
    ) as SlashCommandBuilder;

  module = 'music';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Vous devez être dans un salon vocal pour utiliser cette commande.',
        ephemeral: true,
      });
      return;
    }

    const query = interaction.options.getString('titre', true);

    await interaction.deferReply();

    try {
      // Rechercher sur YouTube
      await interaction.editReply(`🔍 Recherche de "**${query}**" sur YouTube...`);
      const results = await newpipe.search(query, 10);

      if (results.length === 0) {
        await interaction.editReply('❌ Aucun résultat trouvé.');
        return;
      }

      // Créer l'embed avec les résultats
      const embed = this.createResultsEmbed(results, query);

      await interaction.editReply({
        content: '🎵 **Résultats de recherche** - Répondez avec un numéro entre **1** et **10** :',
        embeds: [embed],
      });

      // Vérifier que c'est un TextChannel
      const channel = interaction.channel;
      if (!channel || !('awaitMessages' in channel)) {
        await interaction.followUp({
          content: '❌ Cette commande ne peut être utilisée que dans un salon textuel.',
          ephemeral: true,
        });
        return;
      }

      // Attendre une réponse numérique (1-10)
      const filter = (msg: Message) => {
        const num = parseInt(msg.content);
        return msg.author.id === interaction.user.id && num >= 1 && num <= results.length;
      };

      try {
        const collected = await channel.awaitMessages({
          filter,
          max: 1,
          time: 60000, // 60 secondes
          errors: ['time'],
        });

        const choice = parseInt(collected.first()!.content);
        const selected = results[choice - 1];

        // Supprimer le message de choix de l'utilisateur
        await collected.first()!.delete().catch(() => {});

        // Jouer la musique sélectionnée
        await this.playTrack(interaction, voiceChannel, selected, context);
      } catch (error) {
        await interaction.followUp({
          content: '⏰ **Temps écoulé** - Vous n\'avez pas répondu à temps.',
          ephemeral: true,
        });
      }
    } catch (error: any) {
      logger.error('Error in play command:', error);
      await interaction.editReply(`❌ Erreur: ${error.message}`);
    }
  }

  private createResultsEmbed(results: NewPipeSearchResult[], query: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle(`🔎 Résultats pour "${query}"`)
      .setDescription(results.map((r, i) => 
        `**${i + 1}.** [${r.title}](${r.url})\n` +
        `⏱️ ${r.duration} | 👤 ${r.uploader}`
      ).join('\n\n'))
      .setFooter({ text: 'Répondez avec un numéro entre 1 et 10 pour choisir' })
      .setTimestamp();

    return embed;
  }

  private async playTrack(
    interaction: ChatInputCommandInteraction,
    voiceChannel: any,
    track: NewPipeSearchResult,
    context: ICommandContext
  ): Promise<void> {
    try {
      await interaction.followUp(`🔄 Chargement de **${track.title}**...`);

      // Récupérer le player de la guild
      const player = getPlayer(interaction.guildId!);

      // Rejoindre le salon vocal si pas déjà connecté
      if (!player.isConnected()) {
        await player.join(voiceChannel);
        await interaction.followUp(`✅ Connecté au salon **${voiceChannel.name}**`);
      }

      // Ajouter à la queue et jouer
      const queueItem = await player.addToQueue(track.url, interaction.user.id);

      const currentTrack = player.getCurrentTrack();
      
      if (currentTrack && currentTrack.info.url !== queueItem.info.url) {
        // Ajouté à la queue
        const position = player.getQueue().length + 1;
        await interaction.followUp(
          `✅ **${track.title}** ajouté à la queue !\n` +
          `📍 Position: **#${position}**\n` +
          `⏱️ Durée: **${queueItem.info.duration}**`
        );
      } else {
        // Lecture immédiate
        const embed = new EmbedBuilder()
          .setColor(0x1DB954)
          .setTitle('🎵 Lecture en cours')
          .setDescription(`**${queueItem.info.title}**`)
          .addFields(
            { name: '⏱️ Durée', value: queueItem.info.duration, inline: true },
            { name: '👤 Chaîne', value: queueItem.info.uploader, inline: true },
            { name: '🎶 Demandé par', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        await interaction.followUp({ embeds: [embed] });
      }
    } catch (error: any) {
      logger.error('Failed to play track:', error);
      await interaction.followUp(`❌ Impossible de jouer cette musique: ${error.message}`);
    }
  }
}
