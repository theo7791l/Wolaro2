import {
  Client,
  Interaction,
  ChatInputCommandInteraction,
  REST,
  Routes,
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

      // FIX: utiliser config.token et config.clientId (pas config.discord.*)
      const rest = new REST({ version: '10' }).setToken(config.token);

      logger.info(`Started refreshing ${commandData.length} application (/) commands.`);

      // Register globally
      await rest.put(Routes.applicationCommands(config.clientId), {
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

      // FIX: Retirer la vérification "module enabled" - tout le monde peut utiliser tous les modules
      // Seuls les Master Admins peuvent utiliser des modules désactivés si nécessaire
      // Cette vérification bloquait tout le monde inutilement

      // FIX: Vérifier les permissions DISCORD uniquement (pas les perms du bot)
      // Tout le monde peut utiliser toutes les commandes SAUF :
      // 1. Commandes [master] (réservées aux Master Admins du bot)
      // 2. Commandes de modération (nécessitent les perms Discord)
      if (command.permissions && guildId) {
        // Vérifier si c'est un Master Admin du BOT (bypass total)
        const isMaster = SecurityManager.isMaster(user.id);
        
        if (!isMaster) {
          // Pour les non-Master : vérifier les perms DISCORD du serveur
          const member = await interaction.guild?.members.fetch(user.id);
          if (member && !member.permissions.has(command.permissions)) {
            await interaction.reply({
              content: '❌ Vous n\'avez pas les permissions Discord nécessaires pour cette commande.',
              ephemeral: true,
            });
            return;
          }
        }
      }

      // FIX: Vérifier si la commande est réservée aux Master Admins [master]
      // Si command.masterOnly existe et est à true, bloquer les non-Master
      if ((command as any).masterOnly && !SecurityManager.isMaster(user.id)) {
        await interaction.reply({
          content: '❌ Cette commande est réservée aux administrateurs du bot.',
          ephemeral: true,
        });
        return;
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
        const { allowed } = await this.redis.checkRateLimit(rateLimitKey, 10, 60);
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
