<?php
if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    $ns = 'statefall/v1';
    register_rest_route($ns, '/me', ['methods' => 'GET', 'callback' => 'statefall_rest_me', 'permission_callback' => '__return_true']);
    register_rest_route($ns, '/scores', [
        ['methods' => 'GET',  'callback' => 'statefall_rest_list', 'permission_callback' => '__return_true',
         'args' => ['cls' => ['default' => 'Standard'], 'limit' => ['default' => 50], 'offset' => ['default' => 0]]],
        ['methods' => 'POST', 'callback' => 'statefall_rest_submit', 'permission_callback' => 'statefall_can_submit'],
    ]);
    register_rest_route($ns, '/scores/mine', ['methods' => 'GET', 'callback' => 'statefall_rest_mine', 'permission_callback' => function () { return is_user_logged_in(); },
        'args' => ['cls' => ['default' => ''], 'limit' => ['default' => 50], 'offset' => ['default' => 0]]]);
    register_rest_route($ns, '/scores/(?P<id>\d+)', ['methods' => 'GET', 'callback' => 'statefall_rest_one', 'permission_callback' => '__return_true']);
    register_rest_route($ns, '/scores/(?P<id>\d+)/replay', ['methods' => 'GET', 'callback' => 'statefall_rest_score_replay', 'permission_callback' => '__return_true']);
    register_rest_route($ns, '/scores/(?P<id>\d+)/card', ['methods' => 'POST', 'callback' => 'statefall_rest_card', 'permission_callback' => function () { return is_user_logged_in(); }]);
    register_rest_route($ns, '/classes', ['methods' => 'GET', 'callback' => 'statefall_rest_classes', 'permission_callback' => '__return_true']);
});

function statefall_err($code, $message, $status) {
    return new WP_REST_Response(['error' => $code, 'message' => $message], $status);
}

function statefall_can_submit(WP_REST_Request $req) {
    if (!is_user_logged_in()) return new WP_Error('unauthorized', 'Log in to post scores.', ['status' => 401]);
    // The REST cookie auth already checked X-WP-Nonce; a missing/invalid nonce makes is_user_logged_in() false here.
    if (get_user_meta(get_current_user_id(), 'statefall_banned', true)) return new WP_Error('forbidden', 'This account cannot post scores.', ['status' => 403]);
    return true;
}

function statefall_user_summary($uid) {
    global $wpdb; $t = statefall_table();
    $row = $wpdb->get_row($wpdb->prepare("SELECT COUNT(*) AS n, MAX(score) AS best, SUM(result LIKE %s) AS wins FROM $t WHERE user_id=%d AND result<>%s", '%ictory%', $uid, 'Abandoned'), ARRAY_A);
    return ['matches' => (int) ($row['n'] ?? 0), 'best' => (int) ($row['best'] ?? 0), 'wins' => (int) ($row['wins'] ?? 0)];
}

function statefall_rest_me() {
    if (!is_user_logged_in()) return statefall_err('unauthorized', 'Not logged in.', 401);
    $u = wp_get_current_user();
    return array_merge(['id' => $u->ID, 'name' => $u->display_name], statefall_user_summary($u->ID));
}

function statefall_rate_ok($uid) {
    global $wpdb; $t = statefall_table();
    $r10 = (int) get_option('statefall_rate_10min', 6); $rd = (int) get_option('statefall_rate_day', 40);
    $n10 = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE user_id=%d AND created_at > %s", $uid, gmdate('Y-m-d H:i:s', time() - 600)));
    if ($n10 >= $r10) return false;
    $nd = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE user_id=%d AND created_at > %s", $uid, gmdate('Y-m-d H:i:s', time() - DAY_IN_SECONDS)));
    return $nd < $rd;
}

