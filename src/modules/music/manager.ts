import { Manager } from 'erela.js';
import { Client } from 'discord.js';
import { logger } from '../../utils/logger';
import Deezer from 'erela.js-deezer';

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
    send: (id, payload) => {
      const guild = client.guilds.cache.get(id);
      if (guild) guild.shard.send(payload);
    },
    plugins: [new Deezer()],
  });

  // Events
  musicManager.on('nodeConnect', (node) => {
    logger.info(`✅ Lavalink node "${node.options.identifier}" connected`);
  });

  musicManager.on('nodeError', (node, error) => {
    logger.error(`❌ Lavalink node "${node.options.identifier}" error:`, error);
  });

  musicManager.on('nodeDisconnect', (node) => {
    logger.warn(`⚠️ Lavalink node "${node.options.identifier}" disconnected`);
  });

  musicManager.on('trackStart', (player, track) => {
    logger.info(`🎵 Playing: ${track.title} by ${track.author}`);
    
    const channel = client.channels.cache.get(player.textChannel!);
    if (channel && channel.isTextBased()) {
      channel.send(`🎶 En lecture : **${track.title}** par **${track.author}**`).catch(() => {});
    }
  });

  musicManager.on('queueEnd', (player) => {
    logger.info('Queue ended, leaving voice channel');
    
    const channel = client.channels.cache.get(player.textChannel!);
    if (channel && channel.isTextBased()) {
      channel.send('⏹️ File d\'attente terminée. Je quitte le salon vocal.').catch(() => {});
    }
    
    player.destroy();
  });

  musicManager.on('playerMove', (player, oldChannel, newChannel) => {
    player.voiceChannel = newChannel;
  });

  musicManager.on('trackError', (player, track, error) => {
    logger.error(`Track error: ${track?.title}`, error);
    
    const channel = client.channels.cache.get(player.textChannel!);
    if (channel && channel.isTextBased()) {
      channel.send(`❌ Erreur lors de la lecture de **${track?.title || 'la piste'}**.`).catch(() => {});
    }
  });

  // Raw event handler pour Discord
  client.on('raw', (d: any) => musicManager.updateVoiceState(d));

  // Init manager
  musicManager.init(client.user?.id);
  
  logger.info('🎵 Music manager initialized with Lavalink');
}

export function getMusicManager(): Manager {
  if (!musicManager) {
    throw new Error('Music manager not initialized');
  }
  return musicManager;
}
