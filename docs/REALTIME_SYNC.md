# Wolaro Real-time Synchronization System

## Architecture Overview

```
┌────────────────────────┐
│  wolaro.fr/panel        │
│  (Frontend - React)     │
│  User clicks "Save"     │
└────────────┬───────────┘
             │ HTTPS
             │
     ┌────────▼──────────┐
     │                      │
     │   1. API Server      │
     │   POST /api/panel   │
     │                      │
     └──────┬───────┬──────┘
           │         │
           │         │
   ┌───────▼────┐  │
   │  2. Database  │  │
   │  (PostgreSQL) │  │
   │  UPDATE ...   │  │
   └──────────────┘  │
                     │
              ┌──────▼───────┐
              │  3. Redis      │
              │  PUBLISH event │
              └──────┬─────┬───┘
                    │     │
       ┌────────────▼─────┌▼────────────┐
       │                         │              │
   ┌───▼─────────────┐   ┌────▼────────────┐
   │  4a. Discord Bot  │   │  4b. WebSocket    │
   │  SUBSCRIBE        │   │  SUBSCRIBE        │
   │  Clear cache      │   │  Forward to panel │
   │  Reload config    │   └───────┬──────────┘
   └──────────────────┘           │ WebSocket
                               │
                    ┌──────────▼──────────┐
                    │  5. Panel UI Update   │
                    │  Real-time refresh    │
                    └─────────────────────┘
```

## Components

### 1. PostgreSQL (Persistent Storage)
**Role**: Source of truth for all configuration
- Stores guild settings, module configs, permissions
- Always written to before Redis
- Bot reads from DB if cache miss

**Tables**:
- `guilds`: Main guild configuration
- `guild_modules`: Module settings per guild
- `guild_members`: User permissions
- `panel_sessions`: Active panel sessions

### 2. Redis (Cache + Pub/Sub)
**Role**: Fast cache and real-time message broker

**Cache Keys** (TTL 1 hour):
```
guild:config:{guildId}       - Full guild configuration
guild:module:{guildId}:{name} - Specific module config
user:permissions:{userId}     - User permissions
```

**Pub/Sub Channels**:
```
config:update       - Guild settings changed
module:toggle       - Module enabled/disabled
guild:reload        - Force full reload
permission:revoked  - User lost admin rights
command:executed    - Command run (for audit logs)
```

### 3. WebSocket Server (Socket.io)
**Role**: Real-time push to panel UI

**Features**:
- JWT authentication
- Auto-join user's guild rooms
- Forward Redis events to connected clients
- Permission enforcement

**Events Emitted to Panel**:
```javascript
'config:updated'     - Settings changed, refresh UI
'module:toggled'     - Module state changed
'guild:reload'       - Full refresh needed
'permission:revoked' - User kicked out
'command:executed'   - Show in real-time logs
```

## Flow Examples

### Example 1: User changes prefix in panel

```typescript
// 1. Panel Frontend
await fetch('https://wolaro.fr/api/panel/guilds/123', {
  method: 'PATCH',
  body: JSON.stringify({ settings: { prefix: '!' } })
});

// 2. API Server (panel.ts)
await database.query(
  'UPDATE guilds SET settings = $1 WHERE guild_id = $2',
  [settings, guildId]
);
await pubsub.publishConfigUpdate(guildId, settings);

// 3. Redis Pub/Sub
REDIS PUBLISH config:update {
  guildId: "123",
  settings: { prefix: "!" },
  timestamp: 1708612800000
}

// 4a. Discord Bot receives
Bot clears cache: guild:config:123
Bot reloads from DB: SELECT * FROM guilds WHERE guild_id = '123'
Bot caches new config (TTL 1h)

// 4b. WebSocket receives
WebSocket forwards to all connected panel users in guild:123 room
io.to('guild:123').emit('config:updated', { settings: {...} })

// 5. Panel UI updates automatically
const socket = io('wss://wolaro.fr');
socket.on('config:updated', (data) => {
  setPrefix(data.settings.prefix); // React state update
});
```

