<?php
if (!defined('ABSPATH')) exit;

/** Shared data stays at the package root; games live in immutable release directories. */
function statefall_game_dir()  { $u = wp_upload_dir(); return trailingslashit($u['basedir']) . 'statefall/'; }
function statefall_pointer_target() {
    $dir = statefall_game_dir() . 'release-pointers/';
    if (is_dir($dir)) {
        $records = array_values(array_filter(scandir($dir), function ($name) use ($dir) { return preg_match('/^[0-9]{20}-[A-Za-z0-9]+\.pointer$/', $name) && is_file($dir . $name); }));
        rsort($records, SORT_STRING);
        foreach ($records as $record) { $target = trim((string) file_get_contents($dir . $record)); if ($target === 'legacy' || preg_match('/^[A-Za-z0-9][A-Za-z0-9._+-]{0,128}$/', $target)) return $target; }
    }
    // Read the pre-1.10.7 pointer during migration; new writes use the journal above.
    $old = statefall_game_dir() . 'active-release';
    if (is_file($old)) { $target = trim((string) file_get_contents($old)); if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._+-]{0,128}$/', $target)) return $target; }
    return is_file(statefall_game_dir() . 'index.html') ? 'legacy' : null;
}
function statefall_release_manifest($name) {
    if (!is_string($name) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._+-]{0,128}$/', $name)) return null;
    $path = statefall_game_dir() . 'releases/' . $name . '/release.json';
    $data = is_file($path) ? json_decode(file_get_contents($path), true) : null;
    return is_array($data) ? $data : null;
}
function statefall_release_context($refresh = false, $namedRelease = null) {
    static $active = null; static $named = [];
    if ($refresh) { $active = null; $named = []; return null; }
    if ($namedRelease !== null && isset($named[$namedRelease])) return $named[$namedRelease];
    if ($namedRelease === null && $active !== null) return $active;
    $target = $namedRelease !== null ? $namedRelease : statefall_pointer_target();
    if ($target === 'legacy') $context = ['name' => null, 'manifest' => null, 'dir' => statefall_game_dir(), 'url' => statefall_game_url(), 'runtimeUrl' => statefall_game_url(), 'entry' => 'index.html', 'flags' => 'flags.js'];
    else {
        $manifest = $target ? statefall_release_manifest($target) : null;
        $context = $manifest ? ['name' => $target, 'manifest' => $manifest, 'dir' => statefall_game_dir() . 'releases/' . $target . '/', 'url' => statefall_game_url() . 'releases/' . rawurlencode($target) . '/', 'runtimeUrl' => home_url('/play/releases/' . rawurlencode($target) . '/'), 'entry' => $manifest['entry'], 'flags' => $manifest['flags']] : null;
    }
    if ($namedRelease !== null) $named[$namedRelease] = $context; else $active = $context;
    return $context;
}
function statefall_active_release() { $context = statefall_release_context(); return $context ? $context['name'] : null; }
function statefall_release_dir() { $context = statefall_release_context(); return $context ? $context['dir'] : statefall_game_dir(); }
function statefall_game_path() { $context = statefall_release_context(); return $context ? $context['dir'] . $context['entry'] : statefall_game_dir() . 'index.html'; }
/** Public URL of the package folder (served directly by the web server; hosts like WP Engine never pass static files to PHP). */
function statefall_game_url() { $u = wp_upload_dir(); return trailingslashit($u['baseurl']) . 'statefall/'; }
function statefall_release_url() { $context = statefall_release_context(); return $context ? $context['url'] : statefall_game_url(); }
function statefall_runtime_asset_url() { $context = statefall_release_context(); return $context ? $context['runtimeUrl'] : statefall_game_url(); }
function statefall_flags_path() { $context = statefall_release_context(); return $context ? $context['dir'] . $context['flags'] : statefall_game_dir() . 'flags.js'; }
function statefall_flags_url() { $context = statefall_release_context(); return $context ? $context['url'] . $context['flags'] : statefall_game_url() . 'flags.js'; }

