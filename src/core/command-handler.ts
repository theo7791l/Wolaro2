import {
  Client,
  Interaction,
  ChatInputCommandInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../cache/redis';
import { ModuleLoader } from './module-loader';
import { SecurityManager } from '../utils/security';
import { logger } from '../utils/logger';
import { config } from '../config';

export class CommandHandler {
  private moduleLoader!: ModuleLoader;

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}

  async initialize(moduleLoader: ModuleLoader): Promise<void> {
    this.moduleLoader = moduleLoader;

    // Register slash commands
    await this.registerSlashCommands();

    // Listen for interactions
    this.client.on('interactionCreate', (interaction) => this.handleInteraction(interaction));

    logger.info('Command handler initialized');
  }

  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = this.moduleLoader.getAllCommands();
      const commandData = commands.map((cmd) => cmd.data.toJSON());

      const rest = new REST({ version: '10' }).setToken(config.discord.token);

      logger.info(`Started refreshing ${commandData.length} application (/) commands.`);

      // Register globally
      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: commandData,
      });

      logger.info(`Successfully registered ${commandData.length} application (/) commands.`);
    } catch (error) {
      logger.error('Failed to register slash commands:', error);
    }
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, user } = interaction;

    try {
      // Get command
      const command = this.moduleLoader.getCommand(commandName);
      if (!command) {
        await interaction.reply({
          content: '❌ Cette commande n\'existe pas.',
          ephemeral: true,
        });
        return;
      }

      // Check if guild only
      if (command.guildOnly && !guildId) {
        await interaction.reply({
          content: '❌ Cette commande ne peut être utilisée que dans un serveur.',
          ephemeral: true,
        });
        return;
      }

      // Check if module is enabled for this guild
      if (guildId && command.module) {
        const isEnabled = await this.moduleLoader.isModuleEnabledForGuild(guildId, command.module);
        if (!isEnabled && !SecurityManager.isMaster(user.id)) {
          await interaction.reply({
            content: `❌ Le module **${command.module}** est désactivé sur ce serveur.`,
            ephemeral: true,
          });
          return;
        }
      }

      // Check permissions (bypass for Master Admins)
      if (!SecurityManager.isMaster(user.id)) {
        if (command.permissions && guildId) {
          const member = await interaction.guild?.members.fetch(user.id);
          if (member && !member.permissions.has(command.permissions)) {
            await interaction.reply({
              content: '❌ Vous n\'avez pas les permissions nécessaires.',
              ephemeral: true,
            });
            return;
          }
        }
      }

      // Check cooldown
      if (command.cooldown && guildId) {
        const cooldownKey = `${guildId}:${user.id}:${commandName}`;
        const hasCooldown = await this.redis.hasCooldown(cooldownKey);
        
        if (hasCooldown && !SecurityManager.isMaster(user.id)) {
          const remaining = await this.redis.getCooldownTTL(cooldownKey);
          await interaction.reply({
            content: `⏱️ Veuillez attendre ${remaining}s avant de réutiliser cette commande.`,
            ephemeral: true,
          });
          return;
        }

        // Set cooldown
        await this.redis.setCooldown(cooldownKey, command.cooldown);
      }

      // Rate limiting
      if (guildId) {
        const rateLimitKey = SecurityManager.getRateLimitKey('user', user.id);
        const { allowed, remaining } = await this.redis.checkRateLimit(rateLimitKey, 10, 60);
        
        if (!allowed && !SecurityManager.isMaster(user.id)) {
          await interaction.reply({
            content: '⚠️ Vous envoyez trop de commandes. Ralentissez !',
            ephemeral: true,
          });
          return;
        }
      }

      // Execute command
      await command.execute(interaction as ChatInputCommandInteraction, {
        database: this.database,
        redis: this.redis,
        client: this.client,
      });

      // Log command usage
      if (guildId) {
        await this.database.logAction(user.id, 'COMMAND_EXECUTE', {
          command: commandName,
          guildId,
        });
      }

      logger.info(`Command ${commandName} executed by ${user.tag} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      
      const errorMessage = '❌ Une erreur est survenue lors de l\'exécution de la commande.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
}
