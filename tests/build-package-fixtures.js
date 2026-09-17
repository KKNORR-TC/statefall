'use strict';

const fs = require('fs');
const path = require('path');
const {releaseZip, sha256, zip} = require('../tools/package-zip');
const releaseMetadata = require('../tools/release-metadata');

const out = path.resolve(__dirname, '..', '.artifacts', 'package-fixtures');
fs.mkdirSync(out, {recursive: true});
const app = Buffer.from('window.STATEFALL_RELEASE_FIXTURE=true;\n');
const css = Buffer.from('body{background:#123}\n');
const appPath = `assets/app.${sha256(app).slice(0, 8)}.js`;
const cssPath = `assets/site.${sha256(css).slice(0, 8)}.css`;
const signingKeySha256 = releaseMetadata.signingKeySha256;
const files = (version, build, required = '1.10.7') => [
  {path: 'index.html', data: Buffer.from(`<!doctype html><html><body><div id="start">Statefall</div><script>const GAME_VERSION='${version}', GAME_BUILD='${build}', REQUIRES_PLUGIN='${required}';</script><script src="__STATEFALL_ASSET_BASE__${appPath}"></script></body></html>`)},
  {path: 'flags.js', data: Buffer.from('window.STATEFALL_FLAGS_FIXTURE=true;\n')},
  {path: appPath, data: app},
  {path: cssPath, data: css},
  {path: 'assets/plain.deadbeef.js', data: Buffer.from('window.STATEFALL_BAD_FINGERPRINT=true;\n')},
  {path: 'howto/tabs.json', data: Buffer.from('[["basics","Basics"]]\n')},
  {path: 'howto/basics.html', data: Buffer.from('<p>Fixture help</p>\n')},
];
const make = (name, version, build = 'fixture', mutate, required = '1.10.7') => fs.writeFileSync(path.join(out, name), releaseZip(files(version, build, required), {version, build, minimumPluginVersion: required, signingKeySha256, entry: 'index.html', flags: 'flags.js'}, mutate));
for (let i = 1; i <= 7; i++) make(`valid-${i}.zip`, `9.0.${i}`, `fixture-${i}`);
make('wrong-hash.zip', '9.1.0', 'wrong-hash', manifest => { manifest.files.find(file => file.path === 'flags.js').sha256 = '0'.repeat(64); });
make('limit.zip', '9.1.1', 'limit');
make('missing-asset.zip', '9.1.2', 'missing-asset', manifest => { manifest.files.push({path: 'assets/missing.12345678.js', size: 1, sha256: '0'.repeat(64)}); });
make('unsupported-schema.zip', '9.1.3', 'schema', manifest => { manifest.schema = 99; });
make('version-mismatch.zip', '9.1.4', 'version-mismatch', manifest => { manifest.version = '9.1.5'; });
make('build-mismatch.zip', '9.1.6', 'build-mismatch', manifest => { manifest.build = 'other-build'; });
make('plugin-mismatch.zip', '9.1.7', 'plugin-mismatch', manifest => { manifest.minimumPluginVersion = '1.10.6'; });
make('signing-key-mismatch.zip', '9.1.9', 'signing-key-mismatch', manifest => { manifest.signingKeySha256 = '0'.repeat(64); });
const noBaseFiles = files('9.1.8', 'no-asset-base');
noBaseFiles[0].data = Buffer.from(noBaseFiles[0].data.toString('utf8').replace('__STATEFALL_ASSET_BASE__', ''));
fs.writeFileSync(path.join(out, 'missing-asset-base.zip'), releaseZip(noBaseFiles, {version: '9.1.8', build: 'no-asset-base', minimumPluginVersion: '1.10.7', signingKeySha256, entry: 'index.html', flags: 'flags.js'}));
const base = files('9.1.2', 'unsafe');
fs.writeFileSync(path.join(out, 'traversal.zip'), zip([...base, {path: '../escape.js', data: Buffer.from('bad')} ]));
fs.writeFileSync(path.join(out, 'forbidden.zip'), zip([...base, {path: 'shell.php', data: Buffer.from('<?php')} ]));
fs.writeFileSync(path.join(out, 'duplicate.zip'), zip([{path: 'release.json', data: Buffer.from('{}')}, {path: 'FLAGS.js', data: Buffer.from('a')}, {path: 'flags.js', data: Buffer.from('b')}]));
fs.writeFileSync(path.join(out, 'absolute.zip'), zip([{path: '/escape.js', data: Buffer.from('bad')} ]));
fs.writeFileSync(path.join(out, 'dotfile.zip'), zip([{path: '.htaccess', data: Buffer.from('bad')} ]));
fs.writeFileSync(path.join(out, 'corrupt.zip'), Buffer.from('not a zip file'));
fs.writeFileSync(path.join(out, 'paths.json'), JSON.stringify({appPath, cssPath}, null, 2) + '\n');
console.log(`Built package fixtures in ${out}`);