function statefall_register_rewrite() {
    add_rewrite_rule('^play/?$', 'index.php?statefall_play=1', 'top');
    add_rewrite_rule('^play/(.+)$', 'index.php?statefall_asset=$matches[1]', 'top');
    add_rewrite_rule('^credits/(\d+)/?$', 'index.php?statefall_credits=$matches[1]', 'top');
}
add_action('init', 'statefall_register_rewrite');
add_filter('query_vars', function ($v) { $v[] = 'statefall_play'; $v[] = 'statefall_asset'; $v[] = 'statefall_credits'; return $v; });

function statefall_mime($path) {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $m = ['html' => 'text/html; charset=utf-8', 'js' => 'application/javascript; charset=utf-8', 'mjs' => 'application/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'json' => 'application/json; charset=utf-8',
          'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'svg' => 'image/svg+xml', 'webp' => 'image/webp', 'ico' => 'image/x-icon',
          'mp3' => 'audio/mpeg', 'ogg' => 'audio/ogg', 'wav' => 'audio/wav', 'woff' => 'font/woff', 'woff2' => 'font/woff2', 'txt' => 'text/plain; charset=utf-8', 'wasm' => 'application/wasm'];
    return $m[$ext] ?? 'application/octet-stream';
}

/** The config block the game reads. */
function statefall_wp_config($context = null) {
    $context = $context ?: statefall_release_context();
    $user = is_user_logged_in() ? ['id' => get_current_user_id(), 'name' => wp_get_current_user()->display_name] : null;
    if ($user && function_exists('statefall_nation_of')) { $n = statefall_nation_of($user['id']); $user['nation'] = ['flag' => $n['flag'], 'name' => $n['name'], 'tier' => $n['tier'], 'wins' => $n['wins']]; }
    return [
        'rest' => esc_url_raw(rest_url('statefall/v1/')),
        'nonce' => wp_create_nonce('wp_rest'),
        'user' => $user,
        'loginUrl' => wp_login_url(home_url('/play/')),
        'registerUrl' => wp_registration_url(),
        'profileUrl' => home_url('/profile/'),
        'boardUrl' => home_url('/leaderboard/'),
        'howtoUrl' => home_url('/how-to-play/'),
        'communityUrl' => home_url('/community/'),
        'privacyUrl' => function_exists('get_privacy_policy_url') && get_privacy_policy_url() ? get_privacy_policy_url() : home_url('/privacy-policy/'),
        'logoutUrl' => wp_logout_url(home_url('/play/')),
        'version' => $context && $context['manifest'] ? $context['manifest']['version'] : get_option('statefall_game_version', ''),
        'base' => home_url('/play/'),
        'assets' => statefall_runtime_asset_url(),
        'playlist' => esc_url_raw(rest_url('statefall/v1/playlist')),
        'creditsUrl' => home_url('/credits/'),
        'nationPool' => function_exists('statefall_nation_pool') ? statefall_nation_pool(20) : [],
        'homeUrl' => home_url('/'),
    ];
}

