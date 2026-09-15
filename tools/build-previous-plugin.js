'use strict';

const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const {sha256, zip} = require('./package-zip');

const root = path.resolve(__dirname, '..');
const prefix = 'plugin/statefall-scores/';
const previousRef = '88dca6e';
const names = execFileSync('git', ['ls-tree', '-r', '--name-only', previousRef, 'plugin/statefall-scores'], {cwd: root, encoding: 'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const entries = names.map(name => ({path: `statefall-scores/${name.slice(prefix.length)}`, data: execFileSync('git', ['show', `${previousRef}:${name}`], {cwd: root, maxBuffer: 32 * 1024 * 1024})}));
const main = entries.find(entry => entry.path === 'statefall-scores/statefall-scores.php');
if (!main || !/Version:\s*1\.10\.6\b/.test(main.data.toString('utf8'))) throw new Error(`${previousRef} is not the expected repository plugin 1.10.6 baseline.`);
const archive = zip(entries.sort((a, b) => a.path.localeCompare(b.path)));
const output = path.join(root, '.artifacts'); fs.mkdirSync(output, {recursive: true});
const target = path.join(output, 'statefall-scores-1.10.6.zip'); fs.writeFileSync(target, archive);
console.log(`${path.relative(root, target)} sha256 ${sha256(archive)}`);
