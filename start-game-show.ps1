# Game Show Startup Script
Write-Host "Starting Game Show Services..." -ForegroundColor Cyan

# Kill any existing node processes
Write-Host "Stopping existing services..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null

Start-Sleep -Seconds 2

# Start WebSocket Server
Write-Host "Starting WebSocket server on port 4001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$PSScriptRoot\apps\ws'; npm run dev`"" -WindowStyle Minimized
Start-Sleep -Seconds 3

# Start Next.js Web Server
Write-Host "Starting web server on port 3001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$PSScriptRoot\apps\web'; npx next dev -p 3001`"" -WindowStyle Minimized
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Game Show is starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  - Studio: http://localhost:3001/studio" -ForegroundColor Yellow
Write-Host "  - Show: http://localhost:3001/show/seed-show-1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please wait 10-15 seconds for all services to initialize..." -ForegroundColor Gray
Write-Host ""
