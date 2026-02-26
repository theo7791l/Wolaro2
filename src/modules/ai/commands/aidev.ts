import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ChannelType,
  PermissionFlagsBits 
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class AIDevCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('aidev')
    .setDescription('🧑‍💻 Configurer le salon Xavier - Assistant développeur IA (GPT-OSS-120B)')
    .addChannelOption((option) =>
      option
        .setName('salon')
        .setDescription('Salon où Xavier répondra automatiquement (vide = désactiver)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder;

  module = 'ai';
  guildOnly = true;
  cooldown = 3;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const channel = interaction.options.getChannel('salon');

    try {
      // Récupérer la config actuelle du module AI
      const configRows = await context.database.query(
        'SELECT config FROM guild_modules WHERE guild_id = $1 AND module_name = $2',
        [interaction.guildId, 'ai']
      );

      let config = configRows[0]?.config || {};

      // Si aucun salon spécifié, désactiver Xavier
      if (!channel) {
        delete config.devChannel;
        
        await context.database.query(
          `INSERT INTO guild_modules (guild_id, module_name, config)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, module_name)
           DO UPDATE SET config = $3, updated_at = NOW()`,
          [interaction.guildId, 'ai', JSON.stringify(config)]
        );

        const embed = new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle('🚫 Xavier désactivé')
          .setDescription(
            'Xavier ne répondra plus automatiquement dans aucun salon.\n\n' +
            'Pour le réactiver, utilisez `/aidev salon:#votre-salon`'
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Configurer le salon pour Xavier
      config.devChannel = channel.id;

      await context.database.query(
        `INSERT INTO guild_modules (guild_id, module_name, config)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, module_name)
         DO UPDATE SET config = $3, updated_at = NOW()`,
        [interaction.guildId, 'ai', JSON.stringify(config)]
      );

      const embed = new EmbedBuilder()
        .setColor(0x7289da)
        .setTitle('✅ Xavier activé !')
        .setDescription(
          `🧑‍💻 **Xavier** répondra automatiquement dans ${channel}\n\n` +
          '**Qu\'est-ce que Xavier ?**\n' +
          'Xavier est un assistant développeur IA expert de Wolaro2 qui utilise **GPT-OSS-120B**.\n\n' +
          '**Capacités :**\n' +
          '• Génération de code TypeScript complet\n' +
          '• Debugging et optimisation\n' +
          '• Conseil en architecture\n' +
          '• Connaissance parfaite de Wolaro2\n' +
          '• Support pour le bot ET le panel web\n\n' +
          '**Limites :** 30 req/min, 1000 req/jour\n\n' +
          '💡 *Envoyez simplement vos questions dans ce salon !*'
        )
        .addFields(
          { 
            name: '🔧 Utilisation', 
            value: `Posez vos questions directement dans ${channel}, Xavier répondra automatiquement.` 
          },
          { 
            name: '⚠️ Désactiver', 
            value: 'Utilisez `/aidev` sans sélectionner de salon' 
          }
        )
        .setFooter({ 
          text: `Config par ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL() 
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Log de l'action
      await context.database.logAction(
        interaction.user.id,
        'AIDEV_CONFIG',
        {
          channelId: channel.id,
          channelName: channel.name,
        },
        interaction.guildId!
      );
    } catch (error: any) {
      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('❌ Erreur de configuration')
        .setDescription(`Impossible de configurer Xavier : \`${error.message}\``)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
