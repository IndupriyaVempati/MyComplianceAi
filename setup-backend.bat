@echo off
echo ============================================
echo   Setting up Backend with Python 3.9
echo ============================================
echo.

cd /d "%~dp0backend"

REM Check if Python is available
echo Checking Python version...
python --version
echo.

REM Remove old .venv if it exists
if exist .venv (
    echo Removing old virtual environment...
    rmdir /s /q .venv
    timeout /t 2 /nobreak >nul
)

REM Create fresh virtual environment
echo Creating virtual environment...
python -m venv .venv
echo.

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat
echo.

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip
echo.

REM Install dependencies one by one to avoid build issues
echo Installing core dependencies...
echo This will take 5-10 minutes. Please wait...
echo.

python -m pip install --upgrade setuptools wheel

REM Install packages that don't require compilation first
python -m pip install ^
    "uvicorn>=0.23.2" ^
    "fastapi>=0.103.2" ^
    "pydantic>=2" ^
    "orjson>=3.9.10" ^
    "python-multipart>=0.0.6" ^
    "sse-starlette>=1.6.5" ^
    "structlog>=24.1.0" ^
    "python-json-logger>=2.0.7" ^
    "tiktoken>=0.7" ^
    "python-dotenv" ^
    "pyjwt[crypto]>=2.8.0" ^
    "passlib>=1.7.4" ^
    "bcrypt>=4.0.0" ^
    "stripe>=11.5.0" ^
    "markdown>=3.10" ^
    "beautifulsoup4>=4.12" ^
    "duckduckgo-search>=5.3.0" ^
    "arxiv>=2.1.0" ^
    "wikipedia>=1.4.0" ^
    "httpx"

echo.
echo Installing LangChain packages...
python -m pip install ^
    "langchain>=0.3" ^
    "langchain-core>=0.3" ^
    "langchain-openai>=0.2" ^
    "langchain-anthropic>=0.2" ^
    "langchain-community>=0.3" ^
    "langchain-pinecone>=0.2"

echo.
echo Installing LangGraph...
python -m pip install ^
    "langgraph==0.2.45" ^
    "langgraph-checkpoint-postgres>=2.0.2"

echo.
echo Installing database drivers...
python -m pip install ^
    "pgvector>=0.2.5" ^
    "psycopg2-binary>=2.9.9" ^
    "asyncpg>=0.29.0" ^
    "aiosqlite>=0.20"

echo.
echo Installing document processing...
python -m pip install ^
    "pymupdf>=1.23.0" ^
    "pdfminer-six>=20231228" ^
    "llama-index-core>=0.12" ^
    "llama-index-readers-file>=0.4"

echo.
echo Installing embeddings and vector stores...
python -m pip install ^
    "sentence-transformers>=3.0" ^
    "pinecone-client>=3.0"

echo.
echo Installing PDF generation...
python -m pip install "weasyprint>=68.1"

echo.
echo ============================================
echo   Installation Complete!
echo ============================================
echo.
echo Testing if backend can start...
echo.

REM Quick test to see if imports work
python -c "import fastapi; import langgraph; import langchain; print('All core imports OK!')"

echo.
echo You can now start the application:
echo   start-all.bat
echo.
pause
