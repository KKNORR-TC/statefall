param([switch]$DockerDesktop)
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
if ($running) {
    $args = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")
    docker @args stop
    if ($LASTEXITCODE -ne 0) { throw 'Statefall sandbox failed to stop.' }
} else { Write-Host 'Docker engine is unavailable; checking Desktop shutdown separately.' }
if ($DockerDesktop) {
    if (Get-Process '*docker*' -ErrorAction SilentlyContinue) {
        $shutdown = Start-Process -FilePath 'C:\Program Files\Docker\Docker\DockerCli.exe' -ArgumentList '-Shutdown' -WindowStyle Hidden -PassThru
        if (-not $shutdown.WaitForExit(10000)) { Stop-Process -Id $shutdown.Id -Force -ErrorAction SilentlyContinue }
    }
    for ($i = 0; $i -lt 20; $i++) {
        if (-not (Get-Process '*docker*' -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Seconds 1
    }
    # A crashed backend may not respond to graceful shutdown. Only stop this installation.
    $remaining = @(Get-Process '*docker*' -ErrorAction SilentlyContinue)
    foreach ($process in $remaining) {
        if ($process.HasExited) { continue }
        $path = $process.Path
        if (-not $path -and $process.HasExited) { continue }
        if (-not $path -or -not $path.StartsWith('C:\Program Files\Docker\Docker\', [StringComparison]::OrdinalIgnoreCase)) { continue } # Never stop unknown paths; the final live-process check still fails if any remain.
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    for ($i = 0; $i -lt 10; $i++) {
        if (-not (Get-Process '*docker*' -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Seconds 1
    }
    if (Get-Process '*docker*' -ErrorAction SilentlyContinue) { throw 'Docker Desktop processes remain after shutdown.' }
    & "$PSScriptRoot\preserve-runtime-sockets.ps1"
    Write-Host 'Docker Desktop and the Statefall sandbox are stopped.'
}
