<?php
/**
 * Plugin Name: Statefall Scores
 * Description: Global leaderboard, player profiles and game hosting for Statefall RTS. Adds REST endpoints, a scores table, the [statefall_board] and [statefall_profile] shortcodes, and serves the game at /play/.
 * Version: 1.10.7
 * Author: That Company
 * License: GPL-2.0-or-later
 * Text Domain: statefall-scores
 */

if (!defined('ABSPATH')) exit;

define('STATEFALL_VERSION', '1.10.7');
define('STATEFALL_PATH', plugin_dir_path(__FILE__));
define('STATEFALL_URL', plugin_dir_url(__FILE__));
define('STATEFALL_TABLE', 'statefall_scores');

/**
 * Guarded loader. A syntax error or fatal in any module is caught here, that module is skipped, and an admin notice
 * says which file and line — the site never goes down because of a bad plugin update. Keep this file itself minimal.
 * Kill switch: define('STATEFALL_DISABLED', true) in wp-config.php turns the whole plugin off.
 */
if (defined('STATEFALL_DISABLED') && STATEFALL_DISABLED) { add_action('admin_notices', function () { echo '<div class="notice notice-warning"><p>Statefall is disabled by STATEFALL_DISABLED in wp-config.php.</p></div>'; }); return; }
$statefall_modules = ['score', 'rest', 'shortcodes', 'play', 'music', 'moderate', 'packages', 'saves', 'reports', 'nations', 'trophies', 'players', 'admin'];
$statefall_errors = [];
foreach ($statefall_modules as $statefall_m) {
    try { require_once STATEFALL_PATH . 'includes/' . $statefall_m . '.php'; }
    catch (\Throwable $e) { $statefall_errors[] = ['module' => $statefall_m, 'message' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()]; }
}
if ($statefall_errors) { update_option('statefall_load_errors', $statefall_errors); }
else if (get_option('statefall_load_errors')) { delete_option('statefall_load_errors'); }
add_action('admin_notices', function () {
    $errs = get_option('statefall_load_errors'); if (!$errs || !current_user_can('manage_options')) return;
    foreach ($errs as $e) echo '<div class="notice notice-error"><p><b>Statefall:</b> module <code>' . esc_html($e['module']) . '</code> failed to load and was skipped — ' . esc_html($e['message']) . ' (' . esc_html($e['file']) . ':' . (int) $e['line'] . '). The rest of the plugin is running. Upload a fixed plugin zip to clear this.</p></div>';
});

/** Table name with prefix. */
function statefall_table() { global $wpdb; return $wpdb->prefix . STATEFALL_TABLE; }

/** Signing key: wp-config constant first, then the stored option (set on the settings page). */
function statefall_sign_keys() {
    $keys = [];
    if (defined('STATEFALL_SIGN_KEY') && STATEFALL_SIGN_KEY) $keys[] = STATEFALL_SIGN_KEY;
    $opt = get_option('statefall_sign_key');       if ($opt) $keys[] = $opt;
    $old = get_option('statefall_sign_key_prev');  if ($old) $keys[] = $old; // accepted during a rotation
    return array_values(array_unique($keys));
}

/** Activation: create the table, register the rewrite, schedule pruning. */
function statefall_create_table() {
    global $wpdb;
    $table = statefall_table();
    $charset = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta("CREATE TABLE $table (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        played_at DATETIME NOT NULL,
        result VARCHAR(20) NOT NULL,
        country VARCHAR(40) NOT NULL,
        map VARCHAR(20) NOT NULL,
        diff VARCHAR(12) NOT NULL,
        fog TINYINT(1) NOT NULL DEFAULT 0,
        risky TINYINT(1) NOT NULL DEFAULT 0,
        cls VARCHAR(60) NOT NULL,
        land DECIMAL(5,1) NOT NULL,
        minutes DECIMAL(6,1) NOT NULL,
        kills SMALLINT UNSIGNED NOT NULL,
        peak BIGINT UNSIGNED NOT NULL,
        gold BIGINT UNSIGNED NOT NULL,
        seed VARCHAR(16) NOT NULL,
        score INT UNSIGNED NOT NULL,
        ip_hash CHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        stats LONGTEXT NULL,
        card VARCHAR(80) NULL,
        custom TEXT NULL,
        flag TEXT NULL,
        bots TEXT NULL,
        PRIMARY KEY  (id),
        KEY cls_score (cls, score),
        KEY user_created (user_id, created_at)
    ) $charset;");
}
function statefall_activate() {
    statefall_create_table(); if (function_exists('statefall_saves_create_table')) statefall_saves_create_table(); if (function_exists('statefall_reports_create_table')) statefall_reports_create_table();
    if (!get_option('statefall_sign_key')) add_option('statefall_sign_key', wp_generate_password(40, false, false));
    add_option('statefall_rate_10min', 6);
    add_option('statefall_rate_day', 40);
    add_option('statefall_prune_abandoned', 1);
    if (function_exists('statefall_register_rewrite')) statefall_register_rewrite();
    flush_rewrite_rules();
    if (!wp_next_scheduled('statefall_prune')) wp_schedule_event(time() + 3600, 'weekly', 'statefall_prune');
}
register_activation_hook(__FILE__, 'statefall_activate');
/** Upgrade the table when the plugin is updated without reactivation. */
add_action('init', function () {
    if (get_option('statefall_db_version') === STATEFALL_VERSION) return;
    statefall_create_table(); if (function_exists('statefall_saves_create_table')) statefall_saves_create_table(); if (function_exists('statefall_reports_create_table')) statefall_reports_create_table();
    update_option('statefall_db_version', STATEFALL_VERSION);
    // rewrite rules are registered on init by play.php; flush them once, late, when it is safe
    add_action('wp_loaded', 'flush_rewrite_rules', 99);
    // WP Engine caches HTML for logged-out visitors; a plugin update changes markup, so purge it
    add_action('wp_loaded', function () { if (class_exists('WpeCommon')) { if (method_exists('WpeCommon', 'purge_memcached')) WpeCommon::purge_memcached(); if (method_exists('WpeCommon', 'purge_varnish_cache')) WpeCommon::purge_varnish_cache(); } }, 100);
}, 20);

function statefall_deactivate() {
    flush_rewrite_rules();
    wp_clear_scheduled_hook('statefall_prune');
}
register_deactivation_hook(__FILE__, 'statefall_deactivate');

/** Weekly prune of abandoned matches older than 90 days (if enabled). */
add_action('statefall_prune', function () {
    if (!get_option('statefall_prune_abandoned', 1)) return;
    global $wpdb;
    $wpdb->query($wpdb->prepare("DELETE FROM " . statefall_table() . " WHERE result=%s AND created_at < %s", 'Abandoned', gmdate('Y-m-d H:i:s', time() - 90 * DAY_IN_SECONDS)));
});

/** Front-end stylesheet for the shortcodes. */
add_action('wp_enqueue_scripts', function () {
    wp_register_style('statefall-board', STATEFALL_URL . 'assets/board.css', [], STATEFALL_VERSION);
});
