import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { RPGManager } from '../utils/manager';

export class ProfileCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgprofile')
    .setDescription('Voir votre profil RPG')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Utilisateur dont voir le profil')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const target = interaction.options.getUser('utilisateur') || interaction.user;

    try {
      const profile = await RPGManager.getOrCreateProfile(
        interaction.guildId!,
        target.id,
        context.database
      );

      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`⚔️ Profil RPG de ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '🎯 Niveau', value: `${profile.level}`, inline: true },
          { name: '✨ XP', value: `${profile.xp}/${profile.xpToNextLevel}`, inline: true },
          { name: '💰 Or', value: `${profile.gold}`, inline: true },
          { name: '❤️ Santé', value: `${profile.health}/${profile.maxHealth}`, inline: true },
          { name: '⚔️ Attaque', value: `${profile.attack}`, inline: true },
          { name: '🛡️ Défense', value: `${profile.defense}`, inline: true },
          { name: '🏆 Victoires', value: `${profile.wins}`, inline: true },
          { name: '💀 Défaites', value: `${profile.losses}`, inline: true },
          { name: '🎖️ Ratio', value: `${profile.winRate}%`, inline: true }
        )
        .setFooter({ text: `Classe: ${profile.class || 'Aventurier'}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: '❌ Impossible de charger le profil RPG.',
        ephemeral: true,
      });
    }
  }
}
