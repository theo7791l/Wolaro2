import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../../../config';

const execAsync = promisify(exec);

export class UpdateCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('update')
    .setDescription('[MASTER ADMIN] Update bot from GitHub and restart')
    .addBooleanOption((option) =>
      option
        .setName('force')
        .setDescription('Force update even if no changes detected')
        .setRequired(false)
    ) as SlashCommandBuilder;

  module = 'admin';
  ownerOnly = true;
  cooldown = 30;

  async execute(interaction: ChatInputCommandInteraction, _context: ICommandContext): Promise<void> {
    // Double check master admin
    if (!config.masterAdmins.includes(interaction.user.id)) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('Access Denied')
        .setDescription('This command is restricted to master administrators only.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const force = interaction.options.getBoolean('force') || false;

    // Initial response
    const initialEmbed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('Update System')
      .setDescription('Checking for updates...')
      .addFields(
        { name: 'Status', value: 'Initializing', inline: true },
        { name: 'Force Update', value: force ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [initialEmbed] });

    try {
      // Check git status
      const { stdout: currentCommit } = await execAsync('git rev-parse --short HEAD');
      const current = currentCommit.trim();

      // Fetch latest
      await execAsync('git fetch origin main');

      const { stdout: remoteCommit } = await execAsync('git rev-parse --short origin/main');
      const remote = remoteCommit.trim();

      // Check if update available
      if (current === remote && !force) {
        const upToDateEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('Update System')
          .setDescription('Bot is already up to date.')
          .addFields(
            { name: 'Current Version', value: `\`${current}\``, inline: true },
            { name: 'Latest Version', value: `\`${remote}\``, inline: true },
            { name: 'Status', value: 'No update needed', inline: false }
          )
          .setFooter({ text: 'Use force:true to force update' })
          .setTimestamp();

        await interaction.editReply({ embeds: [upToDateEmbed] });
        return;
      }

      // Get changelog
      let changelog = 'No changes';
      if (current !== remote) {
        const { stdout: log } = await execAsync(`git log --oneline ${current}..${remote}`);
        const commits = log.trim().split('\n').slice(0, 5);
        changelog = commits.map((c) => `• ${c}`).join('\n') || 'No changes';
      }

      // Update in progress
      const updatingEmbed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('Update System')
        .setDescription('Update in progress...')
        .addFields(
          { name: 'Current Version', value: `\`${current}\``, inline: true },
          { name: 'New Version', value: `\`${remote}\``, inline: true },
          { name: 'Status', value: 'Downloading...', inline: false },
          { name: 'Recent Changes', value: `\`\`\`\n${changelog}\n\`\`\``, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [updatingEmbed] });

      // Run update script
      const { stdout: updateOutput, stderr: updateError } = await execAsync(
        'bash scripts/update.sh',
        { timeout: 120000 } // 2 minutes timeout
      );

      // Parse output for status
      const success = !updateError.includes('Error') && !updateOutput.includes('Error');

      if (success) {
        const successEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('Update Successful')
          .setDescription('Bot has been updated and is restarting...')
          .addFields(
            { name: 'Previous Version', value: `\`${current}\``, inline: true },
            { name: 'New Version', value: `\`${remote}\``, inline: true },
            { name: 'Status', value: 'Restarting...', inline: false },
            { name: 'Recent Changes', value: `\`\`\`\n${changelog}\n\`\`\``, inline: false }
          )
          .setFooter({ text: 'Bot will be back online in a few seconds' })
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        // Give time for message to send before restart
        setTimeout(() => {
          process.exit(0); // PM2 will restart automatically
        }, 2000);
      } else {
        throw new Error('Update script failed');
      }
    } catch (error: any) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('Update Failed')
        .setDescription('An error occurred during the update process.')
        .addFields(
          { name: 'Error', value: `\`\`\`\n${error.message}\n\`\`\``, inline: false },
          { name: 'Recommendation', value: 'Check logs and update manually if needed.', inline: false }
        )
        .setFooter({ text: 'Bot is still running on current version' })
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}
