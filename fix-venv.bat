@echo off
REM Fix Virtual Environment - Recreate from scratch
echo ============================================
echo   Recreating Virtual Environment
echo ============================================
echo.

cd /d "%~dp0backend"

REM Remove old virtual environment
echo Removing old .venv...
if exist .venv rmdir /s /q .venv

REM Create fresh virtual environment
echo Creating new virtual environment...
python -m venv .venv

REM Activate it
call .venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install poetry
echo Installing poetry...
pip install poetry

REM Install dependencies
echo Installing project dependencies (this may take 5-10 minutes)...
poetry install

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo You can now run:
echo   start-all.bat
echo.
pause
