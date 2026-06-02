# Camunda 集装箱出口协作流程 — 一键启动脚本
# 用法：.\scripts\start.ps1 [orderId]
# 如果遇到权限问题，先执行：Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

param(
    [string]$OrderId = ""
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "============================================"
Write-Host "  Container Export Collaboration Launcher"
Write-Host "============================================"
Write-Host ""

# 1. 检查 Camunda 8 Run
Write-Host "[1/4] Checking Camunda 8 Run..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/" -TimeoutSec 3 -UseBasicParsing
    Write-Host "  OK  Camunda 8 Run is running on port 8080"
} catch {
    Write-Host "  !! Camunda 8 Run may not be running. Please start it first:"
    Write-Host "     cd E:\camunda && .\c8run.exe start"
    Write-Host ""
    $choice = Read-Host "  Press Enter to continue anyway, or Ctrl+C to abort"
}
Write-Host ""

# 2. 部署 BPMN
Write-Host "[2/4] Deploying BPMN..."
Set-Location $RootDir
npm run deploy
if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
Write-Host ""

# 3. 启动 worker（后台）
Write-Host "[3/4] Starting all 9 workers in background..."
$workerJob = Start-Job -ScriptBlock {
    Set-Location $using:RootDir
    npm run start:all
}
Write-Host "  Worker Job ID: $($workerJob.Id)"
Start-Sleep -Seconds 3
Write-Host ""

# 4. 启动流程实例
Write-Host "[4/4] Starting process instances..."
if ($OrderId) {
    $processResult = npm run start:processes -- $OrderId
} else {
    $processResult = npm run start:processes
}
Write-Host ""

Write-Host "============================================"
Write-Host "  All set! Workers are running in background."
Write-Host "  View in Operate: http://localhost:8081"
Write-Host ""
Write-Host "  To stop: Stop-Job -Id $($workerJob.Id) ; Remove-Job -Id $($workerJob.Id)"
Write-Host "============================================"

# 等待用户按 Ctrl+C
try {
    Write-Host "Press Ctrl+C to stop all workers..."
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`nStopping workers..."
    Stop-Job -Id $workerJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $workerJob.Id -ErrorAction SilentlyContinue
    Write-Host "Done."
}
