import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

/**
 * Auto-Update Manager for Wolaro
 * Handles npm updates and bot restarts
 * Only accessible by Master Admins via /update command
 */
export class UpdateManager {
  private static isUpdating = false;

  /**
   * Check if an update is currently in progress
   */
  static isUpdateInProgress(): boolean {
    return this.isUpdating;
  }

  /**
   * Check for available updates
   * Returns list of outdated packages
   */
  static async checkForUpdates(): Promise<{ hasUpdates: boolean; packages: string[] }> {
    try {
      const { stdout } = await execAsync('npm outdated --json 2>/dev/null || echo "{}"');
      const outdated = JSON.parse(stdout || '{}');
      const packages = Object.keys(outdated);
      return {
        hasUpdates: packages.length > 0,
        packages,
      };
    } catch {
      return { hasUpdates: false, packages: [] };
    }
  }

  /**
   * Get current bot version from package.json
   */
  static getVersion(): string {
    try {
      const pkg = require('../../package.json');
      return pkg.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Pull latest code from git repository
   */
  static async gitPull(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync('git pull origin main');
      logger.info('Git pull completed:', stdout);
      return { success: true, output: stdout || stderr };
    } catch (error: any) {
      logger.error('Git pull failed:', error);
      return { success: false, output: error.message || 'Git pull failed' };
    }
  }

  /**
   * Run npm install to install new dependencies
   */
  static async npmInstall(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout } = await execAsync('npm install --production 2>&1');
      logger.info('npm install completed');
      return { success: true, output: stdout };
    } catch (error: any) {
      logger.error('npm install failed:', error);
      return { success: false, output: error.message || 'npm install failed' };
    }
  }

  /**
   * Build TypeScript code
   */
  static async build(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync('npm run build 2>&1');
      logger.info('Build completed');
      return { success: true, output: stdout || stderr };
    } catch (error: any) {
      logger.error('Build failed:', error);
      return { success: false, output: error.message || 'Build failed' };
    }
  }

  /**
   * Full update sequence:
   * 1. git pull
   * 2. npm install
   * 3. npm run build
   * 4. Graceful restart via PM2
   */
  static async performUpdate(requestedBy: string): Promise<{
    success: boolean;
    steps: { name: string; success: boolean; output: string }[];
  }> {
    if (this.isUpdating) {
      return {
        success: false,
        steps: [{ name: 'check', success: false, output: 'Update already in progress' }],
      };
    }

    this.isUpdating = true;
    logger.warn(`Update initiated by Master Admin: ${requestedBy}`);

    const steps: { name: string; success: boolean; output: string }[] = [];

    try {
      // Step 1: Git pull
      const gitResult = await this.gitPull();
      steps.push({ name: 'git pull', ...gitResult });
      if (!gitResult.success) {
        this.isUpdating = false;
        return { success: false, steps };
      }

      // Step 2: npm install
      const installResult = await this.npmInstall();
      steps.push({ name: 'npm install', ...installResult });
      if (!installResult.success) {
        this.isUpdating = false;
        return { success: false, steps };
      }

      // Step 3: Build
      const buildResult = await this.build();
      steps.push({ name: 'npm run build', ...buildResult });
      if (!buildResult.success) {
        this.isUpdating = false;
        return { success: false, steps };
      }

      // Step 4: Restart via PM2 (graceful)
      setTimeout(() => {
        try {
          logger.info('Restarting bot via PM2...');
          execSync('pm2 restart wolaro --update-env');
        } catch {
          // PM2 not available - manual restart needed
          logger.warn('PM2 not available - manual restart required');
          process.exit(0);
        }
      }, 3000); // 3 second delay to send Discord response first

      steps.push({ name: 'pm2 restart', success: true, output: 'Restart scheduled in 3s' });
      return { success: true, steps };
    } catch (error: any) {
      logger.error('Update failed:', error);
      this.isUpdating = false;
      steps.push({ name: 'error', success: false, output: error.message });
      return { success: false, steps };
    }
  }

  /**
   * Quick restart without update (Master Admin only)
   */
  static async restart(requestedBy: string): Promise<void> {
    logger.warn(`Bot restart requested by Master Admin: ${requestedBy}`);
    setTimeout(() => {
      try {
        execSync('pm2 restart wolaro');
      } catch {
        process.exit(0);
      }
    }, 2000);
  }

  /**
   * Get system information
   */
  static getSystemInfo(): Record<string, string> {
    try {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      return {
        version: this.getVersion(),
        nodeVersion: process.version,
        platform: process.platform,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        pid: process.pid.toString(),
      };
    } catch {
      return { error: 'Failed to get system info' };
    }
  }
}
