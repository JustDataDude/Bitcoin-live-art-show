# 🚀 Quick Start Guide

## If Nothing is Loading:

### Step 1: Stop All Running Servers
```powershell
taskkill /F /IM node.exe
```

### Step 2: Start Both Servers

**Open TWO separate PowerShell windows:**

#### Window 1 - WebSocket Server:
```powershell
cd "C:\Users\zacka\Desktop\Crypto game show\live-art\apps\ws"
pnpm dev
```

Wait for: `ws listening on :4001`

#### Window 2 - Next.js Web App:
```powershell
cd "C:\Users\zacka\Desktop\Crypto game show\live-art\apps\web"
pnpm dev
```

Wait for: `✓ Ready in Xs` and `Local: http://localhost:3000`

### Step 3: Open Browser
Go to: **http://localhost:3000/show/seed-show-1**

## ✅ What You Should See:

- **Terminal 1:** `ws listening on :4001`
- **Terminal 2:** `✓ Ready in Xs` and `Local: http://localhost:3000`
- **Browser:** The live show page loads with artist streams, chat, and bidding

## 🐛 Common Issues:

### "Port already in use"
```powershell
taskkill /F /IM node.exe
```
Then restart both servers.

### "Cannot find module"
```powershell
cd "C:\Users\zacka\Desktop\Crypto game show\live-art"
pnpm install
```

### "ERR_CONNECTION_REFUSED"
- Make sure BOTH terminals are running
- Check Terminal 1 shows "ws listening on :4001"
- Check Terminal 2 shows "Local: http://localhost:3000"
- If either is missing, there's an error - copy the error message

### Page loads but shows blank/errors
- Open browser console (F12)
- Check for JavaScript errors
- Make sure WebSocket server is running on port 4001

