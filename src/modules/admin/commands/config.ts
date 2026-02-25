import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ChannelType,
  TextChannel,
  CategoryChannel,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { logger } from '../../../utils/logger.js';

interface ModuleConfig {
  name: string;
  emoji: string;
  description: string;
  fields: ConfigField[];
}

interface ConfigField {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  style?: TextInputStyle;
  maxLength?: number;
}

const MODULES: Record<string, ModuleConfig> = {
  moderation: {
    name: 'Moderation',
    emoji: '🛡️',
    description: 'Auto-modération, logs, anti-raid et anti-spam',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'log_channel', label: 'Salon de logs (ID)', placeholder: '1234567890', required: false },
      { id: 'mute_role', label: 'Rôle Mute (ID)', placeholder: '1234567890', required: false },
      { id: 'max_warns', label: 'Avertissements max (1-10)', placeholder: '3', required: false },
      { id: 'spam_threshold', label: 'Seuil spam msgs/5s (3-20)', placeholder: '5', required: false },
    ],
  },
  economy: {
    name: 'Economy',
    emoji: '💰',
    description: 'Système bancaire, daily, work, shop',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'currency_name', label: 'Nom de la devise', placeholder: 'coins', required: false },
      { id: 'currency_symbol', label: 'Symbole devise', placeholder: '🪙', required: false },
      { id: 'daily_amount', label: 'Récompense daily (100-10000)', placeholder: '500', required: false },
      { id: 'work_range', label: 'Récompense work (min-max)', placeholder: '50-500', required: false },
    ],
  },
  leveling: {
    name: 'Leveling',
    emoji: '📈',
    description: 'XP par message, level-up, rôles-récompenses',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'xp_per_message', label: 'XP par message (10-100)', placeholder: '25', required: false },
      { id: 'xp_cooldown', label: 'Cooldown XP secondes (30-300)', placeholder: '60', required: false },
      { id: 'level_up_channel', label: 'Salon level-up (ID)', placeholder: '1234567890', required: false },
      { id: 'stack_roles', label: 'Stack rôles (true/false)', placeholder: 'true', required: false },
    ],
  },
  music: {
    name: 'Music',
    emoji: '🎵',
    description: 'YouTube, Spotify, SoundCloud, queue, filtres',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'default_volume', label: 'Volume par défaut (1-100)', placeholder: '50', required: false },
      { id: 'max_queue_size', label: 'Taille queue max (10-500)', placeholder: '100', required: false },
      { id: 'allow_filters', label: 'Filtres audio (true/false)', placeholder: 'true', required: false },
      { id: 'dj_role', label: 'Rôle DJ (ID)', placeholder: '1234567890', required: false },
    ],
  },
  ai: {
    name: 'AI (Gemini)',
    emoji: '🤖',
    description: 'Chatbot, support, auto-modération IA',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'chat_channel', label: 'Salon chat IA (ID)', placeholder: '1234567890', required: false },
      { id: 'auto_moderate', label: 'Auto-modération IA (true/false)', placeholder: 'false', required: false },
      { id: 'toxicity_threshold', label: 'Seuil toxicité (0.0-1.0)', placeholder: '0.8', required: false },
      { id: 'response_chance', label: 'Chance réponse % (0-100)', placeholder: '10', required: false },
    ],
  },
  rpg: {
    name: 'RPG',
    emoji: '⚔️',
    description: 'Combat PvP/PvE, inventaire, quêtes',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'start_gold', label: 'Or de départ (0-10000)', placeholder: '100', required: false },
      { id: 'start_health', label: 'Santé départ (50-500)', placeholder: '100', required: false },
      { id: 'daily_reward', label: 'Récompense daily (100-5000)', placeholder: '200', required: false },
      { id: 'quest_channel', label: 'Salon quêtes (ID)', placeholder: '1234567890', required: false },
    ],
  },
  tickets: {
    name: 'Tickets',
    emoji: '🎫',
    description: 'Support, bug reports, transcripts',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'category', label: 'Catégorie tickets (ID)', placeholder: '1234567890', required: false },
      { id: 'support_role', label: 'Rôle support (ID)', placeholder: '1234567890', required: false },
      { id: 'transcript_channel', label: 'Salon transcripts (ID)', placeholder: '1234567890', required: false },
      { id: 'auto_close_hours', label: 'Auto-fermeture heures (1-168)', placeholder: '24', required: false },
    ],
  },
  giveaways: {
    name: 'Giveaways',
    emoji: '🎉',
    description: 'Concours automatiques, multi-gagnants',
    fields: [
      { id: 'enabled', label: 'Activé (true/false)', placeholder: 'true', required: true },
      { id: 'ping_role', label: 'Rôle à ping (ID)', placeholder: '1234567890', required: false },
      { id: 'min_account_age_days', label: 'Âge compte min jours (0-365)', placeholder: '7', required: false },
      { id: 'min_server_age_days', label: 'Âge serveur min jours (0-90)', placeholder: '1', required: false },
    ],
  },
};

