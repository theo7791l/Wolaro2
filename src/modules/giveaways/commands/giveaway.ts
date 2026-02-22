import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class GiveawayCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Créer un giveaway')
    .addStringOption((option) =>
      option
        .setName('prix')
        .setDescription('Le prix du giveaway')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('durée')
        .setDescription('Durée en secondes (défaut: 24h)')
        .setMinValue(60)
        .setMaxValue(604800)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('gagnants')
        .setDescription('Nombre de gagnants (défaut: 1)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName('salon')
        .setDescription('Salon où poster le giveaway (défaut: salon actuel)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Description supplémentaire')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'giveaways';
  permissions = [PermissionFlagsBits.ManageGuild];
  guildOnly = true;
  cooldown = 10;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const prize = interaction.options.getString('prix', true);
    const duration = interaction.options.getInteger('durée') || 86400;
    const winners = interaction.options.getInteger('gagnants') || 1;
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const description = interaction.options.getString('description');

    await interaction.deferReply({ ephemeral: true });

    try {
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const giveawaysModule = config?.modules?.find((m: any) => m.module_name === 'giveaways');

      const endTime = Date.now() + duration * 1000;

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(giveawaysModule?.config?.embedColor || '#FF0000')
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(
          `**Prix:** ${prize}\n` +
          (description ? `${description}\n\n` : '\n') +
          `**Gagnants:** ${winners}\n` +
          `**Se termine:** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
          'Cliquez sur le bouton 🎁 pour participer !'
        )
        .setFooter({ text: `Hôte: ${interaction.user.tag}` })
        .setTimestamp(endTime);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_enter')
          .setLabel('Participer')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎁')
      );

      // Send giveaway message
      const giveawayMsg = await (channel as any).send({
        content: giveawaysModule?.config?.pingRole ? `<@&${giveawaysModule.config.pingRole}>` : '@everyone',
        embeds: [embed],
        components: [row],
      });

      // Save to database
      await context.database.query(
        `INSERT INTO giveaways (
          guild_id, channel_id, message_id, prize, winners_count, 
          host_id, end_time, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())`,
        [
          interaction.guildId!,
          channel!.id,
          giveawayMsg.id,
          prize,
          winners,
          interaction.user.id,
          new Date(endTime),
        ]
      );

      await interaction.editReply(`✅ Giveaway créé dans ${channel} ! Il se terminera <t:${Math.floor(endTime / 1000)}:R>`);
    } catch (error) {
      await interaction.editReply('❌ Erreur lors de la création du giveaway.');
    }
  }
}
