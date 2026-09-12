<?php
/**
 * Local-only safety controls for the restored production snapshot.
 */
if (!defined('ABSPATH')) exit;

add_filter('pre_wp_mail', '__return_false', PHP_INT_MAX);
add_filter('automatic_updater_disabled', '__return_true', PHP_INT_MAX);
add_filter('pre_http_request', function ($response, $args, $url) {
    $host = wp_parse_url($url, PHP_URL_HOST);
    if (in_array($host, ['localhost', '127.0.0.1', 'db'], true)) return $response;
    return new WP_Error('statefall_sandbox_blocked', 'External HTTP is disabled in the Statefall sandbox.');
}, PHP_INT_MIN, 3);

add_action('init', function () {
    update_option('blog_public', '0');
}, 1);
