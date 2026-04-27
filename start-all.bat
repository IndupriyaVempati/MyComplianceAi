@echo off
REM Start Both Backend and Frontend
echo ============================================
echo   MyComplianceAi - Starting Application
echo ============================================
echo.

REM Start Backend in new window
start "Backend Server" cmd /k "cd /d %~dp0 && call start-backend.bat"

REM Wait 2 seconds
timeout /t 2 /nobreak >nul

REM Start Frontend in new window
start "Frontend Server" cmd /k "cd /d %~dp0 && call start-frontend.bat"

echo.
echo Both servers are starting in separate windows...
echo.
echo Access the application at:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8100
echo.
echo Press any key to close this window...
pause >nul
