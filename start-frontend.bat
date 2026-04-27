@echo off
REM Start Frontend Development Server
echo Starting Frontend Server...

cd /d "%~dp0frontend"

REM Check if node_modules exists, install if not
if not exist "node_modules" (
    echo Installing dependencies...
    call yarn install
)

REM Start the dev server
call yarn dev

pause
