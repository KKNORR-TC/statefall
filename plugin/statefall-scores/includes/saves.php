<?php
if (!defined('ABSPATH')) exit;

/** Saved games and replays, per user, stored on the site. */
function statefall_saves_table() { global $wpdb; return $wpdb->prefix . 'statefall_saves'; }
function statefall_saves_create_table() {
    global $wpdb; $t = statefall_saves_table(); $charset = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta("CREATE TABLE $t (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        kind VARCHAR(10) NOT NULL DEFAULT 'save',
        slot VARCHAR(80) NOT NULL,
        seed VARCHAR(20) NOT NULL DEFAULT '',
        map VARCHAR(20) NOT NULL DEFAULT '',
        country VARCHAR(40) NOT NULL DEFAULT '',
        cls VARCHAR(80) NOT NULL DEFAULT '',
        diff VARCHAR(16) NOT NULL DEFAULT '',
        result VARCHAR(30) NOT NULL DEFAULT '',
        tick INT UNSIGNED NOT NULL DEFAULT 0,
        game_version VARCHAR(16) NOT NULL DEFAULT '',
        size INT UNSIGNED NOT NULL DEFAULT 0,
        data LONGTEXT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY  (id),
        KEY user_kind (user_id, kind, updated_at)
    ) ENGINE=InnoDB $charset;");
    $engine = $wpdb->get_var($wpdb->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s', $t));
    if ($engine && strcasecmp($engine, 'InnoDB') !== 0) $wpdb->query("ALTER TABLE $t ENGINE=InnoDB");
}
define('STATEFALL_SAVE_MAX_BYTES', 98304); define('STATEFALL_SAVE_SLOTS', 10); define('STATEFALL_REPLAY_SLOTS', 20);

add_action('rest_api_init', function () {
    $ns = 'statefall/v1'; $auth = function () { return is_user_logged_in(); };
    register_rest_route($ns, '/saves', [
        ['methods' => 'GET', 'callback' => 'statefall_saves_list', 'permission_callback' => $auth],
        ['methods' => 'POST', 'callback' => 'statefall_saves_put', 'permission_callback' => $auth],
    ]);
    register_rest_route($ns, '/saves/(?P<id>\d+)/file', ['methods' => 'GET', 'callback' => 'statefall_saves_file', 'permission_callback' => $auth]);
    register_rest_route($ns, '/saves/(?P<id>\d+)', [
        ['methods' => 'GET', 'callback' => 'statefall_saves_get', 'permission_callback' => $auth],
        ['methods' => 'DELETE', 'callback' => 'statefall_saves_delete', 'permission_callback' => $auth],
        ['methods' => 'POST', 'callback' => 'statefall_saves_rename', 'permission_callback' => $auth],
    ]);
});
function statefall_save_row_out($r, $withData = false) {
    $o = ['id' => (int) $r['id'], 'kind' => $r['kind'], 'slot' => $r['slot'], 'seed' => $r['seed'], 'map' => $r['map'], 'country' => $r['country'], 'cls' => $r['cls'], 'diff' => $r['diff'], 'result' => $r['result'], 'tick' => (int) $r['tick'], 'minutes' => round((int) $r['tick'] / 600, 1), 'gameVersion' => $r['game_version'], 'size' => (int) $r['size'], 'createdAt' => $r['created_at'], 'updatedAt' => $r['updated_at']];
    if ($withData) $o['data'] = json_decode($r['data'], true);
    return $o;
}
function statefall_saves_list(WP_REST_Request $req) {
    global $wpdb; $t = statefall_saves_table(); $uid = get_current_user_id();
    $rows = $wpdb->get_results($wpdb->prepare("SELECT id,user_id,kind,slot,seed,map,country,cls,diff,result,tick,game_version,size,created_at,updated_at FROM $t WHERE user_id=%d ORDER BY updated_at DESC", $uid), ARRAY_A);
    return ['saves' => array_map('statefall_save_row_out', $rows ?: []), 'limits' => ['save' => STATEFALL_SAVE_SLOTS, 'replay' => STATEFALL_REPLAY_SLOTS, 'bytes' => STATEFALL_SAVE_MAX_BYTES]];
}
function statefall_saves_get(WP_REST_Request $req) {
    global $wpdb; $t = statefall_saves_table(); $r = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id=%d AND user_id=%d", (int) $req['id'], get_current_user_id()), ARRAY_A);
    if (!$r) return new WP_REST_Response(['error' => 'not_found'], 404);
    return statefall_save_row_out($r, true);
}
/** Validate the user-controlled names and flags embedded in replay settings. */
function statefall_replay_identity($value, $with_slot = false, $fallback = false) {
    $raw_name = is_array($value) ? trim((string) ($value['name'] ?? '')) : '';
    $decoded_name = html_entity_decode($raw_name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $valid_name = $raw_name !== '' && mb_strlen($raw_name) <= 40 && !preg_match('/[<>\\x00-\\x1F\\x7F]/u', $decoded_name);
    $name = $valid_name ? sanitize_text_field($raw_name) : '';
    $flag = is_array($value) && function_exists('statefall_validate_flag') ? statefall_validate_flag(['layers' => $value['layers'] ?? null]) : false;
    $slot = is_array($value) ? (int) ($value['slot'] ?? 0) : 0;
    $valid_slot = !$with_slot || ($slot >= 0 && $slot <= 8);
    if (!$valid_name || !$flag || !$valid_slot) {
        if (!$fallback) return false;
        return ['userId' => 0, 'name' => 'Unnamed nation', 'layers' => [['h', '#ffffff', '#0038a8']]] + ($with_slot ? ['slot' => max(0, min(8, $slot))] : []);
    }
    return ['userId' => max(0, (int) ($value['userId'] ?? 0)), 'name' => $name, 'layers' => $flag['layers']] + ($with_slot ? ['slot' => $slot] : []);
}
function statefall_validate_replay_settings(array &$data) {
    $settings = is_array($data['settings'] ?? null) ? $data['settings'] : [];
    if (isset($settings['customFlag'])) {
        $clean = statefall_replay_identity($settings['customFlag']); if (!$clean) return false; $settings['customFlag'] = $clean;
    }
    if (isset($settings['customBots'])) {
        if (!is_array($settings['customBots']) || count($settings['customBots']) > 9) return false;
        $clean_bots = []; foreach ($settings['customBots'] as $bot) { $clean = statefall_replay_identity($bot, true); if (!$clean) return false; $clean_bots[] = $clean; }
        $settings['customBots'] = $clean_bots;
    }
    $data['settings'] = $settings; return true;
}
/** Sanitize legacy stored identities before a replay is returned publicly. */
function statefall_public_replay_data(array $data) {
    $settings = is_array($data['settings'] ?? null) ? $data['settings'] : [];
    if (isset($settings['customFlag'])) $settings['customFlag'] = statefall_replay_identity($settings['customFlag'], false, true);
    if (isset($settings['customBots'])) { $bots = []; foreach (array_slice(is_array($settings['customBots']) ? $settings['customBots'] : [], 0, 9) as $bot) $bots[] = statefall_replay_identity($bot, true, true); $settings['customBots'] = $bots; }
    $data['settings'] = $settings; return $data;
}
/** Create or update. Body: {kind, slot, data:{...replay file...}}. Updating: by id, or by slot for kind=save (the Autosave slot). */
function statefall_saves_put(WP_REST_Request $req) {
    global $wpdb; $t = statefall_saves_table(); $uid = get_current_user_id(); $in = $req->get_json_params();
    if (!is_array($in) || empty($in['data']) || !is_array($in['data'])) return new WP_REST_Response(['error' => 'malformed', 'message' => 'No save data.'], 400);
    $data = $in['data'];
    if (!isset($data['cmds']) || !is_array($data['cmds']) || empty($data['seed'])) return new WP_REST_Response(['error' => 'malformed', 'message' => 'Not a Statefall save.'], 400);
    if (!statefall_validate_replay_settings($data)) return new WP_REST_Response(['error' => 'invalid_replay', 'message' => 'Replay nation data is not valid.'], 422);
    $enc = wp_json_encode($data, JSON_UNESCAPED_UNICODE); if (strlen($enc) > STATEFALL_SAVE_MAX_BYTES) return new WP_REST_Response(['error' => 'too_large', 'message' => 'Save is too large (' . size_format(strlen($enc)) . ').'], 413);
    $kind = ($in['kind'] ?? 'save') === 'replay' ? 'replay' : 'save';
    $slot = mb_substr(sanitize_text_field($in['slot'] ?? ''), 0, 80); if ($slot === '') $slot = $kind === 'replay' ? 'Replay' : 'Save';
    $autosave = strcasecmp($slot, 'Autosave') === 0; if ($autosave && $kind !== 'save') return new WP_REST_Response(['error' => 'reserved_slot', 'message' => 'Autosave is reserved for saved games.'], 422); if ($autosave) $slot = 'Autosave';
    $st = is_array($data['settings'] ?? null) ? $data['settings'] : [];
    $fields = ['user_id' => $uid, 'kind' => $kind, 'slot' => $slot, 'seed' => substr(sanitize_text_field($data['seed']), 0, 20), 'map' => substr(sanitize_key($st['map'] ?? ''), 0, 20), 'country' => mb_substr(sanitize_text_field($in['country'] ?? ''), 0, 40), 'cls' => mb_substr(sanitize_text_field($in['cls'] ?? ''), 0, 80), 'diff' => substr(sanitize_key($st['diff'] ?? ''), 0, 16), 'result' => mb_substr(sanitize_text_field($data['result'] ?? ''), 0, 30), 'tick' => (int) ($data['tick'] ?? 0), 'game_version' => substr(sanitize_text_field($data['game'] ?? ''), 0, 16), 'size' => strlen($enc), 'data' => $enc, 'updated_at' => current_time('mysql', true)];
    $lock_name = 'statefall_saves_' . $uid; $locked = (int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $lock_name));
    if ($locked !== 1) return new WP_REST_Response(['error' => 'busy', 'message' => 'Saves are busy; try again.'], 503);
    try {
        $id = (int) ($in['id'] ?? 0); $existing = null;
        if ($id) { $existing = $wpdb->get_row($wpdb->prepare("SELECT id,kind,slot FROM $t WHERE id=%d AND user_id=%d", $id, $uid), ARRAY_A); if (!$existing) return new WP_REST_Response(['error' => 'not_found'], 404); if ($autosave !== (strcasecmp($existing['slot'], 'Autosave') === 0)) return new WP_REST_Response(['error' => 'reserved_slot', 'message' => 'Autosave is managed automatically.'], 422); }
        elseif ($kind === 'save' && ($autosave || !empty($in['bySlot']))) $existing = $wpdb->get_row($wpdb->prepare("SELECT id,kind FROM $t WHERE user_id=%d AND kind='save' AND slot=%s ORDER BY id ASC LIMIT 1", $uid, $slot), ARRAY_A);
        if ($existing) {
            if ($existing['kind'] !== $kind) return new WP_REST_Response(['error' => 'immutable_kind', 'message' => 'A save cannot change kind.'], 422);
            $ok = $wpdb->update($t, $fields, ['id' => (int) $existing['id']]); if ($ok === false) return new WP_REST_Response(['error' => 'server', 'message' => 'Could not update save.'], 500);
            return ['ok' => true, 'id' => (int) $existing['id'], 'updated' => true];
        }
        $limit = $kind === 'replay' ? STATEFALL_REPLAY_SLOTS : STATEFALL_SAVE_SLOTS; $dropped = null;
        if ($wpdb->query('START TRANSACTION') === false) return new WP_REST_Response(['error' => 'server', 'message' => 'Could not start save transaction.'], 500);
        $n = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE user_id=%d AND kind=%s", $uid, $kind));
        while ($n >= $limit) { $old = $wpdb->get_row($wpdb->prepare("SELECT id,slot FROM $t WHERE user_id=%d AND kind=%s ORDER BY (slot='Autosave') ASC, updated_at ASC, id ASC LIMIT 1", $uid, $kind), ARRAY_A); if (!$old || $wpdb->delete($t, ['id' => (int) $old['id']]) === false) { $wpdb->query('ROLLBACK'); return new WP_REST_Response(['error' => 'server', 'message' => 'Could not enforce save limit.'], 500); } $dropped = $old['slot']; $n--; }
        $fields['created_at'] = current_time('mysql', true); $ok = $wpdb->insert($t, $fields); if (!$ok) { $wpdb->query('ROLLBACK'); return new WP_REST_Response(['error' => 'server', 'message' => 'Could not save.'], 500); }
        $new_id = (int) $wpdb->insert_id; if ($wpdb->query('COMMIT') === false) { $wpdb->query('ROLLBACK'); return new WP_REST_Response(['error' => 'server', 'message' => 'Could not commit save.'], 500); } return ['ok' => true, 'id' => $new_id, 'dropped' => $dropped];
    } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock_name)); }
}
function statefall_saves_delete(WP_REST_Request $req) { global $wpdb; $t = statefall_saves_table(); $n = $wpdb->delete($t, ['id' => (int) $req['id'], 'user_id' => get_current_user_id()]); return ['ok' => (bool) $n]; }
function statefall_saves_rename(WP_REST_Request $req) { global $wpdb; $t = statefall_saves_table(); $in = $req->get_json_params(); $slot = mb_substr(sanitize_text_field($in['slot'] ?? ''), 0, 80); if ($slot === '') return new WP_REST_Response(['error' => 'malformed'], 400); $current = $wpdb->get_row($wpdb->prepare("SELECT kind,slot FROM $t WHERE id=%d AND user_id=%d", (int) $req['id'], get_current_user_id()), ARRAY_A); if (!$current) return new WP_REST_Response(['error' => 'not_found'], 404); if (strcasecmp($slot, 'Autosave') === 0 || ($current['kind'] === 'save' && strcasecmp($current['slot'], 'Autosave') === 0)) return new WP_REST_Response(['error' => 'reserved_slot', 'message' => 'Autosave is managed automatically.'], 422); $n = $wpdb->update($t, ['slot' => $slot], ['id' => (int) $req['id'], 'user_id' => get_current_user_id()]); return ['ok' => $n !== false]; }

