# 🎥 Live Streaming - Testing Instructions

## How to Test Streaming

### Step 1: Start Your Servers

```powershell
# Kill all node processes
taskkill /F /IM node.exe

# Wait a moment
Start-Sleep -Seconds 2

# Start the game show (this starts both servers)
.\start-game-show.ps1
```

### Step 2: Open Studio Page

Open in your browser:
👉 **http://localhost:3001/studio**

### Step 3: Start a Stream

1. In the "Live Streaming" section, click **"Start Webcam"** on the "Host of the Night" stream
2. Allow camera and microphone permissions when prompted
3. You should see your webcam preview appear
4. Look for the console message: `[WebRTC Publisher host_1] Connected to signaling server`

### Step 4: Open Show Page

Open a new browser tab:
👉 **http://localhost:3001/show/seed-show-1**

### Step 5: Check Console Logs

Open the browser DevTools (F12) and go to the **Console** tab.

You should see:
```
[WebRTC Viewer host_1] Connecting to: http://localhost:4001
[WebRTC Viewer host_1] Connected to signaling server
```

### Step 6: Verify Stream is Working

You should now see:
- ✅ The host video stream should appear in the "Host of the Night" section
- ✅ A red "LIVE" indicator in the bottom-left of the video
- ✅ Console shows "Stream is available" message

### Step 7: Test Artist Streams

1. Go back to the Studio page
2. Click **"Start Screen Share"** on one of the Artist streams
3. Select a screen or window to share
4. Go back to the Show page - you should see the screen share appear

## Troubleshooting

### Issue: Still seeing "Waiting for stream..."
- **Check browser console** for connection errors
- **Verify both servers are running** (WebSocket on port 4001, Web on port 3001)

### Issue: Console shows connection errors
- Verify the WebSocket server is running on port 4001
- Check that `.env.local` has `NEXT_PUBLIC_WS_URL=http://localhost:4001` (or leave it unset to use the default)

### Issue: CORS errors
- Restart the WebSocket server after changes
- Make sure both servers are running on the correct ports

## What to Look For

✅ **Working correctly:**
- Console shows WebSocket URL
- Videos appear when streams are started
- No connection errors in console
- Streams are LIVE and showing content

❌ **Still broken:**
- Connection refused errors
- Videos never change from "Waiting for stream..."

## Need More Help?

If streams still don't work, share:
1. Browser console logs (F12 → Console tab)
2. Network tab showing WebSocket connection attempts
3. Server terminal output

