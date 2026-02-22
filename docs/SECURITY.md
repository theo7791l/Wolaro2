# Security Best Practices

## Master Admin System

### Adding Master Admins

1. Add user ID to `.env`:
```env
MASTER_ADMIN_IDS=123456789012345678,987654321098765432
```

2. Or insert directly into database:
```sql
INSERT INTO master_admins (user_id, username, access_level, can_impersonate, can_blacklist)
VALUES ('123456789012345678', 'admin_username', 10, true, true);
```

### Master Admin Capabilities

- **Impersonate**: View any guild's config
- **Blacklist**: Ban guilds from using the bot
- **Force Restart**: Restart bot instances
- **Audit Access**: View all system logs
- **Bypass**: Skip all rate limits and permissions

### Example Usage

```typescript
import { SecurityManager } from './utils/security';

if (SecurityManager.isMaster(userId)) {
  // Grant god-mode access
}
```

## Rate Limiting

### Default Limits

- **IP**: 100 requests/minute
- **User**: 200 requests/minute (authenticated)
- **Guild**: Per-command cooldowns (3-30s)

### Custom Rate Limits

```typescript
const { allowed, remaining, resetAt } = await redis.checkRateLimit(
  'custom:identifier',
  50,  // max requests
  60   // window in seconds
);

if (!allowed) {
  return res.status(429).json({ error: 'Rate limit exceeded', resetAt });
}
```

## Input Validation

### Always Sanitize User Input

```typescript
import { SecurityManager } from './utils/security';

const sanitized = SecurityManager.sanitizeInput(userInput);
```

### Use Zod for Schema Validation

```typescript
import { z } from 'zod';

const schema = z.object({
  username: z.string().min(3).max(32),
  age: z.number().min(13).max(120),
});

try {
  const validated = schema.parse(req.body);
} catch (error) {
  return res.status(400).json({ error: 'Invalid input' });
}
```

## Anti-Raid Protection

### Join Spike Detection

```typescript
const { isSpike, joinCount } = AntiRaidManager.trackJoin(guildId);

if (isSpike) {
  // Trigger lockdown
  await channel.permissionOverwrites.edit(guildId, {
    SendMessages: false,
  });
}
```

### Message Spam Detection

```typescript
const { isSpam, count } = AntiRaidManager.trackMessage(guildId, userId);

if (isSpam) {
  // Auto-timeout user
  await member.timeout(60000, 'Spam detected');
}
```

## Encryption

### Encrypting Sensitive Data

```typescript
const encrypted = SecurityManager.encrypt(sensitiveData);
// Store encrypted in database

const decrypted = SecurityManager.decrypt(encrypted);
// Use decrypted data
```

## JWT Security

### Token Generation

```typescript
import jwt from 'jsonwebtoken';
import { config } from './config';

const token = jwt.sign(
  { userId, username },
  config.api.jwtSecret,
  { expiresIn: '7d' }
);
```

### Token Verification

```typescript
try {
  const decoded = jwt.verify(token, config.api.jwtSecret);
} catch (error) {
  // Invalid or expired token
}
```

## IP Whitelisting

### For Master Admin Access

```env
IP_WHITELIST=127.0.0.1,::1,YOUR_IP_HERE
```

```typescript
if (!SecurityManager.isIPWhitelisted(req.ip)) {
  return res.status(403).json({ error: 'IP not whitelisted' });
}
```

## Database Security

### Use Parameterized Queries

```typescript
// Good - Protected from SQL injection
await database.query(
  'SELECT * FROM guilds WHERE guild_id = $1',
  [guildId]
);

// Bad - Vulnerable to SQL injection
await database.query(
  `SELECT * FROM guilds WHERE guild_id = '${guildId}'`
);
```

### Connection Security

```env
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
```

## Audit Logging

### Log All Important Actions

```typescript
await database.logAction(
  userId,
  'GUILD_BLACKLIST',
  { guildId, reason },
  guildId,
  req.ip
);
```

### Query Audit Logs

```sql
SELECT * FROM audit_logs
WHERE action_type = 'MASTER_IMPERSONATE'
ORDER BY timestamp DESC
LIMIT 100;
```

## Production Checklist

- [ ] Change all default passwords
- [ ] Enable SSL/TLS for all connections
- [ ] Set strong JWT secret (min 32 characters)
- [ ] Configure IP whitelist for admin access
- [ ] Enable 2FA for master admins (if implemented)
- [ ] Set up automated backups
- [ ] Configure firewall rules
- [ ] Enable HTTPS for web panel
- [ ] Use environment variables for secrets
- [ ] Set up monitoring and alerts
- [ ] Regular security audits
- [ ] Keep dependencies updated
