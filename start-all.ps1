# Start Both Backend and Frontend
# This script starts both servers in separate windows

Write-Host "Starting MyComplianceAi Application..." -ForegroundColor Green
Write-Host ""

# Get the script directory
$rootDir = $PSScriptRoot

# Start Backend in new window
Write-Host "Launching Backend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; .\start-backend.ps1"

# Wait a moment for backend to initialize
Start-Sleep -Seconds 2

# Start Frontend in new window
Write-Host "Launching Frontend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; .\start-frontend.ps1"

Write-Host ""
Write-Host "Both servers are starting in separate windows..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Access the application at:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8100" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
