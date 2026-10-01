param([Parameter(Mandatory=$true)][string]$ThemePath)
$ErrorActionPreference = 'Stop'
$theme = (Resolve-Path -LiteralPath $ThemePath).Path
$functionsPath = Join-Path $theme 'functions.php'
$mapPath = Join-Path $theme 'map-single.php'
$functions = [IO.File]::ReadAllText($functionsPath)
$map = [IO.File]::ReadAllText($mapPath)
$oldImage = '$img = get_stylesheet_directory_uri() . ''/assets/maps/'' . $map[''slug''] . ''.jpg'';'
$newImage = '$img = get_stylesheet_directory_uri() . ''/assets/maps/'' . ( $map[''slug''] === ''continents'' ? ''continents-coast-v2.jpg'' : $map[''slug''] . ''.jpg'' );'
$functions = $functions.Replace('continents-detail-v1.png', 'continents-coast-v2.jpg')
if (-not $functions.Contains($oldImage) -and -not $functions.Contains($newImage)) { throw 'Map grid source did not match; no changes made.' }
$functions = $functions.Replace($oldImage, $newImage)
$pattern = '(?s)<div class="map-hero">.*?</div>'
if (-not $map.Contains('statefall-continents.php')) {
    if ([regex]::Matches($map,$pattern).Count -ne 1) { throw 'Map hero source did not match; no changes made.' }
    $original = [regex]::Match($map,$pattern).Value
    $replacement = '<?php if ( $map[''slug''] === ''continents'' ) : require get_stylesheet_directory() . ''/statefall-continents.php''; else : ?>' + "`n" + $original + "`n" + '<?php endif; ?>'
    $map = [regex]::Replace($map,$pattern,[System.Text.RegularExpressions.MatchEvaluator]{param($match) $replacement})
}
$backup = Join-Path $theme 'statefall-continents-backup'
if (-not (Test-Path -LiteralPath $backup)) {
    New-Item -ItemType Directory -Path $backup | Out-Null
    Copy-Item -LiteralPath $functionsPath,$mapPath -Destination $backup
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'detail.php') -Destination (Join-Path $theme 'statefall-continents.php')
Copy-Item -Path (Join-Path $PSScriptRoot 'assets/*.png') -Destination (Join-Path $theme 'assets/maps')
Copy-Item -Path (Join-Path $PSScriptRoot 'assets/*.jpg') -Destination (Join-Path $theme 'assets/maps')
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($functionsPath,$functions,$utf8)
[IO.File]::WriteAllText($mapPath,$map,$utf8)
Write-Output "Continents imagery applied to $theme."
