# Quick Fix Script - Install dependencies with pip
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Installing Backend Dependencies" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path "$PSScriptRoot\backend"

# Check if .venv exists
if (-Not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
.\.venv\Scripts\Activate.ps1

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install core dependencies
Write-Host "Installing core dependencies (this will take 5-10 minutes)..." -ForegroundColor Yellow
python -m pip install `
    "uvicorn>=0.23.2" `
    "fastapi>=0.103.2" `
    "langgraph==0.2.45" `
    "langgraph-checkpoint-postgres>=2.0.2" `
    "langchain>=0.3" `
    "langchain-core>=0.3" `
    "langchain-openai>=0.2" `
    "langchain-anthropic>=0.2" `
    "langchain-community>=0.3" `
    "langchain-pinecone>=0.2" `
    "langchain-huggingface>=0.1" `
    "pydantic>=2" `
    "orjson>=3.9.10" `
    "python-multipart>=0.0.6" `
    "tiktoken>=0.7" `
    "sse-starlette>=1.6.5" `
    "structlog>=24.1.0" `
    "python-json-logger>=2.0.7" `
    "pgvector>=0.2.5" `
    "psycopg2-binary>=2.9.9" `
    "asyncpg>=0.29.0" `
    "aiosqlite>=0.20" `
    "sentence-transformers>=3.0" `
    "pinecone-client>=3.0" `
    "python-dotenv" `
    "pyjwt[crypto]>=2.8.0" `
    "passlib>=1.7.4" `
    "bcrypt>=4.0.0" `
    "stripe>=11.5.0" `
    "markdown>=3.10" `
    "weasyprint>=68.1" `
    "pymupdf>=1.23.0" `
    "pdfminer-six>=20231228" `
    "beautifulsoup4>=4.12" `
    "duckduckgo-search>=5.3.0" `
    "arxiv>=2.1.0" `
    "wikipedia>=1.4.0" `
    "llama-index-core>=0.12" `
    "llama-index-readers-file>=0.4" `
    "httpx[socks]" `
    "python-dotenv"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now start the servers:" -ForegroundColor Yellow
Write-Host "  .\start-all.bat" -ForegroundColor White
Write-Host ""