/** Admin: per-user counts, with delete-all for a user. */
function statefall_admin_saves() {
    global $wpdb; $t = statefall_saves_table();
    if (!empty($_POST['sf_purge_user']) && check_admin_referer('statefall_saves')) { $wpdb->delete($t, ['user_id' => (int) $_POST['sf_purge_user']]); statefall_log_action('Purged saves for user #' . (int) $_POST['sf_purge_user']); echo '<div class="updated"><p>Saves removed.</p></div>'; }
    $recent = $wpdb->get_results("SELECT id,user_id,kind,slot,seed,game_version,tick,updated_at FROM $t ORDER BY updated_at DESC LIMIT 40", ARRAY_A);
    $rows = $wpdb->get_results("SELECT user_id, SUM(kind='save') AS saves, SUM(kind='replay') AS replays, SUM(size) AS bytes, MAX(updated_at) AS last FROM $t GROUP BY user_id ORDER BY last DESC LIMIT 200", ARRAY_A);
    $tot = $wpdb->get_row("SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS bytes FROM $t", ARRAY_A);
    echo '<div class="wrap"><h1>Statefall — saved games and replays</h1><p>' . (int) $tot['n'] . ' records · ' . size_format((int) $tot['bytes']) . ' total. Limits per player: ' . STATEFALL_SAVE_SLOTS . ' saves, ' . STATEFALL_REPLAY_SLOTS . ' replays, ' . size_format(STATEFALL_SAVE_MAX_BYTES) . ' each.</p>';
    echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>Player</th><th>Saves</th><th>Replays</th><th>Size</th><th>Last activity (UTC)</th><th></th></tr></thead><tbody>';
    foreach ($rows ?: [] as $r) { $u = get_userdata((int) $r['user_id']); echo '<tr><td>' . esc_html($u ? $u->display_name : '#' . $r['user_id']) . '</td><td>' . (int) $r['saves'] . '</td><td>' . (int) $r['replays'] . '</td><td>' . size_format((int) $r['bytes']) . '</td><td>' . esc_html($r['last']) . '</td><td><form method="post" style="display:inline">' . wp_nonce_field('statefall_saves', '_wpnonce', true, false) . '<button class="button button-small" name="sf_purge_user" value="' . (int) $r['user_id'] . '" onclick="return confirm(\'Delete every save and replay for this player?\')">Delete all</button></form></td></tr>'; }
    echo '</tbody></table>';
    echo '<h2>Recent saves and replays</h2><table class="widefat striped" style="max-width:1000px"><thead><tr><th>#</th><th>Player</th><th>Kind</th><th>Name</th><th>Seed</th><th>Game</th><th>Clock</th><th>Updated (UTC)</th><th></th></tr></thead><tbody>';
    foreach ($recent ?: [] as $r) { $u = get_userdata((int) $r['user_id']); echo '<tr><td>' . (int) $r['id'] . '</td><td>' . esc_html($u ? $u->display_name : '#' . $r['user_id']) . '</td><td>' . esc_html($r['kind']) . '</td><td>' . esc_html($r['slot']) . '</td><td>' . esc_html($r['seed']) . '</td><td>' . esc_html($r['game_version']) . '</td><td>' . esc_html(round((int) $r['tick'] / 600, 1)) . ' min</td><td>' . esc_html($r['updated_at']) . '</td><td><a class="button button-small" href="' . esc_url(wp_nonce_url(admin_url('admin.php?page=statefall-saves&sf_save_dl=' . (int) $r['id']), 'statefall_save_dl')) . '">Download .state</a></td></tr>'; }
    echo '</tbody></table></div>';
}

