import {
  Client,
  Interaction,
  ChatInputCommandInteraction,
  REST,
  Routes,
  MessageFlags,
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
    await this.registerSlashCommands();
    this.client.on('interactionCreate', (interaction) => this.handleInteraction(interaction));
    logger.info('Command handler initialized');
  }

  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = this.moduleLoader.getAllCommands();
      const commandData = commands.map((cmd) => cmd.data.toJSON());
      
      const rest = new REST({ version: '10', timeout: 30000 }).setToken(config.token);
      
      logger.info(`Started refreshing ${commandData.length} application (/) commands.`);
      
      // Wrapper avec timeout pour éviter le blocage infini
      const registrationPromise = rest.put(
        Routes.applicationCommands(config.clientId), 
        { body: commandData }
      );
      
      // Timeout de 30 secondes
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Command registration timeout after 30s')), 30000)
      );
      
      await Promise.race([registrationPromise, timeoutPromise]);
      
      logger.info(`✅ Successfully registered ${commandData.length} application (/) commands.`);
    } catch (error: any) {
      logger.error('Failed to register slash commands:', error);
      logger.warn('⚠️ Bot will continue without updating commands. Existing commands will still work.');
      // Ne pas crash le bot, continuer sans mettre à jour les commandes
    }
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, user } = interaction;

    try {
      // 1. Commande existe ?
      const command = this.moduleLoader.getCommand(commandName);
      if (!command) {
        await interaction.reply({ content: '❌ Cette commande n\'existe pas.', flags: MessageFlags.Ephemeral });
        return;
      }

      // 2. Commande réservée aux serveurs ?
      if (command.guildOnly && !guildId) {
        await interaction.reply({
          content: '❌ Cette commande ne peut être utilisée que dans un serveur.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // 3. Vérification ownerOnly (admin bot seulement)
      if (command.ownerOnly && !SecurityManager.isMaster(user.id)) {
        await interaction.reply({
          content: '❌ Cette commande est réservée aux administrateurs du bot.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // 4. Vérification des permissions Discord (modération, etc.)
      if (command.permissions && command.permissions.length > 0 && guildId) {
        if (!SecurityManager.isMaster(user.id)) {
          const member = await interaction.guild?.members.fetch(user.id);
          if (member && !member.permissions.has(command.permissions)) {
            await interaction.reply({
              content: '❌ Vous n\'avez pas les permissions Discord nécessaires pour cette commande.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }
      }

      // 5. Cooldown (anti-spam par commande)
      if (command.cooldown && guildId) {
        const cooldownKey = `${guildId}:${user.id}:${commandName}`;
        const hasCooldown = await this.redis.hasCooldown(cooldownKey);
        if (hasCooldown && !SecurityManager.isMaster(user.id)) {
          const remaining = await this.redis.getCooldownTTL(cooldownKey);
          await interaction.reply({
            content: `⏱️ Veuillez attendre **${remaining}s** avant de réutiliser cette commande.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await this.redis.setCooldown(cooldownKey, command.cooldown);
      }

      // 6. Rate limiting global (10 commandes par minute par user)
      if (guildId) {
        const rateLimitKey = SecurityManager.getRateLimitKey('user', user.id);
        const { allowed } = await this.redis.checkRateLimit(rateLimitKey, 10, 60);
        if (!allowed && !SecurityManager.isMaster(user.id)) {
          await interaction.reply({
            content: '⚠️ Vous envoyez trop de commandes. Ralentissez !',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // 7. FIX: Gestion automatique du defer pour éviter timeout Discord (3s)
      let deferTimeout: NodeJS.Timeout | null = null;
      const shouldAutoDefer = !interaction.deferred && !interaction.replied;
      
      if (shouldAutoDefer) {
        deferTimeout = setTimeout(async () => {
          if (!interaction.deferred && !interaction.replied) {
            try {
              await interaction.deferReply();
              logger.debug(`Auto-deferred reply for /${commandName}`);
            } catch (err) {
              logger.warn(`Failed to auto-defer /${commandName}:`, err);
            }
          }
        }, 2000); // Déferer après 2 secondes si pas encore répondu
      }

      // 8. Exécution de la commande
      try {
        await command.execute(interaction as ChatInputCommandInteraction, {
          database: this.database,
          redis: this.redis,
          client: this.client,
        });
      } finally {
        // Nettoyer le timeout si la commande a répondu rapidement
        if (deferTimeout) {
          clearTimeout(deferTimeout);
        }
      }

      // 9. Log de l'exécution
      if (guildId) {
        await this.database.logAction(user.id, 'COMMAND_EXECUTED', {
          command: commandName,
          guildId,
        });
      }

      logger.info(`Command /${commandName} executed by ${user.username} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Error executing command /${commandName}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
        guildId,
      });
      
      const errorMessage = '❌ Une erreur est survenue lors de l\'exécution de la commande.';
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  }
}
