# Verify Ollama Setup
# This script checks if Ollama and required models are installed

Write-Host "Checking Ollama Setup..." -ForegroundColor Green
Write-Host ""

# Check if Ollama is installed
try {
    $ollamaVersion = ollama --version 2>&1
    Write-Host "✓ Ollama is installed: $ollamaVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Ollama is not installed or not in PATH" -ForegroundColor Red
    Write-Host "  Download from: https://ollama.ai" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Checking required models..." -ForegroundColor Cyan

$models = @("qwen3:8b", "gemma3:4b", "glm4:9b")
$installedModels = ollama list 2>&1

foreach ($model in $models) {
    if ($installedModels -match $model) {
        Write-Host "  ✓ $model" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $model (NOT INSTALLED)" -ForegroundColor Red
        Write-Host "    Install with: ollama pull $model" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Checking Ollama service..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Ollama service is running on http://localhost:11434" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Ollama service is not responding" -ForegroundColor Red
    Write-Host "  Make sure Ollama is running (check system tray)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Model Status Summary:" -ForegroundColor Green
Write-Host "  - Qwen 3 (8B): Default model for balanced performance"
Write-Host "  - Gemma 3 (4B): Lightweight model for faster responses"
Write-Host "  - GLM 4 (9B): Advanced model for complex reasoning"
Write-Host ""
Write-Host "To install missing models, run:" -ForegroundColor Yellow
Write-Host "  ollama pull qwen3:8b" -ForegroundColor White
Write-Host "  ollama pull gemma3:4b" -ForegroundColor White
Write-Host "  ollama pull glm4:9b" -ForegroundColor White
Write-Host ""
