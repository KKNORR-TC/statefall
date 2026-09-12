<?php
if (!defined('ABSPATH')) exit;

/** Allowed values, mirrored from the game. */
function statefall_enums() {
    return [
        'result' => ['Victory', 'Total victory', 'Team victory', 'Shared victory', 'Defeat', 'Abandoned'],
        'map'    => ['random', 'land', 'islands_l', 'islands_m', 'islands_s', 'atoll', 'world', 'europe', 'americas', 'africa', 'asia', 'mideast'],
        'diff'   => ['supereasy', 'easy', 'normal', 'hard', 'superhard', 'impossible'],
    ];
}

function statefall_map_name($k) {
    $n = ['random' => 'Continents', 'land' => 'Land', 'islands_l' => 'Large islands', 'islands_m' => 'Medium islands', 'islands_s' => 'Small islands', 'atoll' => 'Atoll', 'world' => 'World', 'europe' => 'Europe', 'americas' => 'Americas', 'africa' => 'Africa', 'asia' => 'Asia', 'mideast' => 'Middle East'];
    return $n[$k] ?? $k;
}
function statefall_diff_name($k) {
    $n = ['supereasy' => 'Super easy', 'easy' => 'Easy', 'normal' => 'Normal', 'hard' => 'Hard', 'superhard' => 'Super hard', 'impossible' => 'Impossible'];
    return $n[$k] ?? $k;
}

/** The score formula. MUST match the game's matchScore(). */
function statefall_score(array $r) {
    $diffMult = ['supereasy' => 0.4, 'easy' => 0.7, 'normal' => 1, 'hard' => 1.4, 'superhard' => 1.9, 'impossible' => 2.6][$r['diff']] ?? 1;
    $modeMult = (!empty($r['fog']) ? 1.25 : 1) * (!empty($r['risky']) ? 1.15 : 1);
    $resMap   = ['Total victory' => 1.3, 'Victory' => 1, 'Team victory' => 1, 'Shared victory' => 0.7, 'Abandoned' => 0];
    $resMult  = array_key_exists($r['result'], $resMap) ? $resMap[$r['result']] : 0.25;
    return (int) round($r['land'] * $diffMult * $modeMult * $resMult / max(1, $r['minutes']) * 100);
}

/**
 * Canonical JSON for signing: fixed field order, no whitespace, no `sig`.
 * The game builds exactly this string before HMAC-ing it.
 */
function statefall_canonical(array $r) {
    $c = [
        'when'    => (int) $r['when'],
        'result'  => (string) $r['result'],
        'country' => (string) $r['country'],
        'map'     => (string) $r['map'],
        'diff'    => (string) $r['diff'],
        'fog'     => (bool) $r['fog'],
        'risky'   => (bool) $r['risky'],
        'cls'     => (string) $r['cls'],
        'land'    => (float) $r['land'],
        'minutes' => (float) $r['minutes'],
        'kills'   => (int) $r['kills'],
        'peak'    => (int) $r['peak'],
        'gold'    => (int) $r['gold'],
        'seed'    => (string) $r['seed'],
    ];
    return json_encode($c, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function statefall_verify_sig(array $r, $sig) {
    if (!$sig) return false;
    $canon = statefall_canonical($r);
    foreach (statefall_sign_keys() as $key) {
        if (hash_equals(hash_hmac('sha256', $canon, $key), (string) $sig)) return true;
    }
    return false;
}

/**
 * Validate and normalise an incoming record. Returns [ok=>bool, error=>string, message=>string, record=>array].
 */
function statefall_validate(array $in) {
    $e = statefall_enums();
    $need = ['when', 'result', 'country', 'map', 'diff', 'cls', 'land', 'minutes', 'kills', 'peak', 'gold', 'seed'];
    foreach ($need as $k) if (!array_key_exists($k, $in)) return ['ok' => false, 'error' => 'malformed', 'message' => "Missing field: $k", 'status' => 400];

    $r = [
        'when'    => (int) $in['when'],
        'result'  => sanitize_text_field((string) $in['result']),
        'country' => mb_substr(sanitize_text_field((string) $in['country']), 0, 40),
        'map'     => sanitize_key((string) $in['map']),
        'diff'    => sanitize_key((string) $in['diff']),
        'fog'     => !empty($in['fog']),
        'risky'   => !empty($in['risky']),
        'cls'     => mb_substr(sanitize_text_field((string) $in['cls']), 0, 60),
        'land'    => round((float) $in['land'], 1),
        'minutes' => round((float) $in['minutes'], 1),
        'kills'   => (int) $in['kills'],
        'peak'    => (int) $in['peak'],
        'gold'    => (int) $in['gold'],
        'seed'    => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $in['seed'])),
    ];
    if (!in_array($r['result'], $e['result'], true)) return ['ok' => false, 'error' => 'implausible', 'message' => 'Unknown result', 'status' => 422];
    if (!in_array($r['map'], $e['map'], true))       return ['ok' => false, 'error' => 'implausible', 'message' => 'Unknown map', 'status' => 422];
    if (!in_array($r['diff'], $e['diff'], true))     return ['ok' => false, 'error' => 'implausible', 'message' => 'Unknown difficulty', 'status' => 422];
    if ($r['land'] < 0 || $r['land'] > 100)          return ['ok' => false, 'error' => 'implausible', 'message' => 'Land out of range', 'status' => 422];
    if ($r['minutes'] < 0 || $r['minutes'] > 600)    return ['ok' => false, 'error' => 'implausible', 'message' => 'Time out of range', 'status' => 422];
    if (strpos($r['result'], 'ictory') !== false && $r['minutes'] < 1.5) return ['ok' => false, 'error' => 'implausible', 'message' => 'Victory too fast', 'status' => 422];
    if ($r['result'] === 'Defeat' && $r['land'] >= 72) return ['ok' => false, 'error' => 'implausible', 'message' => 'Defeat with a winning share', 'status' => 422];
    if ($r['kills'] < 0 || $r['kills'] > 120)          return ['ok' => false, 'error' => 'implausible', 'message' => 'Kills out of range', 'status' => 422];
    if ($r['peak'] < 0 || $r['peak'] > 1000000000000) return ['ok' => false, 'error' => 'implausible', 'message' => 'Peak out of range', 'status' => 422];
    if ($r['gold'] < 0 || $r['gold'] > 1000000000000) return ['ok' => false, 'error' => 'implausible', 'message' => 'Gold out of range', 'status' => 422];
    if (strpos($r['cls'], 'Billionaire') !== false && $r['peak'] < 100000000) return ['ok' => false, 'error' => 'implausible', 'message' => 'Billionaire class without a billionaire army', 'status' => 422];
    if (strpos($r['cls'], 'Billionaire') === false && $r['peak'] > 50000000) return ['ok' => false, 'error' => 'implausible', 'message' => 'Army too large for this class', 'status' => 422];
    if ($r['seed'] === '' || strlen($r['seed']) > 16) return ['ok' => false, 'error' => 'implausible', 'message' => 'Bad seed', 'status' => 422];
    if ($r['when'] < 1700000000000 || $r['when'] > (time() + 600) * 1000) return ['ok' => false, 'error' => 'implausible', 'message' => 'Bad timestamp', 'status' => 422];
    $r['score'] = statefall_score($r);
    return ['ok' => true, 'record' => $r];
}
