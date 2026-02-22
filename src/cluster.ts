import cluster from 'cluster';
import os from 'os';
import { logger } from './utils/logger';
import { config } from './config';

if (cluster.isPrimary) {
  const cpuCount = os.cpus().length;
  const workerCount = config.cluster.shardCount === 'auto' ? cpuCount : config.cluster.shardCount;

  logger.info(`Master cluster setting up ${workerCount} workers...`);

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker...');
    cluster.fork();
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received. Shutting down gracefully...');
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received. Shutting down gracefully...');
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
    process.exit(0);
  });
} else {
  // Worker process - start the bot
  require('./index');
  logger.info(`Worker ${process.pid} started`);
}
