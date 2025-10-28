param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('start','stop','restart','status','logs','clean','logs-rotate','start-verbose')]
  [string]$action
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runDir = Join-Path $root '.run'
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $runDir, $logDir | Out-Null

$backendPid = Join-Path $runDir 'backend.pid'
$frontendPid = Join-Path $runDir 'frontend.pid'
$backendLog = Join-Path $logDir 'backend.log'
$frontendLog = Join-Path $logDir 'frontend.log'

function Rotate-Log([string]$logPath) {
  if (-not (Test-Path $logPath)) { return }
  $archive = Join-Path $logDir 'archive'
  New-Item -ItemType Directory -Force -Path $archive | Out-Null
  $base = Split-Path -Leaf $logPath
  $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
  $dest = Join-Path $archive "$ts-$base"
  try { Move-Item -Path $logPath -Destination $dest -Force } catch {}
  # Retencion: mantener ultimos 10 por archivo
  $pattern = "*-" + $base
  Get-ChildItem $archive -Filter $pattern | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 | ForEach-Object { try { Remove-Item $_.FullName -Force } catch {} }
}

function Rotate-Logs {
  Write-Host 'Rotando logs...' -ForegroundColor Cyan
  Rotate-Log $backendLog
  Rotate-Log $frontendLog
}

function Clean-Env {
  Write-Host 'Haciendo clean: detener procesos y rotar logs' -ForegroundColor Cyan
  Stop-ByPidFile $backendPid 'backend'
  Stop-ByPidFile $frontendPid 'frontend'
  Rotate-Logs
  # Quitar PIDs huerfanos
  Remove-Item $backendPid, $frontendPid -ErrorAction SilentlyContinue
}

function Start-Backend {
  $py = Join-Path $root '.venv\Scripts\python.exe'
  if (-not (Test-Path $py)) { throw "No se encontro Python del venv en $py. Crea el venv e instala deps." }
  $backendDir = Join-Path $root 'backend'
  if (-not (Test-Path $backendDir)) { throw "No se encontro carpeta backend en $backendDir" }

  $cmd = "$py -m uvicorn app.main:app --reload --port 8000 --app-dir `"$backendDir`""
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', ($cmd + " >> `"$backendLog`" 2>&1") -WorkingDirectory $root -WindowStyle Minimized -PassThru
  $p.Id | Set-Content $backendPid
  Write-Host "Backend iniciado (PID=$($p.Id)) en http://127.0.0.1:8000" -ForegroundColor Green
}

function Start-Frontend {
  $frontendDir = Join-Path $root 'frontend'
  if (-not (Test-Path (Join-Path $frontendDir 'package.json'))) { throw "No hay package.json en $frontendDir. Ejecuta npm en la carpeta frontend, no en backend." }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "No se encontro 'npm' en el PATH. Instala Node.js." }

  # Instalar deps si faltan
  if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
    Write-Host 'Instalando dependencias del frontend (npm install)...' -ForegroundColor Cyan
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', ('npm install >> ' + "`"$frontendLog`" 2>&1") -WorkingDirectory $frontendDir -Wait | Out-Null
  }

  # Si el puerto esta ocupado, informarlo y fallar rapido con --strictPort
  try { $conn = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction Stop } catch { $conn = $null }
  if ($conn) { Write-Host "Aviso: el puerto 5173 esta en uso por PID $($conn.OwningProcess). Intentare iniciar Vite igualmente." -ForegroundColor Yellow }

  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', ('npm run dev -- --strictPort >> ' + "`"$frontendLog`" 2>&1") -WorkingDirectory $frontendDir -WindowStyle Minimized -PassThru
  $p.Id | Set-Content $frontendPid
  Write-Host "Frontend iniciado (PID=$($p.Id)) en http://127.0.0.1:5173" -ForegroundColor Green
  Start-Sleep -Milliseconds 800
  $alive = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if (-not $alive) {
    Write-Host "El proceso de Vite termino inmediatamente. Es probable que el puerto 5173 este en uso o haya fallado el arranque." -ForegroundColor Red
    if (Test-Path $frontendPid) { Remove-Item $frontendPid -ErrorAction SilentlyContinue }
    try {
      $conn2 = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction Stop
      if ($conn2) { Write-Host "Puerto 5173 en uso por PID $($conn2.OwningProcess). Libera con: taskkill /PID $($conn2.OwningProcess) /F" -ForegroundColor Yellow }
    } catch {}
    Write-Host "Revisa los logs en $frontendLog o usa: .\run_app.ps1 start-verbose" -ForegroundColor Yellow
  }
}

function Stop-ByPidFile([string]$pidFile, [string]$name) {
  if (Test-Path $pidFile) {
    $targetPid = Get-Content $pidFile | Select-Object -First 1
    if ($targetPid) {
      Write-Host "Deteniendo $name (PID=$targetPid)" -ForegroundColor Yellow
      try { Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue } catch {}
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
  } else {
    Write-Host "$name no tenia PID registrado; intentando buscar por puerto si aplica..." -ForegroundColor DarkYellow
  }
}

function Status-Item([string]$pidFile, [string]$name) {
  if (Test-Path $pidFile) {
    $targetPid = Get-Content $pidFile | Select-Object -First 1
    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if ($proc) { Write-Host "${name}: RUNNING (PID=$targetPid)" -ForegroundColor Green }
    else { Write-Host "${name}: STOPPED (PID file huerfano)" -ForegroundColor Yellow }
  } else {
    Write-Host "${name}: STOPPED" -ForegroundColor Yellow
  }
}

switch ($action) {
  'start' {
    Start-Backend
    Start-Frontend
  }
  'start-verbose' {
    Write-Host 'Abriendo consolas visibles...' -ForegroundColor Cyan
    # Escapar el $ para que no se expanda en esta sesión y se evalúe en la nueva consola
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root/backend`"; `$env:PYTHONIOENCODING='utf-8'; `"$root/.venv/Scripts/python.exe`" -m uvicorn app.main:app --reload --port 8000 --app-dir `"$root/backend`"" -WorkingDirectory $root
    # Pasar flags explicitos a Vite; usa --strictPort para fallar rapido si 5173 esta ocupado
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root/frontend`"; npm run dev -- --host --port 5173 --strictPort" -WorkingDirectory $root
  }
  'stop' {
    Stop-ByPidFile $backendPid 'backend'
    Stop-ByPidFile $frontendPid 'frontend'
  }
  'clean' {
    Clean-Env
  }
  'logs-rotate' {
    Rotate-Logs
  }
  'restart' {
    Stop-ByPidFile $backendPid 'backend'
    Stop-ByPidFile $frontendPid 'frontend'
    Start-Backend
    Start-Frontend
  }
  'status' {
    Status-Item $backendPid 'backend'
    Status-Item $frontendPid 'frontend'
    Write-Host "Logs: $backendLog, $frontendLog"
  }
  'logs' {
    Write-Host "Mostrando ultimas lineas de logs..." -ForegroundColor Cyan
    if (Test-Path $backendLog) { Write-Host "== backend ==" -ForegroundColor Cyan; Get-Content $backendLog -Tail 20 }
    if (Test-Path $frontendLog) { Write-Host "== frontend ==" -ForegroundColor Cyan; Get-Content $frontendLog -Tail 20 }
  }
  default { Write-Host "Accion no reconocida." -ForegroundColor Red }
}

Write-Host "Listo." -ForegroundColor Cyan