export class ConfigCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Configurer les modules du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false) as SlashCommandBuilder;

  module = 'admin';
  guildOnly = true;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('config_module_select')
      .setPlaceholder('🔧 Sélectionner un module à configurer')
      .addOptions(
        Object.entries(MODULES).map(([key, module]) => ({
          label: module.name,
          description: module.description,
          value: key,
          emoji: module.emoji,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('⚙️ Configuration des Modules')
      .setDescription(
        '**Sélectionnez le module que vous souhaitez configurer dans le menu déroulant ci-dessous.**\n\n' +
        '**Modules disponibles :**\n' +
        Object.values(MODULES).map(m => `${m.emoji} **${m.name}** — ${m.description}`).join('\n')
      )
      .setFooter({ text: 'Les modifications sont sauvegardées instantanément' })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: ['Ephemeral'],
    });

    // Listen for select menu interaction
    const collector = interaction.channel?.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId === 'config_module_select',
      time: 120_000, // 2 minutes
    });

    collector?.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
      const moduleKey = selectInteraction.values[0];
      const moduleConfig = MODULES[moduleKey];

      // Build modal
      const modal = new ModalBuilder()
        .setCustomId(`config_modal_${moduleKey}`)
        .setTitle(`🔧 Configuration ${moduleConfig.name}`);

      const rows: ActionRowBuilder<TextInputBuilder>[] = [];

      for (const field of moduleConfig.fields) {
        const input = new TextInputBuilder()
          .setCustomId(field.id)
          .setLabel(field.label)
          .setPlaceholder(field.placeholder)
          .setRequired(field.required)
          .setStyle(field.style || TextInputStyle.Short);

        if (field.maxLength) {
          input.setMaxLength(field.maxLength);
        }

        rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      }

      modal.addComponents(...rows);

      await selectInteraction.showModal(modal);

      // Listen for modal submit
      const modalFilter = (i: ModalSubmitInteraction) =>
        i.customId === `config_modal_${moduleKey}` && i.user.id === interaction.user.id;

      try {
        const modalSubmit = await selectInteraction.awaitModalSubmit({
          filter: modalFilter,
          time: 300_000, // 5 minutes
        });

        await this.handleModalSubmit(modalSubmit, moduleKey, context);
      } catch (error) {
        // Modal timeout or error (user closed it)
        logger.debug('Modal submit timeout or cancelled');
      }
    });
  }

  private async handleModalSubmit(
    interaction: ModalSubmitInteraction,
    moduleKey: string,
    context: ICommandContext
  ): Promise<void> {
    const guildId = interaction.guildId!;
    const moduleConfig = MODULES[moduleKey];

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const client = await context.database.getClient();
    try {
      await client.query('BEGIN');

      // Ensure guild exists
      await client.query(
        `INSERT INTO guilds (guild_id, owner_id)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId, interaction.guild!.ownerId]
      );

      // Lock row
      const currentConfig = await client.query(
        'SELECT config FROM guild_modules WHERE guild_id = $1 AND module_name = $2 FOR UPDATE',
        [guildId, moduleKey]
      );

      let settings = currentConfig.rows[0]?.config || {};
      const updates: string[] = [];

      // Process each field
      for (const field of moduleConfig.fields) {
        const value = interaction.fields.getTextInputValue(field.id).trim();
        if (!value && !field.required) continue;

        // Parse and validate
        const parsed = this.parseValue(field.id, value, settings);
        if (parsed.error) {
          await client.query('ROLLBACK');
          await interaction.editReply({ content: `❌ ${parsed.error}` });
          return;
        }

        // Validate permissions for channel/category fields
        if (parsed.needsPermissionCheck && parsed.value) {
          const permCheck = await this.validateChannelPermissions(
            interaction,
            parsed.value as string,
            field.id
          );
          if (permCheck.error) {
            await client.query('ROLLBACK');
            await interaction.editReply({ content: `❌ ${permCheck.error}` });
            return;
          }
        }

        if (parsed.value !== undefined) {
          settings[field.id] = parsed.value;
          updates.push(parsed.display || `${field.label}: **${parsed.value}**`);
        }
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        await interaction.editReply({ content: '❌ Aucune modification détectée.' });
        return;
      }

      // Update database
      await client.query(
        `INSERT INTO guild_modules (guild_id, module_name, config, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (guild_id, module_name)
         DO UPDATE SET config = $3, updated_at = NOW()`,
        [guildId, moduleKey, JSON.stringify(settings)]
      );

      await client.query('COMMIT');

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`✅ ${moduleConfig.emoji} ${moduleConfig.name} — Configuration mise à jour`)
        .setDescription(updates.join('\n'))
        .setFooter({ text: `Mis à jour par ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`Config updated for ${moduleKey} in guild ${guildId} by ${interaction.user.tag}`);

      // Audit log (non-blocking)
      try {
        await context.database.query(
          'INSERT INTO audit_logs (guild_id, user_id, action_type, metadata) VALUES ($1, $2, $3, $4)',
          [guildId, interaction.user.id, 'CONFIG_UPDATED', JSON.stringify({ module: moduleKey, updates })]
        );
      } catch (auditError) {
        logger.warn('Failed to create audit log (non-critical):', auditError);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating config:', error);
      await interaction.editReply({ content: '❌ Erreur lors de la mise à jour de la configuration.' });
    } finally {
      client.release();
    }
  }

  private parseValue(
    fieldId: string,
    value: string,
    currentSettings: Record<string, unknown>
  ): {
    value?: unknown;
    display?: string;
    error?: string;
    needsPermissionCheck?: boolean;
  } {
    // Boolean fields
    if (fieldId === 'enabled' || fieldId === 'auto_moderate' || fieldId === 'stack_roles' || fieldId === 'allow_filters') {
      if (value !== 'true' && value !== 'false') {
        return { error: `${fieldId} doit être "true" ou "false"` };
      }
      return { value: value === 'true', display: `${fieldId}: **${value}**` };
    }

    // Integer fields
    const intFields = [
      'max_warns', 'spam_threshold', 'daily_amount', 'xp_per_message', 'xp_cooldown',
      'default_volume', 'max_queue_size', 'response_chance', 'start_gold', 'start_health',
      'daily_reward', 'auto_close_hours', 'min_account_age_days', 'min_server_age_days'
    ];
    if (intFields.includes(fieldId)) {
      const num = parseInt(value, 10);
      if (isNaN(num)) {
        return { error: `${fieldId} doit être un nombre entier` };
      }
      return { value: num, display: `${fieldId}: **${num}**` };
    }

    // Float fields
    if (fieldId === 'toxicity_threshold') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 1) {
        return { error: 'Seuil de toxicité doit être entre 0.0 et 1.0' };
      }
      return { value: num, display: `Seuil toxicité: **${num}**` };
    }

    // Work range (special case)
    if (fieldId === 'work_range') {
      const match = value.match(/^(\d+)-(\d+)$/);
      if (!match) {
        return { error: 'Format invalide pour work_range (ex: 50-500)' };
      }
      const [_, minStr, maxStr] = match;
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      if (min > max) {
        return { error: `work_min (${min}) ne peut pas être supérieur à work_max (${max})` };
      }
      return {
        value: { work_min: min, work_max: max },
        display: `Récompense work: **${min}-${max}**`,
      };
    }

    // Channel/Role/Category IDs
    const idFields = [
      'log_channel', 'mute_role', 'level_up_channel', 'dj_role', 'chat_channel',
      'quest_channel', 'category', 'support_role', 'transcript_channel', 'ping_role'
    ];
    if (idFields.includes(fieldId)) {
      if (!/^\d{17,20}$/.test(value)) {
        return { error: `${fieldId} doit être un ID Discord valide (17-20 chiffres)` };
      }
      const needsCheck = fieldId.includes('channel') || fieldId === 'category';
      const display = fieldId.includes('role')
        ? `${fieldId}: <@&${value}>`
        : `${fieldId}: <#${value}>`;
      return { value, display, needsPermissionCheck: needsCheck };
    }

    // String fields
    return { value, display: `${fieldId}: **${value}**` };
  }

  private async validateChannelPermissions(
    interaction: ModalSubmitInteraction,
    channelId: string,
    fieldId: string
  ): Promise<{ error?: string }> {
    try {
      const channel = await interaction.guild!.channels.fetch(channelId);
      if (!channel) {
        return { error: `Salon/Catégorie ${channelId} introuvable` };
      }

      const me = interaction.guild!.members.me!;

      if (channel.type === ChannelType.GuildCategory) {
        const perms = channel.permissionsFor(me);
        if (!perms?.has(['ManageChannels', 'ViewChannel'])) {
          return { error: `Je n'ai pas la permission de gérer la catégorie <#${channelId}>` };
        }
      } else if (channel.type === ChannelType.GuildText) {
        const perms = channel.permissionsFor(me);
        const needed = fieldId === 'transcript_channel'
          ? ['SendMessages', 'ViewChannel', 'AttachFiles']
          : ['SendMessages', 'ViewChannel'];
        if (!perms?.has(needed)) {
          return { error: `Je n'ai pas les permissions nécessaires dans <#${channelId}>` };
        }
      }

      return {};
    } catch (error) {
      return { error: `Impossible de vérifier le salon/catégorie ${channelId}` };
    }
  }
}
