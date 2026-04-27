@echo off
REM Start Backend using the virtual environment
echo Starting Backend Server...

cd /d "%~dp0backend"

REM Use the working virtual environment directly. Fall back to system Python
REM only if no project virtual environment exists.
if exist ".venv312\Scripts\python.exe" (
    set "PYTHON_EXE=.venv312\Scripts\python.exe"
) else if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

echo Using Python: %PYTHON_EXE%
"%PYTHON_EXE%" -m uvicorn app.server:app --host 0.0.0.0 --port 8100 --reload

pause
