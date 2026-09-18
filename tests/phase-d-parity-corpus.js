'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const boot=require('../tools/harness.js');
const {validateReplay}=require('../tools/replaycheck.js');
const {replayScenario}=require('../tools/parity-corpus-driver.js');

const file=path.join(__dirname,'fixtures','phase-d-parity-corpus-ad30188.json');
const corpus=JSON.parse(fs.readFileSync(file,'utf8'));
assert.equal(corpus.schema,'statefall-phase-d-parity-corpus/v1');
assert.equal(corpus.provenance.short,'ad30188');
assert.equal(corpus.requiresCanonicalCheckpoints,true);

for(const fixture of corpus.scenarios){
  const validation=validateReplay(fixture,{requireCanonicalCheckpoints:true});
  assert.deepEqual(validation,[],`${fixture.name} schema errors:\n${validation.join('\n')}`);
  const result=replayScenario(fixture,boot);
  assert.deepEqual(result.errors,[],result.errors.join('\n'));
  console.log(`PARITY ${fixture.name} ${fixture.tick} ticks ${fixture.cmds.length} commands ${fixture.final.legacyHash} ${fixture.final.canonical.sha256.slice(0,12)}`);
}

console.log(`Phase D old-versus-extracted parity corpus PASS (${corpus.scenarios.length} scenarios, oracle ${corpus.provenance.short})`);
