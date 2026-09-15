<?php
if (!defined('ABSPATH')) exit;

/** Custom nations: flag at 10 qualifying wins, name at 15, joins the bot pool at 25. */
define('STATEFALL_TIER_FLAG', 10); define('STATEFALL_TIER_NAME', 15); define('STATEFALL_TIER_BOT', 25);
function statefall_palette() { return ['#c8102e', '#d52b1e', '#ff7900', '#ffcc00', '#fcd116', '#009a44', '#006233', '#14b53a', '#0038a8', '#1f3a93', '#0055a4', '#75aadb', '#5bc2e7', '#7b2cbf', '#ffffff', '#111111', '#4b5563', '#8b5a2b', '#f5e6c8', '#ce1126', '#00966e', '#002868', '#ffd27a', '#a3c1ad']; }
/** Qualifying wins: victory, Normal or harder, no easing modes, not a sandbox. */
function statefall_qualifying_wins($uid) {
    global $wpdb; $t = statefall_table();
    $rows = $wpdb->get_results($wpdb->prepare("SELECT result, diff, cls FROM $t WHERE user_id=%d AND result LIKE %s", $uid, '%ictory%'), ARRAY_A) ?: [];
    $n = 0; foreach ($rows as $r) { if (in_array($r['diff'], ['supereasy', 'easy'], true)) continue; if (preg_match('/Billionaire|Instant build|Quick start|Paused orders|Custom start|Sandbox/i', $r['cls'])) continue; $n++; }
    return max(0, $n + (int) get_user_meta($uid, 'statefall_win_credit', true));
}
function statefall_nation_of($uid, $withWins = true) {
    $flag = get_user_meta($uid, 'statefall_flag', true); $name = get_user_meta($uid, 'statefall_nation', true);
    $wins = $withWins ? statefall_qualifying_wins($uid) : null; $tier = $wins === null ? 0 : ($wins >= STATEFALL_TIER_BOT ? 3 : ($wins >= STATEFALL_TIER_NAME ? 2 : ($wins >= STATEFALL_TIER_FLAG ? 1 : 0)));
    return ['userId' => (int) $uid, 'flag' => is_array($flag) ? $flag : null, 'name' => $name ?: '', 'wins' => $wins, 'tier' => $tier, 'tiers' => ['flag' => STATEFALL_TIER_FLAG, 'name' => STATEFALL_TIER_NAME, 'bot' => STATEFALL_TIER_BOT]];
}
/** Validate flag data: {name?, layers:[...]} using the game's compact layer format; palette colours only; at most 8 layers. */
function statefall_validate_flag($f) {
    if (!is_array($f) || !isset($f['layers']) || !is_array($f['layers']) || !count($f['layers']) || count($f['layers']) > 8) return false;
    $pal = array_map('strtolower', statefall_palette()); $emb = ['anchor', 'warship', 'battleship', 'sub', 'fighter', 'bomber', 'missile', 'gun', 'city', 'factory', 'radar', 'satellite', 'shield', 'samstar', 'eagle', 'lion', 'sun', 'crescent', 'crown', 'sword', 'laurel', 'tree', 'mountain', 'tower', 'torch'];
    $col = function ($c) use ($pal) { return is_string($c) && in_array(strtolower($c), $pal, true); }; $num = function ($v, $lo = -2, $hi = 3) { return is_numeric($v) && $v >= $lo && $v <= $hi; };
    $out = [];
    foreach ($f['layers'] as $L) { if (!is_array($L) || !isset($L[0])) return false; $k = $L[0];
        switch ($k) {
            case 'h': case 'v': if (count($L) < 2 || count($L) > 4) return false; for ($i = 1; $i < count($L); $i++) if (!$col($L[$i])) return false; $out[] = $L; break;
            case 'diag': if (count($L) !== 3 || !$col($L[1]) || !$col($L[2])) return false; $out[] = $L; break;
            case 'rect': if (count($L) !== 6 || !$col($L[1])) return false; for ($i = 2; $i < 6; $i++) if (!$num($L[$i], 0, 1)) return false; $out[] = $L; break;
            case 'disc': if (count($L) !== 5 || !$col($L[1]) || !$num($L[2], 0, 1) || !$num($L[3], 0, 1) || !$num($L[4], 0, 1)) return false; $out[] = $L; break;
            case 'ring': if (count($L) !== 6 || !$col($L[1]) || !$num($L[2], 0, 1) || !$num($L[3], 0, 1) || !$num($L[4], 0, 1) || !$num($L[5], 0, 1)) return false; $out[] = $L; break;
            case 'star': if (count($L) < 5 || count($L) > 6 || !$col($L[1]) || !$num($L[2], 0, 1) || !$num($L[3], 0, 1) || !$num($L[4], 0, 0.6) || (isset($L[5]) && !$num($L[5], 3, 12))) return false; $out[] = $L; break;
            case 'cross': if (count($L) !== 4 || !$col($L[1]) || !$num($L[2], 0, 0.6) || !$num($L[3], 0, 1)) return false; $out[] = $L; break;
            case 'sal': if (count($L) !== 3 || !$col($L[1]) || !$num($L[2], 0, 0.6)) return false; $out[] = $L; break;
            case 'tri': if (count($L) < 5 || count($L) > 8 || !$col($L[1])) return false; for ($i = 2; $i < count($L); $i++) if (!is_array($L[$i]) || count($L[$i]) !== 2 || !$num($L[$i][0], 0, 1) || !$num($L[$i][1], 0, 1)) return false; $out[] = $L; break;
            case 'emb': if (count($L) < 6 || count($L) > 7 || !$col($L[1]) || !in_array($L[2], $emb, true) || !$num($L[3], 0, 1) || !$num($L[4], 0, 1) || !$num($L[5], 0.05, 0.6) || (isset($L[6]) && $L[6] !== null && !$col($L[6]))) return false; $out[] = $L; break;
            default: return false;
        }
    }
    $res = ['layers' => $out]; if (isset($f['design']) && is_array($f['design']) && strlen(wp_json_encode($f['design'])) < 6000) $res['design'] = $f['design'];
    return $res;
}
function statefall_nation_name_ok($name, $uid) {
    global $wpdb; $n = trim($name); if (mb_strlen($n) < 3 || mb_strlen($n) > 20 || !preg_match("/^[\\p{L}][\\p{L}\\s\\x27\\-]*$/u", $n)) return 'Names are 3–20 letters, spaces, hyphens or apostrophes.';
    if (function_exists('statefall_text_blocked') && statefall_text_blocked($n)) return 'That name contains a word we can\'t show.';
    $real = statefall_real_country_names(); foreach ($real as $r) if (mb_strtolower($r) === mb_strtolower($n)) return 'That is a real country in the game — pick something of your own.';
    $taken = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key='statefall_nation' AND LOWER(meta_value)=%s AND user_id<>%d LIMIT 1", mb_strtolower($n), $uid)); if ($taken) return 'Another player already has that nation name.';
    return true;
}
function statefall_real_country_names() {
    $p = statefall_flags_path(); if (!is_file($p)) return [];
    $js = file_get_contents($p); if (!preg_match_all("/\\['((?:[^'\\\\]|\\\\.)+)',\\['[hvrdstc]/", $js, $m)) return [];
    return array_map(function ($s) { return str_replace("\\'", "'", $s); }, $m[1]);
}
/** The pool of nations eligible to appear as bots (tier 3), with their flags. */
function statefall_nation_pool($limit = 30) {
    global $wpdb; $ids = $wpdb->get_col("SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key='statefall_pool' AND meta_value='1' ORDER BY RAND() LIMIT " . (int) $limit); $out = [];
    foreach ($ids as $uid) { $n = statefall_nation_of((int) $uid, false); if ($n['flag'] && $n['name']) $out[] = ['userId' => (int) $uid, 'name' => $n['name'], 'flag' => $n['flag']]; }
    return $out;
}
/** Recompute the pool flag for a user (cheap; called after saves and score posts). */
function statefall_pool_refresh($uid) { $n = statefall_nation_of($uid); update_user_meta($uid, 'statefall_pool', ($n['tier'] >= 3 && $n['flag'] && $n['name']) ? '1' : '0'); }

