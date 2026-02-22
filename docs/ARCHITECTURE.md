# Wolaro Architecture Guide

## Overview

Wolaro uses a **single-bot, multi-tenant architecture** where one Discord bot instance serves thousands of guilds with isolated configurations.

## System Architecture

```
┌────────────────────────────────────────────┐
│           Discord Gateway (WebSocket)           │
└────────────────┬───────────────────────────┘
                 │
       ┌─────────┴─────────┐
       │  Discord.js Client  │
       │   (Sharding Auto)   │
       └────────┬─────────┘
                │
    ┌───────────┼───────────┐
    │                          │
┌───┴───┐  ┌──────┴──────┐  ┌────┴────┐
│ Module │  │   Command    │  │  Event   │
│ Loader │  │   Handler    │  │ Handler │
└───┬───┘  └──────┬──────┘  └────┬────┘
    │              │              │
    └──────────────┼──────────────┘
                   │
       ┌───────────┼───────────┐
       │                          │
   ┌───┴────┐            ┌────┴────┐
   │ Database │            │  Redis   │
   │ Manager  │            │ Manager  │
   └────┬────┘            └────┬────┘
        │                      │
   ┌────┴────┐            ┌────┴────┐
   │PostgreSQL│            │  Redis   │
   │ Database │            │  Cache   │
   └─────────┘            └─────────┘

        ┌────────────────────────┐
        │   Express API Server   │
        │   + WebSocket Server   │
        └──────────┬─────────────┘
                   │
        ┌──────────┴──────────┐
        │   Web Panel (React)    │
        └─────────────────────┘
```

## Multi-Tenant Design

### Guild Isolation

Each guild (Discord server) has its own:
- Module configuration (`guild_modules`)
- Settings (`guild_settings`)
- Economy data (`guild_economy`)
- Moderation cases (`moderation_cases`)

### Cache Strategy

1. **Guild Config Cache**: 1 hour TTL
2. **Module Status Cache**: 5 minutes TTL
3. **Rate Limit Cache**: Dynamic based on window
4. **User Profile Cache**: 30 minutes TTL

### Database Optimization

- **Indexes**: All foreign keys and frequently queried columns
- **JSONB**: Flexible configuration storage with GIN indexes
- **Partitioning**: Audit logs by date (future enhancement)
- **Connection Pooling**: Max 20 connections

## Module System

### Module Structure

```typescript
interface IModule {
  name: string;
  description: string;
  version: string;
  commands: ICommand[];
  events: IEvent[];
  configSchema: ZodSchema;
  defaultConfig: object;
}
```

### Dynamic Loading

1. Modules are loaded from `src/modules/`
2. Each module exports a default class implementing `IModule`
3. Commands and events are registered automatically
4. Hot-reload supported via `ModuleLoader.reloadModule()`

### Module Lifecycle

```
[Load] → [Register Commands] → [Register Events] → [Active]
                                                           │
                                                           ↓
[Unload] ← [Cleanup] ←─────── [Reload Request]
```

## Security Architecture

### Rate Limiting Layers

1. **IP-based**: 100 requests/minute
2. **User-based**: 200 requests/minute
3. **Guild-based**: Per-command cooldowns

### Master Admin System

```typescript
SecurityManager.isMaster(userId) // Bypass all checks
```

Master admins can:
- Access any guild's configuration
- Blacklist guilds
- View all audit logs
- Force bot restarts
- Impersonate any server

### Anti-Raid Detection

```typescript
// Join spike: >10 joins in 10 seconds
// Message spam: >5 messages in 5 seconds
AntiRaidManager.trackJoin(guildId)
AntiRaidManager.trackMessage(guildId, userId)
```

## Scaling Strategy

### Horizontal Scaling

- **Sharding**: Automatic Discord.js sharding
- **Cluster Mode**: PM2 cluster with max CPU cores
- **Load Balancing**: Nginx for API requests

### Vertical Scaling

- **Database**: PostgreSQL read replicas
- **Cache**: Redis cluster with sentinels
- **Bot Instances**: Multiple processes per server

## Monitoring

### Health Checks

- `/health` endpoint returns bot status
- Database connection check
- Redis connection check
- Discord gateway status

### Logging

- **Winston**: Structured logging with rotation
- **Audit Logs**: Database-persisted actions
- **Error Tracking**: Sentry integration (future)

## Performance

### Benchmarks (Expected)

- **Command Response**: <100ms
- **Database Query**: <50ms (cached: <5ms)
- **Module Toggle**: <200ms (with WS notify)
- **Concurrent Commands**: 1000+/second

### Optimization Techniques

1. **Query Batching**: Group database operations
2. **Lazy Loading**: Load modules on-demand
3. **Memory Management**: Automatic garbage collection tuning
4. **Connection Pooling**: Reuse database connections
