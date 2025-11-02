# 🚀 Deployment Guide - Getting Your Crypto Game Show Online

This guide will walk you through deploying your application to the internet so others can access it through a domain.

## Overview

Your application consists of:
- **Next.js Web App** (port 3000) - Frontend and API routes
- **WebSocket Server** (port 4001) - Real-time Socket.IO server
- **PostgreSQL Database** - Stored data (users, bids, tips, chat)
- **Redis** (optional) - Caching/session storage
- **LiveKit** (optional) - Alternative streaming solution

---

## Option 1: Quick Deployment (Recommended for Testing)

### Using Vercel (Frontend) + Railway (Backend & Database)

**Time: ~30 minutes | Cost: Free tier available**

#### Step 1: Deploy Database (Railway)

1. **Sign up for Railway** (https://railway.app)
   - Sign in with GitHub
   - Click "New Project"

2. **Create PostgreSQL Database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will auto-generate connection credentials
   - **Copy these credentials** - you'll need them later:
     - `DATABASE_URL` (full connection string)

3. **Create Redis** (Optional but recommended)
   - Click "New" → "Database" → "Redis"
   - Copy the `REDIS_URL`

#### Step 2: Deploy WebSocket Server (Railway)

1. **Create new service** in Railway project
   - Click "New" → "GitHub Repo"
   - Connect your repository
   - Select your repo

2. **Configure the service**
   - Root Directory: `live-art/apps/ws`
   - Build Command: `cd ../.. && pnpm install && cd apps/ws && pnpm build`
   - Start Command: `cd ../.. && pnpm install && cd apps/ws && pnpm start`

3. **Set Environment Variables**
   ```
   DATABASE_URL=<your-postgresql-url-from-step-1>
   REDIS_URL=<your-redis-url-from-step-1>
   PORT=4001
   NODE_ENV=production
   ```

4. **Deploy**
   - Railway will detect the project and start building
   - Note the public URL (e.g., `https://ws-production.up.railway.app`)
   - This is your WebSocket server URL!

#### Step 3: Deploy Frontend (Vercel)

1. **Sign up for Vercel** (https://vercel.com)
   - Sign in with GitHub
   - Click "Add New" → "Project"

2. **Import your repository**
   - Select your GitHub repo
   - Configure:
     - **Root Directory:** `live-art/apps/web`
     - **Framework Preset:** Next.js
     - **Build Command:** `cd ../.. && pnpm install && cd apps/web && pnpm build`
     - **Output Directory:** `.next`
     - **Install Command:** `cd ../.. && pnpm install`

3. **Set Environment Variables**
   ```
   DATABASE_URL=<your-postgresql-url>
   REDIS_URL=<your-redis-url>
   NEXT_PUBLIC_WS_URL=https://ws-production.up.railway.app
   NEXT_PUBLIC_LIVEKIT_URL=<your-livekit-url-if-using>
   LIVEKIT_API_KEY=<your-livekit-api-key>
   LIVEKIT_API_SECRET=<your-livekit-api-secret>
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-walletconnect-id>
   NODE_ENV=production
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your app
   - You'll get a URL like `https://your-app.vercel.app`

#### Step 4: Configure Database Schema

1. **Run Prisma migrations on production database**
   ```bash
   # In your local terminal
   cd live-art/packages/db
   
   # Set production database URL
   $env:DATABASE_URL="<your-production-postgresql-url>"
   
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate deploy
   ```

#### Step 5: Update CSP Headers for Production

Update `live-art/apps/web/next.config.js` to allow connections to your production WebSocket server:

```javascript
connect-src 'self' ws://localhost:* http://localhost:* https://localhost:* https://your-ws-domain.com https://your-ws-domain.com:443 wss://your-ws-domain.com wss://your-ws-domain.com:443
```

---

## Option 2: Full Control Deployment (VPS/Docker)

**Time: ~2 hours | Cost: ~$5-10/month (DigitalOcean, Linode, etc.)**

### Using Docker Compose on a VPS

#### Step 1: Get a VPS

1. **Sign up for DigitalOcean/Linode/Vultr**
   - Create a droplet/server
   - Minimum: 1GB RAM, 1 CPU (2GB+ recommended)
   - Choose Ubuntu 22.04

2. **SSH into your server**
   ```bash
   ssh root@your-server-ip
   ```

#### Step 2: Install Docker & Docker Compose

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

#### Step 3: Clone and Configure

```bash
# Install Git
apt install git -y

# Clone your repository
git clone <your-repo-url> /opt/live-art
cd /opt/live-art/live-art

# Create .env file
cp env.example .env
nano .env
```

Update `.env` with production values:
```env
DATABASE_URL=postgresql://postgres:YOUR_SECURE_PASSWORD@db:5432/liveart
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_WS_URL=https://ws.yourdomain.com
# ... other variables
```

#### Step 4: Setup Reverse Proxy (Nginx)

```bash
# Install Nginx
apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
nano /etc/nginx/sites-available/live-art
```

Paste this configuration (update domain names):

```nginx
# Frontend (Next.js)
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# WebSocket Server
server {
    listen 80;
    server_name ws.yourdomain.com;

    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/live-art /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### Step 5: Setup SSL with Let's Encrypt

```bash
# Get SSL certificates
certbot --nginx -d yourdomain.com -d www.yourdomain.com -d ws.yourdomain.com

# Certbot will automatically update your Nginx config
# Test renewal
certbot renew --dry-run
```

#### Step 6: Create Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    container_name: liveart_db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: liveart
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    container_name: liveart_redis
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    restart: unless-stopped

  ws:
    build:
      context: .
      dockerfile: apps/ws/Dockerfile
    container_name: liveart_ws
    ports:
      - "4001:4001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - PORT=4001
      - NODE_ENV=production
    depends_on:
      - db
      - redis
    restart: unless-stopped

volumes:
  db_data:
  redis_data:
```

Create `apps/ws/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ws apps/ws
COPY packages packages
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile
WORKDIR /app/apps/ws
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ws apps/ws
COPY packages packages
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --prod
WORKDIR /app/apps/ws
COPY --from=builder /app/apps/ws/dist ./dist
CMD ["pnpm", "start"]
```

#### Step 7: Deploy

```bash
# Build and start services
cd /opt/live-art/live-art
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec ws sh -c "cd ../.. && cd packages/db && npx prisma migrate deploy"
```

#### Step 8: Setup Process Manager (PM2) for Next.js

```bash
# Install Node.js and PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y
npm install -g pm2

# Start Next.js app with PM2
cd /opt/live-art/live-art/apps/web
pm2 start npm --name "live-art-web" -- start
pm2 save
pm2 startup
```

---

## Custom Domain Setup

### Option A: Using Vercel/Railway (Easiest)

1. **Buy a domain** from Namecheap, Google Domains, etc.
2. **In Vercel:**
   - Go to Project Settings → Domains
   - Add your domain (e.g., `yourdomain.com`)
   - Follow DNS instructions
3. **In Railway:**
   - Go to your WebSocket service → Settings → Networking
   - Add custom domain (e.g., `ws.yourdomain.com`)
   - Add CNAME record pointing to Railway's domain

### Option B: Using VPS (Full Control)

1. **Point DNS to your server:**
   - Create A record: `yourdomain.com` → Your server IP
   - Create A record: `ws.yourdomain.com` → Your server IP

2. **Update Nginx config** (already done in Step 4 above)

---

## Post-Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Environment variables set correctly
- [ ] Frontend connects to WebSocket server
- [ ] SSL certificates installed (HTTPS working)
- [ ] Test chat functionality
- [ ] Test bidding functionality
- [ ] Test streaming (WebRTC)
- [ ] Monitor logs for errors

---

## Monitoring & Maintenance

### Check Logs

**Railway:**
- Click on your service → "Deployments" → View logs

**VPS:**
```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f

# PM2 logs
pm2 logs live-art-web
```

### Backup Database

**Railway:**
- Automated backups available on paid plans

**VPS:**
```bash
# Create backup script
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres liveart > backup.sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres liveart < backup.sql
```

---

## Troubleshooting

### WebSocket Connection Fails
- Check `NEXT_PUBLIC_WS_URL` is set correctly
- Verify WebSocket server is running
- Check firewall rules allow port 4001 (or 443 for HTTPS)

### Database Connection Errors
- Verify `DATABASE_URL` format
- Check database is accessible from your server
- Verify credentials are correct

### Build Failures
- Check all environment variables are set
- Verify Node.js version matches local (should be 20+)
- Check build logs for specific errors

---

## Quick Reference: Required Environment Variables

```
# Production .env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
NEXT_PUBLIC_WS_URL=https://ws.yourdomain.com
PORT=4001 (for WS server)
NODE_ENV=production

# Optional
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

---

## Next Steps After Deployment

1. **Set up monitoring** (Sentry, LogRocket, etc.)
2. **Enable analytics** (Vercel Analytics, Google Analytics)
3. **Configure CI/CD** (auto-deploy on git push)
4. **Set up alerts** for downtime
5. **Optimize performance** (CDN, caching, etc.)

---

Need help? Check the logs first, then review each step carefully. Most issues are environment variable related!

