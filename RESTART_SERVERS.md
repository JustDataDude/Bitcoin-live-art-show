# 🔄 Server Restart Instructions

## ✅ Both Servers Are Now Running!

I've started both servers in the background:
- ✅ WebSocket Server (port 4001)
- ✅ Next.js Web App (port 3000)

## 🧪 Test It Now:

### Step 1: Open the Show Page
👉 **http://localhost:3000/show/seed-show-1**

### Step 2: Check Browser Console
1. Press **F12** to open DevTools
2. Go to **Console** tab
3. Look for any errors (red messages)

### Step 3: What You Should See:
- ✅ Chat box on the right side
- ✅ "Recent Bids" section showing historical bids
- ✅ "Recent Tips" section
- ✅ Video streams loading
- ✅ Connection status showing "Connected"

### Step 4: Test Chat
1. Type your username at the top
2. Type a message in the chat box
3. Click "Send" or press Enter
4. Message should appear in the chat!

### Step 5: Test Bidding
1. Enter a bid amount (try $300)
2. Click "Place Bid"
3. Bid should appear in both:
   - Recent Bids section
   - Chat (yellow text)

### Step 6: Test Tips
1. Enter a tip message (e.g., "Great show!")
2. Click "Send $1 Tip"
3. Tip should appear in both:
   - Recent Tips section
   - Chat (green text with message)

## 🐛 If Still Not Working:

### Check Console for Errors:

**"Failed to connect to WebSocket"**
```powershell
# Restart WebSocket server
cd live-art/apps/ws
npm run dev
```

**"Failed to load history"**
```powershell
# Check if Next.js is running
cd live-art/apps/web
npm run dev
```

**"Cannot read property of undefined"**
- Hard refresh: **Ctrl + Shift + R**
- Clear cache: **Ctrl + Shift + Delete**

## 🔍 Debug Checklist:

Open browser console (F12) and check:
- [ ] "Socket.io Client connected" message
- [ ] No red errors in console
- [ ] Network tab shows WebSocket connected (ws://localhost:4001)
- [ ] API calls returning 200 status (not 404 or 500)

## 📊 View Database:

To see what's actually saved:
```powershell
cd packages/db
npx prisma studio
```
Open http://localhost:5555 and check:
- ChatMessage table - Should have messages
- Bid table - Should have bids
- Tip table - Should have tips

## 🆘 Emergency Reset:

If nothing works, restart everything:

### Step 1: Stop All Servers
```powershell
# Press Ctrl+C on any terminals that are running
# Or close all terminal windows
```

### Step 2: Kill All Node Processes
```powershell
taskkill /F /IM node.exe
```

### Step 3: Start Fresh
```powershell
# Terminal 1
cd live-art/apps/ws
npm run dev

# Terminal 2 (new terminal window)
cd live-art/apps/web
npm run dev
```

### Step 4: Wait 10 seconds, then test again!

## 💡 Common Issues:

### Issue: "Port 3000 already in use"
**Solution:** Another app is using port 3000. Close it or change Next.js port:
```powershell
cd live-art/apps/web
npm run dev -- -p 3001
```

### Issue: Chat messages not saving
**Solution:** WebSocket server might not be connected to database. Check console for:
```
[Bid] Error: ...
[Tip] Error: ...
[Chat] Error: ...
```

### Issue: Old data showing
**Solution:** Clear browser cache and hard refresh (Ctrl+Shift+R)

## ✅ Success Looks Like:

When everything works, you should be able to:
1. Open 2 browser windows
2. Chat between them in real-time
3. Place bids and see them appear instantly
4. Send tips with messages
5. Refresh and see all history persist!

Let me know what you see in the browser console! 🔍

