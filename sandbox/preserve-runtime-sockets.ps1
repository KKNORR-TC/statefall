# Docker 4.90 can leave inaccessible Windows socket reparse points after exit.
# Preserve only the two known, socket-only runtime directories; never Docker data.
$ErrorActionPreference = 'Stop'
if (Get-Process '*docker*' -ErrorAction SilentlyContinue) {
    throw 'Runtime socket preparation requires Docker Desktop to be fully stopped.'
}
$runtimeRoot = [IO.Path]::GetFullPath([Environment]::GetFolderPath('LocalApplicationData'))
$runtimeSpecs = @(
    @{ Relative = 'Docker\run'; Names = @('dockerEthernetVfkit', 'dockerInference', 'sailor-ingest.sock', 'userAnalyticsOtlpHttp.sock') },
    @{ Relative = 'docker-secrets-engine'; Names = @('engine.sock') }
)
foreach ($spec in $runtimeSpecs) {
    $target = [IO.Path]::GetFullPath((Join-Path $runtimeRoot $spec.Relative))
    if (-not $target.StartsWith($runtimeRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected runtime path.' }
    if (-not (Test-Path -LiteralPath $target)) { continue }
    $directory = Get-Item -LiteralPath $target -Force
    $parent = Get-Item -LiteralPath $directory.Parent.FullName -Force
    if (-not $directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -or ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Refusing redirected runtime directory: $target" }
    $entries = @(Get-ChildItem -LiteralPath $target -Force)
    if (-not $entries.Count) { continue }
    foreach ($entry in $entries) {
        $baseName = $entry.Name -replace '\.stale$', ''
        if ($baseName -notin $spec.Names -or $entry.PSIsContainer -or -not ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Unexpected runtime entry; preserved in place for inspection: $($entry.FullName)"
        }
    }
    # Recheck immediately before mutation. Move the parent, never dereference a socket.
    if (Get-Process '*docker*' -ErrorAction SilentlyContinue) { throw 'Docker started during socket preparation.' }
    $resolved = (Resolve-Path -LiteralPath $target).ProviderPath
    if ($resolved -ne $target) { throw 'Runtime path resolution changed.' }
    $preserved = $target + '-preserved-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
    if ((Split-Path -Parent $preserved) -ne $directory.Parent.FullName -or (Test-Path -LiteralPath $preserved)) { throw 'Invalid preservation destination.' }
    Move-Item -LiteralPath $resolved -Destination $preserved
    New-Item -ItemType Directory -Path $target | Out-Null
    Write-Host "Preserved $($entries.Count) stopped Docker runtime sockets: $preserved"
}
