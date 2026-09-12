<?php
if (!defined('ABSPATH')) exit;

/** Player-submitted reports (replay divergence and, later, other in-game problems). */
function statefall_reports_table() { global $wpdb; return $wpdb->prefix . 'statefall_reports'; }
function statefall_reports_create_table() {
    global $wpdb; $t = statefall_reports_table(); $charset = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta("CREATE TABLE $t (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        kind VARCHAR(20) NOT NULL,
        game_version VARCHAR(16) NOT NULL DEFAULT '',
        save_id BIGINT UNSIGNED NULL,
        tick INT UNSIGNED NOT NULL DEFAULT 0,
        summary VARCHAR(500) NOT NULL DEFAULT '',
        data LONGTEXT NULL,
        ua VARCHAR(255) NOT NULL DEFAULT '',
        status VARCHAR(10) NOT NULL DEFAULT 'new',
        created_at DATETIME NOT NULL,
        PRIMARY KEY  (id),
        KEY status (status, created_at)
    ) $charset;");
}
add_action('rest_api_init', function () {
    register_rest_route('statefall/v1', '/reports', ['methods' => 'POST', 'callback' => 'statefall_reports_post', 'permission_callback' => function () { return is_user_logged_in(); }]);
});
function statefall_reports_post(WP_REST_Request $req) {
    global $wpdb; $t = statefall_reports_table(); $uid = get_current_user_id();
    $k = 'sf_rep_' . $uid; $n = (int) get_transient($k); if ($n >= 6) return new WP_REST_Response(['error' => 'rate_limited', 'message' => 'Too many reports; thank you — try again later.'], 429); set_transient($k, $n + 1, 3600);
    $in = $req->get_json_params(); if (!is_array($in)) return new WP_REST_Response(['error' => 'malformed'], 400);
    $data = is_array($in['data'] ?? null) ? $in['data'] : []; $enc = wp_json_encode($data, JSON_UNESCAPED_UNICODE); if (strlen($enc) > 262144) $enc = substr($enc, 0, 262144);
    $wpdb->insert($t, ['user_id' => $uid, 'kind' => sanitize_key($in['kind'] ?? 'other'), 'game_version' => substr(sanitize_text_field($in['gameVersion'] ?? ''), 0, 16), 'save_id' => isset($in['saveId']) ? (int) $in['saveId'] : null, 'tick' => (int) ($in['tick'] ?? 0), 'summary' => mb_substr(sanitize_text_field($in['summary'] ?? ''), 0, 500), 'data' => $enc, 'ua' => substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255), 'created_at' => current_time('mysql', true)]);
    $id = (int) $wpdb->insert_id;
    $admin = get_option('admin_email'); if ($admin) wp_mail($admin, '[Statefall] ' . sanitize_key($in['kind'] ?? 'report') . ' report #' . $id, "A player filed a report.\n\nSummary: " . sanitize_text_field($in['summary'] ?? '') . "\nGame: " . sanitize_text_field($in['gameVersion'] ?? '') . "\n\n" . admin_url('admin.php?page=statefall-reports'));
    return ['ok' => true, 'id' => $id];
}
function statefall_admin_reports() {
    global $wpdb; $t = statefall_reports_table();
    if (!empty($_POST['sf_rep_action']) && check_admin_referer('statefall_reports')) { $id = (int) $_POST['id']; if ($_POST['sf_rep_action'] === 'delete') $wpdb->delete($t, ['id' => $id]); else $wpdb->update($t, ['status' => $_POST['sf_rep_action'] === 'close' ? 'closed' : 'new'], ['id' => $id]); }
    $rows = $wpdb->get_results("SELECT id,user_id,kind,game_version,save_id,tick,summary,ua,status,created_at FROM $t ORDER BY id DESC LIMIT 200", ARRAY_A);
    echo '<div class="wrap"><h1>Statefall — player reports</h1><p>Filed from the game when a replay diverges (or a player reports a problem). Download the JSON and, where a save id is shown, the .state file from the Saves table for diagnosis.</p>';
    echo '<table class="widefat striped"><thead><tr><th>#</th><th>When (UTC)</th><th>Player</th><th>Kind</th><th>Game</th><th>Save</th><th>Tick</th><th>Summary</th><th>Status</th><th></th></tr></thead><tbody>';
    foreach ($rows ?: [] as $r) { $u = get_userdata((int) $r['user_id']); $dl = wp_nonce_url(admin_url('admin.php?page=statefall-reports&sf_rep_dl=' . (int) $r['id']), 'statefall_reports_dl');
        echo '<tr' . ($r['status'] === 'closed' ? ' style="opacity:.55"' : '') . '><td>' . (int) $r['id'] . '</td><td>' . esc_html($r['created_at']) . '</td><td>' . esc_html($u ? $u->display_name : '#' . $r['user_id']) . '</td><td>' . esc_html($r['kind']) . '</td><td>' . esc_html($r['game_version']) . '</td><td>' . ($r['save_id'] ? '<a href="' . esc_url(admin_url('admin.php?page=statefall-saves')) . '">#' . (int) $r['save_id'] . '</a>' : '—') . '</td><td>' . (int) $r['tick'] . '</td><td style="max-width:420px">' . esc_html($r['summary']) . '<br><span style="color:#888;font-size:11px">' . esc_html(substr($r['ua'], 0, 90)) . '</span></td><td>' . esc_html($r['status']) . '</td><td style="white-space:nowrap"><a class="button button-small" href="' . esc_url($dl) . '">Download JSON</a> <form method="post" style="display:inline">' . wp_nonce_field('statefall_reports', '_wpnonce', true, false) . '<input type="hidden" name="id" value="' . (int) $r['id'] . '"><button class="button button-small" name="sf_rep_action" value="' . ($r['status'] === 'closed' ? 'reopen' : 'close') . '">' . ($r['status'] === 'closed' ? 'Reopen' : 'Close') . '</button> <button class="button button-small" name="sf_rep_action" value="delete" onclick="return confirm(\'Delete this report?\')">Delete</button></form></td></tr>'; }
    if (!$rows) echo '<tr><td colspan="10">No reports.</td></tr>';
    echo '</tbody></table></div>';
}

add_action('admin_init', function () {
    if (empty($_GET['sf_rep_dl']) || !current_user_can('manage_options') || !check_admin_referer('statefall_reports_dl')) return;
    global $wpdb; $t = statefall_reports_table(); $r = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE id=%d", (int) $_GET['sf_rep_dl']), ARRAY_A); if (!$r) return;
    nocache_headers(); header('Content-Type: application/json'); header('Content-Disposition: attachment; filename="statefall-report-' . (int) $r['id'] . '.json"');
    echo wp_json_encode(['report' => array_diff_key($r, ['data' => 1]), 'data' => json_decode($r['data'], true)], JSON_PRETTY_PRINT); exit;
});