/** Stream a save as a .state download (cookie auth + _wpnonce in the URL, so a plain link works). */
function statefall_saves_file(WP_REST_Request $req) {
    global $wpdb; $t = statefall_saves_table(); $r = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id=%d AND user_id=%d", (int) $req['id'], get_current_user_id()), ARRAY_A);
    if (!$r) return new WP_REST_Response(['error' => 'not_found'], 404);
    $name = 'statefall-' . ($r['kind'] === 'replay' ? 'replay' : 'game') . '-' . preg_replace('/[^A-Za-z0-9]/', '', $r['seed']) . '-' . substr($r['updated_at'], 0, 10) . '.state';
    nocache_headers(); header('Content-Type: application/octet-stream'); header('Content-Disposition: attachment; filename="' . $name . '"'); header('Content-Length: ' . strlen($r['data']));
    echo $r['data']; exit;
}

add_action('admin_init', function () {
    if (empty($_GET['sf_save_dl']) || !current_user_can('manage_options') || !check_admin_referer('statefall_save_dl')) return;
    global $wpdb; $t = statefall_saves_table(); $r = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id=%d", (int) $_GET['sf_save_dl']), ARRAY_A); if (!$r) return;
    nocache_headers(); header('Content-Type: application/octet-stream'); header('Content-Disposition: attachment; filename="statefall-' . $r['kind'] . '-' . (int) $r['id'] . '-' . preg_replace('/[^A-Za-z0-9]/', '', $r['seed']) . '.state"'); echo $r['data']; exit;
});
