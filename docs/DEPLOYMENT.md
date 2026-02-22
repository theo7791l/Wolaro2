# Wolaro Deployment Guide

## Production Checklist

### Pre-Deployment

- [ ] Change all default passwords in `.env`
- [ ] Generate strong JWT secret (min 32 characters)
- [ ] Configure master admin IDs
- [ ] Set up PostgreSQL with backups
- [ ] Set up Redis with persistence
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring and alerts
- [ ] Test all modules locally
- [ ] Run database migrations

## Deployment Options

### 1. Docker Compose (Recommended)

#### Requirements
- Docker 20+
- Docker Compose 2+
- 2GB+ RAM
- 10GB+ disk space

#### Steps

```bash
# Clone repository
git clone https://github.com/theo7791l/Wolaro2.git
cd Wolaro2

# Configure environment
cp .env.example .env
nano .env

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:3000/health
```

#### Production docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: wolaro
      POSTGRES_USER: wolaro
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - wolaro-network

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - wolaro-network

  bot:
    build: .
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    ports:
      - "3000:3000"
      - "3001:3001"
    networks:
      - wolaro-network

volumes:
  postgres_data:
  redis_data:

networks:
  wolaro-network:
    driver: bridge
```

### 2. PM2 Cluster

#### Installation

```bash
# Install PM2
npm install -g pm2

# Install dependencies
npm ci --only=production

# Build
npm run build

# Start cluster
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

#### Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs wolaro-bot

# Restart
pm2 restart wolaro-bot

# Stop
pm2 stop wolaro-bot

# Delete
pm2 delete wolaro-bot
```

### 3. Kubernetes

#### Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: wolaro
```

#### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: wolaro-config
  namespace: wolaro
data:
  DB_HOST: postgres-service
  DB_PORT: "5432"
  DB_NAME: wolaro
  REDIS_HOST: redis-service
  REDIS_PORT: "6379"
  API_PORT: "3000"
```

#### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: wolaro-secret
  namespace: wolaro
type: Opaque
data:
  DISCORD_TOKEN: <base64_encoded>
  DB_PASSWORD: <base64_encoded>
  JWT_SECRET: <base64_encoded>
```

#### PostgreSQL Deployment

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: wolaro
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: wolaro-config
              key: DB_NAME
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: wolaro-secret
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

#### Bot Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wolaro-bot
  namespace: wolaro
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wolaro-bot
  template:
    metadata:
      labels:
        app: wolaro-bot
    spec:
      containers:
      - name: bot
        image: wolaro:latest
        ports:
        - containerPort: 3000
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: wolaro-config
        - secretRef:
            name: wolaro-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

## Nginx Reverse Proxy

### Configuration

```nginx
upstream wolaro_api {
    least_conn;
    server localhost:3000;
}

upstream wolaro_websocket {
    least_conn;
    server localhost:3001;
}

server {
    listen 80;
    server_name api.wolaro.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.wolaro.com;

    ssl_certificate /etc/letsencrypt/live/api.wolaro.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.wolaro.com/privkey.pem;

    # API
    location /api {
        proxy_pass http://wolaro_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://wolaro_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Database Backups

### Automated Backup Script

```bash
#!/bin/bash
# /scripts/backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="wolaro_backup_${DATE}.sql"

# Create backup
pg_dump -U wolaro -h localhost wolaro > "${BACKUP_DIR}/${FILENAME}"

# Compress
gzip "${BACKUP_DIR}/${FILENAME}"

# Delete backups older than 7 days
find ${BACKUP_DIR} -name "wolaro_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${FILENAME}.gz"
```

### Cron Job

```bash
# Daily backup at 3 AM
0 3 * * * /scripts/backup.sh >> /var/log/wolaro_backup.log 2>&1
```

## Monitoring

### Prometheus Metrics

Add to `src/api/routes/metrics.ts`:

```typescript
import { Router } from 'express';
import promClient from 'prom-client';

const router = Router();
const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
```

### Grafana Dashboard

Import dashboard JSON from `docs/grafana-dashboard.json`.

## SSL/TLS

### Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.wolaro.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Environment Variables

### Production .env

```env
# Discord
DISCORD_TOKEN=your_production_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

# Database
DB_HOST=postgres-service
DB_PORT=5432
DB_NAME=wolaro
DB_USER=wolaro
DB_PASSWORD=super_secure_password_here

# Redis
REDIS_HOST=redis-service
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_here

# API
API_PORT=3000
API_JWT_SECRET=super_long_jwt_secret_at_least_32_characters_long
API_CORS_ORIGIN=https://panel.wolaro.com

# Master Admins
MASTER_ADMIN_IDS=123456789012345678

# Node
NODE_ENV=production

# Logging
LOG_LEVEL=info
```

## Scaling

### Horizontal Scaling

1. **Multiple Bot Instances**: Use PM2 cluster or K8s replicas
2. **Load Balancer**: Nginx for API requests
3. **Database Read Replicas**: PostgreSQL streaming replication
4. **Redis Cluster**: Redis Sentinel for HA

### Vertical Scaling

- **CPU**: 2-4 cores per instance
- **RAM**: 1-2GB per instance
- **Disk**: SSD for database, 20GB+

## Security

### Firewall Rules

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow HTTP (redirect to HTTPS)
sudo ufw allow 80/tcp

# Enable firewall
sudo ufw enable
```

### Fail2Ban

```bash
# Install
sudo apt install fail2ban

# Configure for Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
```

## Troubleshooting

### Bot Not Starting

```bash
# Check logs
docker-compose logs bot
pm2 logs wolaro-bot

# Check database connection
psql -U wolaro -h localhost -d wolaro

# Check Redis
redis-cli ping
```

### High Memory Usage

```bash
# Check processes
pm2 monit

# Restart with limits
pm2 restart wolaro-bot --max-memory-restart 1G
```

### Database Issues

```bash
# Check connections
SELECT * FROM pg_stat_activity;

# Kill idle connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';

# Vacuum database
VACUUM ANALYZE;
```

## Support

For production support:
- Discord: [Join our server](https://discord.gg/wolaro)
- Email: support@wolaro.com
- Docs: [Documentation](../README.md)
