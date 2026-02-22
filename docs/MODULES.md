# Module Development Guide

## Creating a New Module

### Step 1: Directory Structure

```
src/modules/your-module/
├── index.ts              # Module definition
├── commands/
│   ├── command1.ts
│   └── command2.ts
└── events/
    └── event-handler.ts
```

### Step 2: Module Definition

```typescript
// src/modules/your-module/index.ts
import { Client } from 'discord.js';
import { DatabaseManager } from '../../database/manager';
import { RedisManager } from '../../cache/redis';
import { IModule } from '../../types';
import { z } from 'zod';

export const YourModuleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  someOption: z.string().optional(),
});

export default class YourModule implements IModule {
  name = 'your-module';
  description = 'Description of your module';
  version = '1.0.0';
  author = 'Your Name';
  configSchema = YourModuleConfigSchema;
  defaultConfig = {
    enabled: true,
  };

  commands = [
    // Import and instantiate your commands
  ];

  events = [
    // Import and instantiate your event handlers
  ];

  constructor(
    private client: Client,
    private database: DatabaseManager,
    private redis: RedisManager
  ) {}
}
```

### Step 3: Creating Commands

```typescript
// src/modules/your-module/commands/example.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

export class ExampleCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command')
    .addStringOption((option) =>
      option
        .setName('input')
        .setDescription('Some input')
        .setRequired(true)
    ) as SlashCommandBuilder;

  module = 'your-module';
  permissions = [PermissionFlagsBits.SendMessages];
  guildOnly = true;
  cooldown = 5; // seconds

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const input = interaction.options.getString('input', true);

    // Access database
    const data = await context.database.query(
      'SELECT * FROM some_table WHERE guild_id = $1',
      [interaction.guildId]
    );

    // Access Redis
    await context.redis.set(`key:${interaction.guildId}`, { value: input }, 3600);

    await interaction.reply(`You said: ${input}`);
  }
}
```

### Step 4: Creating Events

```typescript
// src/modules/your-module/events/example-events.ts
import { IEvent } from '../../../types';
import { Message } from 'discord.js';

export class ExampleEventHandler implements IEvent {
  name = 'messageCreate';
  module = 'your-module';
  once = false;

  async execute(message: Message, context: any): Promise<void> {
    if (message.author.bot) return;

    // Your event logic here
    console.log(`Message from ${message.author.tag}: ${message.content}`);
  }
}
```

## Best Practices

### 1. Use TypeScript Strictly

```typescript
// Good
const userId: string = interaction.user.id;

// Bad
const userId = interaction.user.id;
```

### 2. Validate Input with Zod

```typescript
import { z } from 'zod';

const InputSchema = z.object({
  amount: z.number().min(1).max(1000000),
  reason: z.string().max(500),
});

const validated = InputSchema.parse({ amount, reason });
```

### 3. Cache Frequently Accessed Data

```typescript
// Check cache first
const cached = await context.redis.get(`guild:${guildId}:data`);
if (cached) return cached;

// Fallback to database
const data = await context.database.query('...');
await context.redis.set(`guild:${guildId}:data`, data, 3600);
```

### 4. Handle Errors Gracefully

```typescript
try {
  await riskyOperation();
  await interaction.reply('✅ Success!');
} catch (error) {
  logger.error('Operation failed:', error);
  await interaction.reply({
    content: '❌ An error occurred',
    ephemeral: true,
  });
}
```

### 5. Use Embeds for Rich Messages

```typescript
import { EmbedBuilder } from 'discord.js';

const embed = new EmbedBuilder()
  .setColor('#5865F2')
  .setTitle('Title')
  .setDescription('Description')
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: true }
  )
  .setTimestamp();

await interaction.reply({ embeds: [embed] });
```

## Module Configuration

### Accessing Module Config

```typescript
const config = await context.database.getGuildConfig(guildId);
const moduleConfig = config.modules.find(m => m.module_name === 'your-module');

if (moduleConfig?.config?.someOption) {
  // Use the option
}
```

### Updating Module Config (from API)

```http
PATCH /api/modules/:guildId/your-module/config
Authorization: Bearer <token>

{
  "config": {
    "someOption": "new value"
  }
}
```

## Testing Your Module

### 1. Local Testing

```bash
# Start the bot in development mode
npm run dev

# In another terminal, test your commands in Discord
```

### 2. Module Hot Reload

```typescript
// Master admin command to reload a module
await moduleLoader.reloadModule('your-module');
```

### 3. Check Logs

```bash
tail -f logs/combined.log
```

## Publishing Your Module

To make your module available in the Template Store:

1. Export your module configuration:
```typescript
const template = {
  name: 'Your Module Template',
  description: 'Template description',
  modules_included: ['your-module'],
  config_snapshot: moduleConfig,
};
```

2. Submit via API:
```http
POST /api/templates
Authorization: Bearer <token>

{ ...template }
```
