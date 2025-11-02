# 🎨 1 of 1's Game Show - Live Crypto Art Auction

Live cryptocurrency art-auction platform. Host and artists stream live (WebRTC) while viewers bid and tip in real time (Socket.IO). Features Bitcoin wallet integration, persistent chat, and multi-user support.

## ✨ Features
- 🎥 **Live Streaming** - Host webcam + 4 artist screen shares (WebRTC)
- 💬 **Real-time Chat** - Persistent chat with Socket.IO
- 💰 **Live Bidding** - Real-time auction with bid increments
- 💸 **Tips with Messages** - Send tips with custom messages
- 🔗 **Bitcoin Wallets** - Unisat, Magic Eden, Xverse integration
- 🎧 **Spotify Player** - Music player with custom playlists
- 💱 **Crypto Swap** - BTC to USDT swap widget
- 🗄️ **Database** - All bids, tips, and chat persist to SQLite

## Stack
- Turborepo monorepo (npm/pnpm)
- Next.js (App Router, TypeScript, Tailwind) in `apps/web`
- Socket.IO + WebRTC signaling server in `apps/ws`
- SQLite + Prisma in `packages/db`
- Native WebRTC for video streaming
- Bitcoin wallet APIs (Unisat, Magic Eden, Xverse)

## Monorepo layout
```
/live-art/
  turbo.json
  docker-compose.yml
  pnpm-workspace.yaml
  package.json
  .env.example
  /apps
    /web        # Next.js frontend + API routes
    /ws         # Socket.IO server
    /inscriber  # inscription worker
  /packages
    /ui         # shared UI components
    /db         # Prisma schema + client + seed
    /config     # shared config & event types
```

## 🚀 Quick Start

**See `START_HERE.md` for full setup instructions!**

### First Time Setup:
```powershell
# Install dependencies
npm install

# Setup database
cd packages/db
npx prisma generate
npx prisma migrate reset --force
cd ../..
```

### Start the App (2 terminals needed):

**Terminal 1 - WebSocket Server:**
```powershell
cd apps/ws
npm run dev
```

**Terminal 2 - Next.js:**
```powershell
cd apps/web
npm run dev
```

### Open in Browser:
- 🎮 **Show Page (Viewers):** http://localhost:3000/show/seed-show-1
- 📹 **Studio (Broadcasters):** http://localhost:3000/studio
- 🗄️ **Database Viewer:** `cd packages/db; npx prisma studio` (port 5555)

## 📚 Documentation

- **`START_HERE.md`** - Complete setup guide and testing instructions
- **`DATABASE_SETUP.md`** - Database schema and migration info
- **`BACKEND_COMPLETE.md`** - What's been implemented and how to test

## 🎯 What Works

✅ Multi-user real-time bidding and tipping  
✅ Live video streaming (host webcam + artist screens)  
✅ Persistent chat, bids, and tips in SQLite database  
✅ Bitcoin wallet integration (Unisat working, others manual)  
✅ Spotify music player with custom playlists  
✅ BTC/USDT swap widget (mock prices)  
✅ Beautiful gradient UI with glassmorphism effects  

## 🔜 What's Next (For Production)

- Real Bitcoin/crypto payments
- Wallet-based authentication
- PostgreSQL for production
- Deploy to Vercel + Railway/Render
- TURN server for WebRTC across networks
- Real-time price feeds for swap widget

## 📝 Notes

- Database: SQLite (for dev), easy to migrate to PostgreSQL
- Payments: Currently mocked, ready for real integration
- Streaming: WebRTC (works locally, needs TURN for internet)
- This is in active development!
