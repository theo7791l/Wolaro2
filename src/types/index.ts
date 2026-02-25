/**
 * Global Types
 */

import { Client } from 'discord.js';

export interface WolaroModule {
  name: string;
  initialize: (client: Client) => Promise<void>;
  shutdown?: () => Promise<void>;
}
