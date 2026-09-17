$ErrorActionPreference = 'Stop'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }

$settings = @{}
foreach ($line in [IO.File]::ReadAllLines("$PSScriptRoot\.env")) {
    if ($line -match '^\s*([^#][^=]*)=(.*)$') { $settings[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"') }
}
$base = "http://localhost:$($settings.STATEFALL_PORT)"
$compose = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")

docker @compose exec -T wordpress sh -lc 'set -e; find /var/www/html/wp-content/plugins/statefall-scores -name \*.php -print0 | xargs -0 -n1 php -l >/dev/null'
if ($LASTEXITCODE -ne 0) { throw 'Plugin PHP syntax check failed.' }

$homePage = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 60
if ($homePage.StatusCode -ne 200) { throw "Home returned HTTP $($homePage.StatusCode)." }
$play = Invoke-WebRequest -Uri "$base/play/" -UseBasicParsing -TimeoutSec 60
if ($play.StatusCode -ne 200 -or $play.Content -notmatch "GAME_VERSION='1\.10\.9'") { throw 'Game route or embedded version check failed.' }
$board = Invoke-WebRequest -Uri "$base/leaderboard/" -UseBasicParsing -TimeoutSec 60
if ($board.StatusCode -ne 200 -or $board.Content -notmatch 'not independently verified') { throw 'Leaderboard trust label check failed.' }
$classes = Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/classes" -TimeoutSec 60
if ($null -eq $classes) { throw 'Public classes endpoint returned no data.' }

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-WebRequest -Uri "$base/wp-login.php" -WebSession $session -UseBasicParsing -TimeoutSec 60 | Out-Null
$login = @{
    log = $settings.WORDPRESS_LOCAL_ADMIN_USER
    pwd = $settings.WORDPRESS_LOCAL_ADMIN_PASSWORD
    'wp-submit' = 'Log In'
    redirect_to = "$base/play/"
    testcookie = '1'
}
$page = Invoke-WebRequest -Uri "$base/wp-login.php" -Method Post -Body $login -WebSession $session -UseBasicParsing -TimeoutSec 60
if ($page.Content -notmatch '"nonce":"([^"]+)"') { throw 'Authenticated game page did not expose a REST nonce.' }
$headers = @{'X-WP-Nonce' = $Matches[1]}
$me = Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/me" -Headers $headers -WebSession $session -TimeoutSec 60
if ($me.name -ne 'Statefall Local Admin') { throw 'Authenticated REST identity check failed.' }

$saveId = $null
try {
    $payload = @{
        kind = 'save'
        slot = 'Sandbox integration check'
        data = @{
            v = 1
            game = '1.10.7'
            seed = 'LOCALVERIFY'
            settings = @{map = 'random'; diff = 'normal'}
            cmds = @()
            hashes = @()
            tick = 10
            result = 'in progress'
        }
    } | ConvertTo-Json -Depth 8 -Compress
    $created = Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves" -Method Post -Headers $headers -WebSession $session -ContentType 'application/json' -Body $payload -TimeoutSec 60
    $saveId = [int]$created.id
    if ($saveId -le 0) { throw 'Save endpoint did not create a record.' }
    $loaded = Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$saveId" -Headers $headers -WebSession $session -TimeoutSec 60
    if ($loaded.data.seed -ne 'LOCALVERIFY') { throw 'Save endpoint did not return the stored record.' }
} finally {
    if ($saveId) { Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$saveId" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null }
}

Write-Host "PASS WordPress 7.1 / PHP 8.4 sandbox, public routes, authenticated REST, and save CRUD"
