'use strict';

const fs = require('fs');
const path = require('path');
const {sha256, zip} = require('./package-zip');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'plugin', 'statefall-scores');
const output = path.join(root, '.artifacts');
function walk(dir, prefix = 'statefall-scores') {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const relative = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative) : [{path: relative, data: fs.readFileSync(path.join(dir, entry.name))}];
  });
}
const main = fs.readFileSync(path.join(source, 'statefall-scores.php'), 'utf8');
const match = main.match(/Version:\s*([^\s]+)/);
if (!match) throw new Error('Plugin version not found.');
const archive = zip(walk(source).sort((a, b) => a.path.localeCompare(b.path)));
fs.mkdirSync(output, {recursive: true});
const target = path.join(output, `statefall-scores-${match[1]}.zip`);
fs.writeFileSync(target, archive);
fs.writeFileSync(path.join(output,'plugin-candidate.json'),JSON.stringify({version:match[1],filename:path.basename(target),sha256:sha256(archive)},null,2)+'\n');
console.log(`${path.relative(root, target)} sha256 ${sha256(archive)}`);
