import { IEvent } from '../../../types';
import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { logger } from '../../../utils/logger';

export class MessageXPHandler implements IEvent {
  name = 'messageCreate';
  module = 'leveling';

  async execute(message: Message, context: any): Promise<void> {
    if (message.author.bot || !message.guild) return;

    try {
      // Get module config
      const config = await context.database.getGuildConfig(message.guild.id);
      const levelingModule = config?.modules?.find((m: any) => m.module_name === 'leveling');

      if (!levelingModule?.enabled || !levelingModule?.config?.enabled) return;

      const moduleConfig = levelingModule.config;

      // Check if channel/role is blacklisted
      if (moduleConfig.noXpChannels?.includes(message.channel.id)) return;
      
      const member = message.member;
      if (member && moduleConfig.noXpRoles?.some((roleId: string) => member.roles.cache.has(roleId))) {
        return;
      }

      // Check XP cooldown
      const cooldownKey = `xp:${message.guild.id}:${message.author.id}`;
      if (await context.redis.hasCooldown(cooldownKey)) return;

      // Calculate XP gain
      const baseXP = moduleConfig.xpPerMessage || 15;
      const multiplier = moduleConfig.xpMultiplier || 1;
      const randomXP = Math.floor(Math.random() * 10) + 1;
      const xpGain = Math.floor((baseXP + randomXP) * multiplier);

      // Get current stats
      const before = await context.database.query(
        'SELECT global_xp, global_level FROM global_profiles WHERE user_id = $1',
        [message.author.id]
      );

      const oldLevel = before[0]?.global_level || 1;

      // Add XP
      await context.database.updateGlobalXP(message.author.id, xpGain);

      // Get updated stats
      const after = await context.database.query(
        'SELECT global_xp, global_level FROM global_profiles WHERE user_id = $1',
        [message.author.id]
      );

      const newLevel = after[0].global_level;

      // Set cooldown
      const cooldown = moduleConfig.xpCooldown || 60;
      await context.redis.setCooldown(cooldownKey, cooldown);

      // Check for level up
      if (newLevel > oldLevel) {
        await this.handleLevelUp(message, newLevel, moduleConfig, context);
      }
    } catch (error) {
      logger.error('Error in XP handler:', error);
    }
  }

  private async handleLevelUp(
    message: Message,
    newLevel: number,
    config: any,
    _context: any
  ): Promise<void> {
    try {
      // Send level up message
      if (config.levelUpMessage) {
        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎉 Niveau supérieur !')
          .setDescription(`Félicitations ${message.author}, vous êtes maintenant niveau **${newLevel}** !`)
          .setThumbnail(message.author.displayAvatarURL())
          .setTimestamp();

        const channel = config.levelUpChannel
          ? await message.guild!.channels.fetch(config.levelUpChannel)
          : message.channel;

        if (channel && channel.isTextBased()) {
          await (channel as TextChannel).send({ embeds: [embed] });
        }
      }

      // Handle level roles
      if (config.levelRoles && config.levelRoles.length > 0 && message.member) {
        const roleRewards = config.levelRoles.filter((r: any) => r.level === newLevel);
        
        for (const reward of roleRewards) {
          try {
            const role = await message.guild!.roles.fetch(reward.roleId);
            if (role) {
              await message.member.roles.add(role);
              
              // If not stacking, remove lower level roles
              if (!config.stackRoles) {
                const lowerRoles = config.levelRoles
                  .filter((r: any) => r.level < newLevel)
                  .map((r: any) => r.roleId);
                
                for (const lowerRoleId of lowerRoles) {
                  if (message.member.roles.cache.has(lowerRoleId)) {
                    await message.member.roles.remove(lowerRoleId);
                  }
                }
              }

              logger.info(`Gave role ${role.name} to ${message.author.tag} for reaching level ${newLevel}`);
            }
          } catch (error) {
            logger.error('Failed to assign level role:', error);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling level up:', error);
    }
  }
}
