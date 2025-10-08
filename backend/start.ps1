# PowerShell script to start ForenChain Backend Server
Write-Host "Starting ForenChain Backend Server..." -ForegroundColor Green
$env:PORT = 3001
npm start