### Example 2: Admin role removed on Discord

```typescript
// 1. Discord Event (guildMemberUpdate.ts)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const hadAdmin = oldMember.permissions.has('Administrator');
  const hasAdmin = newMember.permissions.has('Administrator');
  
  if (hadAdmin && !hasAdmin) {
    // Update database
    await database.query(
      'UPDATE guild_members SET permissions = $1 WHERE user_id = $2',
      [newPermissions, userId]
    );
    
    // Publish event
    await pubsub.publishPermissionRevoked(
      guildId,
      userId,
      'Administrator role removed'
    );
  }
});

// 2. Redis Pub/Sub
REDIS PUBLISH permission:revoked {
  guildId: "123",
  userId: "456",
  reason: "Administrator role removed",
  timestamp: 1708612800000
}

// 3. WebSocket receives
WebSocket finds user's active socket connections
WebSocket forces leave guild room
WebSocket emits 'permission:revoked' to user

// 4. Panel UI kicks user out
socket.on('permission:revoked', (data) => {
  alert(data.reason);
  window.location.href = '/panel/home'; // Redirect
});
```

### Example 3: Command executed notification

```typescript
// 1. Bot executes command (commandHandler.ts)
const result = await command.execute(interaction, context);

// Publish event
await pubsub.publishCommandExecuted(
  guildId,
  command.data.name,
  interaction.user.id,
  'success'
);

// 2. WebSocket forwards
io.to('guild:123').emit('command:executed', {
  command: 'ban',
  executor: 'theo7791l',
  result: 'success',
  timestamp: Date.now()
});

// 3. Panel shows real-time log
socket.on('command:executed', (data) => {
  addLogEntry({
    time: new Date(data.timestamp),
    user: data.executor,
    action: data.command,
    status: data.result
  });
});
```

## Redis Fallback System

**Problem**: If Redis goes down, bot should continue working.

**Solution**: `RedisFallbackManager` (`src/cache/fallback.ts`)

```typescript
class RedisFallbackManager {
  private memoryCache: Map<string, any> = new Map();
  private isRedisAvailable: boolean = true;
  
  async get(key: string): Promise<string | null> {
    // Try Redis first
    if (this.isRedisAvailable) {
      try {
        return await redis.get(key);
      } catch (error) {
        this.isRedisAvailable = false;
        logger.warn('Redis down, using memory cache');
      }
    }
    
    // Fallback to memory
    return this.memoryCache.get(key);
  }
  
  // Health check every 10 seconds
  // Auto-reconnect when Redis comes back
  // Sync memory cache to Redis
}
```

**Behavior when Redis is down**:
- ✅ Bot continues working (reads from DB)
- ✅ Commands execute normally
- ✅ Config cached in memory (per-process)
- ❌ Real-time sync disabled (no panel updates)
- ❌ Panel changes not reflected until bot restart

## Data Enrichment (Discord API)

**Problem**: Database stores IDs like `"123456789"`, but panel needs to show `"#général"`.

**Solution**: API fetches real names from Discord using bot token.

```typescript
// Panel needs to show log channel selector

// 1. Get config from DB (has channel ID)
const config = await fetch('/api/panel/guilds/123');
const logChannelId = config.modules.moderation.logChannel; // "987654321"

// 2. Get channel names from Discord
const channels = await fetch('/api/discord/guilds/123/channels');
const logChannelName = channels.text.find(c => c.id === logChannelId).name; // "#logs"

// 3. Display in UI
<select>
  <option value="987654321">#logs</option>
  <option value="111222333">#général</option>
</select>
```

## Security

