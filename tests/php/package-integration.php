<?php
if (!defined('ABSPATH')) exit(1);

function sf_assert($condition, $message) { if (!$condition) throw new Exception($message); }
function sf_fixture($name) { return '/statefall-artifacts/package-fixtures/' . $name; }
function sf_install($name) { $result = statefall_install_package(sf_fixture($name), $name); sf_assert($result === true, $name . ': ' . $result); }
function sf_rejected($name, $contains) {
    $before = statefall_active_release(); $result = statefall_install_package(sf_fixture($name), $name);
    sf_assert(is_string($result) && stripos($result, $contains) !== false, $name . ' returned: ' . var_export($result, true));
    sf_assert(statefall_active_release() === $before, $name . ' changed the active pointer');
}

$candidate = json_decode(file_get_contents('/statefall-artifacts/release-candidate.json'), true);
sf_assert(is_array($candidate) && preg_match('/^\d+\.\d+\.\d+$/D', $candidate['version'] ?? ''), 'Current candidate metadata is missing or invalid');
sf_assert(($candidate['filename'] ?? '') === 'statefall-release-' . $candidate['version'] . '.zip', 'Unexpected current ZIP filename');
$exactRelease = $candidate['version'] . '-' . $candidate['build'];
sf_assert(statefall_canonical_release_name($exactRelease) === $exactRelease, 'Invalid current release name');
$exactZip = '/statefall-artifacts/' . $candidate['filename'];
sf_assert(is_file($exactZip) && hash_file('sha256', $exactZip) === ($candidate['sha256'] ?? ''), 'Current ZIP checksum mismatch');
$root = statefall_game_dir();
sf_assert(strpos($root, '/wp-content/uploads/') !== false, 'Tests must use disposable artifact WordPress uploads.');
if (is_dir(statefall_releases_dir())) statefall_rrmdir_contents(statefall_releases_dir(), '');
if (is_dir($root . 'release-pointers')) { statefall_rrmdir_contents($root . 'release-pointers/', ''); @rmdir($root . 'release-pointers'); }
@unlink($root . 'active-release'); @unlink($root . 'index.html'); @unlink($root . 'flags.js'); statefall_release_context(true); wp_mkdir_p(statefall_releases_dir());
update_option('statefall_phase_b_data_marker', 'preserve-me');

file_put_contents($root . 'index.html', '<!doctype html><div id="start">Statefall</div><script>const GAME_VERSION=\'8.9.0\', GAME_BUILD=\'legacy\', REQUIRES_PLUGIN=\'1.10.7\';</script>');
file_put_contents($root . 'flags.js', 'window.LEGACY_FLAGS=true;');
wp_mkdir_p(statefall_releases_dir() . '.staging-interrupted/nested/'); file_put_contents(statefall_releases_dir() . '.staging-interrupted/nested/partial.js', 'partial');
touch(statefall_releases_dir() . '.staging-interrupted', time() - 30000);
wp_mkdir_p(statefall_releases_dir() . '.staging-current/'); file_put_contents(statefall_releases_dir() . '.staging-current/partial.js', 'current');
sf_install('valid-1.zip');
sf_assert(statefall_active_release() === '9.0.1-fixture-1', 'valid install did not activate');
sf_assert(!is_dir(statefall_releases_dir() . '.staging-interrupted'), 'interrupted staging was not cleaned');
sf_assert(is_dir(statefall_releases_dir() . '.staging-current'), 'current staging was incorrectly cleaned');
statefall_rrmdir_contents(statefall_releases_dir() . '.staging-current/', ''); @rmdir(statefall_releases_dir() . '.staging-current');
sf_assert(statefall_release_complete('8.9.0-legacy'), 'legacy root was not imported as a complete immutable release');
sf_assert(statefall_release_complete(statefall_active_release()), 'installed release is incomplete');
sf_assert(statefall_install_package(sf_fixture('valid-2.zip'), 'legacy.html') !== true, 'bare legacy HTML install was accepted');
wp_mkdir_p(statefall_versions_dir() . 'legacy-backup/'); file_put_contents(statefall_versions_dir() . 'legacy-backup/index.html', 'legacy');
sf_assert(stripos(statefall_restore_version('legacy-backup'), 'retired') !== false, 'legacy mutable rollback was accepted');

sf_rejected('wrong-hash.zip', 'SHA-256');
sf_rejected('traversal.zip', 'invalid path');
sf_rejected('forbidden.zip', 'forbidden file extension');
sf_rejected('duplicate.zip', 'duplicate normalized path');
sf_rejected('absolute.zip', 'invalid path');
sf_rejected('dotfile.zip', 'invalid path');
sf_rejected('missing-asset.zip', 'exactly match');
sf_rejected('unsupported-schema.zip', 'unsupported schema');
sf_rejected('corrupt.zip', 'Could not open');
sf_rejected('version-mismatch.zip', 'GAME_VERSION');
sf_rejected('build-mismatch.zip', 'GAME_BUILD');
sf_rejected('plugin-mismatch.zip', 'REQUIRES_PLUGIN');
sf_rejected('signing-key-mismatch.zip', 'signing key');
sf_rejected('missing-asset-base.zip', '__STATEFALL_ASSET_BASE__');

