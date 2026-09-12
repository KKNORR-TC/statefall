param([switch]$DockerDesktop)
$ErrorActionPreference = 'Stop'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }
$prior = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
docker info *> $null
$running = $LASTEXITCODE -eq 0
$ErrorActionPreference = $prior
if (-not $running) { Write-Host 'Docker Desktop and the Statefall sandbox are already stopped.'; return }
$args = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")
docker @args stop
if ($LASTEXITCODE -ne 0) { throw 'Statefall sandbox failed to stop.' }
if ($DockerDesktop) { & 'C:\Program Files\Docker\Docker\DockerCli.exe' -Shutdown }
