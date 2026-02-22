import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class TicketCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Créer un nouveau ticket de support')
    .addStringOption((option) =>
      option
        .setName('sujet')
        .setDescription('Le sujet de votre ticket')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type de ticket')
        .addChoices(
          { name: '💬 Support Général', value: 'general' },
          { name: '🐛 Rapport de Bug', value: 'bug' },
          { name: '💡 Suggestion', value: 'suggestion' },
          { name: '🚨 Signalement', value: 'report' },
          { name: '💰 Achat/Paiement', value: 'payment' }
        )
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'tickets';
  guildOnly = true;
  cooldown = 10;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const subject = interaction.options.getString('sujet', true);
    const type = interaction.options.getString('type', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get config
      const config = await context.database.getGuildConfig(interaction.guildId!);
      const ticketsModule = config?.modules?.find((m: any) => m.module_name === 'tickets');

      if (!ticketsModule?.enabled) {
        await interaction.editReply('❌ Le système de tickets n\'est pas activé.');
        return;
      }

      // Check existing tickets
      const existingTickets = await context.database.query(
        'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = $3',
        [interaction.guildId!, interaction.user.id, 'open']
      );

      const maxTickets = ticketsModule.config?.maxTicketsPerUser || 3;
      if (existingTickets[0].count >= maxTickets) {
        await interaction.editReply(`❌ Vous avez déjà ${maxTickets} tickets ouverts. Fermez-en un avant d'en ouvrir un nouveau.`);
        return;
      }

      // Get next ticket number
      const ticketCount = await context.database.query(
        'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1',
        [interaction.guildId!]
      );
      const ticketNumber = ticketCount[0].count + 1;

      // Create ticket channel
      const channelName = `${ticketsModule.config?.ticketPrefix || 'ticket'}-${ticketNumber.toString().padStart(4, '0')}`;

      const channel = await interaction.guild!.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketsModule.config?.categoryId || undefined,
        permissionOverwrites: [
          {
            id: interaction.guild!.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: context.client.user!.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });

      // Add support roles
      if (ticketsModule.config?.supportRoles) {
        for (const roleId of ticketsModule.config.supportRoles) {
          await channel.permissionOverwrites.create(roleId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });
        }
      }

      // Create ticket in database
      await context.database.query(
        `INSERT INTO tickets (guild_id, user_id, channel_id, ticket_number, subject, type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())`,
        [interaction.guildId!, interaction.user.id, channel.id, ticketNumber, subject, type]
      );

      // Send welcome message
      const typeEmojis: Record<string, string> = {
        general: '💬',
        bug: '🐛',
        suggestion: '💡',
        report: '🚨',
        payment: '💰',
      };

      const embed = new EmbedBuilder()
        .setColor('#00AAFF')
        .setTitle(`${typeEmojis[type]} Ticket #${ticketNumber}`)
        .setDescription(
          `**Sujet:** ${subject}\n` +
          `**Type:** ${type.charAt(0).toUpperCase() + type.slice(1)}\n` +
          `**Créé par:** ${interaction.user}\n\n` +
          'Un membre du support va vous répondre bientôt. Merci de votre patience !'
        )
        .setFooter({ text: 'Cliquez sur le bouton Fermer pour fermer ce ticket' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Fermer le ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Revendiquer')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✅')
      );

      await channel.send({
        content: `${interaction.user} | ${ticketsModule.config?.supportRoles?.map((r: string) => `<@&${r}>`).join(' ') || ''}`,
        embeds: [embed],
        components: [row],
      });

      await interaction.editReply(`✅ Votre ticket a été créé : ${channel}`);
    } catch (error) {
      await interaction.editReply('❌ Erreur lors de la création du ticket.');
    }
  }
}
