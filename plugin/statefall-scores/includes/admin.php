<?php
if (!defined('ABSPATH')) exit;

add_action('admin_menu', function () {
    add_menu_page('Statefall', 'Statefall', 'manage_options', 'statefall', 'statefall_admin_scores', 'dashicons-games', 58);
    add_submenu_page('statefall', 'Recent scores', 'Recent scores', 'manage_options', 'statefall', 'statefall_admin_scores');
    add_submenu_page('statefall', 'Game package', 'Game package', 'manage_options', 'statefall-game', 'statefall_admin_game');
    add_submenu_page('statefall', 'Music', 'Music', 'manage_options', 'statefall-music', 'statefall_admin_music');
    add_submenu_page('statefall', 'Saves', 'Saves', 'manage_options', 'statefall-saves', 'statefall_admin_saves');
    add_submenu_page('statefall', 'Reports', 'Reports', 'manage_options', 'statefall-reports', 'statefall_admin_reports');
    add_submenu_page('statefall', 'Nations', 'Nations', 'manage_options', 'statefall-nations', 'statefall_admin_nations');
    add_submenu_page('statefall', 'Players', 'Players', 'manage_options', 'statefall-players', 'statefall_admin_players');
    add_submenu_page('statefall', 'Settings', 'Settings', 'manage_options', 'statefall-settings', 'statefall_admin_settings');
    add_submenu_page('statefall', 'Setup guide', 'Setup guide', 'manage_options', 'statefall-guide', 'statefall_admin_guide');
});

function statefall_admin_scores() {
    global $wpdb; $t = statefall_table();
    if (isset($_POST['sf_action']) && check_admin_referer('statefall_admin')) {
        $act = sanitize_key($_POST['sf_action']);
        if ($act === 'delete' && !empty($_POST['id'])) { $wpdb->delete($t, ['id' => (int) $_POST['id']]); echo '<div class="updated"><p>Deleted.</p></div>'; }
        if ($act === 'ban' && !empty($_POST['uid']))  { update_user_meta((int) $_POST['uid'], 'statefall_banned', 1); $wpdb->delete($t, ['user_id' => (int) $_POST['uid']]); statefall_log_action('Banned user #' . (int) $_POST['uid']); echo '<div class="updated"><p>User banned and their scores removed.</p></div>'; }
        if ($act === 'unban' && !empty($_POST['uid'])) { delete_user_meta((int) $_POST['uid'], 'statefall_banned'); echo '<div class="updated"><p>User unbanned.</p></div>'; }
        if ($act === 'delquote' && !empty($_POST['id'])) { $wpdb->update($t, ['custom' => null], ['id' => (int) $_POST['id']]); statefall_log_action('Removed custom quote from match #' . (int) $_POST['id']); echo '<div class="updated"><p>Quote removed.</p></div>'; }
    }
    $rows = $wpdb->get_results("SELECT * FROM $t ORDER BY id DESC LIMIT 100", ARRAY_A);
    echo '<div class="wrap"><h1>Statefall — recent scores</h1><table class="widefat striped"><thead><tr><th>ID</th><th>Player</th><th>Result</th><th>Class</th><th>Score</th><th>Land</th><th>Time</th><th>Map</th><th>Diff</th><th>Seed</th><th>Quote</th><th>Submitted (UTC)</th><th></th></tr></thead><tbody>';
    foreach ($rows as $r) {
        $u = get_userdata((int) $r['user_id']); $banned = $u ? get_user_meta($u->ID, 'statefall_banned', true) : false;
        echo '<tr><td>' . (int) $r['id'] . '</td><td>' . esc_html($u ? $u->display_name : '#' . $r['user_id']) . ($banned ? ' <span style="color:#b00">(banned)</span>' : '') . '</td><td>' . esc_html($r['result']) . '</td><td>' . esc_html($r['cls']) . '</td><td>' . (int) $r['score'] . '</td><td>' . esc_html($r['land']) . '%</td><td>' . esc_html($r['minutes']) . '</td><td>' . esc_html(statefall_map_name($r['map'])) . '</td><td>' . esc_html(statefall_diff_name($r['diff'])) . '</td><td>' . esc_html($r['seed']) . '</td><td>' . esc_html($r['created_at']) . '</td><td>';
        if ($r['custom']) echo '<form method="post" style="display:inline">' . wp_nonce_field('statefall_admin', '_wpnonce', true, false) . '<input type="hidden" name="id" value="' . (int) $r['id'] . '"><button class="button button-small" name="sf_action" value="delquote" onclick="return confirm(\'Remove the custom quote and dedication from this match?\')">Delete quote</button></form> ';
        echo '<form method="post" style="display:inline">' . wp_nonce_field('statefall_admin', '_wpnonce', true, false) . '<input type="hidden" name="id" value="' . (int) $r['id'] . '"><button class="button button-small" name="sf_action" value="delete" onclick="return confirm(\'Delete this score?\')">Delete</button></form> ';
        if ($u) echo '<form method="post" style="display:inline">' . wp_nonce_field('statefall_admin', '_wpnonce', true, false) . '<input type="hidden" name="uid" value="' . (int) $u->ID . '"><button class="button button-small" name="sf_action" value="' . ($banned ? 'unban' : 'ban') . '" onclick="return confirm(\'' . ($banned ? 'Unban this user?' : 'Ban this user and delete all their scores?') . '\')">' . ($banned ? 'Unban' : 'Ban') . '</button></form>';
        echo '</td></tr>';
    }
    echo '</tbody></table></div>';
}

