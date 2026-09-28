const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/evidence/comprehensive');
const hash = crypto.createHash('sha256');
function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (/\.(mjs|js)$/.test(file)) hash.update(fs.readFileSync(file));
  }
}
walk(path.join(root, 'game/src/sim'));
const fingerprint = hash.digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
const catalog = read('catalog.json');
function latest(name, key) {
  const rows = fs.readFileSync(path.join(out, name), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const selected = new Map();
  for (const row of rows) if (row.fingerprint === fingerprint) selected.set(key(row), row);
  return {rows: [...selected.values()], history: rows.length};
}
const matrix = latest('matrix-300.jsonl', r => r.id);
const soakKey = r => [r.options.map, r.options.diff, r.options.seed].join('-');
const soaks = latest('soaks-6000.jsonl', soakKey);
const expectedMatrix = [];
const expectedSoaks = [];
for (const [m, map] of catalog.maps.entries()) {
  for (const diff of catalog.difficulties) {
    for (const mode of Object.keys(catalog.modes)) expectedMatrix.push([map, diff, mode].join('-'));
    expectedSoaks.push([map, diff, 'SOAK' + m + 'A'].join('-'));
  }
  expectedSoaks.push([map, 'impossible', 'SOAK' + m + 'B'].join('-'));
}
function summarize(group, expected, key) {
  const seen = new Set(group.rows.map(key));
  return {
    expected: expected.length,
    completed: group.rows.length,
    passed: group.rows.filter(r => r.ok).length,
    failures: group.rows.filter(r => !r.ok).map(r => ({id:key(r), error:r.error})),
    missing: expected.filter(id => !seen.has(id)),
    totalRecordedTicks: group.rows.reduce((n, r) => n + (r.ticks || 0), 0),
    totalCommands: group.rows.reduce((n, r) => n + (r.commands || 0), 0),
    historicalAttemptsAllRevisions: group.history
  };
}
const report = {
  generated: new Date().toISOString(),
  fingerprint,
  matrix: summarize(matrix, expectedMatrix, r => r.id),
  campaigns: {
    ...summarize(soaks, expectedSoaks, soakKey),
    reached6000Ticks: soaks.rows.filter(r => r.ticks >= 6000).length,
    endedEarlier: soaks.rows.filter(r => r.ended && r.ticks < 6000).length,
    endings: [...new Set(soaks.rows.flatMap(r => (r.endings || []).map(e => e.title)))],
    actorPeaks: Object.fromEntries(['maxStructures','maxShips','maxAir','maxAttacks','maxTrucks'].map(k => [k, Math.max(0, ...soaks.rows.map(r => r.observed?.[k] || 0))]))
  },
  rosterBrowser: read('roster-replay-browser.json'),
  scope: '12 maps x 6 difficulties x 16 named profiles; 84 extended campaigns with explicit actual durations. Not exhaustive seeds, binary-option combinations, hardware, or arbitrary action sequences.'
};
const compareFingerprint = process.argv.find(value => value.startsWith('--compare='))?.slice(10);
if (compareFingerprint) {
  const previous = new Map(fs.readFileSync(path.join(out, 'matrix-300.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(r => r.fingerprint === compareFingerprint && r.ok).map(r => [r.id, r]));
  const comparable = matrix.rows.filter(r => r.ok && previous.has(r.id));
  report.optimizationParity = {
    referenceFingerprint: compareFingerprint,
    compared: comparable.length,
    missingReference: expectedMatrix.filter(id => !previous.has(id)),
    mismatches: comparable.filter(r => r.digest !== previous.get(r.id).digest || r.commands !== previous.get(r.id).commands).map(r => r.id)
  };
}
report.pass = report.matrix.missing.length === 0 && report.matrix.failures.length === 0 &&
  report.campaigns.missing.length === 0 && report.campaigns.failures.length === 0 &&
  report.rosterBrowser.length === 3 && report.rosterBrowser.every(r => r.fingerprint === fingerprint && r.replay === 'PASS' && r.renderPurity === 'PASS' && r.errors.length === 0) &&
  (!report.optimizationParity || report.optimizationParity.compared === expectedMatrix.length && report.optimizationParity.missingReference.length === 0 && report.optimizationParity.mismatches.length === 0);
fs.writeFileSync(path.join(out, 'qualification-summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({pass:report.pass, fingerprint, matrix:report.matrix.passed + '/' + report.matrix.expected, campaigns:report.campaigns.passed + '/' + report.campaigns.expected}));
if (!report.pass) process.exitCode = 1;
