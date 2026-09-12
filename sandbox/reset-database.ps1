param([switch]$Force)
$ErrorActionPreference = 'Stop'
if (-not $Force) { throw 'This deletes the local sandbox database. Re-run with -Force to confirm.' }
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }
$args = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")
docker @args down --volumes
if ($LASTEXITCODE -ne 0) { throw 'Statefall sandbox database reset failed.' }
Write-Host 'Local database removed. Run sandbox/start.ps1 to import the backup again.'
