# 🚀 Launch Guide

## Pre-Launch Checklist

### 1. Environment Setup ✅

- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Fill in all required environment variables
- [ ] Run `pnpm validate-env` to verify configuration
- [ ] Ensure PostgreSQL database is set up (not SQLite)
- [ ] Ensure Redis is configured

### 2. Database Setup ✅

```bash
# Run migrations
cd packages/db
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# (Optional) Seed initial data
npx prisma db seed
```

### 3. Build & Test ✅

```bash
# Validate environment
pnpm validate-env

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build
```

### 4. Security Review ✅

- [x] Input validation implemented
- [x] Rate limiting configured
- [x] CORS properly set
- [x] Security headers added
- [ ] HTTPS enforced (configure in deployment)
- [ ] Secrets secured (not in code)

### 5. Performance Optimization ✅

- [x] Code splitting enabled
- [x] Lazy loading implemented
- [x] Bundle optimization configured
- [x] Database indexing added
- [ ] CDN configured (optional)
- [ ] Image optimization enabled

### 6. Monitoring Setup

- [ ] Error tracking (Sentry/LogRocket) configured
- [ ] Analytics (Vercel Analytics/Google Analytics) added
- [ ] Uptime monitoring set up
- [ ] Performance monitoring configured
- [ ] Alert system configured

## Deployment Steps

### Option 1: Vercel + Railway (Recommended)

#### Deploy WebSocket Server (Railway)

1. Sign up at [Railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repository
4. Add service → Deploy from GitHub
5. Select `apps/ws` as root directory
6. Set environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=your_postgres_url
   REDIS_URL=your_redis_url
   CORS_ORIGIN=https://yourdomain.com
   PORT=4001
   ```
7. Deploy and note the URL (e.g., `https://ws-production.up.railway.app`)

#### Deploy Web App (Vercel)

1. Sign up at [Vercel.com](https://vercel.com)
2. Import GitHub repository
3. Configure:
   - **Root Directory:** `apps/web`
   - **Framework:** Next.js
   - **Build Command:** `cd ../.. && pnpm install && cd apps/web && pnpm build`
   - **Output Directory:** `.next`
4. Set environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=your_postgres_url
   REDIS_URL=your_redis_url
   NEXT_PUBLIC_WS_URL=https://ws-production.up.railway.app
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
   CORS_ORIGIN=https://yourdomain.com
   ```
5. Deploy

### Option 2: Docker (Full Control)

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Post-Deployment Verification

### 1. Test All Features

- [ ] Home page loads
- [ ] Show page loads
- [ ] Wallet connections work (Ethereum & Bitcoin)
- [ ] Bidding works
- [ ] Chat works
- [ ] Streaming works (if configured)
- [ ] Payments work
- [ ] Mobile responsive

### 2. Check Logs

```bash
# WebSocket server logs
# Railway: Dashboard → Deployments → Logs
# Docker: docker-compose logs -f ws

# Web app logs
# Vercel: Dashboard → Deployments → Logs
# Docker: docker-compose logs -f web
```

### 3. Monitor Performance

- Check response times
- Monitor error rates
- Watch database connections
- Track WebSocket connections

### 4. Security Check

- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] CORS configured correctly
- [ ] No sensitive data in client code
- [ ] Rate limiting working

## Troubleshooting

### WebSocket Connection Fails

1. Check `NEXT_PUBLIC_WS_URL` is correct
2. Verify WebSocket server is running
3. Check CORS configuration
4. Verify firewall rules

### Database Connection Errors

1. Verify `DATABASE_URL` format
2. Check database is accessible
3. Verify credentials
4. Check connection pool limits

### Build Failures

1. Run `pnpm validate-env`
2. Check all dependencies installed
3. Verify Node.js version (20+)
4. Check build logs for specific errors

## Maintenance

### Daily
- Check error logs
- Monitor server health
- Review failed transactions

### Weekly
- Database backups
- Performance review
- Security audit
- Dependency updates

### Monthly
- Full system backup
- Dependency updates
- Performance optimization
- Feature planning

## Support Resources

- **Documentation:** See `DEPLOYMENT_GUIDE.md`
- **Production Checklist:** See `PRODUCTION_READY.md`
- **Improvements:** See `IMPROVEMENTS_AND_FAILURE_POINTS.md`

## Quick Commands

```bash
# Validate environment
pnpm validate-env

# Build for production
pnpm build

# Run database migrations
cd packages/db && npx prisma migrate deploy

# Check server status
netstat -ano | findstr ":3000 :4001"
```

---

**Ready to launch?** 🚀

1. Complete the checklist above
2. Deploy to your chosen platform
3. Verify all features work
4. Monitor for issues
5. Go live! 🎉