### Panel Access Control
```typescript
// Every API endpoint verifies:
1. Valid JWT token
2. User has ADMINISTRATOR permission OR is guild owner
3. Guild exists and bot is present

// WebSocket connections:
1. JWT authentication on connect
2. Auto-join only guilds where user has permissions
3. Manual join verified before allowing
4. Permission revoked = force disconnect
```

### Redis Security
```typescript
// Production Redis:
- requirepass enabled
- bind 127.0.0.1 (local only)
- No external access
- TLS encryption (optional)
```

## Performance

**Latency measurements**:
```
Panel action → API: 10-20ms
API → Database write: 20-30ms
API → Redis publish: 5-10ms
Redis → Bot receive: 5-10ms
Redis → WebSocket: 5-10ms
WebSocket → Panel UI: 10-20ms

Total: 55-100ms end-to-end
```

**Caching strategy**:
```
Redis TTL: 1 hour
Memory cache TTL: 1 hour
Database: Always source of truth

Cache invalidation:
- Explicit on change (Redis Pub/Sub)
- TTL expiration (automatic)
- Manual clear via /api/panel/guilds/:id/sync
```

## Monitoring

### Health Checks
```bash
# API Health
curl https://wolaro.fr/api/health
{
  "status": "healthy",
  "redis": "connected",
  "database": "connected",
  "websocket": "active",
  "connectedUsers": 42
}

# WebSocket Stats
curl https://wolaro.fr/api/admin/websocket/stats
{
  "connectedUsers": 42,
  "totalConnections": 58,
  "rooms": 15
}

# Redis Stats
curl https://wolaro.fr/api/admin/cache/stats
{
  "redisAvailable": true,
  "memoryCacheSize": 0,
  "cacheHitRate": 0.87
}
```

## Troubleshooting

### Panel not updating in real-time
```
1. Check WebSocket connection:
   Browser console: socket.connected === true?

2. Check Redis:
   redis-cli PING
   Should return: PONG

3. Check if user in correct room:
   socket.rooms.has('guild:123')

4. Check API logs:
   npm run pm2:logs | grep "Published"
```

### Bot not picking up changes
```
1. Check Redis connection:
   Bot logs: "Redis Pub/Sub initialized"

2. Test Redis subscription:
   redis-cli
   SUBSCRIBE config:update
   (in another terminal) PUBLISH config:update "{}"

3. Check if fallback active:
   Bot logs: "Redis down, using memory cache"

4. Force reload:
   POST /api/panel/guilds/123/sync
```

### Redis down
```
1. Bot continues with memory cache
2. Real-time sync disabled
3. Panel changes saved to DB
4. Bot needs restart to pick up changes
5. Auto-reconnect every 10s
6. Auto-sync when Redis comes back
```

## Development

### Testing locally
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start PostgreSQL
pg_ctl start

# Terminal 3: Start Bot
npm run dev

# Terminal 4: Test Pub/Sub
redis-cli
PUBLISH config:update '{"guildId":"123","settings":{"prefix":"!"}}'

# Check bot logs for: "Config update received for guild 123"
```

### Testing WebSocket
```javascript
// Browser console
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('join:guild', '123');
});

socket.on('config:updated', (data) => {
  console.log('Config updated:', data);
});
```

## Production Deployment

### PM2 Ecosystem
```javascript
module.exports = {
  apps: [
    {
      name: 'wolaro-bot',
      script: './dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: 'localhost',
        WS_ENABLED: 'true'
      }
    }
  ]
};
```

### Nginx WebSocket Proxy
```nginx
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Summary

✅ **PostgreSQL**: Source of truth (persistent)
✅ **Redis Cache**: Fast reads (1h TTL)
✅ **Redis Pub/Sub**: Real-time sync (<100ms)
✅ **WebSocket**: Push to panel UI
✅ **Fallback**: Memory cache if Redis down
✅ **Security**: JWT + Permission checks
✅ **Monitoring**: Health checks + stats
✅ **Performance**: 55-100ms end-to-end latency