function statefall_admin_game() {
    $path = statefall_game_path();
    if (isset($_POST['sf_restore']) && check_admin_referer('statefall_game')) { $r = statefall_restore_version(sanitize_file_name(wp_unslash($_POST['sf_restore']))); echo $r === true ? '<div class="updated"><p>Restored.</p></div>' : '<div class="error"><p>' . esc_html($r) . '</p></div>'; }
    if (isset($_POST['sf_delver']) && check_admin_referer('statefall_game')) { $d = statefall_versions_dir() . sanitize_file_name(wp_unslash($_POST['sf_delver'])) . '/'; if (is_dir($d)) { statefall_rrmdir_contents($d, ''); @rmdir($d); statefall_log_action('Deleted backup ' . basename($d)); echo '<div class="updated"><p>Backup deleted.</p></div>'; } }
    $pending = null;
    if (!empty($_FILES['sf_game']) && check_admin_referer('statefall_game')) {
        $f = $_FILES['sf_game'];
        if ($f['error'] !== UPLOAD_ERR_OK) echo '<div class="error"><p>Upload failed (error ' . (int) $f['error'] . '). Check upload_max_filesize / post_max_size if the package is large.</p></div>';
        else {
            // peek inside before installing
            $html = null; $verFile = null;
            if (preg_match('/\.html?$/i', $f['name'])) $html = file_get_contents($f['tmp_name']);
            elseif (preg_match('/\.zip$/i', $f['name']) && class_exists('ZipArchive')) { $z = new ZipArchive(); if ($z->open($f['tmp_name']) === true) { for ($i = 0; $i < $z->numFiles; $i++) { $n = $z->getNameIndex($i); if ($n === 'index.html' || preg_match('#^[^/]+/index\.html$#', $n)) $html = $z->getFromIndex($i); if ($n === 'VERSION.txt' || preg_match('#^[^/]+/VERSION\.txt$#', $n)) $verFile = trim($z->getFromIndex($i)); } $z->close(); } }
            if ($html === null) echo '<div class="error"><p>No index.html found in the upload.</p></div>';
            else {
                $v = statefall_validate_game_html($html);
                foreach ($v['errors'] as $e) echo '<div class="error"><p>' . esc_html($e) . '</p></div>';
                if ($v['ok']) {
                    $label = $v['version'] ? $v['version']['version'] : ($verFile ?: gmdate('Y-m-d H:i'));
                    if ($v['version'] && $verFile && strpos($verFile, $v['version']['version']) === false) $v['warnings'][] = 'VERSION.txt says "' . $verFile . '" but the game file says ' . $v['version']['version'] . '; using the game file.';
                    $cur = statefall_installed_info(); if ($cur['installed']) statefall_backup_current($cur['version']);
                    $res = statefall_install_package($f['tmp_name'], $f['name'], $label);
                    if ($res === true) { update_option('statefall_game_installed', ['t' => current_time('mysql', true), 'who' => wp_get_current_user()->display_name, 'how' => 'uploaded ' . sanitize_file_name($f['name'])]); statefall_log_action('Installed game package ' . $label . ' (' . sanitize_file_name($f['name']) . ')'); echo '<div class="updated"><p>Game package <b>' . esc_html($label) . '</b> installed.' . ($cur['installed'] ? ' The previous version was kept as a backup below.' : '') . '</p></div>'; }
                    else echo '<div class="error"><p>' . esc_html($res) . '</p></div>';
                    foreach ($v['warnings'] as $w) echo '<div class="notice notice-warning"><p>' . esc_html($w) . '</p></div>';
                }
            }
        }
    }
    $info = statefall_installed_info();
    echo '<div class="wrap"><h1>Statefall — game package</h1>';
    if ($info['installed']) {
        echo '<table class="widefat" style="max-width:760px"><tbody>';
        foreach ([['Installed version', 'v' . $info['version'] . ($info['build'] ? ' · build ' . $info['build'] : '')], ['Game file', size_format($info['size']) . ' · sha256 ' . $info['sha'] . '…'], ['How-to pages', $info['howto'] ? $info['howto'] . ' pages (use [statefall_howto])' : 'none in this package'], ['Signing key', $info['keyMatch'] === null ? 'not readable' : ($info['keyMatch'] ? '✓ matches the site key' : '✗ does not match — scores will fail')], ['Installed', trim(($info['installedAt'] ?: '') . ' ' . ($info['by'] ? 'by ' . $info['by'] : '') . ' ' . ($info['how'] ? '(' . $info['how'] . ')' : ''))], ['Plugin', 'v' . STATEFALL_VERSION . ($info['requires'] && version_compare(STATEFALL_VERSION, $info['requires'], '<') ? ' — game expects ' . $info['requires'] . ' or newer' : '')]] as $r) echo '<tr><th style="width:170px;text-align:left">' . esc_html($r[0]) . '</th><td>' . esc_html($r[1]) . '</td></tr>';
        echo '</tbody></table><p><a href="' . esc_url(home_url('/play/')) . '" target="_blank" class="button">Open /play/</a></p>';
    } else echo '<p><b>No game installed yet.</b> /play/ will 404 until you upload a package here.</p>';
    echo '<h2>Install a release</h2><form method="post" enctype="multipart/form-data">' . wp_nonce_field('statefall_game', '_wpnonce', true, false) . '<p><input type="file" name="sf_game" accept=".zip,.html,.htm" required> <span class="description">statefall-release-x.y.z.zip, or a bare index.html</span></p><p><button class="button button-primary">Install</button> <span class="description">The current version is backed up first. Max upload: ' . esc_html(size_format(wp_max_upload_size())) . '.</span></p></form>';
    $vers = statefall_list_versions();
    echo '<h2>Previous versions</h2>'; if (!$vers) echo '<p class="description">No backups yet — one is kept automatically each time you install.</p>';
    else { echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>Backup</th><th>Version</th><th>Build</th><th>Size</th><th>How-to</th><th>Saved</th><th></th></tr></thead><tbody>'; foreach ($vers as $v) echo '<tr><td>' . esc_html($v['name']) . '</td><td>' . esc_html($v['version']) . '</td><td>' . esc_html($v['build']) . '</td><td>' . size_format($v['size']) . '</td><td>' . ($v['howto'] ? 'yes' : '—') . '</td><td>' . esc_html(gmdate('Y-m-d H:i', $v['time'])) . '</td><td><form method="post" style="display:inline">' . wp_nonce_field('statefall_game', '_wpnonce', true, false) . '<button class="button button-small" name="sf_restore" value="' . esc_attr($v['name']) . '" onclick="return confirm(\'Restore this version? The current one will be backed up.\')">Restore</button> <button class="button button-small" name="sf_delver" value="' . esc_attr($v['name']) . '" onclick="return confirm(\'Delete this backup?\')">Delete</button></form></td></tr>'; echo '</tbody></table><p class="description">The last five installs are kept.</p>'; }
    echo '<h2>Plugin</h2><p>Installed plugin: <b>v' . STATEFALL_VERSION . '</b>. <a class="button" href="' . esc_url(admin_url('plugin-install.php?tab=upload')) . '">Update the Statefall plugin</a> <span class="description">Upload statefall-scores-x.y.z.zip; WordPress will offer "Replace current with uploaded".</span></p>';
    echo '</div>';
}
function statefall_admin_guide() {
    $home = home_url('/'); $key = get_option('statefall_sign_key');
    echo '<div class="wrap"><h1>Statefall — setup guide</h1><div style="max-width:900px;background:#fff;padding:18px 24px;border:1px solid #ccd;border-radius:6px;line-height:1.55">';
    echo '<h2>What this plugin does</h2><p>Serves the Statefall game at <code>/play/</code>, stores scores and match records, provides the leaderboard, profile and how-to pages, hosts the music library, moderates player quotes, and publishes public credit pages at <code>/credits/&lt;id&gt;/</code>.</p>';
    echo '<h2>First-time setup</h2><ol><li>Activate the plugin (done).</li><li><b>Statefall → Game package</b>: upload the latest <code>statefall-release-x.y.z.zip</code>. The version is read from the package.</li><li>Create these pages (Pages → Add New) with exactly these slugs and contents:<ul><li><code>/leaderboard/</code> — <code>[statefall_board]</code></li><li><code>/profile/</code> — <code>[statefall_profile]</code></li><li><code>/how-to-play/</code> — <code>[statefall_howto]</code></li><li>Optionally <code>/community/</code> (bbPress) and a privacy policy page (Settings → Privacy).</li></ul></li><li><b>Settings → General</b>: tick <i>Anyone can register</i> so players can create accounts.</li><li><b>Settings → Permalinks</b>: click Save once (registers <code>/play/</code> and <code>/credits/</code>).</li><li>Install an SMTP plugin (e.g. WP Mail SMTP) so registration, password-reset and WordPress recovery emails are delivered.</li><li><b>Statefall → Music</b>: upload the soundtrack (WAV is converted in the browser). Categories: pre-game, in-game, and stings for victory, defeat, #1 and credits.</li></ol>';
    echo '<h2>Updating</h2><ul><li><b>Game</b>: Statefall → Game package → Install. The previous version is backed up automatically; use <i>Restore</i> to roll back.</li><li><b>Plugin</b>: Plugins → Add New → Upload (there is a shortcut on the Game package page). WordPress offers <i>Replace current with uploaded</i>. A bad module cannot take the site down: it is skipped and reported as a red notice; upload a fixed zip to clear it. Kill switch: <code>define(\'STATEFALL_DISABLED\', true);</code> in wp-config.php.</li></ul>';
    echo '<h2>The signing key</h2><p>Every game build carries a key that must match this site\'s key (Statefall → Settings). The Game package page shows whether they match. To force a key, add <code>define(\'STATEFALL_SIGN_KEY\', \'…\');</code> to wp-config.php — it overrides the stored one.</p>';
    echo '<h2>Where things live</h2><ul><li>Game and how-to pages: <code>wp-content/uploads/statefall/</code></li><li>Music: <code>uploads/statefall/audio/</code> (kept across game installs)</li><li>Share cards: <code>uploads/statefall/cards/</code></li><li>Backups: <code>uploads/statefall/versions/</code> (last five)</li><li>Scores: table <code>' . esc_html(statefall_table()) . '</code></li></ul>';
    echo '<h2>After a site restore</h2><ol><li>Settings → Permalinks → Save.</li><li>Statefall → Game package: confirm the version and that the signing key matches.</li><li>Statefall → Music: confirm tracks are listed (they live in uploads, so a file-level restore keeps them).</li></ol>';
    echo '<h2>Moderation</h2><p>Player quotes and dedications are checked on the server against the blocked-word list (Statefall → Settings, masked). Recent scores shows each quote with a <i>Delete quote</i> button, plus <i>Delete</i> for a whole score and <i>Ban</i> for a user.</p>';
    echo '<h2>Troubleshooting</h2><table class="widefat striped"><tbody><tr><td><b>/play/ shows 404</b></td><td>Settings → Permalinks → Save. WP Engine does not pass static files through WordPress, which is why music and cards are served from uploads, not /play/.</td></tr><tr><td><b>"Not posted: Bad signature (403)"</b></td><td>The game\'s key differs from the site\'s. See the Game package page.</td></tr><tr><td><b>"(422)"</b></td><td>A plausibility rule rejected the record — the message names it.</td></tr><tr><td><b>"(401)"</b></td><td>The player is not logged in as far as WordPress can tell — cookies or a stale page.</td></tr><tr><td><b>No Watch link on the board</b></td><td>The stats didn\'t arrive with the score — a game older than 1.2 or a plugin older than 1.3.</td></tr><tr><td><b>Music not playing</b></td><td>Statefall → Music must have enabled tracks; the game loads the list on each visit to /play/.</td></tr></tbody></table>';
    echo '<h2>Copy this checklist for another admin</h2><textarea readonly rows="8" class="large-text" onclick="this.select()">Statefall setup: 1) Activate plugin 2) Statefall → Game package → install latest statefall-release zip 3) Pages: /leaderboard/ [statefall_board], /profile/ [statefall_profile], /how-to-play/ [statefall_howto] 4) Settings → General: Anyone can register 5) Settings → Permalinks → Save 6) Install SMTP plugin 7) Statefall → Music: upload tracks 8) Statefall → Settings: note the signing key (game builds must match). Updates: game via Game package page (auto-backup, Restore to roll back); plugin via Plugins → Upload → Replace. Site: ' . esc_html($home) . '</textarea>';
    echo '</div></div>';
}
function statefall_admin_settings() {
    if (isset($_POST['sf_save']) && check_admin_referer('statefall_settings')) {
        update_option('statefall_rate_10min', max(1, (int) $_POST['rate10']));
        update_option('statefall_rate_day', max(1, (int) $_POST['rateday']));
        update_option('statefall_prune_abandoned', empty($_POST['prune']) ? 0 : 1);
        if (!empty($_POST['rotate'])) { update_option('statefall_sign_key_prev', get_option('statefall_sign_key')); update_option('statefall_sign_key', wp_generate_password(40, false, false)); }
        if (!empty($_POST['endrotate'])) delete_option('statefall_sign_key_prev');
        if (isset($_POST['words'])) { $w = array_values(array_unique(array_filter(array_map(function ($x) { return mb_strtolower(trim(sanitize_text_field($x))); }, preg_split('/[\r\n,]+/', wp_unslash($_POST['words'])))))); update_option('statefall_words', $w); }
        echo '<div class="updated"><p>Saved.</p></div>';
    }
    $key = get_option('statefall_sign_key'); $prev = get_option('statefall_sign_key_prev');
    $const = defined('STATEFALL_SIGN_KEY') && STATEFALL_SIGN_KEY;
    echo '<div class="wrap"><h1>Statefall — settings</h1><form method="post">' . wp_nonce_field('statefall_settings', '_wpnonce', true, false);
    echo '<h2>Signing key</h2><p>The game file must contain the same key (constant <code>STATEFALL_SIGN_KEY</code> in the game). ' . ($const ? 'A key is also defined in <code>wp-config.php</code> and takes precedence.' : '') . '</p>';
    echo '<p>Current key: <code id="sfkey">' . esc_html(substr($key, 0, 6)) . '…' . esc_html(substr($key, -4)) . '</code> <button type="button" class="button" onclick="document.getElementById(\'sfkey\').textContent=\'' . esc_js($key) . '\'">Reveal</button></p>';
    if ($prev) echo '<p>A previous key is still accepted (rotation in progress). <label><input type="checkbox" name="endrotate"> Stop accepting the previous key</label></p>';
    echo '<p><label><input type="checkbox" name="rotate"> Rotate the key now (the old one stays valid until you end the rotation; ship a game file with the new key first)</label></p>';
    echo '<h2>Rate limits</h2><p><label>Per 10 minutes <input type="number" name="rate10" value="' . (int) get_option('statefall_rate_10min', 6) . '" min="1"></label> &nbsp; <label>Per day <input type="number" name="rateday" value="' . (int) get_option('statefall_rate_day', 40) . '" min="1"></label></p>';
    $words = statefall_words();
    echo '<h2>Blocked words</h2><p>' . count($words) . ' words. Player quotes and dedications are checked against this list on the server (whole words, leetspeak normalised); the game file never contains it. <button type="button" class="button" onclick="document.getElementById(\'sfWords\').style.display=\'block\';this.style.display=\'none\'">Reveal and edit</button></p><div id="sfWords" style="display:none"><textarea name="words" rows="6" class="large-text">' . esc_textarea(implode("\n", $words)) . '</textarea><p class="description">One per line. Saving replaces the list.</p></div>';
    echo '<h2>Housekeeping</h2><p><label><input type="checkbox" name="prune" ' . checked(1, get_option('statefall_prune_abandoned', 1), false) . '> Prune Abandoned matches older than 90 days (weekly)</label></p>';
    echo '<p><button class="button button-primary" name="sf_save" value="1">Save</button></p></form>';
    echo '<h2>Pages</h2><p>Create these pages: <code>/leaderboard/</code> with <code>[statefall_board]</code>, <code>/profile/</code> with <code>[statefall_profile]</code>, <code>/how-to-play/</code> with <code>[statefall_howto]</code>. The game is served at <code>/play/</code> automatically once uploaded. Enable registration under Settings → General → Membership.</p>';
    echo '<h2>Health</h2>' . statefall_health_html();
    $act = array_reverse(get_option('statefall_activity', []) ?: []); if ($act) { echo '<h2>Recent admin activity</h2><table class="widefat striped" style="max-width:900px"><tbody>'; foreach (array_slice($act, 0, 12) as $a) echo '<tr><td style="width:170px">' . esc_html($a['t']) . '</td><td style="width:160px">' . esc_html($a['who']) . '</td><td>' . esc_html($a['what']) . '</td></tr>'; echo '</tbody></table>'; }
    echo '</div>';
}

function statefall_admin_nations() {
    global $wpdb;
    if (!empty($_POST['sf_nat']) && check_admin_referer('statefall_nations')) { $uid = (int) $_POST['uid']; if ($_POST['sf_nat'] === 'delflag') delete_user_meta($uid, 'statefall_flag'); if ($_POST['sf_nat'] === 'delname') delete_user_meta($uid, 'statefall_nation'); if ($_POST['sf_nat'] === 'delbot') delete_user_meta($uid, 'statefall_botrec'); statefall_pool_refresh($uid); statefall_log_action('Nation moderation (' . sanitize_key($_POST['sf_nat']) . ') for user #' . $uid); echo '<div class="updated"><p>Done.</p></div>'; }
    $ids = $wpdb->get_col("SELECT DISTINCT user_id FROM {$wpdb->usermeta} WHERE meta_key IN ('statefall_flag','statefall_nation')");
    echo '<div class="wrap"><h1>Statefall — custom nations</h1><p>Flag at ' . STATEFALL_TIER_FLAG . ' qualifying wins, name at ' . STATEFALL_TIER_NAME . ', bot pool at ' . STATEFALL_TIER_BOT . '. Flags are drawn from the palette and shapes only; names pass the blocked-word list.</p>';
    echo '<script src="' . esc_url(statefall_game_url() . 'flags.js') . '"></script><table class="widefat striped"><thead><tr><th>Player</th><th>Flag</th><th>Nation</th><th>Wins</th><th>Tier</th><th>In pool</th><th>Bot record</th><th></th></tr></thead><tbody>';
    foreach ($ids as $uid) { $n = statefall_nation_of((int) $uid); $u = get_userdata((int) $uid); $b = statefall_bot_record((int) $uid);
        echo '<tr><td>' . esc_html($u ? $u->display_name : '#' . $uid) . '</td><td>' . ($n['flag'] ? '<span data-sf-flag="' . esc_attr(wp_json_encode($n['flag'])) . '" data-w="54" data-h="36"></span>' : '—') . '</td><td>' . esc_html($n['name'] ?: '—') . '</td><td>' . (int) $n['wins'] . '</td><td>' . (int) $n['tier'] . '</td><td>' . (get_user_meta((int) $uid, 'statefall_pool', true) === '1' ? 'yes' : 'no') . '</td><td>' . (int) $b['matches'] . ' matches · ' . (int) $b['wins'] . ' wins</td><td><form method="post" style="display:inline">' . wp_nonce_field('statefall_nations', '_wpnonce', true, false) . '<input type="hidden" name="uid" value="' . (int) $uid . '"><button class="button button-small" name="sf_nat" value="delflag" onclick="return confirm(\'Delete this flag?\')">Delete flag</button> <button class="button button-small" name="sf_nat" value="delname" onclick="return confirm(\'Delete this nation name?\')">Delete name</button> <button class="button button-small" name="sf_nat" value="delbot">Reset bot record</button></form></td></tr>'; }
    if (!$ids) echo '<tr><td colspan="8">No custom nations yet.</td></tr>';
    echo '</tbody></table></div>';
}
