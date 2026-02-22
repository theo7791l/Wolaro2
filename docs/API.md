# Wolaro API Documentation

## Base URL

```
http://localhost:3000/api
```

Production: `https://api.wolaro.com/api`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

## Rate Limits

- **IP**: 100 requests/minute
- **Authenticated User**: 200 requests/minute
- **Master Admin**: Unlimited

## Endpoints

### Authentication

#### Discord OAuth2 Login

```http
POST /api/auth/discord
Content-Type: application/json

{
  "code": "<oauth2_code>"
}
```

**Response:**
```json
{
  "token": "<jwt_token>",
  "user": {
    "id": "123456789012345678",
    "username": "user",
    "discriminator": "0",
    "avatar": "avatar_hash"
  }
}
```

#### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user_id": "123456789012345678",
  "username": "user",
  "global_xp": 5000,
  "global_level": 10,
  "badges": [],
  "reputation": 0
}
```

---

### Guilds

#### Get User's Guilds

```http
GET /api/guilds
Authorization: Bearer <token>
```

**Response:**
```json
{
  "guilds": [
    {
      "guild_id": "987654321098765432",
      "owner_id": "123456789012345678",
      "plan_type": "FREE",
      "joined_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get Guild Configuration

```http
GET /api/guilds/:guildId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "guild_id": "987654321098765432",
  "owner_id": "123456789012345678",
  "plan_type": "FREE",
  "modules": [
    {
      "module_name": "moderation",
      "enabled": true,
      "config": {
        "autoMod": true,
        "antiSpam": true
      }
    }
  ]
}
```

#### Update Guild Settings

```http
PATCH /api/guilds/:guildId/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "general",
  "key": "prefix",
  "value": "!"
}
```

**Response:**
```json
{
  "success": true
}
```

#### Get Guild Analytics

```http
GET /api/guilds/:guildId/analytics?startDate=2026-01-01&endDate=2026-02-01&metricType=MESSAGE_COUNT
Authorization: Bearer <token>
```

**Response:**
```json
{
  "analytics": [
    {
      "metric_type": "MESSAGE_COUNT",
      "metric_value": 1500,
      "recorded_at": "2026-01-15T12:00:00.000Z"
    }
  ]
}
```

---

### Modules

#### Get Available Modules

```http
GET /api/modules
```

**Response:**
```json
{
  "modules": [
    {
      "name": "moderation",
      "displayName": "Modération",
      "description": "Système de modération avancé",
      "icon": "🛡️",
      "category": "Sécurité"
    }
  ]
}
```

#### Toggle Module

```http
POST /api/modules/:guildId/:moduleName/toggle
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "moduleName": "moderation",
  "enabled": true
}
```

#### Update Module Config

```http
PATCH /api/modules/:guildId/:moduleName/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "config": {
    "autoMod": true,
    "antiSpam": false
  }
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Admin (Master Only)

#### Get All Guilds

```http
GET /api/admin/guilds
Authorization: Bearer <master_token>
```

**Response:**
```json
{
  "guilds": [
    {
      "guild_id": "987654321098765432",
      "owner_id": "123456789012345678",
      "plan_type": "PREMIUM",
      "module_count": 5
    }
  ]
}
```

#### Impersonate Guild

```http
GET /api/admin/impersonate/:guildId
Authorization: Bearer <master_token>
```

**Response:**
```json
{
  "config": {
    "guild_id": "987654321098765432",
    "modules": [...]
  }
}
```

#### Blacklist Guild

```http
POST /api/admin/blacklist/:guildId
Authorization: Bearer <master_token>
Content-Type: application/json

{
  "reason": "Abuse detected"
}
```

**Response:**
```json
{
  "success": true
}
```

#### Get Audit Logs

```http
GET /api/admin/audit-logs?guildId=123&userId=456&actionType=MODULE_TOGGLE&limit=50
Authorization: Bearer <master_token>
```

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "user_id": "123456789012345678",
      "action_type": "MODULE_TOGGLE",
      "metadata": {
        "moduleName": "moderation",
        "enabled": true
      },
      "timestamp": "2026-02-22T12:00:00.000Z"
    }
  ]
}
```

#### Get System Stats

```http
GET /api/admin/stats
Authorization: Bearer <master_token>
```

**Response:**
```json
{
  "stats": {
    "total_guilds": 1000,
    "active_guilds": 950,
    "total_users": 50000,
    "premium_guilds": 50,
    "actions_24h": 10000
  }
}
```

---

### Analytics

#### Get Guild Activity

```http
GET /api/analytics/:guildId/activity?period=7d
Authorization: Bearer <token>
```

**Response:**
```json
{
  "metrics": [
    {
      "date": "2026-02-15",
      "messages": 1500,
      "joins": 10,
      "leaves": 5,
      "commands": 200
    }
  ]
}
```

#### Get Module Usage

```http
GET /api/analytics/:guildId/modules
Authorization: Bearer <token>
```

**Response:**
```json
{
  "modules": [
    {
      "module_name": "moderation",
      "enabled": true,
      "config": {...},
      "updated_at": "2026-02-20T10:00:00.000Z"
    }
  ]
}
```

#### Get Top Users

```http
GET /api/analytics/:guildId/top-users?limit=10&metric=balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "topUsers": [
    {
      "user_id": "123456789012345678",
      "balance": 10000,
      "bank_balance": 50000,
      "daily_streak": 30
    }
  ]
}
```

---

## WebSocket

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'AUTH',
    data: { token: 'your_jwt_token' },
    timestamp: Date.now()
  }));

  // Subscribe to guild updates
  ws.send(JSON.stringify({
    type: 'SUBSCRIBE_GUILD',
    data: { guildId: '987654321098765432' },
    timestamp: Date.now()
  }));
});
```

### Events

#### AUTH_SUCCESS
```json
{
  "type": "AUTH_SUCCESS",
  "data": { "userId": "123456789012345678" },
  "timestamp": 1708611234567
}
```

#### CONFIG_UPDATE
```json
{
  "type": "CONFIG_UPDATE",
  "guildId": "987654321098765432",
  "data": { "category": "general", "key": "prefix", "value": "!" },
  "timestamp": 1708611234567
}
```

#### MODULE_TOGGLE
```json
{
  "type": "MODULE_TOGGLE",
  "guildId": "987654321098765432",
  "data": { "moduleName": "moderation", "enabled": true },
  "timestamp": 1708611234567
}
```

#### AUDIT_LOG
```json
{
  "type": "AUDIT_LOG",
  "guildId": "987654321098765432",
  "data": {
    "user_id": "123456789012345678",
    "action_type": "SETTINGS_UPDATE",
    "metadata": {...}
  },
  "timestamp": 1708611234567
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request body"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "You do not have access to this guild"
}
```

### 404 Not Found
```json
{
  "error": "Guild not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "remaining": 0,
  "resetAt": 1708611234567
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```
