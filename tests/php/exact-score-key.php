<?php
if (!defined('ABSPATH')) exit(1);

wp_set_current_user(2);
$record = [
    'when' => round(microtime(true) * 1000), 'result' => 'Defeat', 'country' => 'Artifact test',
    'map' => 'random', 'diff' => 'normal', 'fog' => false, 'risky' => false, 'cls' => 'Standard',
    'land' => 1, 'minutes' => 2, 'kills' => 0, 'peak' => 120, 'gold' => 0, 'seed' => 'ARTIFACTKEYTEST',
];
function sf_submit_exact($record, $sig) {
    $request = new WP_REST_Request('POST', '/statefall/v1/scores');
    $request->set_header('content-type', 'application/json');
    $request->set_body(wp_json_encode(array_merge($record, ['sig' => $sig])));
    return statefall_rest_submit($request);
}
$bad = sf_submit_exact($record, str_repeat('0', 64));
if (!($bad instanceof WP_REST_Response) || $bad->get_status() !== 403 || ($bad->get_data()['error'] ?? '') !== 'forbidden') throw new Exception('Exact artifact score did not reject a mismatched signing key.');
$keys = statefall_sign_keys();
$good = sf_submit_exact($record, hash_hmac('sha256', statefall_canonical($record), $keys[0]));
if ($good instanceof WP_REST_Response || empty($good['ok'])) throw new Exception('Exact artifact score signed with the matching key was not accepted.');
echo "PASS exact artifact score accepts the matching key and rejects a mismatch\n";
