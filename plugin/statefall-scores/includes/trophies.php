<?php
if (!defined('ABSPATH')) exit;

/** Trophies: ranking trophies (held while true) and milestone badges (permanent). Computed from scores; cached 5 minutes. */
function statefall_trophies($uid) {
    $uid = (int) $uid; $key = 'sf_troph_' . $uid; $c = get_transient($key); if (is_array($c)) return $c;
    global $wpdb; $t = statefall_table();
    $rows = $wpdb->get_results($wpdb->prepare("SELECT id,result,diff,cls,map,minutes,kills,score,stats,played_at FROM $t WHERE user_id=%d AND result<>'Abandoned' ORDER BY played_at ASC", $uid), ARRAY_A) ?: [];
    $isWin = function ($r) { return stripos($r['result'], 'ictory') !== false; };
    $ok = function ($r) { return !in_array($r['diff'], ['supereasy', 'easy'], true) && !preg_match('/Billionaire|Instant build|Quick start|Paused orders|Custom start|Sandbox/i', $r['cls']); };
    $wins = array_values(array_filter($rows, $isWin)); $qwins = array_values(array_filter($wins, $ok)); $matches = count($rows);
    // career sums from stats
    $sum = ['shipsSunk' => 0, 'intercepts' => 0, 'missiles' => 0, 'planesDown' => 0, 'continents' => 0, 'kills' => 0]; $survivor = false;
    foreach ($rows as $r) { if (empty($r['stats'])) continue; $st = json_decode($r['stats'], true); $c2 = $st['c'] ?? []; foreach ($sum as $k => $v) $sum[$k] += (int) ($c2[$k] ?? 0); if ($isWin($r) && (int) ($c2['nuked'] ?? 0) >= 5) $survivor = true; }
    $mapsWon = []; foreach ($qwins as $r) $mapsWon[$r['map']] = 1; $realMaps = ['world', 'europe', 'americas', 'africa', 'asia', 'mideast'];
    $diffWon = []; foreach ($wins as $r) $diffWon[$r['diff']] = 1;
    $streak = 0; $best = 0; foreach ($rows as $r) { if ($isWin($r)) { $streak++; $best = max($best, $streak); } else $streak = 0; }
    $blitz = false; $marathon = false; foreach ($qwins as $r) { if ((float) $r['minutes'] < 5) $blitz = true; if ((float) $r['minutes'] > 30) $marathon = true; }
    $gar = false; $fog = false; foreach ($qwins as $r) { if (stripos($r['cls'], 'Garrisons') !== false) $gar = true; if (!empty($r['fog'])) $fog = true; }
    $fogRow = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE user_id=%d AND fog=1 AND result LIKE %s", $uid, '%ictory%')); if ($fogRow) $fog = true;
    $nation = function_exists('statefall_nation_of') ? statefall_nation_of($uid) : ['tier' => 0, 'flag' => null, 'name' => '']; $bot = function_exists('statefall_bot_record') ? statefall_bot_record($uid) : ['killedPlayers' => 0];
    // ---- ranking (against everyone)
    $rank = ['overall' => (int) $wpdb->get_var($wpdb->prepare("SELECT 1 + COUNT(*) FROM (SELECT MAX(score) s FROM $t WHERE result<>'Abandoned' GROUP BY user_id) x WHERE x.s > (SELECT COALESCE(MAX(score),0) FROM $t WHERE user_id=%d AND result<>'Abandoned')", $uid))];
    $top = function ($sql) use ($wpdb, $uid) { $v = $wpdb->get_var($wpdb->prepare($sql, $uid)); return $v !== null && (int) $v === $uid; };
    $mostMatches = $matches > 0 && $top("SELECT user_id FROM $t WHERE result<>'Abandoned' GROUP BY user_id ORDER BY COUNT(*) DESC, MIN(played_at) ASC LIMIT 1") && $uid;
    $mostWins = count($wins) > 0 && $top("SELECT user_id FROM $t WHERE result LIKE '%ictory%' GROUP BY user_id ORDER BY COUNT(*) DESC, MIN(played_at) ASC LIMIT 1");
    $mostKills = $sum['kills'] > 0 && $top("SELECT user_id FROM $t WHERE result<>'Abandoned' GROUP BY user_id ORDER BY SUM(kills) DESC, MIN(played_at) ASC LIMIT 1");
    $classFirsts = $wpdb->get_col($wpdb->prepare("SELECT cls FROM (SELECT cls, user_id, MAX(score) s FROM $t WHERE result<>'Abandoned' GROUP BY cls, user_id) a WHERE user_id=%d AND s = (SELECT MAX(score) FROM $t b WHERE b.cls=a.cls AND b.result<>'Abandoned')", $uid)) ?: [];
    $T = []; $add = function ($id, $label, $desc, $earned, $kind = 'badge', $prog = null, $icon = 'star') use (&$T) { $T[] = ['id' => $id, 'label' => $label, 'desc' => $desc, 'earned' => (bool) $earned, 'kind' => $kind, 'progress' => $prog, 'icon' => $icon]; };
    $add('rank1', '#1 overall', 'Highest score on the site', $rank['overall'] === 1 && $matches, 'rank', null, 'crown');
    $add('rank3', 'Top 3 overall', 'A top-three score on the site', $rank['overall'] <= 3 && $matches, 'rank', null, 'laurel');
    foreach ($classFirsts as $cls) $add('class:' . $cls, '#1 in ' . $cls, 'Best score in the ' . $cls . ' class', true, 'rank', null, 'crown');
    $add('mostMatches', 'Most matches', 'More matches played than anyone', $mostMatches, 'rank', null, 'sun');
    $add('mostWins', 'Most wins', 'More victories than anyone', $mostWins, 'rank', null, 'crown');
    $add('mostKills', 'Warlord', 'Most nations eliminated of any player', $mostKills, 'rank', null, 'sword');
    $add('first', 'First blood', 'Win a match', count($wins) >= 1, 'badge', [min(1, count($wins)), 1], 'torch');
    foreach ([[10, 'Veteran'], [25, 'Commander'], [50, 'Field Marshal'], [100, 'Legend']] as $w) $add('wins' . $w[0], $w[1], $w[0] . ' victories', count($wins) >= $w[0], 'badge', [min(count($wins), $w[0]), $w[0]], 'shield');
    $add('blitz', 'Blitz', 'Win a qualifying match in under five minutes', $blitz, 'badge', null, 'fighter');
    $add('marathon', 'Marathon', 'Win a qualifying match that ran past thirty minutes', $marathon, 'badge', null, 'mountain');
    foreach ([['hard', 'Hardened'], ['superhard', 'Steel'], ['impossible', 'Impossible']] as $d) $add('diff:' . $d[0], $d[1], 'Win on ' . statefall_diff_name($d[0]), !empty($diffWon[$d[0]]), 'badge', null, 'tower');
    $add('garrisons', 'Quartermaster', 'Win a Garrisons match', $gar, 'badge', null, 'city');
    $add('fog', 'Night owl', 'Win in fog of war', $fog, 'badge', null, 'radar');
    $add('maps', 'Globetrotter', 'Win on every real-world map', count(array_intersect($realMaps, array_keys($mapsWon))) === 6, 'badge', [count(array_intersect($realMaps, array_keys($mapsWon))), 6], 'satellite');
    $add('admiral', 'Admiral', '25 enemy ships sunk in your career', $sum['shipsSunk'] >= 25, 'badge', [min($sum['shipsSunk'], 25), 25], 'battleship');
    $add('dome', 'Iron dome', '100 missiles shot down', $sum['intercepts'] >= 100, 'badge', [min($sum['intercepts'], 100), 100], 'samstar');
    $add('rocket', 'Rocketeer', '100 missiles launched', $sum['missiles'] >= 100, 'badge', [min($sum['missiles'], 100), 100], 'missile');
    $add('ace', 'Ace', '25 aircraft shot down', $sum['planesDown'] >= 25, 'badge', [min($sum['planesDown'], 25), 25], 'bomber');
    $add('unifier', 'Unifier', '25 continents unified', $sum['continents'] >= 25, 'badge', [min($sum['continents'], 25), 25], 'tree');
    $add('survivor', 'Survivor', 'Win a match after being nuked five times', $survivor, 'badge', null, 'shield');
    $add('streak', 'On a roll', 'Five wins in a row', $best >= 5, 'badge', [min($best, 5), 5], 'sun');
    $add('founder', 'Founder', 'Design your flag', $nation['tier'] >= 1 && $nation['flag'], 'badge', null, 'eagle');
    $add('named', 'Sovereign', 'Name your nation', $nation['tier'] >= 2 && $nation['name'], 'badge', null, 'crown');
    $add('world', 'World nation', 'Your nation joins other players\' games', $nation['tier'] >= 3, 'badge', null, 'satellite');
    $add('nemesis', 'Nemesis', 'Your bot nation eliminated a player', (int) ($bot['killedPlayers'] ?? 0) >= 1, 'badge', null, 'lion');
    set_transient($key, $T, 300); return $T;
}
add_action('rest_api_init', function () { register_rest_route('statefall/v1', '/trophies/(?P<id>\d+)', ['methods' => 'GET', 'callback' => function ($req) { return ['trophies' => statefall_trophies((int) $req['id'])]; }, 'permission_callback' => '__return_true']); });
/** Invalidate on score post. */
function statefall_trophies_bust($uid) { delete_transient('sf_troph_' . (int) $uid); }
