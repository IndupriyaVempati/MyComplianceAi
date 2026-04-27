# Start Frontend Development Server
# This script starts the Vite + React frontend

Write-Host "Starting Frontend Server on port 5173..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\frontend"

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    yarn install
}

# Start the dev server
Write-Host "Frontend server starting..." -ForegroundColor Yellow
yarn dev
