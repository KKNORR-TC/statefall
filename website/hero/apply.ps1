param([Parameter(Mandatory=$true)][string]$ThemePath)
$ErrorActionPreference = 'Stop'
$theme = (Resolve-Path -LiteralPath $ThemePath).Path
$frontPath = Join-Path $theme 'front-page.php'
$functionsPath = Join-Path $theme 'functions.php'
$front = [IO.File]::ReadAllText($frontPath)
$functions = [IO.File]::ReadAllText($functionsPath)
$pattern = '(?s)<!-- ============ HERO ============ -->.*?(?=<!-- ============ FOUNDING PLAYER STRIP ============ -->)'
if ([regex]::Matches($front, $pattern).Count -ne 1) { throw 'Expected exactly one Statefall hero section; no changes made.' }
$replacement = '<!-- ============ HERO ============ -->' + "`n" + '<?php require get_stylesheet_directory() . ''/statefall-hero.php''; ?>' + "`n`n"
$front = [regex]::Replace($front, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement })
$marker = '// Statefall cinematic hero v1.0.0'
if (-not $functions.Contains($marker)) {
    $functions += @'

// Statefall cinematic hero v1.0.0
add_action( 'wp_enqueue_scripts', function () {
    if ( is_front_page() ) {
        wp_enqueue_style( 'statefall-cinematic-hero', get_stylesheet_directory_uri() . '/statefall-hero.css', array( 'statefall-style' ), '1.0.0' );
    }
}, 20 );
'@
}
$backup = Join-Path $theme 'statefall-hero-backup'
if (-not (Test-Path -LiteralPath $backup)) {
    New-Item -ItemType Directory -Path $backup | Out-Null
    Copy-Item -LiteralPath $frontPath,$functionsPath -Destination $backup
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'hero.php') -Destination (Join-Path $theme 'statefall-hero.php')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'hero.css') -Destination (Join-Path $theme 'statefall-hero.css')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'assets/statefall-hero-v1.png') -Destination (Join-Path $theme 'assets/statefall-hero-v1.png')
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($frontPath, $front, $utf8)
[IO.File]::WriteAllText($functionsPath, $functions, $utf8)
Write-Output "Hero v1.0.0 applied to $theme; original templates preserved in $backup."