add_action('template_redirect', function () {
    // static assets of the package: /play/<path>
    $asset = get_query_var('statefall_asset');
    if ($asset) {
        $rel = str_replace('\\', '/', $asset); $context = null;
        if (preg_match('#^releases/([^/]+)/(.+)$#', $rel, $match)) { $context = statefall_release_context(false, rawurldecode($match[1])); $rel = $match[2]; }
        else { $context = statefall_release_context(); if ($context && $context['name']) { status_header(404); exit; } }
        if (!$context || strpos($rel, '..') !== false || $rel === '' || $rel === $context['entry']) { status_header(404); exit; }
        $record = null;
        if ($context['manifest']) {
            if ($rel !== 'release.json') foreach ($context['manifest']['files'] as $item) if ($item['path'] === $rel) { $record = $item; break; }
            if ($rel !== 'release.json' && !$record) { status_header(404); exit; }
        }
        $file = $context['dir'] . $rel;
        if (!is_file($file)) { status_header(404); exit; }
        header('Content-Type: ' . statefall_mime($file));
        $immutable = false;
        if ($record && preg_match('/\.([a-f0-9]{8,64})\.[A-Za-z0-9]+$/', basename($rel), $fingerprint)) $immutable = strpos($record['sha256'], $fingerprint[1]) === 0;
        header('Cache-Control: public, max-age=' . ($immutable ? '31536000, immutable' : '300, must-revalidate'));
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
    $cid = (int) get_query_var('statefall_credits');
    if ($cid) { statefall_credits_page($cid); exit; }
    if (!get_query_var('statefall_play')) return;
    $context = statefall_release_context(); $path = $context ? $context['dir'] . $context['entry'] : statefall_game_dir() . 'index.html';
    if (!file_exists($path)) { status_header(404); wp_die('The Statefall game has not been uploaded yet. Go to Statefall → Game file in the dashboard.'); }
    $html = file_get_contents($path);
    $json = wp_json_encode(statefall_wp_config($context), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    $inject = '<script type="application/json" id="statefall-wp-config">' . $json . '</script><script>window.STATEFALL_WP=JSON.parse(document.getElementById("statefall-wp-config").textContent);</script>';
    $pos = stripos($html, '<script');
    $html = $pos !== false ? substr($html, 0, $pos) . $inject . "\n" . substr($html, $pos) : $inject . $html;
    if ($context && $context['name']) {
        // Multi-file manifests require this explicit, release-qualified asset base.
        $html = str_replace('__STATEFALL_ASSET_BASE__', $context['runtimeUrl'], $html);
    } else {
        // The deployed 1.10.7 single-file package has only these optional relative legacy assets.
        $ver = get_option('statefall_game_version', '');
        if ($ver) $html = preg_replace('/(src|href)="((?:flags\.js|howto\/[^"?]+|(?:js|css|img)\/[^"?]+))"/i', '$1="' . statefall_game_url() . '$2?v=' . rawurlencode($ver) . '"', $html);
    }
    nocache_headers();
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
});

function statefall_rrmdir_contents($dir, $except) {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $e) { if ($e === '.' || $e === '..') continue; $p = $dir . $e; if (rtrim($p, '/') === rtrim($except, '/')) continue;
        if (is_dir($p)) { statefall_rrmdir_contents($p . '/', $except); @rmdir($p); } else @unlink($p); }
}
/** Public page for one match: Open Graph card for sharing, a Watch button, and the summary. */
function statefall_credits_page($id) {
    global $wpdb; $t = statefall_table(); $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id=%d", $id), ARRAY_A);
    if (!$row) { status_header(404); wp_die('No such match.'); }
    $o = statefall_row_out($row, null, true); $u = $o['user']['name']; $st = $o['stats'] ?? null; $cu = $o['custom'] ?? null;
    $title = sprintf('%s — %s as %s · Statefall', $u, $o['result'], $o['country']);
    $desc = sprintf('%s min · %s%% of the land · %s · %s · score %d', $o['minutes'], $o['land'], statefall_diff_name($o['diff']), $o['cls'], $o['score']);
    $url = home_url('/credits/' . $id . '/'); $img = $o['card'] ?: '';
    $watch = home_url('/play/?credits=' . $id); $share = 'https://www.facebook.com/sharer/sharer.php?u=' . rawurlencode($url);
    nocache_headers(); header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . esc_html($title) . '</title>';
    echo '<meta property="og:type" content="website"><meta property="og:site_name" content="Statefall"><meta property="og:title" content="' . esc_attr($title) . '"><meta property="og:description" content="' . esc_attr($desc) . '"><meta property="og:url" content="' . esc_url($url) . '">';
    if ($img) echo '<meta property="og:image" content="' . esc_url($img) . '"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' . esc_url($img) . '">';
    echo '<meta name="twitter:title" content="' . esc_attr($title) . '"><meta name="twitter:description" content="' . esc_attr($desc) . '">';
    echo '<style>body{margin:0;background:#0f1a26;color:#e8ecef;font-family:"Segoe UI",system-ui,sans-serif}.w{max-width:900px;margin:0 auto;padding:28px 18px}.card{background:#1a2634;border:1px solid #33475c;border-radius:12px;padding:20px}h1{margin:0 0 6px;font-size:28px}.m{color:#8fa3b8}.btn{display:inline-block;background:#2f5a8c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;margin:14px 8px 0 0;border:0;font:inherit;cursor:pointer}.btn.fb{background:#1877f2}img{max-width:100%;border-radius:8px;border:1px solid #33475c;margin-top:14px}table{border-collapse:collapse;font-size:14px;margin-top:14px;width:100%}td{padding:5px 8px;border-bottom:1px solid #16232f}td:first-child{color:#8fa3b8;white-space:nowrap}.tl td:first-child{width:60px;text-align:right}a{color:#7fb3ff}</style></head><body><div class="w">';
    echo '<p><a href="' . esc_url(home_url('/')) . '">Statefall</a> · <a href="' . esc_url(home_url('/leaderboard/')) . '">Leaderboard</a></p><div class="card"><h1>' . esc_html($u) . ' — ' . esc_html($o['result']) . ' as ' . esc_html($o['country']) . '</h1><p class="m">' . esc_html($desc) . ' · seed <a href="' . esc_url(home_url('/play/?seed=' . rawurlencode($o['seed']) . '&cls=' . rawurlencode($o['cls']))) . '">' . esc_html($o['seed']) . '</a></p>';
    $play = home_url('/play/?seed=' . rawurlencode($o['seed']) . '&cls=' . rawurlencode($o['cls']));
    echo '<a class="btn" href="' . esc_url($watch) . '">▶ Watch the credits</a><a class="btn" href="' . esc_url($play) . '">Play this map — same seed, same class</a><a class="btn fb" href="' . esc_url($share) . '" target="_blank" rel="noopener">Share on Facebook</a><button class="btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(' . wp_json_encode($url) . ').then(()=>{this.textContent=\'Copied\';setTimeout(()=>{this.textContent=\'Copy link\'},1800)})">Copy link</button>';
    if ($cu && !empty($cu['quote'])) echo '<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #7fb3ff;background:rgba(47,90,140,.25);border-radius:8px"><em>“' . esc_html($cu['quote']) . '”</em><br><span style="color:#ffd27a">— ' . esc_html($u) . (!empty($cu['title']) ? ', ' . esc_html($cu['title']) : '') . ', ' . esc_html($o['country']) . '</span></blockquote>';
    if ($cu && !empty($cu['dedication'])) echo '<p class="m">' . esc_html($cu['dedication']) . '</p>';
    if (is_user_logged_in() && get_current_user_id() === (int) $row['user_id']) echo '<p><a href="' . esc_url(home_url('/play/?credits=' . $id . '&edit=1')) . '">Edit these credits</a></p>';
    if ($img) echo '<img src="' . esc_url($img) . '" alt="Match card">';
    if ($st && !empty($st['c'])) { $c = $st['c']; $rows = [['Provinces taken', $c['conquests'] ?? 0], ['Countries eliminated', $c['kills'] ?? 0], ['Continents unified', $c['continents'] ?? 0], ['Peak army', $c['peak'] ?? 0], ['Missiles launched', $c['missiles'] ?? 0], ['Missiles shot down', $c['intercepts'] ?? 0], ['Ships sunk', $c['shipsSunk'] ?? 0], ['Aircraft shot down', $c['planesDown'] ?? 0]];
        echo '<table>'; foreach ($rows as $r) if ($r[1]) echo '<tr><td>' . esc_html($r[0]) . '</td><td>' . esc_html(number_format((float) $r[1])) . '</td></tr>'; echo '</table>'; }
    if ($st && !empty($st['tl'])) { echo '<h3>The campaign</h3><table class="tl">'; foreach (array_slice($st['tl'], 0, 60) as $e) echo '<tr><td>' . esc_html(floor($e['m']) . ':' . str_pad((string) round(($e['m'] - floor($e['m'])) * 60), 2, '0', STR_PAD_LEFT)) . '</td><td>' . esc_html($e['t']) . '</td></tr>'; echo '</table>'; }
    echo '</div></div></body></html>';
}
