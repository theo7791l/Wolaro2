import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { TicketCommand } from './commands/ticket';
import { CloseCommand } from './commands/close';
import { AddUserCommand } from './commands/add';
import { RemoveUserCommand } from './commands/remove';
import { TranscriptCommand } from './commands/transcript';
import { TicketButtonHandler } from './events/ticket-buttons';
import { z } from 'zod';

export const TicketsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  categoryId: z.string().optional(),
  supportRoles: z.array(z.string()).default([]),
  transcriptsChannel: z.string().optional(),
  maxTicketsPerUser: z.number().min(1).max(10).default(3),
  autoCloseInactive: z.boolean().default(true),
  inactivityTimeout: z.number().min(3600).max(604800).default(86400),
  ticketPrefix: z.string().default('ticket'),
});

export default class TicketsModule implements IModule {
  name = 'tickets';
  description = 'Système de tickets de support avec transcripts';
  version = '1.0.0';
  author = 'Wolaro';
  configSchema = TicketsConfigSchema;
  defaultConfig = {
    enabled: true,
    supportRoles: [],
    maxTicketsPerUser: 3,
    autoCloseInactive: true,
    inactivityTimeout: 86400,
    ticketPrefix: 'ticket',
  };

  commands = [
    new TicketCommand(),
    new CloseCommand(),
    new AddUserCommand(),
    new RemoveUserCommand(),
    new TranscriptCommand(),
  ];

  events = [
    new TicketButtonHandler(),
  ];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
