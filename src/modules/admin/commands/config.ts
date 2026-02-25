import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
  CategoryChannel,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { pool } from '../../../database/manager.js';
import { logger } from '../../../utils/logger.js';

export class ConfigCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Configure bot modules for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    
    // Moderation module
    .addSubcommand((sub) =>
      sub
        .setName('moderation')
        .setDescription('Configure moderation module')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable moderation module'))
        .addChannelOption((opt) =>
          opt
            .setName('log_channel')
            .setDescription('Channel for moderation logs')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption((opt) => opt.setName('mute_role').setDescription('Role to assign when muting users'))
        .addIntegerOption((opt) =>
          opt.setName('max_warns').setDescription('Max warnings before auto-action').setMinValue(1).setMaxValue(10)
        )
        .addBooleanOption((opt) => opt.setName('auto_mod').setDescription('Enable auto-moderation'))
        .addIntegerOption((opt) =>
          opt
            .setName('spam_threshold')
            .setDescription('Messages per 5s to trigger anti-spam')
            .setMinValue(3)
            .setMaxValue(20)
        )
    )
    
    // Economy module
    .addSubcommand((sub) =>
      sub
        .setName('economy')
        .setDescription('Configure economy module')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable economy module'))
        .addStringOption((opt) =>
          opt.setName('currency_name').setDescription('Name of the currency (e.g., "coins")')
        )
        .addStringOption((opt) =>
          opt.setName('currency_symbol').setDescription('Symbol of the currency (e.g., "🪙")')
        )
        .addIntegerOption((opt) =>
          opt
            .setName('daily_amount')
            .setDescription('Daily reward amount')
            .setMinValue(100)
            .setMaxValue(10000)
        )
        .addIntegerOption((opt) =>
          opt.setName('work_min').setDescription('Minimum work reward').setMinValue(10).setMaxValue(1000)
        )
        .addIntegerOption((opt) =>
          opt.setName('work_max').setDescription('Maximum work reward').setMinValue(100).setMaxValue(10000)
        )
    )
    
    // Leveling module
    .addSubcommand((sub) =>
      sub
        .setName('leveling')
        .setDescription('Configure leveling module')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable leveling module'))
        .addIntegerOption((opt) =>
          opt
            .setName('xp_per_message')
            .setDescription('XP gained per message')
            .setMinValue(10)
            .setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('xp_cooldown')
            .setDescription('Cooldown between XP gains (seconds)')
            .setMinValue(30)
            .setMaxValue(300)
        )
        .addChannelOption((opt) =>
          opt
            .setName('level_up_channel')
            .setDescription('Channel for level-up announcements')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption((opt) =>
          opt.setName('stack_roles').setDescription('Stack role rewards (keep previous roles)')
        )
    )
    
    // Music module
    .addSubcommand((sub) =>
      sub
        .setName('music')
        .setDescription('Configure music module')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable music module'))
        .addIntegerOption((opt) =>
          opt
            .setName('default_volume')
            .setDescription('Default music volume (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('max_queue_size')
            .setDescription('Maximum queue size')
            .setMinValue(10)
            .setMaxValue(500)
        )
        .addBooleanOption((opt) => opt.setName('allow_filters').setDescription('Allow audio filters (bass boost, etc.)'))
        .addRoleOption((opt) => opt.setName('dj_role').setDescription('DJ role (bypass some restrictions)'))
    )
    
    // AI module
    .addSubcommand((sub) =>
      sub
        .setName('ai')
        .setDescription('Configure AI module (Gemini)')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable AI module'))
        .addChannelOption((opt) =>
          opt
            .setName('chat_channel')
            .setDescription('Channel for AI auto-responses')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption((opt) => opt.setName('auto_moderate').setDescription('Enable AI auto-moderation'))
        .addNumberOption((opt) =>
          opt
            .setName('toxicity_threshold')
            .setDescription('Toxicity threshold (0.0-1.0, float value for AI analysis)')
            .setMinValue(0.0)
            .setMaxValue(1.0)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('response_chance')
            .setDescription('Chance of AI responding in chat channel (%)')
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    
    // RPG module
    .addSubcommand((sub) =>
      sub
        .setName('rpg')
        .setDescription('Configure RPG module')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable RPG module'))
        .addIntegerOption((opt) =>
          opt
            .setName('start_gold')
            .setDescription('Starting gold for new players')
            .setMinValue(0)
            .setMaxValue(10000)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('start_health')
            .setDescription('Starting health for new players')
            .setMinValue(50)
            .setMaxValue(500)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('daily_reward')
            .setDescription('Daily RPG reward')
            .setMinValue(100)
            .setMaxValue(5000)
        )
        .addChannelOption((opt) =>
          opt
            .setName('quest_channel')
            .setDescription('Channel for quest announcements')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    
    // Tickets module
    .addSubcommand((sub) =>
      sub
        .setName('tickets')
        .setDescription('Configure tickets module')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable tickets module'))
        .addChannelOption((opt) =>
          opt
            .setName('category')
            .setDescription('Category for ticket channels')
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption((opt) => opt.setName('support_role').setDescription('Support role (can view tickets)'))
        .addChannelOption((opt) =>
          opt
            .setName('transcript_channel')
            .setDescription('Channel for ticket transcripts')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('auto_close_hours')
            .setDescription('Auto-close tickets after X hours of inactivity')
            .setMinValue(1)
            .setMaxValue(168)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('max_per_user')
            .setDescription('Max open tickets per user')
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    
    // Giveaways module
    .addSubcommand((sub) =>
      sub
        .setName('giveaways')
        .setDescription('Configure giveaways module')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable/disable giveaways module'))
        .addRoleOption((opt) => opt.setName('ping_role').setDescription('Role to ping for new giveaways'))
        .addIntegerOption((opt) =>
          opt
            .setName('min_account_age_days')
            .setDescription('Minimum account age to participate (days)')
            .setMinValue(0)
            .setMaxValue(365)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('min_server_age_days')
            .setDescription('Minimum server join age to participate (days)')
            .setMinValue(0)
            .setMaxValue(90)
        )
    ) as SlashCommandBuilder;

  module = 'admin';
  guildOnly = true;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // FIX BUG #2: Ensure guild exists to avoid FK violation
      await client.query(
        `INSERT INTO guilds (guild_id, guild_name, joined_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId, interaction.guild!.name]
      );

      // FIX BUG #3: Lock row to prevent race conditions
      const currentConfig = await client.query(
        'SELECT guild_settings FROM guild_modules WHERE guild_id = $1 AND module_name = $2 FOR UPDATE',
        [guildId, subcommand]
      );

      let settings = currentConfig.rows[0]?.guild_settings || {};
      const updates: string[] = [];

      // Process all options based on subcommand
      switch (subcommand) {
        case 'moderation':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          
          // FIX BUG #5: Verify channel permissions
          if (interaction.options.getChannel('log_channel')) {
            const logChannel = interaction.options.getChannel('log_channel') as TextChannel;
            const permissions = logChannel.permissionsFor(interaction.guild!.members.me!);
            
            if (!permissions?.has(['SendMessages', 'ViewChannel'])) {
              await client.query('ROLLBACK');
              await interaction.reply({
                content: `❌ I don't have permission to send messages in <#${logChannel.id}>.`,
                ephemeral: true,
              });
              return;
            }
            
            settings.log_channel = logChannel.id;
            updates.push(`Log Channel: <#${settings.log_channel}>`);
          }
          
          if (interaction.options.getRole('mute_role')) {
            settings.mute_role = interaction.options.getRole('mute_role')!.id;
            updates.push(`Mute Role: <@&${settings.mute_role}>`);
          }
          if (interaction.options.getInteger('max_warns')) {
            settings.max_warns = interaction.options.getInteger('max_warns');
            updates.push(`Max Warns: **${settings.max_warns}**`);
          }
          if (interaction.options.getBoolean('auto_mod') !== null) {
            settings.auto_mod = interaction.options.getBoolean('auto_mod');
            updates.push(`Auto-Mod: **${settings.auto_mod}**`);
          }
          if (interaction.options.getInteger('spam_threshold')) {
            settings.spam_threshold = interaction.options.getInteger('spam_threshold');
            updates.push(`Spam Threshold: **${settings.spam_threshold}**`);
          }
          break;

        case 'economy':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          if (interaction.options.getString('currency_name')) {
            settings.currency_name = interaction.options.getString('currency_name');
            updates.push(`Currency Name: **${settings.currency_name}**`);
          }
          if (interaction.options.getString('currency_symbol')) {
            settings.currency_symbol = interaction.options.getString('currency_symbol');
            updates.push(`Currency Symbol: **${settings.currency_symbol}**`);
          }
          if (interaction.options.getInteger('daily_amount')) {
            settings.daily_amount = interaction.options.getInteger('daily_amount');
            updates.push(`Daily Amount: **${settings.daily_amount}**`);
          }
          
          // FIX BUG #1: Validate work_min <= work_max
          const workMin = interaction.options.getInteger('work_min');
          const workMax = interaction.options.getInteger('work_max');
          
          if (workMin && workMax && workMin > workMax) {
            await client.query('ROLLBACK');
            await interaction.reply({
              content: `❌ Work minimum (${workMin}) cannot be greater than work maximum (${workMax}).`,
              ephemeral: true,
            });
            return;
          }
          
          if (workMin && settings.work_max && workMin > settings.work_max) {
            await client.query('ROLLBACK');
            await interaction.reply({
              content: `❌ Work minimum (${workMin}) cannot be greater than current work maximum (${settings.work_max}).`,
              ephemeral: true,
            });
            return;
          }
          
          if (workMax && settings.work_min && workMax < settings.work_min) {
            await client.query('ROLLBACK');
            await interaction.reply({
              content: `❌ Work maximum (${workMax}) cannot be less than current work minimum (${settings.work_min}).`,
              ephemeral: true,
            });
            return;
          }
          
          if (workMin) {
            settings.work_min = workMin;
            updates.push(`Work Min: **${settings.work_min}**`);
          }
          if (workMax) {
            settings.work_max = workMax;
            updates.push(`Work Max: **${settings.work_max}**`);
          }
          break;

        case 'leveling':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          if (interaction.options.getInteger('xp_per_message')) {
            settings.xp_per_message = interaction.options.getInteger('xp_per_message');
            updates.push(`XP per Message: **${settings.xp_per_message}**`);
          }
          if (interaction.options.getInteger('xp_cooldown')) {
            settings.xp_cooldown = interaction.options.getInteger('xp_cooldown');
            updates.push(`XP Cooldown: **${settings.xp_cooldown}s**`);
          }
          
          if (interaction.options.getChannel('level_up_channel')) {
            const levelUpChannel = interaction.options.getChannel('level_up_channel') as TextChannel;
            const permissions = levelUpChannel.permissionsFor(interaction.guild!.members.me!);
            
            if (!permissions?.has(['SendMessages', 'ViewChannel'])) {
              await client.query('ROLLBACK');
              await interaction.reply({
                content: `❌ I don't have permission to send messages in <#${levelUpChannel.id}>.`,
                ephemeral: true,
              });
              return;
            }
            
            settings.level_up_channel = levelUpChannel.id;
            updates.push(`Level-Up Channel: <#${settings.level_up_channel}>`);
          }
          
          if (interaction.options.getBoolean('stack_roles') !== null) {
            settings.stack_roles = interaction.options.getBoolean('stack_roles');
            updates.push(`Stack Roles: **${settings.stack_roles}**`);
          }
          break;

        case 'music':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          if (interaction.options.getInteger('default_volume')) {
            settings.default_volume = interaction.options.getInteger('default_volume');
            updates.push(`Default Volume: **${settings.default_volume}%**`);
          }
          if (interaction.options.getInteger('max_queue_size')) {
            settings.max_queue_size = interaction.options.getInteger('max_queue_size');
            updates.push(`Max Queue Size: **${settings.max_queue_size}**`);
          }
          if (interaction.options.getBoolean('allow_filters') !== null) {
            settings.allow_filters = interaction.options.getBoolean('allow_filters');
            updates.push(`Allow Filters: **${settings.allow_filters}**`);
          }
          if (interaction.options.getRole('dj_role')) {
            settings.dj_role = interaction.options.getRole('dj_role')!.id;
            updates.push(`DJ Role: <@&${settings.dj_role}>`);
          }
          break;

        case 'ai':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          
          if (interaction.options.getChannel('chat_channel')) {
            const chatChannel = interaction.options.getChannel('chat_channel') as TextChannel;
            const permissions = chatChannel.permissionsFor(interaction.guild!.members.me!);
            
            if (!permissions?.has(['SendMessages', 'ViewChannel'])) {
              await client.query('ROLLBACK');
              await interaction.reply({
                content: `❌ I don't have permission to send messages in <#${chatChannel.id}>.`,
                ephemeral: true,
              });
              return;
            }
            
            settings.chat_channel = chatChannel.id;
            updates.push(`Chat Channel: <#${settings.chat_channel}>`);
          }
          
          if (interaction.options.getBoolean('auto_moderate') !== null) {
            settings.auto_moderate = interaction.options.getBoolean('auto_moderate');
            updates.push(`Auto-Moderate: **${settings.auto_moderate}**`);
          }
          // FIX BUG #6: Documented as float for AI toxicity analysis
          if (interaction.options.getNumber('toxicity_threshold') !== null) {
            settings.toxicity_threshold = interaction.options.getNumber('toxicity_threshold');
            updates.push(`Toxicity Threshold: **${settings.toxicity_threshold}**`);
          }
          if (interaction.options.getInteger('response_chance')) {
            settings.response_chance = interaction.options.getInteger('response_chance');
            updates.push(`Response Chance: **${settings.response_chance}%**`);
          }
          break;

        case 'rpg':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          if (interaction.options.getInteger('start_gold')) {
            settings.start_gold = interaction.options.getInteger('start_gold');
            updates.push(`Starting Gold: **${settings.start_gold}**`);
          }
          if (interaction.options.getInteger('start_health')) {
            settings.start_health = interaction.options.getInteger('start_health');
            updates.push(`Starting Health: **${settings.start_health}**`);
          }
          if (interaction.options.getInteger('daily_reward')) {
            settings.daily_reward = interaction.options.getInteger('daily_reward');
            updates.push(`Daily Reward: **${settings.daily_reward}**`);
          }
          
          if (interaction.options.getChannel('quest_channel')) {
            const questChannel = interaction.options.getChannel('quest_channel') as TextChannel;
            const permissions = questChannel.permissionsFor(interaction.guild!.members.me!);
            
            if (!permissions?.has(['SendMessages', 'ViewChannel'])) {
              await client.query('ROLLBACK');
              await interaction.reply({
                content: `❌ I don't have permission to send messages in <#${questChannel.id}>.`,
                ephemeral: true,
              });
              return;
            }
            
            settings.quest_channel = questChannel.id;
            updates.push(`Quest Channel: <#${settings.quest_channel}>`);
          }
          break;

        case 'tickets':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          
          if (interaction.options.getChannel('category')) {
            const category = interaction.options.getChannel('category') as CategoryChannel;
            const permissions = category.permissionsFor(interaction.guild!.members.me!);
            
            if (!permissions?.has(['ManageChannels', 'ViewChannel'])) {
              await client.query('ROLLBACK');
              await interaction.reply({
                content: `❌ I don't have permission to manage channels in category <#${category.id}>.`,
                ephemeral: true,
              });
              return;
            }
            
            settings.category = category.id;
            updates.push(`Category: <#${settings.category}>`);
          }
          
          if (interaction.options.getRole('support_role')) {
            settings.support_role = interaction.options.getRole('support_role')!.id;
            updates.push(`Support Role: <@&${settings.support_role}>`);
          }
          
          if (interaction.options.getChannel('transcript_channel')) {
            const transcriptChannel = interaction.options.getChannel('transcript_channel') as TextChannel;
            const permissions = transcriptChannel.permissionsFor(interaction.guild!.members.me!);
            
            if (!permissions?.has(['SendMessages', 'ViewChannel', 'AttachFiles'])) {
              await client.query('ROLLBACK');
              await interaction.reply({
                content: `❌ I don't have permission to send files in <#${transcriptChannel.id}>.`,
                ephemeral: true,
              });
              return;
            }
            
            settings.transcript_channel = transcriptChannel.id;
            updates.push(`Transcript Channel: <#${settings.transcript_channel}>`);
          }
          
          if (interaction.options.getInteger('auto_close_hours')) {
            settings.auto_close_hours = interaction.options.getInteger('auto_close_hours');
            updates.push(`Auto-Close: **${settings.auto_close_hours}h**`);
          }
          if (interaction.options.getInteger('max_per_user')) {
            settings.max_per_user = interaction.options.getInteger('max_per_user');
            updates.push(`Max Per User: **${settings.max_per_user}**`);
          }
          break;

        case 'giveaways':
          if (interaction.options.getBoolean('enabled') !== null) {
            settings.enabled = interaction.options.getBoolean('enabled');
            updates.push(`Enabled: **${settings.enabled}**`);
          }
          if (interaction.options.getRole('ping_role')) {
            settings.ping_role = interaction.options.getRole('ping_role')!.id;
            updates.push(`Ping Role: <@&${settings.ping_role}>`);
          }
          if (interaction.options.getInteger('min_account_age_days') !== null) {
            settings.min_account_age_days = interaction.options.getInteger('min_account_age_days');
            updates.push(`Min Account Age: **${settings.min_account_age_days} days**`);
          }
          if (interaction.options.getInteger('min_server_age_days') !== null) {
            settings.min_server_age_days = interaction.options.getInteger('min_server_age_days');
            updates.push(`Min Server Age: **${settings.min_server_age_days} days**`);
          }
          break;
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        await interaction.reply({
          content: '❌ No options provided. Please specify at least one option to update.',
          ephemeral: true,
        });
        return;
      }

      // Update database within transaction
      await client.query(
        `INSERT INTO guild_modules (guild_id, module_name, guild_settings, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (guild_id, module_name)
         DO UPDATE SET guild_settings = $3, updated_at = NOW()`,
        [guildId, subcommand, JSON.stringify(settings)]
      );

      await client.query('COMMIT');

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`✅ ${subcommand.charAt(0).toUpperCase() + subcommand.slice(1)} Configuration Updated`)
        .setDescription(updates.join('\n'))
        .setFooter({ text: `Updated by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`Config updated for ${subcommand} in guild ${guildId} by ${interaction.user.tag}`);

      // FIX BUG #4: Non-blocking audit log (runs after response)
      try {
        await pool.query(
          'INSERT INTO audit_logs (guild_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
          [guildId, interaction.user.id, 'config_update', JSON.stringify({ module: subcommand, updates })]
        );
      } catch (auditError) {
        logger.warn('Failed to create audit log (non-critical):', auditError);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating config:', error);
      await interaction.reply({
        content: '❌ An error occurred while updating configuration.',
        ephemeral: true,
      });
    } finally {
      client.release();
    }
  }
}
