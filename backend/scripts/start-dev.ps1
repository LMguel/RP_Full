# Script para iniciar Backend e Frontend simultaneamente
# Usar: .\start-dev.ps1

Write-Host "🚀 INICIANDO APLICAÇÃO COMPLETA - RP_FULL" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Cyan

# Função para iniciar o backend
function Start-Backend {
    Write-Host "🔧 Iniciando Backend (Flask)..." -ForegroundColor Yellow
    Set-Location "$PSScriptRoot"
    
    # Ativa o ambiente virtual se existir
    if (Test-Path ".\.venv\Scripts\Activate.ps1") {
        Write-Host "🐍 Ativando ambiente virtual..." -ForegroundColor Blue
        & .\.venv\Scripts\Activate.ps1
    }
    
    # Inicia o Flask
    python app.py
}

# Função para iniciar o frontend
function Start-Frontend {
    Write-Host "🎨 Iniciando Frontend (Vite)..." -ForegroundColor Yellow
    
    # Aguarda um pouco para o backend subir
    Start-Sleep -Seconds 3
    
    # Navega para o frontend
    Set-Location "$PSScriptRoot\..\front"
    
    # Inicia o Vite
    npm run dev
}

try {
    # Inicia ambos os processos em paralelo
    $backendJob = Start-Job -ScriptBlock ${function:Start-Backend}
    $frontendJob = Start-Job -ScriptBlock ${function:Start-Frontend}
    
    # Carregar variáveis de ambiente
    if (Test-Path ".\.env") {
        Get-Content ".\.env" | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
    
    $backendPort = if ($env:FLASK_PORT) { $env:FLASK_PORT } else { "5000" }
    $frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "5173" }
    
    Write-Host ""
    Write-Host "✅ Aplicação iniciada com sucesso!" -ForegroundColor Green
    Write-Host "🔗 Backend: http://localhost:$backendPort" -ForegroundColor Cyan
    Write-Host "🎨 Frontend: http://localhost:$frontendPort" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  Pressione Ctrl+C para parar ambos os serviços" -ForegroundColor Yellow
    Write-Host ""
    
    # Aguarda os jobs terminarem
    Wait-Job $backendJob, $frontendJob
    
} catch {
    Write-Host "❌ Erro ao iniciar aplicação: $_" -ForegroundColor Red
} finally {
    # Remove os jobs
    Remove-Job $backendJob, $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "👋 Aplicação encerrada!" -ForegroundColor Yellow
}