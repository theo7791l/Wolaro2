import { Manager } from 'erela.js-apple';
import { Client, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';

export let musicManager: Manager;

export function initializeMusicManager(client: Client) {
  musicManager = new Manager({
    nodes: [
      {
        host: 'lava-v3.ajieblogs.eu.org',
        port: 443,
        password: 'https://dsc.gg/ajidevserver',
        secure: true,
        identifier: 'main-node',
      },
    ],
    send: (id: string, payload: any) => {
      const guild = client.guilds.cache.get(id);
      if (guild) guild.shard.send(payload);
    },
  });

  // Events
  musicManager.on('nodeConnect', (node: any) => {
    logger.info(`✅ Lavalink node "${node.options.identifier}" connected`);
  });

  musicManager.on('nodeError', (node: any, error: any) => {
    logger.error(`❌ Lavalink node "${node.options.identifier}" error:`, error);
  });

  musicManager.on('nodeDisconnect', (node: any) => {
    logger.warn(`⚠️ Lavalink node "${node.options.identifier}" disconnected`);
  });

  musicManager.on('trackStart', (player: any, track: any) => {
    logger.info(`🎵 Playing: ${track.title} by ${track.author}`);
    
    const channel = client.channels.cache.get(player.textChannel) as TextChannel;
    if (channel?.isTextBased()) {
      channel.send(`🎶 En lecture : **${track.title}** par **${track.author}**`).catch(() => {});
    }
  });

  musicManager.on('queueEnd', (player: any) => {
    logger.info('Queue ended, leaving voice channel');
    
    const channel = client.channels.cache.get(player.textChannel) as TextChannel;
    if (channel?.isTextBased()) {
      channel.send('⏹️ File d\'attente terminée. Je quitte le salon vocal.').catch(() => {});
    }
    
    player.destroy();
  });

  musicManager.on('playerMove', (player: any, oldChannel: string, newChannel: string) => {
    player.voiceChannel = newChannel;
  });

  musicManager.on('trackError', (player: any, track: any, error: any) => {
    logger.error(`Track error: ${track?.title}`, error);
    
    const channel = client.channels.cache.get(player.textChannel) as TextChannel;
    if (channel?.isTextBased()) {
      channel.send(`❌ Erreur lors de la lecture de **${track?.title || 'la piste'}**.`).catch(() => {});
    }
  });

  // Raw event handler pour Discord
  client.on('raw', (d: any) => musicManager.updateVoiceState(d));

  // Init manager
  musicManager.init(client.user?.id || '');
  
  logger.info('🎵 Music manager initialized with Lavalink (erela.js-apple)');
}

export function getMusicManager(): Manager {
  if (!musicManager) {
    throw new Error('Music manager not initialized');
  }
  return musicManager;
}
