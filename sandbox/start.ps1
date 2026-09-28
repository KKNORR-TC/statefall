param([switch]$Pull)
$ErrorActionPreference = 'Stop'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }

function Test-DockerReady {
    $prior = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    docker info *> $null
    $ready = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prior
    return $ready
}

if (-not (Test-DockerReady)) {
    Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 5
        if (Test-DockerReady) { $ready = $true; break }
    }
    if (-not $ready) { throw 'Docker Desktop did not become ready.' }
}

$args = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")
if ($Pull) { docker @args pull }
docker @args up -d
if ($LASTEXITCODE -ne 0) { throw 'Statefall sandbox failed to start.' }

$settings = @{}
foreach ($line in [IO.File]::ReadAllLines("$PSScriptRoot\.env")) {
    if ($line -match '^\s*([^#][^=]*)=(.*)$') { $settings[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"') }
}
$user = $settings.WORDPRESS_LOCAL_ADMIN_USER
$password = $settings.WORDPRESS_LOCAL_ADMIN_PASSWORD
$cli = $args + @('--profile', 'tools', 'run', '--rm', 'cli')
$prior = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
docker @cli user get $user --field=ID *> $null
$userExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = $prior
if (-not $userExists) {
    docker @cli search-replace 'https://www.worldrts.com' 'http://localhost:8088' --all-tables-with-prefix --skip-columns=guid --quiet
    docker @cli search-replace 'https://statefall.wpenginepowered.com' 'http://localhost:8088' --all-tables-with-prefix --skip-columns=guid --quiet
    docker @cli user create $user 'statefall-local@example.invalid' --role=administrator "--user_pass=$password" '--display_name=Statefall Local Admin' --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the synthetic local administrator.' }
}
docker @cli option update home 'http://localhost:8088' --quiet
docker @cli option update siteurl 'http://localhost:8088' --quiet
docker @args ps
Write-Host 'Statefall sandbox: http://localhost:8088/'
