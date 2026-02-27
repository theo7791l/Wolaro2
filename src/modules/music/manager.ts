import { Shoukaku, Connectors } from 'shoukaku';
import { Client } from 'discord.js';
import { logger } from '../../utils/logger';

export let shoukaku: Shoukaku;
export const players = new Map<string, any>();

export function initializeMusicManager(client: Client) {
  shoukaku = new Shoukaku(
    new Connectors.DiscordJS(client),
    [
      {
        name: 'main',
        url: 'lava-v3.ajieblogs.eu.org:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true,
      },
    ],
    {
      moveOnDisconnect: false,
      resume: false,
      resumeTimeout: 30,
      reconnectTries: 2,
      restTimeout: 10000,
    }
  );

  shoukaku.on('ready', (name: string) => {
    logger.info(`✅ Lavalink node "${name}" connected`);
  });

  shoukaku.on('error', (name: string, error: any) => {
    logger.error(`❌ Lavalink node "${name}" error:`, error);
  });

  shoukaku.on('close', (name: string, code: number, reason: string) => {
    logger.warn(`⚠️ Lavalink node "${name}" closed: ${code} - ${reason}`);
  });

  shoukaku.on('disconnect', (name: string, count: number) => {
    logger.warn(`⚠️ Lavalink node "${name}" disconnected (${count} tries)`);
  });

  logger.info('🎵 Music manager initialized with Shoukaku');
}

export function getShoukaku(): Shoukaku {
  if (!shoukaku) {
    throw new Error('Shoukaku not initialized');
  }
  return shoukaku;
}
