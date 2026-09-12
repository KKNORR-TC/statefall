<?php
if (!defined('ABSPATH')) exit;

/** The game package lives in uploads/statefall/: index.html plus any assets (howto/, js/, css/, img/…). */
function statefall_game_dir()  { $u = wp_upload_dir(); return trailingslashit($u['basedir']) . 'statefall/'; }
function statefall_game_path() { return statefall_game_dir() . 'index.html'; }
/** Public URL of the package folder (served directly by the web server; hosts like WP Engine never pass static files to PHP). */
function statefall_game_url() { $u = wp_upload_dir(); return trailingslashit($u['baseurl']) . 'statefall/'; }

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
function statefall_wp_config() {
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
        'version' => get_option('statefall_game_version', ''),
        'base' => home_url('/play/'),
        'assets' => statefall_game_url(),
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
        $rel = str_replace('\\', '/', $asset);
        if (strpos($rel, '..') !== false || $rel === '' || $rel === 'index.html') { status_header(404); exit; }
        $file = statefall_game_dir() . $rel;
        if (!is_file($file)) { status_header(404); exit; }
        $ver = get_option('statefall_game_version', '');
        header('Content-Type: ' . statefall_mime($file));
        header('Cache-Control: public, max-age=' . (isset($_GET['v']) ? 31536000 : 3600));
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
    $cid = (int) get_query_var('statefall_credits');
    if ($cid) { statefall_credits_page($cid); exit; }
    if (!get_query_var('statefall_play')) return;
    $path = statefall_game_path();
    if (!file_exists($path)) { status_header(404); wp_die('The Statefall game has not been uploaded yet. Go to Statefall → Game file in the dashboard.'); }
    $html = file_get_contents($path);
    $inject = '<script>window.STATEFALL_WP=' . wp_json_encode(statefall_wp_config()) . ';</script>';
    $pos = stripos($html, '<script');
    $html = $pos !== false ? substr($html, 0, $pos) . $inject . "\n" . substr($html, $pos) : $inject . $html;
    // cache-bust relative asset references with the package version
    $ver = get_option('statefall_game_version', '');
    if ($ver) $html = preg_replace('/(src|href)="((?!https?:|\/\/|data:|#)[^"?]+\.(?:js|css|png|jpg|webp|svg|mp3|ogg|wav))"/i', '$1="' . statefall_game_url() . '$2?v=' . rawurlencode($ver) . '"', $html);
    nocache_headers();
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
});

/**
 * Install a game package: either a single index.html or a zip containing index.html at its root (or inside one top folder)
 * plus any assets. Returns true or an error string.
 */
function statefall_install_package($tmp, $name, $version) {
    $dir = statefall_game_dir();
    if (preg_match('/\.html?$/i', $name)) {
        $body = file_get_contents($tmp);
        if (stripos($body, 'Statefall') === false) return 'That does not look like the Statefall game file.';
        if (!is_dir($dir)) wp_mkdir_p($dir);
        file_put_contents($dir . 'index.html', $body);
    } elseif (preg_match('/\.zip$/i', $name)) {
        if (!class_exists('ZipArchive')) return 'ZipArchive is not available on this server; upload index.html instead.';
        $z = new ZipArchive();
        if ($z->open($tmp) !== true) return 'Could not open the zip.';
        // find index.html: root or one level down
        $prefix = null;
        for ($i = 0; $i < $z->numFiles; $i++) { $n = $z->getNameIndex($i); if ($n === 'index.html') { $prefix = ''; break; } if (preg_match('#^([^/]+)/index\.html$#', $n, $m)) { $prefix = $m[1] . '/'; } }
        if ($prefix === null) { $z->close(); return 'The zip has no index.html at its root.'; }
        $stage = $dir . '.staging-' . wp_generate_password(8, false, false) . '/';
        wp_mkdir_p($stage);
        for ($i = 0; $i < $z->numFiles; $i++) {
            $n = $z->getNameIndex($i);
            if ($prefix !== '' && strpos($n, $prefix) !== 0) continue;
            $rel = substr($n, strlen($prefix));
            if ($rel === '' || strpos($rel, '..') !== false || substr($rel, -1) === '/') { if (substr($rel, -1) === '/' && strpos($rel, '..') === false) wp_mkdir_p($stage . $rel); continue; }
            if (preg_match('/\.(php|phtml|phar|sh|exe)$/i', $rel)) continue; // never install executables
            wp_mkdir_p(dirname($stage . $rel));
            file_put_contents($stage . $rel, $z->getFromIndex($i));
        }
        $z->close();
        if (!is_file($stage . 'index.html')) return 'Package extracted but index.html is missing.';
        // swap: remove old files (keep nothing), move staging into place
        // keep the music library across package installs
        foreach (['audio', 'cards', 'versions'] as $keep) { if (is_dir($dir . $keep) && !is_dir($stage . $keep)) rename($dir . $keep, $stage . $keep); }
        statefall_rrmdir_contents($dir, $stage);
        statefall_move_tree($stage, $dir);
        @rmdir($stage);
    } else return 'Upload index.html or a .zip package.';
    update_option('statefall_game_version', $version ?: gmdate('Y-m-d H:i'));
    return true;
}
function statefall_rrmdir_contents($dir, $except) {
    foreach (scandir($dir) as $e) { if ($e === '.' || $e === '..') continue; $p = $dir . $e; if (rtrim($p, '/') === rtrim($except, '/')) continue;
        if (is_dir($p)) { statefall_rrmdir_contents($p . '/', $except); @rmdir($p); } else @unlink($p); }
}
function statefall_move_tree($from, $to) {
    foreach (scandir($from) as $e) { if ($e === '.' || $e === '..') continue; $s = $from . $e; $d = $to . $e;
        if (is_dir($s)) { wp_mkdir_p($d); statefall_move_tree($s . '/', $d . '/'); @rmdir($s); } else rename($s, $d); }
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
