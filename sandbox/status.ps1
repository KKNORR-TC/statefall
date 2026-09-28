$ErrorActionPreference = 'Stop'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }
$probeInfo = [Diagnostics.ProcessStartInfo]::new()
$probeInfo.FileName = Join-Path $dockerBin 'docker.exe'
$probeInfo.Arguments = 'info'
$probeInfo.UseShellExecute = $false
$probeInfo.CreateNoWindow = $true
$probeInfo.RedirectStandardOutput = $true
$probeInfo.RedirectStandardError = $true
$probe = [Diagnostics.Process]::new()
$probe.StartInfo = $probeInfo
try {
    [void]$probe.Start()
    $probeOutput = $probe.StandardOutput.ReadToEndAsync()
    $probeError = $probe.StandardError.ReadToEndAsync()
    $answered = $probe.WaitForExit(10000)
    if (-not $answered) { $probe.Kill(); [void]$probe.WaitForExit(2000) }
    $running = $answered -and $probe.ExitCode -eq 0
} finally { $probe.Dispose() }
if (-not $running) {
    if (Get-Process '*docker*' -ErrorAction SilentlyContinue) { Write-Host 'Docker engine is unavailable, but Docker Desktop processes are still running.'; exit 1 }
    Write-Host 'Docker Desktop and the Statefall sandbox are stopped.'; return
}
$args = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")
docker @args ps
