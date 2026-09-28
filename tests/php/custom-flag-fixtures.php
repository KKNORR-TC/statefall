<?php
if (!defined('ABSPATH')) exit(1);
if (strpos(home_url(), 'http://localhost:') !== 0 || $GLOBALS['wpdb']->prefix !== 'artifact_') throw new Exception('Synthetic flags require disposable artifact WordPress.');
$flag = ['layers' => [['h', '#0038a8', '#ffffff'], ['emb', '#ffffff', 'anchor', 0.5, 0.5, 0.2, null]]];
if (statefall_validate_flag($flag) !== $flag) throw new Exception('Synthetic flag must retain the valid null accent.');
foreach (['artifact-admin' => 10, 'upgrade-user' => 25] as $login => $wins) {
 $user = get_user_by('login', $login); if (!$user) throw new Exception('Missing synthetic artifact user.');
 update_user_meta($user->ID, 'statefall_flag', $flag);
 update_user_meta($user->ID, 'statefall_nation', 'Synthetic ' . $login);
 update_user_meta($user->ID, 'statefall_win_credit', $wins);
 statefall_pool_refresh($user->ID);
}
echo "PASS synthetic player and opponent flag fixtures installed in disposable WordPress\n";
