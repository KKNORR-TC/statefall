$ErrorActionPreference = 'Stop'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }
$settings = @{}
foreach ($line in [IO.File]::ReadAllLines("$PSScriptRoot\.env")) { if ($line -match '^\s*([^#][^=]*)=(.*)$') { $settings[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"') } }
$port = if ($settings.STATEFALL_ARTIFACT_PORT) { $settings.STATEFALL_ARTIFACT_PORT } else { '8089' }
$base = "http://localhost:$port"
$compose = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml", '--profile', 'artifacts')
$cli = $compose + @('run', '--rm', 'artifact-cli', 'wp')

docker @compose up -d db artifact-wordpress
if ($LASTEXITCODE -ne 0) { throw 'Artifact WordPress failed to start.' }
docker @compose exec -T artifact-wordpress sh -lc 'mkdir -p /var/www/html/wp-content/uploads /var/www/html/wp-content/upgrade /var/www/html/wp-content/plugins; cp /statefall-config/htaccess /var/www/html/.htaccess; chown -R www-data:www-data /var/www/html/wp-content /var/www/html/.htaccess'
if ($LASTEXITCODE -ne 0) { throw 'Could not initialize artifact WordPress permissions.' }
for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 5; break } catch { Start-Sleep -Seconds 2 } }
if (-not $response) { throw 'Artifact WordPress did not become ready.' }

$prior = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
$null = docker @cli core is-installed
$installed = $LASTEXITCODE -eq 0
$ErrorActionPreference = $prior
if ($installed) {
    $ErrorActionPreference = 'SilentlyContinue'; docker @cli plugin deactivate statefall-scores *> $null; docker @cli plugin delete statefall-scores *> $null; $ErrorActionPreference = $prior
    docker @cli db clean --yes
    if ($LASTEXITCODE -ne 0) { throw 'Could not reset the disposable artifact table prefix.' }
}
docker @compose exec -T artifact-wordpress rm -rf /var/www/html/wp-content/plugins/statefall-scores
if ($LASTEXITCODE -ne 0) { throw 'Could not clear the disposable artifact plugin directory.' }
docker @cli core install "--url=$base" '--title=Statefall Artifact Tests' '--admin_user=artifact-admin' '--admin_password=artifact-password' '--admin_email=artifact@example.invalid' '--skip-email'
if ($LASTEXITCODE -ne 0) { throw 'Fresh artifact WordPress installation failed.' }
$plugin = Join-Path $PSScriptRoot '..\.artifacts\statefall-scores-1.10.7.zip'
if (-not (Test-Path -LiteralPath $plugin)) { throw 'Built plugin ZIP was not found.' }
docker @cli plugin install '/statefall-artifacts/statefall-scores-1.10.6.zip' --activate
if ($LASTEXITCODE -ne 0) { throw 'Exact previous plugin 1.10.6 fresh installation failed.' }
docker @cli option update statefall_upgrade_data_marker 'from-1.10.6'
docker @cli user create upgrade-user 'upgrade-user@example.invalid' '--role=subscriber' '--user_pass=artifact-upgrade-password'
if ($LASTEXITCODE -ne 0) { throw 'Could not create previous-version preservation data.' }
docker @cli plugin install '/statefall-artifacts/statefall-scores-1.10.7.zip' --force --activate
if ($LASTEXITCODE -ne 0) { throw 'Exact plugin ZIP upgrade from 1.10.6 failed.' }
$upgradeMarker = docker @cli option get statefall_upgrade_data_marker
$upgradeUser = docker @cli user get upgrade-user --field=ID
if ($LASTEXITCODE -ne 0 -or $upgradeMarker.Trim() -ne 'from-1.10.6' -or [int]$upgradeUser -le 0) { throw 'The 1.10.6 to 1.10.7 upgrade did not preserve data.' }
docker @cli option update permalink_structure '/%postname%/'
$permalinkStructure = docker @cli option get permalink_structure
if ($LASTEXITCODE -ne 0 -or $permalinkStructure.Trim() -ne '/%postname%/') { throw 'Could not configure artifact WordPress permalinks.' }
$signingSource = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\game\src\config\signing.js'))
if ($signingSource -notmatch "STATEFALL_SIGN_KEY='([^']+)'") { throw 'Game signing key was not found.' }
docker @cli option update statefall_sign_key $Matches[1] | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not configure the artifact signing key.' }
docker @cli eval-file /statefall-tests/package-integration.php
if ($LASTEXITCODE -ne 0) { throw 'Package integration tests failed.' }
docker @cli eval-file /statefall-tests/exact-score-key.php
if ($LASTEXITCODE -ne 0) { throw 'Exact artifact score signing-key tests failed.' }
docker @cli plugin install '/statefall-artifacts/statefall-scores-1.10.7.zip' --force --activate
if ($LASTEXITCODE -ne 0) { throw 'Exact plugin ZIP upgrade failed.' }
$marker = docker @cli option get statefall_phase_b_data_marker
if ($LASTEXITCODE -ne 0 -or $marker.Trim() -ne 'preserve-me') { throw 'Plugin ZIP upgrade did not preserve data.' }

$paths = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\.artifacts\package-fixtures\paths.json')) | ConvertFrom-Json
$play = Invoke-WebRequest -Uri "$base/play/" -UseBasicParsing -TimeoutSec 30
if ($play.StatusCode -ne 200 -or $play.Content -notmatch '<script type="application/json" id="statefall-wp-config">' -or $play.Content -notmatch "GAME_VERSION='1\.10\.11'") { throw 'Private exact-game HTML failed.' }
if (($play.Headers['Cache-Control'] -join ',') -notmatch 'no-cache|no-store') { throw 'Play HTML is not private/uncached.' }
$exactBase = "$base/play/releases/1.10.11-2026-09-18-phase-d2/"
$exactManifest = Invoke-RestMethod -Uri ($exactBase + 'release.json') -TimeoutSec 30
$exactChunks = @($exactManifest.files | Where-Object { $_.path -match '^assets/.+\.js$' })
$exactChunk = if ($exactChunks.Count) { $exactChunks[0] } else { $null }
if (-not $exactChunk) { throw 'Exact game manifest has no JavaScript chunk.' }
$exactJs = Invoke-WebRequest -Uri ($exactBase + $exactChunk.path) -UseBasicParsing -TimeoutSec 30
if (($exactJs.Headers['Content-Type'] -join ',') -notmatch 'javascript' -or ($exactJs.Headers['Cache-Control'] -join ',') -notmatch 'max-age=31536000.*immutable') { throw 'Exact game chunk MIME/cache headers failed.' }
$fixtureBase = "$base/play/releases/9.0.4-fixture-4/"
$js = Invoke-WebRequest -Uri ($fixtureBase + $paths.appPath) -UseBasicParsing -TimeoutSec 30
if (($js.Headers['Content-Type'] -join ',') -notmatch 'javascript' -or ($js.Headers['Cache-Control'] -join ',') -notmatch 'max-age=31536000.*immutable') { throw 'Hashed JavaScript MIME/cache headers failed.' }
$css = Invoke-WebRequest -Uri ($fixtureBase + $paths.cssPath) -UseBasicParsing -TimeoutSec 30
if (($css.Headers['Content-Type'] -join ',') -notmatch 'text/css') { throw 'CSS MIME header failed.' }
$badFingerprint = Invoke-WebRequest -Uri ($fixtureBase + 'assets/plain.deadbeef.js') -UseBasicParsing -TimeoutSec 30
if (($badFingerprint.Headers['Cache-Control'] -join ',') -match 'immutable') { throw 'A filename fingerprint that does not match the manifest hash received immutable caching.' }
$manifest = Invoke-WebRequest -Uri ($fixtureBase + 'release.json') -UseBasicParsing -TimeoutSec 30
if (($manifest.Headers['Content-Type'] -join ',') -notmatch 'application/json' -or ($manifest.Headers['Cache-Control'] -join ',') -notmatch 'max-age=300') { throw 'Release metadata MIME/cache headers failed.' }
try { Invoke-WebRequest -Uri "$base/play/$($paths.appPath)" -UseBasicParsing -TimeoutSec 30 | Out-Null; throw 'Unqualified modern asset URL was served.' } catch [System.Net.WebException] { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
$env:STATEFALL_WORDPRESS_URL = $base
npm run test:wordpress:artifact
if ($LASTEXITCODE -ne 0) { throw 'Artifact-backed WordPress browser smoke failed.' }
Write-Host 'PASS exact plugin/game ZIP installation and runtime MIME/cache paths'
