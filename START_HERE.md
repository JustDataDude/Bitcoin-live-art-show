# 🚀 Quick Start Guide

## First Time Setup (Do this once)

### 1. Install Dependencies
```powershell
# From the live-art folder
npm install
```

### 2. Setup Database
```powershell
# Navigate to database package
cd packages/db

# Generate Prisma client
npx prisma generate

# Reset and seed the database with sample data
npx prisma migrate reset --force

# Go back to root
cd ../..
```

## Starting the Application (Every Time)

You need **TWO** terminal windows running at the same time:

### Terminal 1: WebSocket Server
```powershell
cd apps/ws
npm run dev
```

You should see: `ws listening on :4001`

### Terminal 2: Next.js Web App
```powershell
cd apps/web
npm run dev
```

You should see: `- Local: http://localhost:3000`

## Using the Application

### Main Show Page (Viewers)
**URL:** http://localhost:3000/show/seed-show-1

**Features:**
- 🎥 Watch live streams (Host + 4 Artists)
- 💬 Real-time chat
- 💰 Place bids
- 💸 Send tips with messages
- 🎧 Music player (Spotify)
- 💱 BTC to USDT swap widget
- 🔗 Connect Bitcoin wallets (Unisat, Magic Eden, Xverse)

### Studio Page (Broadcasters)
**URL:** http://localhost:3000/studio

**Features:**
- 📹 Host webcam stream
- 🖥️ 4 screen sharing streams for artists
- Start/stop streams
- View viewer count

## Testing Multi-User

1. Open **multiple browser windows** or use **incognito mode**
2. Each window will have a different username (e.g., Guest-123, Guest-456)
3. Try:
   - Chatting from different windows
   - Bidding against each other
   - Sending tips with messages
   - Watching streams

## Database Viewer

To see all the data being saved:

```powershell
cd packages/db
npx prisma studio
```

This opens a browser at http://localhost:5555 where you can:
- View all users, bids, tips, and chat messages
- Edit data manually
- See real-time updates

## What's Now Stored in Database?

✅ **Users** - Auto-created when someone connects
✅ **Bids** - Every bid with amount and timestamp
✅ **Tips** - Tips with optional messages
✅ **Chat Messages** - All chat history
✅ **Shows & Lots** - Game show episodes and auction items

## Troubleshooting

### Port Already in Use
If you see "Port 3000/4001 already in use":
1. Stop all terminals (Ctrl+C)
2. Close any other apps using those ports
3. Restart both servers

### Database Locked Error
If you get "database is locked":
1. Stop both servers (Ctrl+C)
2. Close Prisma Studio if it's open
3. Run: `cd packages/db; npx prisma generate`
4. Restart servers

### Changes Not Showing
1. Stop servers
2. Clear browser cache (Ctrl+Shift+Delete)
3. Restart servers
4. Hard refresh browser (Ctrl+Shift+R)

## Next Steps

### Ready for Production?

To make this ready for multiple users on the internet, you'll need:

1. **Real Authentication** - Bitcoin wallet signatures instead of guest usernames
2. **Real Payments** - Integrate actual BTC/USDC payment processing
3. **Deploy Database** - Move from SQLite to PostgreSQL
4. **Deploy Servers** - Host on Vercel (Next.js) and Railway/Render (WebSocket)
5. **TURN Server** - For WebRTC across different networks
6. **Domain & SSL** - HTTPS required for webcam/screen sharing

Let me know when you're ready for any of these! 🚀

