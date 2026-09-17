const assert=require('node:assert/strict');
const metadata=require('../../tools/release-metadata.js');
const baselines=require('../fixtures/simulation-baselines-v1.10.8.json');

const fixture='tests/fixtures/simulation-baselines-v1.10.8.json';

assert.equal(baselines.schema,'statefall-simulation-baselines/v1',`${fixture}: unsupported schema`);
assert.equal(baselines.gameVersion,metadata.simulationBaselineVersion,`${fixture}: game version does not match the explicit simulation baseline contract`);

function fail(label,expected,actual,detail=''){
  assert.fail(`${label}: approved v${baselines.gameVersion} simulation baseline changed\nexpected ${JSON.stringify(expected)}\nactual   ${JSON.stringify(actual)}${detail?'\n'+detail:''}\nIf this change is intentional, review it and explicitly edit ${fixture}; never regenerate it silently.`);
}

function assertSimulationBaseline(group,name,actual,detail=''){
  const expected=baselines[group]?.scenarios?.[name]||baselines[group]?.[name];
  assert.ok(expected,`${fixture}: missing ${group}.${name}`);
  const pinned={legacyHash:expected.legacyHash,sha256:expected.sha256};
  if(actual.legacyHash!==pinned.legacyHash||actual.sha256!==pinned.sha256) fail(`${group}.${name}`,pinned,actual,detail);
}

function assertCanonicalBaseline(group,name,actual,detail=''){
  const expected=baselines[group]?.[name];
  assert.ok(expected,`${fixture}: missing ${group}.${name}`);
  if(actual!==expected.sha256) fail(`${group}.${name}`,{sha256:expected.sha256},{sha256:actual},detail);
}

module.exports={baselines,assertSimulationBaseline,assertCanonicalBaseline};
