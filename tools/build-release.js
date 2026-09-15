'use strict';

const fs = require('fs');
const path = require('path');
const {releaseZip, sha256} = require('./package-zip');

const root = path.resolve(__dirname, '..');
const pkg = path.join(root, 'pkg');
const output = path.join(root, '.artifacts');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'game', 'index.html'));
const match = source.toString('utf8').match(/GAME_VERSION='([^']+)',\s*GAME_BUILD='([^']+)'/);
if (!match || match[1] !== packageJson.version) throw new Error('Game and package.json versions do not match.');

function walk(dir, prefix = '') {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative) : [{path: relative, data: fs.readFileSync(path.join(dir, entry.name))}];
  });
}

const files = [{path: 'index.html', data: source}, ...walk(pkg).filter(file => file.path !== 'VERSION.txt')];
files.push({path: 'VERSION.txt', data: Buffer.from(`${match[1]} build ${match[2]}\n`)});
if (!files.some(file => file.path === 'flags.js')) throw new Error('Run release:assets before building the release.');
const archive = releaseZip(files, {version: match[1], build: match[2], minimumPluginVersion: '1.10.7', entry: 'index.html', flags: 'flags.js'});
fs.mkdirSync(output, {recursive: true});
const target = path.join(output, `statefall-release-${match[1]}.zip`);
fs.writeFileSync(target, archive);
console.log(`${path.relative(root, target)} sha256 ${sha256(archive)}`);
