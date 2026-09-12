<?php
if (!defined('ABSPATH')) exit;

/** Default blocked words are stored encoded so they never appear in plain text in the plugin source; the live list lives in wp_options. */
function statefall_default_words() { return array_filter(array_map('trim', explode("\n", base64_decode('YXNzCmFzc2hvbGUKYmFzdGFyZApiaXRjaApib2xsb2NrcwpidWdnZXIKYnVsbHNoaXQKY29jawpjcmFwCmN1bnQKZGFtbgpkaWNrCmRpY2toZWFkCmRvdWNoZQpmYWcKZmFnZ290CmZ1Y2sKZnVja2VyCmZ1Y2tpbmcKZ29kZGFtbgpqYWNrYXNzCmplcmtvZmYKa2lrZQptb3RoZXJmdWNrZXIKbmlnZ2EKbmlnZ2VyCnBpc3MKcHJpY2sKcHVzc3kKcmV0YXJkCnJldGFyZGVkCnNoaXQKc2hpdGhlYWQKc2x1dApzcGljCnRpdHMKdHdhdAp3YW5rCndhbmtlcgp3aG9yZQ==')))); }
function statefall_words() { $w = get_option('statefall_words'); if (!is_array($w)) { $w = statefall_default_words(); update_option('statefall_words', $w); } return $w; }

/** Normalise leetspeak, punctuation and repeated letters before matching. */
function statefall_normalize_text($t) {
    $t = mb_strtolower($t, 'UTF-8');
    $t = strtr($t, ['0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '@' => 'a', '$' => 's', '!' => 'i', '|' => 'l']);
    $t = preg_replace('/[^a-z\s]/u', '', $t);
    $t = preg_replace('/(.)\1{2,}/', '$1$1', $t); // fuuuuck → fuuck
    return preg_replace('/\s+/', ' ', trim($t));
}
/** Whole-word match against the list (with plurals); also catches words glued together with spaces removed. */
function statefall_text_blocked($text) {
    $n = statefall_normalize_text($text); if ($n === '') return false;
    $words = statefall_words(); $tokens = explode(' ', $n); $joined = str_replace(' ', '', $n);
    foreach ($words as $w) { $w = statefall_normalize_text($w); if ($w === '') continue;
        foreach ($tokens as $tok) { if ($tok === $w || $tok === $w . 's' || $tok === $w . 'es') return true; }
        if (strlen($w) >= 5 && strpos($joined, $w) !== false) return true; // longer words can't hide inside spaced-out letters
    }
    return false;
}
/** Structural clean: letters, numbers, spaces, basic punctuation; length cap. */
function statefall_clean_text($t, $max) {
    $t = wp_strip_all_tags((string) $t);
    $t = preg_replace('/[^\p{L}\p{N}\s\.\,\!\?\'\-\:\;]/u', '', $t);
    $t = preg_replace('/\s+/u', ' ', trim($t));
    return mb_substr($t, 0, $max, 'UTF-8');
}

add_action('rest_api_init', function () {
    $ns = 'statefall/v1';
    register_rest_route($ns, '/moderate', ['methods' => 'POST', 'callback' => 'statefall_rest_moderate', 'permission_callback' => function () { return is_user_logged_in(); }]);
    register_rest_route($ns, '/scores/(?P<id>\d+)/custom', [
        ['methods' => 'POST', 'callback' => 'statefall_rest_custom_save', 'permission_callback' => function () { return is_user_logged_in(); }],
        ['methods' => 'DELETE', 'callback' => 'statefall_rest_custom_delete', 'permission_callback' => function () { return is_user_logged_in(); }],
    ]);
});

function statefall_moderate_rate_ok($uid) { $k = 'sf_mod_' . $uid; $n = (int) get_transient($k); if ($n >= 20) return false; set_transient($k, $n + 1, 600); return true; }

function statefall_rest_moderate(WP_REST_Request $req) {
    if (!statefall_moderate_rate_ok(get_current_user_id())) return new WP_REST_Response(['error' => 'rate_limited', 'message' => 'Too many checks; try again in a few minutes.'], 429);
    $in = $req->get_json_params(); $out = [];
    foreach (['quote' => 200, 'title' => 40, 'dedication' => 120] as $k => $max) { if (!isset($in[$k])) continue; $c = statefall_clean_text($in[$k], $max); $out[$k] = ['text' => $c, 'ok' => !statefall_text_blocked($c)]; }
    return ['ok' => !in_array(false, array_map(function ($v) { return $v['ok']; }, $out), true), 'fields' => $out];
}

function statefall_custom_sanitize(array $in) {
    $c = [];
    $c['song'] = sanitize_key((string) ($in['song'] ?? ''));
    $c['quote'] = statefall_clean_text($in['quote'] ?? '', 200);
    $c['title'] = statefall_clean_text($in['title'] ?? '', 40);
    $c['dedication'] = statefall_clean_text($in['dedication'] ?? '', 120);
    $c['nemesis'] = statefall_clean_text($in['nemesis'] ?? '', 40);
    $c['highlight'] = (int) ($in['highlight'] ?? -1);
    $c['tone'] = in_array($in['tone'] ?? '', ['serious', 'wry', 'brutal'], true) ? $in['tone'] : 'wry';
    return $c;
}
function statefall_rest_custom_save(WP_REST_Request $req) {
    global $wpdb; $t = statefall_table(); $id = (int) $req['id'];
    $row = $wpdb->get_row($wpdb->prepare("SELECT id,user_id FROM $t WHERE id=%d", $id), ARRAY_A);
    if (!$row || (int) $row['user_id'] !== get_current_user_id()) return new WP_REST_Response(['error' => 'forbidden', 'message' => 'Not your match.'], 403);
    $in = $req->get_json_params(); if (!is_array($in)) return new WP_REST_Response(['error' => 'malformed'], 400);
    $c = statefall_custom_sanitize($in);
    foreach (['quote', 'title', 'dedication'] as $k) if ($c[$k] !== '' && statefall_text_blocked($c[$k])) return new WP_REST_Response(['error' => 'blocked', 'message' => 'That text contains a word we can\'t show.', 'field' => $k], 422);
    $wpdb->update($t, ['custom' => wp_json_encode($c, JSON_UNESCAPED_UNICODE)], ['id' => $id]);
    return ['ok' => true, 'custom' => $c];
}
function statefall_rest_custom_delete(WP_REST_Request $req) {
    global $wpdb; $t = statefall_table(); $id = (int) $req['id'];
    $row = $wpdb->get_row($wpdb->prepare("SELECT id,user_id FROM $t WHERE id=%d", $id), ARRAY_A);
    if (!$row || ((int) $row['user_id'] !== get_current_user_id() && !current_user_can('manage_options'))) return new WP_REST_Response(['error' => 'forbidden'], 403);
    $wpdb->update($t, ['custom' => null], ['id' => $id]);
    return ['ok' => true];
}
