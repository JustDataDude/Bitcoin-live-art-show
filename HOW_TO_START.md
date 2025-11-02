# 🚀 How To Start The Servers

## Step 1: Open TWO PowerShell Windows

### Window 1 - WebSocket Server:
```powershell
cd "C:\Users\zacka\Desktop\Crypto game show\live-art"
.\start-ws.bat
```

**Wait for this message:**
```
ws listening on :4001
```

### Window 2 - Next.js Web App:
```powershell
cd "C:\Users\zacka\Desktop\Crypto game show\live-art"
.\start-web.bat
```

**Wait for this message:**
```
✓ Ready in Xs
- Local: http://localhost:3000
```

## Step 2: Test It!

Open your browser:
👉 **http://localhost:3000/show/seed-show-1**

## ✅ Success Checklist:

- [ ] Terminal 1 shows "ws listening on :4001"
- [ ] Terminal 2 shows "Ready in Xs" and "Local: http://localhost:3000"
- [ ] Browser opens the page without "ERR_CONNECTION_REFUSED"
- [ ] Browser console (F12) shows "Socket.io Client connected"
- [ ] You can see the Recent Bids section
- [ ] You can send chat messages

## 🐛 If You See Errors:

### "Cannot find module '@live-art/db'"
Run this first:
```powershell
cd "C:\Users\zacka\Desktop\Crypto game show\live-art\packages\db"
npx prisma generate
cd ..\..
```
Then try starting servers again.

### "Port already in use"
Kill all node processes:
```powershell
taskkill /F /IM node.exe
```
Then start servers again.

### "ERR_CONNECTION_REFUSED" in browser
- Make SURE both terminals are running!
- Check Terminal 1 for "ws listening on :4001"
- Check Terminal 2 for "Local: http://localhost:3000"
- If either is NOT showing those messages, there's an error. Copy/paste the error and tell me!

## 📸 What You Should See:

**Terminal 1 (WebSocket):**
```
> @live-art/ws@0.1.0 dev
> tsx watch src/index.ts
ws listening on :4001
```

**Terminal 2 (Next.js):**
```
> @live-art/web@0.1.0 dev
> next dev -p 3000
  ▲ Next.js 14.2.33
  - Local:        http://localhost:3000
  
 ✓ Ready in 2.3s
```

**Browser Console (F12 → Console tab):**
```
Socket.io Client connected
```

---

## 🎯 Quick Start Commands:

Copy and paste these **one at a time** in PowerShell:

```powershell
# Navigate to project
cd "C:\Users\zacka\Desktop\Crypto game show\live-art"

# Terminal 1 - Start WebSocket (keep this running!)
.\start-ws.bat
```

Open a NEW PowerShell window:
```powershell
# Navigate to project
cd "C:\Users\zacka\Desktop\Crypto game show\live-art"

# Terminal 2 - Start Web App (keep this running!)
.\start-web.bat
```

Then open: http://localhost:3000/show/seed-show-1