add_action('rest_api_init', function () {
    $ns = 'statefall/v1'; $auth = function () { return is_user_logged_in(); };
    register_rest_route($ns, '/nation', [
        ['methods' => 'GET', 'callback' => function () { $n = statefall_nation_of(get_current_user_id()); $n['bot'] = statefall_bot_record(get_current_user_id()); $n['palette'] = statefall_palette(); return $n; }, 'permission_callback' => $auth],
        ['methods' => 'POST', 'callback' => 'statefall_nation_save', 'permission_callback' => $auth],
    ]);
    register_rest_route($ns, '/nation/(?P<id>\d+)', ['methods' => 'GET', 'callback' => function ($req) { $n = statefall_nation_of((int) $req['id']); unset($n['wins']); $n['bot'] = statefall_bot_record((int) $req['id']); return $n; }, 'permission_callback' => '__return_true']);
});
function statefall_nation_save(WP_REST_Request $req) {
    $uid = get_current_user_id(); $in = $req->get_json_params(); if (!is_array($in)) return new WP_REST_Response(['error' => 'malformed'], 400);
    $n = statefall_nation_of($uid);
    if (array_key_exists('flag', $in)) { if ($n['tier'] < 1) return new WP_REST_Response(['error' => 'locked', 'message' => 'Your flag unlocks at ' . STATEFALL_TIER_FLAG . ' qualifying wins.'], 403); if ($in['flag'] === null) delete_user_meta($uid, 'statefall_flag'); else { $v = statefall_validate_flag($in['flag']); if (!$v) return new WP_REST_Response(['error' => 'invalid', 'message' => 'That flag design is not valid.'], 422); update_user_meta($uid, 'statefall_flag', $v); } }
    if (array_key_exists('name', $in)) { if ($n['tier'] < 2) return new WP_REST_Response(['error' => 'locked', 'message' => 'Naming your nation unlocks at ' . STATEFALL_TIER_NAME . ' qualifying wins.'], 403); $nm = trim(sanitize_text_field($in['name'])); if ($nm === '') delete_user_meta($uid, 'statefall_nation'); else { $ok = statefall_nation_name_ok($nm, $uid); if ($ok !== true) return new WP_REST_Response(['error' => 'invalid', 'message' => $ok], 422); update_user_meta($uid, 'statefall_nation', $nm); } }
    statefall_pool_refresh($uid); $out = statefall_nation_of($uid); $out['ok'] = true; return $out;
}
/** Bot record: aggregated from botNations reported with scores. */
function statefall_bot_record($uid) { $r = get_user_meta($uid, 'statefall_botrec', true); $d = ['matches' => 0, 'wins' => 0, 'survived' => 0, 'kills' => 0, 'killedPlayers' => 0, 'landSum' => 0, 'killers' => []]; if (is_array($r)) $d = array_merge($d, $r); $d['avgLand'] = $d['matches'] ? round($d['landSum'] / $d['matches'], 1) : 0; arsort($d['killers']); $d['topKiller'] = $d['killers'] ? array_key_first($d['killers']) : null; return $d; }
function statefall_bot_record_add(array $bn) {
    foreach ($bn as $b) { $uid = (int) ($b['userId'] ?? 0); if (!$uid) continue; $r = get_user_meta($uid, 'statefall_botrec', true); if (!is_array($r)) $r = ['matches' => 0, 'wins' => 0, 'survived' => 0, 'kills' => 0, 'killedPlayers' => 0, 'landSum' => 0, 'killers' => []];
        $r['matches']++; if (!empty($b['alive'])) $r['survived']++; if (!empty($b['alive']) && (float) ($b['land'] ?? 0) >= 72) $r['wins']++; $r['kills'] += (int) ($b['kills'] ?? 0); if (!empty($b['killedPlayer'])) $r['killedPlayers']++; $r['landSum'] += (float) ($b['land'] ?? 0); if (!empty($b['killedBy'])) { $k = mb_substr(sanitize_text_field($b['killedBy']), 0, 40); $r['killers'][$k] = ($r['killers'][$k] ?? 0) + 1; }
        update_user_meta($uid, 'statefall_botrec', $r); }
}
/** Public player page: /player/<id>/ renders the theme's "Player" page (created automatically) with the profile shortcode in public mode. */
add_action('init', function () { add_rewrite_rule('^player/(\d+)/?$', 'index.php?pagename=player&statefall_player=$matches[1]', 'top'); });
add_filter('query_vars', function ($v) { $v[] = 'statefall_player'; return $v; });
function statefall_ensure_player_page() {
    if (get_page_by_path('player')) return;
    wp_insert_post(['post_title' => 'Player', 'post_name' => 'player', 'post_status' => 'publish', 'post_type' => 'page', 'post_content' => '[statefall_profile]', 'comment_status' => 'closed']);
}
add_action('init', function () { if (get_option('statefall_player_page') !== '1') { statefall_ensure_player_page(); update_option('statefall_player_page', '1'); } }, 30);
function statefall_player_url($uid) { return add_query_arg('u', (int) $uid, home_url('/player/')); }
