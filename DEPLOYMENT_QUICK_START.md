# ⚡ Quick Deployment Checklist

Follow this checklist for the fastest path to deployment.

## Prerequisites

- [ ] GitHub repository with your code
- [ ] Domain name (optional, can use provided subdomains)
- [ ] WalletConnect Project ID (get from https://cloud.walletconnect.com)

---

## 🚀 Fast Track (30 minutes)

### 1. Database Setup (5 min)

**Option A: Railway (Easiest)**
1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Add PostgreSQL
4. Copy `DATABASE_URL`

**Option B: Supabase (Alternative)**
1. Go to https://supabase.com
2. Create project
3. Settings → Database → Connection string
4. Copy `DATABASE_URL`

### 2. Deploy WebSocket Server (10 min)

**Using Railway:**
1. In Railway, click "New" → "GitHub Repo"
2. Connect your repository
3. Configure:
   - Root: `live-art/apps/ws`
   - Build: `cd ../.. && pnpm install && cd apps/ws && pnpm build`
   - Start: `cd ../.. && pnpm install && cd apps/ws && pnpm start`
4. Add environment variables:
   ```
   DATABASE_URL=<from-step-1>
   PORT=4001
   NODE_ENV=production
   ```
5. Deploy and **copy the public URL** (e.g., `https://ws-production.up.railway.app`)

### 3. Deploy Frontend (10 min)

**Using Vercel:**
1. Go to https://vercel.com
2. Import your GitHub repository
3. Configure:
   - Root Directory: `live-art/apps/web`
   - Framework: Next.js
   - Build Command: `cd ../.. && pnpm install && cd apps/web && pnpm build`
   - Install Command: `cd ../.. && pnpm install`
4. Add environment variables:
   ```
   DATABASE_URL=<from-step-1>
   NEXT_PUBLIC_WS_URL=<from-step-2>
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-project-id>
   NODE_ENV=production
   ```
5. Deploy

### 4. Setup Database (5 min)

```bash
# In your local terminal
cd live-art/packages/db

# Set production database
$env:DATABASE_URL="<your-production-database-url>"

# Deploy schema
npx prisma generate
npx prisma migrate deploy
```

### 5. Test It!

1. Visit your Vercel URL
2. Go to `/show/seed-show-1`
3. Test:
   - [ ] Chat works
   - [ ] Bidding works
   - [ ] WebSocket connects (check browser console)

---

## 🌐 Custom Domain (Optional)

### Vercel:
1. Project Settings → Domains
2. Add your domain
3. Follow DNS instructions

### Railway (WebSocket):
1. Service → Settings → Networking
2. Add custom domain
3. Update DNS CNAME record

---

## 🐛 Common Issues

**WebSocket won't connect:**
- Check `NEXT_PUBLIC_WS_URL` in Vercel environment variables
- Ensure Railway WebSocket service is running
- Check browser console for errors

**Database errors:**
- Verify `DATABASE_URL` is correct
- Run migrations: `npx prisma migrate deploy`

**Build fails:**
- Check all environment variables are set
- Verify Node.js version (should be 20+)

---

## 📊 Monitoring

**Railway:** Check service logs in dashboard
**Vercel:** Check deployment logs in dashboard

---

## ✅ Done!

Your app should now be live! Share the URL with others to test.

---

**Need more details?** See `DEPLOYMENT_GUIDE.md` for comprehensive instructions.

