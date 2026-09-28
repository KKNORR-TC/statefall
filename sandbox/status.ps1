$ErrorActionPreference = 'Stop'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }
$prior = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
docker info *> $null
$running = $LASTEXITCODE -eq 0
$ErrorActionPreference = $prior
if (-not $running) {
    if (Get-Process '*docker*' -ErrorAction SilentlyContinue) { Write-Host 'Docker engine is unavailable, but Docker Desktop processes are still running.'; exit 1 }
    Write-Host 'Docker Desktop and the Statefall sandbox are stopped.'; return
}
$args = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")
docker @args ps