function sf_small_limits($limits) { $limits['files'] = 3; return $limits; }
add_filter('statefall_package_limits', 'sf_small_limits'); sf_rejected('limit.zip', 'file count'); remove_filter('statefall_package_limits', 'sf_small_limits');
function sf_tiny_file_limit($limits) { $limits['file'] = 10; return $limits; }
add_filter('statefall_package_limits', 'sf_tiny_file_limit'); sf_rejected('limit.zip', 'extracted-size'); remove_filter('statefall_package_limits', 'sf_tiny_file_limit');

$bad = statefall_releases_dir() . '9.9.9-incomplete/'; wp_mkdir_p($bad); file_put_contents($bad . 'release.json', '{}');
$before = statefall_active_release(); sf_assert(statefall_activate_release('9.9.9-incomplete') !== true, 'incomplete release activated'); sf_assert(statefall_active_release() === $before, 'failed activation changed pointer');
statefall_rrmdir_contents($bad, ''); @rmdir($bad);

sf_install('valid-2.zip');
sf_assert(statefall_restore_version('9.0.1-fixture-1') === true, 'rollback failed');
sf_assert(statefall_active_release() === '9.0.1-fixture-1', 'rollback pointer is wrong');
$pointerDir = $root . 'release-pointers/'; $sequence = 0;
foreach (scandir($pointerDir) as $record) if (preg_match('/^([0-9]{20})-/', $record, $match)) $sequence = max($sequence, (int) $match[1]);
file_put_contents($pointerDir . sprintf('%020d', $sequence + 1) . '-external.pointer', "9.0.2-fixture-2\n");
sf_assert(statefall_active_release() === '9.0.1-fixture-1', 'one request mixed active release contexts');
statefall_release_context(true); sf_assert(statefall_active_release() === '9.0.2-fixture-2', 'a new request did not resolve the latest pointer');
sf_assert(statefall_restore_version('9.0.1-fixture-1') === true, 'rollback after context snapshot test failed');
$oldPointer = $root . 'active-release'; file_put_contents($oldPointer, 'do-not-replace');
sf_assert(statefall_restore_version('9.0.2-fixture-2') === true, 'journal activation failed with an existing legacy pointer file');
sf_assert(file_get_contents($oldPointer) === 'do-not-replace', 'activation relied on replacing the old pointer file');
$pointerRecords = glob($root . 'release-pointers/*.pointer'); sf_assert(count($pointerRecords) >= 3, 'atomic pointer journal did not append activation records');
sf_assert(statefall_restore_version('9.0.1-fixture-1') === true, 'pointer journal rollback failed');

$lock = fopen($root . '.release.lock', 'c'); flock($lock, LOCK_EX);
function sf_zero_lock_timeout($timeout) { return 0; }
add_filter('statefall_release_lock_timeout', 'sf_zero_lock_timeout');
sf_assert(stripos(statefall_delete_release('9.0.2-fixture-2'), 'in progress') !== false, 'filesystem lock did not block deletion');
remove_filter('statefall_release_lock_timeout', 'sf_zero_lock_timeout'); flock($lock, LOCK_UN); fclose($lock);
sf_assert(statefall_delete_release('../9.0.1-fixture-1') !== true, 'traversal release name was accepted');
sf_assert(statefall_delete_release('') !== true, 'empty release name was accepted');
sf_assert(stripos(statefall_delete_release('9.0.1-fixture-1'), 'active') !== false, 'active release deletion was accepted');
sf_assert(is_file($root . 'index.html'), 'release deletion reached the package root');
sf_assert(statefall_delete_release('9.0.2-fixture-2') === true, 'inactive release deletion failed');
sf_install('valid-2.zip');
sf_assert(statefall_active_release() === '9.0.2-fixture-2', 'reinstall did not reactivate existing release');
for ($i = 3; $i <= 7; $i++) sf_install('valid-' . $i . '.zip');
$releases = array_values(array_filter(statefall_list_versions(), function ($release) { return !$release['legacy']; }));
sf_assert(count($releases) === 6, 'retention must keep active plus five inactive releases');
sf_assert(!is_dir(statefall_releases_dir() . '9.0.1-fixture-1'), 'oldest inactive release was not pruned');
sf_assert(is_dir(statefall_releases_dir() . statefall_active_release()), 'active release was pruned');
sf_assert(statefall_restore_version('9.0.4-fixture-4') === true, 'final rollback failed');
  sf_assert(statefall_install_package($exactZip, $candidate['filename']) === true, 'exact production game ZIP did not install');
  sf_assert(statefall_active_release() === $exactRelease && statefall_release_complete(statefall_active_release()), 'exact production game ZIP is incomplete');
sf_assert(get_option('statefall_phase_b_data_marker') === 'preserve-me', 'unrelated WordPress data changed');
  sf_assert(statefall_game_path() === statefall_releases_dir() . $exactRelease . '/index.html', 'runtime entry path is wrong');
  sf_assert(statefall_flags_path() === statefall_releases_dir() . $exactRelease . '/flags.js', 'runtime flags path is wrong');
$info = statefall_installed_info(); sf_assert($info['keyMatch'] === true, 'exact release signing-key metadata does not match the site key');
ob_start(); statefall_admin_game(); $admin = ob_get_clean();
  sf_assert(stripos($admin, 'game package') !== false && strpos($admin, $exactRelease) !== false, 'admin release UI is incompatible');

echo "PASS manifest install, validation, activation, rollback, reinstall, staging, retention and data preservation\n";