function statefall_rest_submit(WP_REST_Request $req) {
    global $wpdb; $t = statefall_table();
    $in = $req->get_json_params();
    if (!is_array($in)) return statefall_err('malformed', 'Body must be JSON.', 400);
    $v = statefall_validate($in);
    if (!$v['ok']) return statefall_err($v['error'], $v['message'], $v['status']);
    $r = $v['record'];
    if (!statefall_verify_sig($r, $in['sig'] ?? '')) return statefall_err('forbidden', 'Bad signature.', 403);
    $uid = get_current_user_id();
    if (!statefall_rate_ok($uid)) return statefall_err('rate_limited', 'Too many submissions; try again later.', 429);
    // Duplicate guard: same user, same seed, same timestamp.
    $dup = $wpdb->get_var($wpdb->prepare("SELECT id FROM $t WHERE user_id=%d AND seed=%s AND played_at=%s", $uid, $r['seed'], gmdate('Y-m-d H:i:s', (int) ($r['when'] / 1000))));
    if ($dup) return ['ok' => true, 'id' => (int) $dup, 'duplicate' => true];
    $flagJson = null; if (isset($in['flag']) && is_array($in['flag']) && function_exists('statefall_validate_flag')) { $vf = statefall_validate_flag($in['flag']); if ($vf) { $vf['name'] = mb_substr(sanitize_text_field($in['flag']['name'] ?? ''), 0, 40); $flagJson = wp_json_encode($vf, JSON_UNESCAPED_UNICODE); } }
    // Client-reported bot participation is not authoritative and must never mutate another account.
    $botsJson = null;
    $stats = null; $statsNote = null; if (isset($in['stats']) && is_array($in['stats'])) { $enc = wp_json_encode($in['stats'], JSON_UNESCAPED_UNICODE); if (strlen($enc) <= 65536) $stats = $enc; else $statsNote = 'too_large'; }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ok = $wpdb->insert($t, [
        'user_id' => $uid, 'played_at' => gmdate('Y-m-d H:i:s', (int) ($r['when'] / 1000)),
        'result' => $r['result'], 'country' => $r['country'], 'map' => $r['map'], 'diff' => $r['diff'],
        'fog' => $r['fog'] ? 1 : 0, 'risky' => $r['risky'] ? 1 : 0, 'cls' => $r['cls'],
        'land' => $r['land'], 'minutes' => $r['minutes'], 'kills' => $r['kills'], 'peak' => $r['peak'], 'gold' => $r['gold'],
        'seed' => $r['seed'], 'score' => $r['score'], 'ip_hash' => hash('sha256', wp_salt('auth') . $ip), 'created_at' => current_time('mysql', true), 'stats' => $stats, 'flag' => $flagJson, 'bots' => $botsJson,
    ]);
    if (!$ok) return statefall_err('server', 'Could not save.', 500);
    $id = (int) $wpdb->insert_id;
    $rank = 1 + (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE score > %d AND result<>%s", $r['score'], 'Abandoned'));
    $crank = 1 + (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE cls=%s AND score > %d AND result<>%s", $r['cls'], $r['score'], 'Abandoned'));
    if (function_exists('statefall_pool_refresh')) statefall_pool_refresh($uid); if (function_exists('statefall_trophies_bust')) statefall_trophies_bust($uid);
    return ['ok' => true, 'id' => $id, 'rank' => $rank, 'classRank' => $crank, 'score' => $r['score'], 'stats' => $stats !== null, 'statsNote' => $statsNote];
}

/** Row → API shape. */
function statefall_row_out($row, $rank = null, $full = false) {
    $u = get_userdata((int) $row['user_id']);
    $o = [
        'id' => (int) $row['id'], 'when' => strtotime($row['played_at'] . ' UTC') * 1000,
        'result' => $row['result'], 'country' => $row['country'], 'map' => $row['map'], 'diff' => $row['diff'],
        'fog' => (bool) $row['fog'], 'risky' => (bool) $row['risky'], 'cls' => $row['cls'],
        'land' => (float) $row['land'], 'minutes' => (float) $row['minutes'], 'kills' => (int) $row['kills'],
        'peak' => (int) $row['peak'], 'gold' => (int) $row['gold'], 'seed' => $row['seed'], 'score' => (int) $row['score'],
        'user' => ['id' => (int) $row['user_id'], 'name' => $u ? $u->display_name : 'Unknown'],
    ];
    if ($rank !== null) $o['rank'] = $rank;
    $o['hasStats'] = !empty($row['stats']); $o['flag'] = !empty($row['flag']) ? json_decode($row['flag'], true) : null; $o['card'] = !empty($row['card']) ? statefall_game_url() . 'cards/' . rawurlencode($row['card']) : null;
    if ($full && !empty($row['stats'])) $o['stats'] = json_decode($row['stats'], true);
    if ($full && !empty($row['custom'])) $o['custom'] = json_decode($row['custom'], true);
    return $o;
}

/** Top rows for a class (or all classes' top 3). Used by REST and the shortcodes. */
function statefall_top($cls, $limit = 50, $offset = 0) {
    global $wpdb; $t = statefall_table();
    $limit = max(1, min(200, (int) $limit)); $offset = max(0, (int) $offset);
    if ($cls === '__all') {
        $classes = $wpdb->get_col($wpdb->prepare("SELECT cls FROM $t WHERE result<>%s GROUP BY cls ORDER BY COUNT(*) DESC", 'Abandoned'));
        $out = [];
        foreach ($classes as $c) {
            $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE cls=%s AND result<>%s ORDER BY score DESC, minutes ASC, id ASC LIMIT 3", $c, 'Abandoned'), ARRAY_A);
            $out[$c] = array_map(function ($r, $i) { return statefall_row_out($r, $i + 1); }, $rows, array_keys($rows));
        }
        return $out;
    }
    $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE cls=%s AND result<>%s ORDER BY score DESC, minutes ASC, id ASC LIMIT %d OFFSET %d", $cls, 'Abandoned', $limit, $offset), ARRAY_A);
    return array_map(function ($r, $i) use ($offset) { return statefall_row_out($r, $offset + $i + 1); }, $rows, array_keys($rows));
}

function statefall_rest_list(WP_REST_Request $req) {
    $cls = sanitize_text_field($req->get_param('cls') ?: 'Standard');
    return statefall_top($cls, $req->get_param('limit'), $req->get_param('offset'));
}

function statefall_rest_mine(WP_REST_Request $req) {
    global $wpdb; $t = statefall_table();
    $uid = get_current_user_id(); $cls = sanitize_text_field((string) $req->get_param('cls'));
    $limit = max(1, min(200, (int) $req->get_param('limit'))); $offset = max(0, (int) $req->get_param('offset'));
    if ($cls !== '') $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE user_id=%d AND cls=%s ORDER BY score DESC, id DESC LIMIT %d OFFSET %d", $uid, $cls, $limit, $offset), ARRAY_A);
    else $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE user_id=%d ORDER BY id DESC LIMIT %d OFFSET %d", $uid, $limit, $offset), ARRAY_A);
    return array_map(function ($r, $i) use ($offset) { return statefall_row_out($r, $offset + $i + 1); }, $rows, array_keys($rows));
}

function statefall_rest_classes() {
    global $wpdb; $t = statefall_table();
    $rows = $wpdb->get_results($wpdb->prepare("SELECT cls, COUNT(*) AS n FROM $t WHERE result<>%s GROUP BY cls ORDER BY n DESC", 'Abandoned'), ARRAY_A);
    return array_map(function ($r) { return ['cls' => $r['cls'], 'count' => (int) $r['n']]; }, $rows);
}

function statefall_rest_one(WP_REST_Request $req) {
    global $wpdb; $t = statefall_table(); $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id=%d", (int) $req['id']), ARRAY_A);
    if (!$row) return statefall_err('not_found', 'No such match.', 404);
    $rank = 1 + (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE cls=%s AND score > %d AND result<>%s", $row['cls'], $row['score'], 'Abandoned'));
    return statefall_row_out($row, $rank, true);
}
function statefall_cards_dir() { return statefall_game_dir() . 'cards/'; }
function statefall_rest_card(WP_REST_Request $req) {
    global $wpdb; $t = statefall_table(); $id = (int) $req['id'];
    $row = $wpdb->get_row($wpdb->prepare("SELECT id,user_id FROM $t WHERE id=%d", $id), ARRAY_A);
    if (!$row || (int) $row['user_id'] !== get_current_user_id()) return statefall_err('forbidden', 'Not your match.', 403);
    $files = $req->get_file_params(); if (empty($files['card']) || $files['card']['error'] !== UPLOAD_ERR_OK) return statefall_err('malformed', 'No image.', 400);
    if ($files['card']['size'] > 600000) return statefall_err('too_big', 'Card too large.', 413);
    $info = @getimagesize($files['card']['tmp_name']); if (!$info || $info['mime'] !== 'image/png') return statefall_err('type', 'PNG only.', 415);
    if (!is_dir(statefall_cards_dir())) wp_mkdir_p(statefall_cards_dir());
    $name = 'match-' . $id . '.png'; if (!move_uploaded_file($files['card']['tmp_name'], statefall_cards_dir() . $name)) return statefall_err('server', 'Could not save.', 500);
    $wpdb->update($t, ['card' => $name], ['id' => $id]);
    return ['ok' => true, 'url' => statefall_game_url() . 'cards/' . $name];
}

/** The stored replay that belongs to a posted match (same player, same seed, saved around the same time). Public: credits pages are public. */
function statefall_rest_score_replay(WP_REST_Request $req) {
    global $wpdb; $t = statefall_table(); if (!function_exists('statefall_saves_table')) return new WP_REST_Response(['error' => 'unavailable'], 404);
    $row = $wpdb->get_row($wpdb->prepare("SELECT id,user_id,seed,created_at FROM $t WHERE id=%d", (int) $req['id']), ARRAY_A); if (!$row) return new WP_REST_Response(['error' => 'not_found'], 404);
    $st = statefall_saves_table();
    $r = $wpdb->get_row($wpdb->prepare("SELECT id,data FROM $st WHERE user_id=%d AND kind='replay' AND seed=%s AND ABS(TIMESTAMPDIFF(MINUTE, created_at, %s)) <= 10 ORDER BY ABS(TIMESTAMPDIFF(SECOND, created_at, %s)) ASC LIMIT 1", (int) $row['user_id'], $row['seed'], $row['created_at'], $row['created_at']), ARRAY_A);
    if (!$r) return new WP_REST_Response(['error' => 'not_found', 'message' => 'No replay is stored for this match.'], 404);
    $d = json_decode($r['data'], true); if (!is_array($d) || empty($d['cmds'])) return new WP_REST_Response(['error' => 'not_found'], 404);
    if (function_exists('statefall_public_replay_data')) $d = statefall_public_replay_data($d);
    return ['id' => (int) $r['id'], 'data' => $d];
}
