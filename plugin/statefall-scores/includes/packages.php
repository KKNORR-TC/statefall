<?php
if (!defined('ABSPATH')) exit;

/** Package inspection, validation, versioned backups and rollback. */
function statefall_versions_dir() { return statefall_game_dir() . 'versions/'; }
function statefall_log_action($what) {
    $log = get_option('statefall_activity', []); if (!is_array($log)) $log = [];
    $u = wp_get_current_user(); $log[] = ['t' => current_time('mysql', true), 'who' => $u && $u->ID ? $u->display_name : 'system', 'what' => $what];
    update_option('statefall_activity', array_slice($log, -60));
}
/** Read the game version out of an index.html body. */
function statefall_version_from_html($html) {
    if (preg_match("/GAME_VERSION='([^']+)',\s*GAME_BUILD='([^']+)'/", $html, $m)) return ['version' => $m[1], 'build' => $m[2]];
    return null;
}
function statefall_requires_plugin_from_html($html) { return preg_match("/REQUIRES_PLUGIN='([^']+)'/", $html, $m) ? $m[1] : null; }
/** Validate a candidate index.html. Returns ['ok'=>bool,'errors'=>[],'warnings'=>[],'version'=>...]. */
function statefall_validate_game_html($html) {
    $errors = []; $warnings = [];
    if (stripos($html, 'Statefall') === false || strpos($html, 'id="start"') === false || strpos($html, 'GAME_VERSION') === false) $errors[] = 'This is not a Statefall game file (missing the start card or version markers).';
    if (preg_match('/<\?php/i', $html)) $errors[] = 'The file contains PHP, which is never part of a game package.';
    if (strlen($html) < 200000) $warnings[] = 'The game file is unusually small (' . size_format(strlen($html)) . ').';
    $v = statefall_version_from_html($html);
    if (!$v) $warnings[] = 'Could not read GAME_VERSION from the file.';
    $keys = statefall_sign_keys(); if ($keys && preg_match("/STATEFALL_SIGN_KEY='([^']*)'/", $html, $m)) { if (!in_array($m[1], $keys, true)) $warnings[] = 'The signing key baked into this game file does not match the site\'s key — scores will be rejected with "Bad signature" until one of them is changed.'; }
    $req = statefall_requires_plugin_from_html($html); if ($req && version_compare(STATEFALL_VERSION, $req, '<')) $warnings[] = 'This game build expects plugin ' . $req . ' or newer; installed plugin is ' . STATEFALL_VERSION . '.';
    return ['ok' => !$errors, 'errors' => $errors, 'warnings' => $warnings, 'version' => $v];
}
/** Snapshot the currently installed package (index.html + howto/) into versions/<label>/ and prune to the last 5. */
function statefall_backup_current($label) {
    $dir = statefall_game_dir(); if (!is_file($dir . 'index.html')) return null;
    $vd = statefall_versions_dir(); wp_mkdir_p($vd);
    $name = sanitize_file_name(($label ?: 'unknown') . '-' . gmdate('Ymd-His')); $dest = $vd . $name . '/'; wp_mkdir_p($dest);
    copy($dir . 'index.html', $dest . 'index.html');
    if (is_dir($dir . 'howto')) statefall_copy_tree($dir . 'howto/', $dest . 'howto/');
    if (is_file($dir . 'VERSION.txt')) copy($dir . 'VERSION.txt', $dest . 'VERSION.txt');
    // prune
    $all = array_values(array_filter(scandir($vd), function ($e) use ($vd) { return $e !== '.' && $e !== '..' && is_dir($vd . $e); })); sort($all);
    while (count($all) > 5) { $old = array_shift($all); statefall_rrmdir_contents($vd . $old . '/', ''); @rmdir($vd . $old); }
    return $name;
}
function statefall_copy_tree($from, $to) { wp_mkdir_p($to); foreach (scandir($from) as $e) { if ($e === '.' || $e === '..') continue; if (is_dir($from . $e)) statefall_copy_tree($from . $e . '/', $to . $e . '/'); else copy($from . $e, $to . $e); } }
function statefall_list_versions() {
    $vd = statefall_versions_dir(); if (!is_dir($vd)) return [];
    $out = []; foreach (scandir($vd) as $e) { if ($e === '.' || $e === '..' || !is_dir($vd . $e)) continue; $html = is_file($vd . $e . '/index.html') ? file_get_contents($vd . $e . '/index.html') : ''; $v = statefall_version_from_html($html); $out[] = ['name' => $e, 'version' => $v ? $v['version'] : '?', 'build' => $v ? $v['build'] : '', 'size' => is_file($vd . $e . '/index.html') ? filesize($vd . $e . '/index.html') : 0, 'howto' => is_dir($vd . $e . '/howto'), 'time' => (preg_match('/-(\d{8})-(\d{6})$/', $e, $m) ? gmmktime((int) substr($m[2], 0, 2), (int) substr($m[2], 2, 2), (int) substr($m[2], 4, 2), (int) substr($m[1], 4, 2), (int) substr($m[1], 6, 2), (int) substr($m[1], 0, 4)) : filemtime($vd . $e))]; }
    usort($out, function ($a, $b) { return $b['time'] <=> $a['time']; }); return $out;
}
function statefall_restore_version($name) {
    $vd = statefall_versions_dir(); $src = $vd . sanitize_file_name($name) . '/'; if (!is_file($src . 'index.html')) return 'That backup has no game file.';
    $cur = statefall_installed_info(); statefall_backup_current($cur['version'] ?: 'current');
    $dir = statefall_game_dir(); copy($src . 'index.html', $dir . 'index.html');
    if (is_dir($dir . 'howto')) { statefall_rrmdir_contents($dir . 'howto/', ''); @rmdir($dir . 'howto'); }
    if (is_dir($src . 'howto')) statefall_copy_tree($src . 'howto/', $dir . 'howto/');
    $v = statefall_version_from_html(file_get_contents($dir . 'index.html'));
    update_option('statefall_game_version', $v ? $v['version'] : $name); update_option('statefall_game_installed', ['t' => current_time('mysql', true), 'who' => wp_get_current_user()->display_name, 'how' => 'restored from ' . $name]);
    statefall_log_action('Restored game package ' . $name); return true;
}
function statefall_installed_info() {
    $dir = statefall_game_dir(); $p = $dir . 'index.html'; if (!is_file($p)) return ['installed' => false];
    $head = file_get_contents($p); $v = statefall_version_from_html($head);
    $keys = statefall_sign_keys(); $keyMatch = null; if ($keys && preg_match("/STATEFALL_SIGN_KEY='([^']*)'/", $head, $m)) $keyMatch = in_array($m[1], $keys, true);
    $n = 0; if (is_dir($dir . 'howto')) foreach (scandir($dir . 'howto') as $e) if (preg_match('/\.html$/', $e)) $n++;
    $meta = get_option('statefall_game_installed', []);
    return ['installed' => true, 'version' => $v ? $v['version'] : (get_option('statefall_game_version', '') ?: '?'), 'build' => $v ? $v['build'] : '', 'size' => filesize($p), 'sha' => substr(hash_file('sha256', $p), 0, 12), 'howto' => $n, 'keyMatch' => $keyMatch, 'requires' => statefall_requires_plugin_from_html($head), 'installedAt' => $meta['t'] ?? '', 'by' => $meta['who'] ?? '', 'how' => $meta['how'] ?? ''];
}
/** Health check rows for the dashboard. */
function statefall_health() {
    global $wpdb; $rows = []; $info = statefall_installed_info();
    $rows[] = ['Game package installed', $info['installed'], $info['installed'] ? 'v' . $info['version'] . ' · ' . $info['howto'] . ' how-to pages' : 'Upload a release under Game package'];
    if ($info['installed']) $rows[] = ['Signing key matches game file', $info['keyMatch'] !== false, $info['keyMatch'] === null ? 'could not read the key from the file' : ($info['keyMatch'] ? 'ok' : 'scores will be rejected — re-upload a game built with this site\'s key, or define STATEFALL_SIGN_KEY')];
    $t = statefall_table(); $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $t)) === $t; $rows[] = ['Scores table', $exists, $exists ? $wpdb->get_var("SELECT COUNT(*) FROM $t") . ' rows · schema ' . get_option('statefall_db_version', '?') : 'missing — deactivate and reactivate the plugin'];
    $rules = get_option('rewrite_rules'); $rw = is_array($rules) && isset($rules['^play/?$']); $rows[] = ['/play/ rewrite rule', $rw, $rw ? 'registered' : 'visit Settings → Permalinks and Save'];
    $rest = wp_remote_get(rest_url('statefall/v1/classes'), ['timeout' => 6]); $ok = !is_wp_error($rest) && wp_remote_retrieve_response_code($rest) === 200; $rows[] = ['REST API reachable', $ok, $ok ? rest_url('statefall/v1/') : (is_wp_error($rest) ? $rest->get_error_message() : 'HTTP ' . wp_remote_retrieve_response_code($rest))];
    $ad = statefall_audio_dir(); $w = is_dir($ad) ? wp_is_writable($ad) : wp_is_writable(dirname(statefall_game_dir())); $rows[] = ['Uploads folder writable', $w, statefall_game_dir()];
    $reg = (bool) get_option('users_can_register'); $rows[] = ['Player registration open', $reg, $reg ? 'anyone can register' : 'Settings → General → Membership'];
    $errs = get_option('statefall_load_errors'); $rows[] = ['All plugin modules loaded', !$errs, $errs ? count($errs) . ' module(s) failed — see the notice above' : 'ok'];
    foreach (['/leaderboard/', '/profile/', '/how-to-play/'] as $path) { $pg = get_page_by_path(trim($path, '/')); $rows[] = ['Page ' . $path, (bool) $pg, $pg ? 'exists' : 'create it with the matching shortcode (see Setup guide)']; }
    return $rows;
}
function statefall_health_html() { $h = '<table class="widefat striped" style="max-width:900px"><tbody>'; foreach (statefall_health() as $r) $h .= '<tr><td style="width:36px;font-size:18px">' . ($r[1] ? '<span style="color:#1a7f37">●</span>' : '<span style="color:#b00">●</span>') . '</td><td style="width:260px"><b>' . esc_html($r[0]) . '</b></td><td>' . esc_html($r[2]) . '</td></tr>'; return $h . '</tbody></table>'; }
