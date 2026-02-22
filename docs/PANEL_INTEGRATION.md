# Panel Integration Guide

## Overview

Wolaro's web panel (`wolaro.fr/panel`) provides a complete dashboard for server administrators to manage their Discord bot configuration without needing Discord commands.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  wolaro.fr      │ ◄─────► │   API Server    │ ◄─────► │  PostgreSQL DB  │
│  (Web Panel)    │  HTTPS  │   (Express)     │   SQL   │   (Database)    │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                     │                           ▲
                                     │                           │
                                     ▼                           │
                            ┌─────────────────┐                 │
                            │                 │                 │
                            │  Discord Bot    │─────────────────┘
                            │   (Wolaro)      │
                            │                 │
                            └─────────────────┘
```

## Database Tables for Panel

### `panel_sessions`
Stores active panel sessions with JWT tokens:
- `user_id`: Discord user ID
- `session_token`: JWT access token
- `refresh_token`: JWT refresh token
- `expires_at`: Session expiration
- `ip_address`: User IP for security
- `user_agent`: Browser info

### `guild_members`
Tracks members with panel access:
- `guild_id`: Discord guild ID
- `user_id`: Discord user ID
- `permissions`: Array of permissions (e.g., ADMINISTRATOR)

## API Endpoints for Panel

### Authentication

#### `POST /api/auth/login`
Discord OAuth2 login
```json
{
  "code": "discord_oauth_code"
}
```

#### `POST /api/auth/refresh`
Refresh access token
```json
{
  "refreshToken": "refresh_token_here"
}
```

#### `GET /api/auth/me`
Get current user info
```
Headers: Authorization: Bearer <token>
```

### Panel Routes

#### `GET /api/panel/guilds`
Get user's guilds where they have admin permissions
```
Headers: Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "guild_id": "123456789",
      "owner_id": "987654321",
      "plan_type": "PREMIUM",
      "is_admin": true,
      "settings": {
        "name": "My Server",
        "icon": "https://...",
        "member_count": 1500
      }
    }
  ],
  "count": 1
}
```

#### `GET /api/panel/guilds/:guildId`
Get specific guild configuration
```
Headers: Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "guild_id": "123456789",
    "settings": {...},
    "modules": [
      {
        "module_name": "moderation",
        "enabled": true,
        "config": {...}
      }
    ]
  }
}
```

#### `PATCH /api/panel/guilds/:guildId`
Update guild settings
```
Headers: Authorization: Bearer <token>
Body:
{
  "settings": {
    "prefix": "!",
    "language": "fr"
  }
}
```

#### `GET /api/panel/guilds/:guildId/modules`
Get all modules for a guild
```
Headers: Authorization: Bearer <token>
```

#### `PATCH /api/panel/guilds/:guildId/modules/:moduleName`
Toggle or configure a module
```
Headers: Authorization: Bearer <token>
Body:
{
  "enabled": true,
  "config": {
    "autoModEnabled": true,
    "logChannel": "987654321"
  }
}
```

#### `GET /api/panel/guilds/:guildId/analytics`
Get guild analytics (last 7 days by default)
```
Headers: Authorization: Bearer <token>
Query: ?days=30
```

#### `GET /api/panel/guilds/:guildId/audit`
Get audit logs with pagination
```
Headers: Authorization: Bearer <token>
Query: ?limit=50&offset=0
```

#### `POST /api/panel/guilds/:guildId/sync`
Sync guild data from Discord (force refresh)
```
Headers: Authorization: Bearer <token>
```

## Security

### Authentication Flow

1. User clicks "Login with Discord" on wolaro.fr/panel
2. Redirected to Discord OAuth2
3. Discord redirects back with code
4. Frontend calls `POST /api/auth/login` with code
5. Backend exchanges code for Discord tokens
6. Backend creates JWT tokens and session
7. Frontend stores tokens (httpOnly cookies recommended)
8. All API requests include Authorization header

### Permission Verification

Every panel API route verifies:
1. Valid JWT token
2. User has ADMINISTRATOR permission in the guild OR is guild owner
3. Guild exists in database (bot is in the guild)

### Rate Limiting

All panel routes are rate limited:
- 100 requests per minute per IP
- 1000 requests per hour per user

## Frontend Integration Example

```javascript
// Login
const response = await fetch('https://wolaro.fr/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: oauthCode })
});
const { accessToken, refreshToken } = await response.json();

// Store tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Get guilds
const guildsResponse = await fetch('https://wolaro.fr/api/panel/guilds', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const guilds = await guildsResponse.json();

// Update module
await fetch(`https://wolaro.fr/api/panel/guilds/${guildId}/modules/moderation`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    enabled: true,
    config: { autoModEnabled: true }
  })
});
```

## Environment Variables

```env
# Panel Configuration
PANEL_URL=https://wolaro.fr/panel
PANEL_SESSION_DURATION=604800  # 7 days

# API Configuration
API_PORT=3000
API_JWT_SECRET=your_jwt_secret_min_32_characters
API_CORS_ORIGIN=https://wolaro.fr,https://www.wolaro.fr

# Domain
MAIN_DOMAIN=wolaro.fr
```

## Database Migrations

The schema includes:
- `panel_sessions` table
- `guild_members` table
- Indexes for performance
- Cleanup function for expired sessions

Run migrations:
```bash
psql -U wolaro -d wolaro -f src/database/schema.sql
```

## Bot-Panel Sync

The bot and panel share the same database, ensuring real-time sync:

1. **Panel → Bot**: Module changes in panel immediately affect bot behavior
2. **Bot → Panel**: Bot updates (e.g., moderation actions) appear in panel audit logs
3. **Discord → Panel**: Guild data can be force-refreshed via sync endpoint

## WebSocket (Real-time Updates)

For real-time updates, WebSocket server is available:

```javascript
const ws = new WebSocket('wss://wolaro.fr:3001');

ws.onopen = () => {
  ws.send(JSON.stringify({
    event: 'authenticate',
    token: accessToken
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'module:toggle') {
    // Update UI
  }
};
```

## Production Deployment

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name wolaro.fr www.wolaro.fr;

    ssl_certificate /etc/letsencrypt/live/wolaro.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wolaro.fr/privkey.pem;

    # Panel (static files)
    location /panel {
        root /var/www/wolaro;
        try_files $uri $uri/ /panel/index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d wolaro.fr -d www.wolaro.fr
```

## Support

For panel integration issues:
- Check API logs: `npm run pm2:logs`
- Test endpoints: `curl https://wolaro.fr/api/health`
- Verify database connection
- Check CORS configuration
