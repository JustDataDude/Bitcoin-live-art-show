# Server Status

## ✅ Servers Running

- **Web Server (Next.js)**: Port 3000 - PID 13944
- **WebSocket Server**: Port 4001 - PID 7220

## 🚀 Access URLs

- **Home Page**: http://localhost:3000
- **Show Page**: http://localhost:3000/show/seed-show-1
- **Marketplace**: http://localhost:3000/marketplace
- **Studio**: http://localhost:3000/studio

## ⚠️ First Load Notes

On first startup, Next.js may take 30-60 seconds to compile. You'll see:
- A loading spinner initially
- Then the page will load progressively as components initialize

## 🔧 Recent Optimizations Applied

1. **Lazy Loading**: Heavy components (wallets, Spotify, WebRTC) load on demand
2. **Deferred Operations**: Non-critical data (Bitcoin price, history) loads after initial render
3. **Reduced Initial Data**: Limited initial history loads (20 bids, 20 tips, 50 messages)
4. **Loading States**: Added loading indicators for better UX
5. **Connection Resilience**: WebSocket auto-reconnects with exponential backoff

## 🐛 Troubleshooting

If pages don't load:

1. **Wait 30-60 seconds** for initial compilation
2. **Hard refresh**: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
3. **Check browser console** (F12) for errors
4. **Verify servers are running**:
   ```powershell
   netstat -ano | findstr ":3000 :4001"
   ```

## 📝 Restart Servers

To restart everything:

```powershell
# Stop all Node processes
taskkill /F /IM node.exe

# Start WebSocket server (in one terminal)
cd live-art/apps/ws
pnpm dev

# Start Web server (in another terminal)
cd live-art/apps/web
pnpm dev
```

Or use the root command:
```powershell
cd live-art
pnpm dev
```

