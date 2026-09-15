<?php
if (!defined('ABSPATH')) exit;

/** Manifest package installation, immutable releases, activation and rollback. */
function statefall_versions_dir() { return statefall_game_dir() . 'versions/'; }
function statefall_releases_dir() { return statefall_game_dir() . 'releases/'; }
function statefall_package_limits() {
    return apply_filters('statefall_package_limits', ['archive' => 67108864, 'files' => 2000, 'file' => 33554432, 'total' => 134217728, 'depth' => 10, 'path' => 240]);
}
function statefall_canonical_release_name($name) {
    return is_string($name) && preg_match('/^[A-Za-z0-9][A-Za-z0-9._+-]{0,128}$/D', $name) && basename($name) === $name && sanitize_file_name($name) === $name ? $name : null;
}
function statefall_with_release_lock($callback) {
    $root = statefall_game_dir(); if (!is_dir($root) && !wp_mkdir_p($root)) return 'Could not create the release root.';
    $handle = @fopen($root . '.release.lock', 'c'); if (!$handle) return 'Could not open the release filesystem lock.';
    $deadline = microtime(true) + (float) apply_filters('statefall_release_lock_timeout', 10.0); $locked = false;
    do { $locked = flock($handle, LOCK_EX | LOCK_NB); if (!$locked) usleep(50000); } while (!$locked && microtime(true) < $deadline);
    if (!$locked) { fclose($handle); return 'Another release operation is in progress.'; }
    try { return $callback(); } finally { flock($handle, LOCK_UN); fclose($handle); }
}
function statefall_log_action($what) {
    $log = get_option('statefall_activity', []); if (!is_array($log)) $log = [];
    $u = wp_get_current_user(); $log[] = ['t' => current_time('mysql', true), 'who' => $u && $u->ID ? $u->display_name : 'system', 'what' => $what];
    update_option('statefall_activity', array_slice($log, -60));
}
function statefall_version_from_html($html) {
    return preg_match("/GAME_VERSION='([^']+)',\s*GAME_BUILD='([^']+)'/", $html, $m) ? ['version' => $m[1], 'build' => $m[2]] : null;
}
function statefall_requires_plugin_from_html($html) { return preg_match("/REQUIRES_PLUGIN='([^']+)'/", $html, $m) ? $m[1] : null; }
function statefall_validate_game_html($html) {
    $errors = []; $warnings = [];
    if (stripos($html, 'Statefall') === false || strpos($html, 'id="start"') === false || strpos($html, 'GAME_VERSION') === false) $errors[] = 'This is not a Statefall game file (missing the start card or version markers).';
    if (preg_match('/<\?php/i', $html)) $errors[] = 'The file contains PHP, which is never part of a game package.';
    if (strlen($html) < 200000) $warnings[] = 'The game file is unusually small (' . size_format(strlen($html)) . ').';
    $v = statefall_version_from_html($html); if (!$v) $warnings[] = 'Could not read GAME_VERSION from the file.';
    $keys = statefall_sign_keys(); if ($keys && preg_match("/STATEFALL_SIGN_KEY='([^']*)'/", $html, $m) && !in_array($m[1], $keys, true)) $warnings[] = 'The signing key baked into this game file does not match the site key.';
    $req = statefall_requires_plugin_from_html($html); if ($req && version_compare(STATEFALL_VERSION, $req, '<')) $warnings[] = 'This game build expects plugin ' . $req . ' or newer.';
    return ['ok' => !$errors, 'errors' => $errors, 'warnings' => $warnings, 'version' => $v];
}
function statefall_package_path_error($path, $limits) {
    if (!is_string($path) || $path === '' || strlen($path) > $limits['path'] || !preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*$#', $path)) return 'invalid path';
    if ($path[0] === '/' || preg_match('/^[A-Za-z]:/', $path) || substr($path, -1) === '/') return 'absolute or directory path';
    $parts = explode('/', $path);
    if (count($parts) > $limits['depth']) return 'path is too deep';
    foreach ($parts as $part) if ($part === '' || $part === '.' || $part === '..' || $part[0] === '.') return 'unsafe path segment';
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $allowed = ['html', 'js', 'mjs', 'css', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'mp3', 'ogg', 'wav', 'woff', 'woff2', 'txt', 'wasm'];
    return in_array($ext, $allowed, true) ? null : 'forbidden file extension';
}
function statefall_validate_manifest($manifest, $archiveFiles, $limits) {
    if (!is_array($manifest) || ($manifest['schema'] ?? null) !== 1) return 'release.json uses an unsupported schema.';
    foreach (['version', 'build', 'minimumPluginVersion', 'entry', 'flags', 'files'] as $key) if (!array_key_exists($key, $manifest)) return 'release.json is missing ' . $key . '.';
    foreach (['version', 'build', 'minimumPluginVersion'] as $key) if (!is_string($manifest[$key]) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/', $manifest[$key])) return 'release.json has an invalid ' . $key . '.';
    if (version_compare(STATEFALL_VERSION, $manifest['minimumPluginVersion'], '<')) return 'This release requires Statefall plugin ' . $manifest['minimumPluginVersion'] . ' or newer.';
    if (!is_array($manifest['files']) || !$manifest['files'] || count($manifest['files']) > $limits['files']) return 'release.json has an invalid file list.';
    $listed = [];
    foreach ($manifest['files'] as $file) {
        if (!is_array($file) || !isset($file['path'], $file['size'], $file['sha256'])) return 'release.json has an invalid file record.';
        $error = statefall_package_path_error($file['path'], $limits); if ($error) return 'Manifest path ' . $file['path'] . ': ' . $error . '.';
        $key = strtolower($file['path']); if (isset($listed[$key])) return 'release.json contains a duplicate normalized path.';
        if (!is_int($file['size']) || $file['size'] < 0 || $file['size'] > $limits['file'] || !preg_match('/^[a-f0-9]{64}$/', $file['sha256'])) return 'release.json has invalid size or hash metadata.';
        $listed[$key] = $file;
    }
    foreach (['entry', 'flags'] as $key) if (!is_string($manifest[$key]) || !isset($listed[strtolower($manifest[$key])])) return 'release.json ' . $key . ' is not in the file list.';
    $actual = array_fill_keys(array_map('strtolower', $archiveFiles), true); unset($actual['release.json']);
    if (array_diff_key($listed, $actual) || array_diff_key($actual, $listed)) return 'Archive files do not exactly match release.json.';
    return true;
}
function statefall_validate_manifest_entry($manifest, $html) {
    $valid = statefall_validate_game_html($html); if (!$valid['ok']) return implode(' ', $valid['errors']);
    $version = statefall_version_from_html($html); $required = statefall_requires_plugin_from_html($html);
    if (!$version || !$required) return 'The manifest entry is missing required game version markers.';
    if ($manifest['version'] !== $version['version']) return 'release.json version does not match GAME_VERSION.';
    if ($manifest['build'] !== $version['build']) return 'release.json build does not match GAME_BUILD.';
    if ($manifest['minimumPluginVersion'] !== $required) return 'release.json minimumPluginVersion does not match REQUIRES_PLUGIN.';
    $runtimeAssets = array_filter($manifest['files'], function ($file) use ($manifest) { return $file['path'] !== $manifest['entry'] && $file['path'] !== $manifest['flags'] && $file['path'] !== 'VERSION.txt' && strpos($file['path'], 'howto/') !== 0; });
    if ($runtimeAssets && strpos($html, '__STATEFALL_ASSET_BASE__') === false) return 'The multi-file manifest entry is missing __STATEFALL_ASSET_BASE__.';
    return true;
}
function statefall_inspect_package($tmp) {
    $limits = statefall_package_limits();
    if (!is_file($tmp) || filesize($tmp) > $limits['archive']) return 'The ZIP exceeds the compressed-size limit.';
    if (!class_exists('ZipArchive')) return 'ZipArchive is not available on this server.';
    $zip = new ZipArchive(); if ($zip->open($tmp) !== true) return 'Could not open the ZIP.';
    $files = []; $seen = []; $total = 0; $manifestBody = null;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i); $path = $stat['name'] ?? '';
        $error = statefall_package_path_error($path, $limits); if ($error) { $zip->close(); return 'ZIP path ' . $path . ': ' . $error . '.'; }
        $key = strtolower($path); if (isset($seen[$key])) { $zip->close(); return 'The ZIP contains a duplicate normalized path.'; } $seen[$key] = true;
        if (count($files) >= $limits['files'] || $stat['size'] > $limits['file'] || $total + $stat['size'] > $limits['total']) { $zip->close(); return 'The ZIP exceeds file count or extracted-size limits.'; }
        $opsys = 0; $attr = 0; if ($zip->getExternalAttributesIndex($i, $opsys, $attr) && (($attr >> 16) & 0170000) === 0120000) { $zip->close(); return 'The ZIP contains a symbolic link.'; }
        $files[] = $path; $total += $stat['size'];
        if ($key === 'release.json') { if ($stat['size'] > 1048576) { $zip->close(); return 'release.json is too large.'; } $manifestBody = $zip->getFromIndex($i); }
    }
    if ($manifestBody === null) { $zip->close(); return 'The ZIP has no release.json at its root.'; }
    $manifest = json_decode($manifestBody, true); $valid = statefall_validate_manifest($manifest, $files, $limits);
    if ($valid !== true) { $zip->close(); return $valid; }
    return ['zip' => $zip, 'manifest' => $manifest, 'files' => $files, 'total' => $total, 'manifestBody' => $manifestBody];
}
function statefall_release_name($manifest) { return $manifest['version'] . '-' . $manifest['build']; }
function statefall_release_complete($name, $manifest = null) {
    if (statefall_canonical_release_name($name) === null) return false;
    $dir = statefall_releases_dir() . $name . '/';
    if (!$manifest) $manifest = is_file($dir . 'release.json') ? json_decode(file_get_contents($dir . 'release.json'), true) : null;
    if (!is_array($manifest) || !is_array($manifest['files'] ?? null)) return false;
    $listedPaths = array_column($manifest['files'], 'path');
    if (statefall_validate_manifest($manifest, array_merge($listedPaths, ['release.json']), statefall_package_limits()) !== true) return false;
    if (statefall_release_name($manifest) !== $name) return false;
    foreach ($manifest['files'] as $file) {
        $path = $dir . $file['path'];
        if (!is_file($path) || filesize($path) !== $file['size'] || hash_file('sha256', $path) !== $file['sha256']) return false;
    }
    $actual = [];
    if (is_dir($dir)) foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)) as $file) if ($file->isFile()) $actual[] = str_replace('\\', '/', substr($file->getPathname(), strlen($dir)));
    sort($actual); $expected = array_merge($listedPaths, ['release.json']); sort($expected);
    return $actual === $expected && is_file($dir . $manifest['entry']) && is_file($dir . $manifest['flags']) && statefall_validate_manifest_entry($manifest, file_get_contents($dir . $manifest['entry'])) === true;
}
function statefall_cleanup_staging() {
    $dir = statefall_releases_dir(); if (!is_dir($dir)) return;
    $staleBefore = time() - (int) apply_filters('statefall_staging_max_age', 21600);
    foreach (scandir($dir) as $name) if (strpos($name, '.staging-') === 0 && is_dir($dir . $name) && filemtime($dir . $name) < $staleBefore) { statefall_rrmdir_contents($dir . $name . '/', ''); @rmdir($dir . $name); }
}
function statefall_write_pointer_locked($target) {
    if ($target !== 'legacy' && statefall_canonical_release_name($target) === null) return 'Invalid active-release target.';
    $dir = statefall_game_dir() . 'release-pointers/'; if (!is_dir($dir) && !wp_mkdir_p($dir)) return 'Could not create the active-release pointer directory.';
    $sequence = 0; foreach (scandir($dir) as $record) if (preg_match('/^([0-9]{20})-[A-Za-z0-9]+\.pointer$/', $record, $match)) $sequence = max($sequence, (int) $match[1]);
    $sequence++; $token = wp_generate_password(12, false, false); $tmp = $dir . '.staging-' . $token; $final = $dir . sprintf('%020d', $sequence) . '-' . $token . '.pointer';
    $handle = @fopen($tmp, 'xb'); if (!$handle) return 'Could not stage the active-release pointer.';
    $ok = fwrite($handle, $target . "\n") === strlen($target) + 1 && fflush($handle); if (function_exists('fsync')) $ok = $ok && fsync($handle); fclose($handle);
    if (!$ok || !rename($tmp, $final)) { @unlink($tmp); return 'Could not atomically publish the active-release pointer.'; }
    statefall_release_context(true);
    $records = array_values(array_filter(scandir($dir), function ($name) { return preg_match('/^[0-9]{20}-[A-Za-z0-9]+\.pointer$/', $name); })); rsort($records, SORT_STRING);
    foreach (array_slice($records, 20) as $record) @unlink($dir . $record);
    return true;
}
function statefall_activate_release_locked($name) {
    if (statefall_canonical_release_name($name) === null) return 'Invalid release name.';
    $manifest = statefall_release_manifest($name); if (!$manifest || !statefall_release_complete($name, $manifest)) return 'That release is missing or incomplete.';
    $pointer = statefall_write_pointer_locked($name); if ($pointer !== true) return $pointer;
    update_option('statefall_game_version', $manifest['version']);
    update_option('statefall_game_installed', ['t' => current_time('mysql', true), 'who' => wp_get_current_user()->display_name, 'how' => 'activated ' . $name]);
    statefall_log_action('Activated game release ' . $name); statefall_prune_releases_locked(); return true;
}
function statefall_activate_release($name) { return statefall_with_release_lock(function () use ($name) { return statefall_activate_release_locked($name); }); }
function statefall_import_legacy_root_locked() {
    if (statefall_pointer_target() !== 'legacy' || !is_file(statefall_game_dir() . 'index.html')) return true;
    $root = statefall_game_dir(); $html = file_get_contents($root . 'index.html'); $version = statefall_version_from_html($html); $required = statefall_requires_plugin_from_html($html);
    if (!$version || !$required || !is_file($root . 'flags.js')) return 'The active legacy package cannot be imported safely; install its complete flags.js before upgrading.';
    $paths = ['index.html', 'flags.js']; if (is_file($root . 'VERSION.txt')) $paths[] = 'VERSION.txt';
    if (is_dir($root . 'howto')) foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . 'howto', FilesystemIterator::SKIP_DOTS)) as $file) if ($file->isFile()) $paths[] = str_replace('\\', '/', substr($file->getPathname(), strlen($root)));
    sort($paths); $files = []; $limits = statefall_package_limits(); $total = 0;
    foreach ($paths as $path) { $error = statefall_package_path_error($path, $limits); $size = filesize($root . $path); if ($error || $size > $limits['file'] || $total + $size > $limits['total']) return 'The active legacy package cannot be imported safely.'; $total += $size; $files[] = ['path' => $path, 'size' => $size, 'sha256' => hash_file('sha256', $root . $path)]; }
    $manifest = ['schema' => 1, 'version' => $version['version'], 'build' => $version['build'], 'minimumPluginVersion' => $required, 'entry' => 'index.html', 'flags' => 'flags.js', 'files' => $files];
    $name = statefall_release_name($manifest); $final = statefall_releases_dir() . $name . '/'; if (is_dir($final)) return statefall_release_complete($name, $manifest) ? true : 'The legacy release conflicts with an existing immutable release.';
    $stage = statefall_releases_dir() . '.staging-legacy-' . wp_generate_password(12, false, false) . '/'; if (!wp_mkdir_p($stage)) return 'Could not stage the legacy release.';
    foreach ($paths as $path) { wp_mkdir_p(dirname($stage . $path)); if (!copy($root . $path, $stage . $path) || hash_file('sha256', $stage . $path) !== hash_file('sha256', $root . $path)) { statefall_rrmdir_contents($stage, ''); @rmdir($stage); return 'Could not verify the staged legacy release.'; } }
    $manifestWritten = file_put_contents($stage . 'release.json', wp_json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX) !== false;
    if (!$manifestWritten || !statefall_release_complete_in_dir($stage, $manifest) || !rename($stage, $final)) { statefall_rrmdir_contents($stage, ''); @rmdir($stage); return 'Could not finalize the staged legacy release.'; }
    return true;
}
function statefall_release_complete_in_dir($dir, $manifest) {
    foreach ($manifest['files'] as $file) if (!is_file($dir . $file['path']) || filesize($dir . $file['path']) !== $file['size'] || hash_file('sha256', $dir . $file['path']) !== $file['sha256']) return false;
    return statefall_validate_manifest_entry($manifest, file_get_contents($dir . $manifest['entry'])) === true;
}
function statefall_install_package($tmp, $name, $version = '') {
    if (preg_match('/\.html?$/i', $name)) return 'Bare HTML installation is retired. Existing legacy root packages remain readable; install a release.json ZIP to update safely.';
    if (!preg_match('/\.zip$/i', $name)) return 'Upload a manifest ZIP.';
    $package = statefall_inspect_package($tmp); if (is_string($package)) return $package; $entered = false;
    $result = statefall_with_release_lock(function () use ($package, $name, &$entered) { $entered = true; return statefall_install_package_locked($package, $name); });
    if (!$entered) $package['zip']->close(); return $result;
}
function statefall_install_package_locked($package, $name) {
    statefall_cleanup_staging(); $legacy = statefall_import_legacy_root_locked(); if ($legacy !== true) { $package['zip']->close(); return $legacy; }
    $zip = $package['zip']; $manifest = $package['manifest']; $release = statefall_release_name($manifest);
    $final = statefall_releases_dir() . $release . '/'; wp_mkdir_p(statefall_releases_dir());
    if (is_dir($final)) { $zip->close(); if (!statefall_release_complete($release, $manifest)) return 'An immutable release with this version and build already exists but differs or is incomplete.'; return statefall_activate_release_locked($release); }
    $stage = statefall_releases_dir() . '.staging-' . wp_generate_password(12, false, false) . '/'; if (!wp_mkdir_p($stage)) { $zip->close(); return 'Could not create the staging directory.'; }
    $error = null;
    foreach ($manifest['files'] as $file) {
        $stream = $zip->getStream($file['path']); $dest = $stage . $file['path']; wp_mkdir_p(dirname($dest)); $out = @fopen($dest, 'wb');
        if (!$stream || !$out) { $error = 'Could not extract ' . $file['path'] . '.'; if ($stream) fclose($stream); if ($out) fclose($out); break; }
        $written = stream_copy_to_stream($stream, $out, $file['size'] + 1); fclose($stream); fclose($out);
        if ($written !== $file['size']) { $error = 'Extracted size mismatch for ' . $file['path'] . '.'; break; }
    }
    $zip->close();
    if (!$error && file_put_contents($stage . 'release.json', $package['manifestBody'], LOCK_EX) === false) $error = 'Could not write release.json.';
    if (!$error) foreach ($manifest['files'] as $file) if (hash_file('sha256', $stage . $file['path']) !== $file['sha256']) { $error = 'SHA-256 mismatch for ' . $file['path'] . '.'; break; }
    if (!$error) { $entryCheck = statefall_validate_manifest_entry($manifest, file_get_contents($stage . $manifest['entry'])); if ($entryCheck !== true) $error = $entryCheck; }
    if ($error || !rename($stage, $final)) { statefall_rrmdir_contents($stage, ''); @rmdir($stage); return $error ?: 'Could not finalize the immutable release directory.'; }
    $activated = statefall_activate_release_locked($release); if ($activated !== true) return $activated;
    statefall_log_action('Installed game release ' . $release . ' (' . sanitize_file_name($name) . ')'); return true;
}
function statefall_prune_releases_locked($keepInactive = 5) {
    $dir = statefall_releases_dir(); if (!is_dir($dir)) return; statefall_release_context(true); $active = statefall_active_release(); $items = [];
    foreach (scandir($dir) as $name) if ($name !== $active && $name[0] !== '.' && is_dir($dir . $name) && is_file($dir . $name . '/release.json')) $items[] = ['name' => $name, 'time' => filemtime($dir . $name . '/release.json')];
    usort($items, function ($a, $b) { return $b['time'] <=> $a['time'] ?: strcmp($b['name'], $a['name']); });
    foreach (array_slice($items, $keepInactive) as $item) { statefall_rrmdir_contents($dir . $item['name'] . '/', ''); @rmdir($dir . $item['name']); }
}
function statefall_prune_releases($keepInactive = 5) { return statefall_with_release_lock(function () use ($keepInactive) { statefall_prune_releases_locked($keepInactive); return true; }); }
function statefall_list_versions() {
    $out = []; $dir = statefall_releases_dir(); $active = statefall_active_release();
    if (is_dir($dir)) foreach (scandir($dir) as $name) { if ($name[0] === '.' || !is_dir($dir . $name)) continue; $m = statefall_release_manifest($name); if (!$m) continue; $out[] = ['name' => $name, 'version' => $m['version'], 'build' => $m['build'], 'size' => array_sum(array_column($m['files'], 'size')), 'howto' => is_dir($dir . $name . '/howto'), 'time' => filemtime($dir . $name . '/release.json'), 'active' => $name === $active, 'legacy' => false]; }
    $legacy = statefall_versions_dir(); if (is_dir($legacy)) foreach (scandir($legacy) as $name) { if ($name === '.' || $name === '..' || !is_file($legacy . $name . '/index.html')) continue; $v = statefall_version_from_html(file_get_contents($legacy . $name . '/index.html')); $out[] = ['name' => $name, 'version' => $v['version'] ?? '?', 'build' => $v['build'] ?? '', 'size' => filesize($legacy . $name . '/index.html'), 'howto' => is_dir($legacy . $name . '/howto'), 'time' => filemtime($legacy . $name), 'active' => false, 'legacy' => true]; }
    usort($out, function ($a, $b) { return $b['time'] <=> $a['time']; }); return $out;
}
function statefall_restore_version($name) {
    if (statefall_canonical_release_name($name) === null) return 'Invalid release name.';
    if (is_dir(statefall_releases_dir() . $name)) return statefall_activate_release($name);
    if (is_dir(statefall_versions_dir() . $name)) return 'Legacy mutable backup restore is retired. Repackage it with release.json before activation.';
    return 'That release does not exist.';
}
function statefall_delete_release($name) {
    if (statefall_canonical_release_name($name) === null) return 'Invalid release name.';
    return statefall_with_release_lock(function () use ($name) {
        statefall_release_context(true);
        if ($name === statefall_active_release()) return 'The active release cannot be deleted.';
        $base = realpath(statefall_releases_dir()); $dir = statefall_releases_dir() . $name . '/'; $real = realpath($dir);
        if (!$base || !$real || dirname($real) !== $base || is_link(rtrim($dir, '/')) || !is_file($dir . 'release.json')) return 'That release does not exist.';
        statefall_rrmdir_contents($dir, ''); if (!@rmdir($dir)) return 'Could not delete the release.'; statefall_log_action('Deleted release ' . $name); return true;
    });
}
function statefall_installed_info() {
    $context = statefall_release_context(); $path = statefall_game_path(); if (!is_file($path)) return ['installed' => false]; $html = file_get_contents($path); $m = $context ? $context['manifest'] : null; $v = $m ? ['version' => $m['version'], 'build' => $m['build']] : statefall_version_from_html($html);
    $keys = statefall_sign_keys(); $keyMatch = null; if ($keys && preg_match("/STATEFALL_SIGN_KEY='([^']*)'/", $html, $match)) $keyMatch = in_array($match[1], $keys, true);
    $howto = statefall_release_dir() . 'howto/'; $n = 0; if (is_dir($howto)) foreach (scandir($howto) as $e) if (preg_match('/\.html$/', $e)) $n++;
    $meta = get_option('statefall_game_installed', []); return ['installed' => true, 'version' => $v['version'] ?? (get_option('statefall_game_version', '') ?: '?'), 'build' => $v['build'] ?? '', 'release' => statefall_active_release(), 'size' => filesize($path), 'sha' => substr(hash_file('sha256', $path), 0, 12), 'howto' => $n, 'keyMatch' => $keyMatch, 'requires' => $m['minimumPluginVersion'] ?? statefall_requires_plugin_from_html($html), 'installedAt' => $meta['t'] ?? '', 'by' => $meta['who'] ?? '', 'how' => $meta['how'] ?? ''];
}
function statefall_health() {
    global $wpdb; $rows = []; $info = statefall_installed_info(); $rows[] = ['Game package installed', $info['installed'], $info['installed'] ? 'v' . $info['version'] . ' - ' . $info['howto'] . ' how-to pages' : 'Upload a release under Game package'];
    if ($info['installed']) { $rows[] = ['Active release complete', empty($info['release']) || statefall_release_complete($info['release']), $info['release'] ?: 'legacy root package']; $rows[] = ['Signing key matches game file', $info['keyMatch'] !== false, $info['keyMatch'] === null ? 'could not read the key from the file' : ($info['keyMatch'] ? 'ok' : 'scores will be rejected')]; }
    $t = statefall_table(); $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $t)) === $t; $rows[] = ['Scores table', $exists, $exists ? $wpdb->get_var("SELECT COUNT(*) FROM $t") . ' rows - schema ' . get_option('statefall_db_version', '?') : 'missing'];
    $rules = get_option('rewrite_rules'); $rw = is_array($rules) && isset($rules['^play/?$']); $rows[] = ['/play/ rewrite rule', $rw, $rw ? 'registered' : 'visit Settings > Permalinks and Save'];
    $rest = wp_remote_get(rest_url('statefall/v1/classes'), ['timeout' => 6]); $ok = !is_wp_error($rest) && wp_remote_retrieve_response_code($rest) === 200; $rows[] = ['REST API reachable', $ok, $ok ? rest_url('statefall/v1/') : (is_wp_error($rest) ? $rest->get_error_message() : 'HTTP ' . wp_remote_retrieve_response_code($rest))];
    $w = is_dir(statefall_game_dir()) ? wp_is_writable(statefall_game_dir()) : wp_is_writable(dirname(statefall_game_dir())); $rows[] = ['Uploads folder writable', $w, statefall_game_dir()];
    $reg = (bool) get_option('users_can_register'); $rows[] = ['Player registration open', $reg, $reg ? 'anyone can register' : 'Settings > General > Membership'];
    $errs = get_option('statefall_load_errors'); $rows[] = ['All plugin modules loaded', !$errs, $errs ? count($errs) . ' module(s) failed' : 'ok'];
    foreach (['/leaderboard/', '/profile/', '/how-to-play/'] as $page) { $found = get_page_by_path(trim($page, '/')); $rows[] = ['Page ' . $page, (bool) $found, $found ? 'exists' : 'create it with the matching shortcode']; }
    return $rows;
}
function statefall_health_html() { $h = '<table class="widefat striped" style="max-width:900px"><tbody>'; foreach (statefall_health() as $r) $h .= '<tr><td style="width:36px">' . ($r[1] ? '<span style="color:#1a7f37">*</span>' : '<span style="color:#b00">*</span>') . '</td><td style="width:260px"><b>' . esc_html($r[0]) . '</b></td><td>' . esc_html($r[2]) . '</td></tr>'; return $h . '</tbody></table>'; }
