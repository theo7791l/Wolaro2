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
    await this.registerSlashCommands();
    this.client.on('interactionCreate', (interaction) => this.handleInteraction(interaction));
    logger.info('Command handler initialized');
  }

  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = this.moduleLoader.getAllCommands();
      const commandData = commands.map((cmd) => cmd.data.toJSON());
      const rest = new REST({ version: '10' }).setToken(config.token);
      logger.info(`Started refreshing ${commandData.length} application (/) commands.`);
      await rest.put(Routes.applicationCommands(config.clientId), { body: commandData });
      logger.info(`Successfully registered ${commandData.length} application (/) commands.`);
    } catch (error) {
      logger.error('Failed to register slash commands:', error);
    }
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, user } = interaction;

    try {
      // 1. Commande existe ?
      const command = this.moduleLoader.getCommand(commandName);
      if (!command) {
        await interaction.reply({ content: '❌ Cette commande n\'existe pas.', ephemeral: true });
        return;
      }

      // 2. Commande réservée aux serveurs ?
      if (command.guildOnly && !guildId) {
        await interaction.reply({
          content: '❌ Cette commande ne peut être utilisée que dans un serveur.',
          ephemeral: true,
        });
        return;
      }

      // 3. FIX CRITIQUE - Vérification ownerOnly (admin bot seulement)
      // Le check utilisait "masterOnly" mais ICommand déclare "ownerOnly" → personne n'était bloqué
      // sur les commandes admin, ET tout le monde semblait bloqué car les commandes normales
      // échouaient sur FK constraint (guild non initialisée). Fix double :
      //   a) Utiliser command.ownerOnly (le bon nom de champ)
      //   b) La sync des guildes dans ready() résout le FK constraint
      if (command.ownerOnly && !SecurityManager.isMaster(user.id)) {
        await interaction.reply({
          content: '❌ Cette commande est réservée aux administrateurs du bot.',
          ephemeral: true,
        });
        return;
      }

      // 4. Vérification des permissions Discord (modération, etc.)
      // Seulement si la commande demande des permissions spécifiques
      if (command.permissions && command.permissions.length > 0 && guildId) {
        if (!SecurityManager.isMaster(user.id)) {
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

      // 5. Cooldown (anti-spam par commande)
      if (command.cooldown && guildId) {
        const cooldownKey = `${guildId}:${user.id}:${commandName}`;
        const hasCooldown = await this.redis.hasCooldown(cooldownKey);
        if (hasCooldown && !SecurityManager.isMaster(user.id)) {
          const remaining = await this.redis.getCooldownTTL(cooldownKey);
          await interaction.reply({
            content: `⏱️ Veuillez attendre **${remaining}s** avant de réutiliser cette commande.`,
            ephemeral: true,
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
            ephemeral: true,
          });
          return;
        }
      }

      // 7. Exécution de la commande
      await command.execute(interaction as ChatInputCommandInteraction, {
        database: this.database,
        redis: this.redis,
        client: this.client,
      });

      // 8. Log de l'exécution
      // FIX: 'COMMAND_EXECUTE' → 'COMMAND_EXECUTED' (ActionType dans types.ts)
      if (guildId) {
        await this.database.logAction(user.id, 'COMMAND_EXECUTED', {
          command: commandName,
          guildId,
        });
      }

      // FIX: user.tag déprécié en discord.js v14 → user.username
      logger.info(`Command /${commandName} executed by ${user.username} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Error executing command /${commandName}:`, error);
      const errorMessage = '❌ Une erreur est survenue lors de l\'exécution de la commande.';
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  }
}
