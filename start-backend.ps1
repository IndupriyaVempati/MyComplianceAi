# Start Backend Server
# This script starts the FastAPI backend server

Write-Host "Starting Backend Server on port 8100..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\backend"

function Resolve-BackendPython {
    $candidates = @(
        (Join-Path $PSScriptRoot "backend\.venv312\Scripts\python.exe"),
        (Join-Path $PSScriptRoot "backend\.venv\Scripts\python.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return "python"
}

# Load environment variables
$envFile = Join-Path $PSScriptRoot "backend\.env"
if (Test-Path $envFile) {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Start the server
Write-Host "Backend server starting..." -ForegroundColor Yellow
$pythonExe = Resolve-BackendPython
Write-Host "Using Python: $pythonExe" -ForegroundColor Cyan
& $pythonExe -m uvicorn app.server:app --host 0.0.0.0 --port 8100 --reload
