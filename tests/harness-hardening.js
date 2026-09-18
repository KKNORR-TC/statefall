'use strict';

const assert=require('node:assert/strict');
const boot=require('../tools/harness.js');
const {STRUCT,SHIPS,AIR}=require('../game/src/sim/rules.mjs');

const before=new Set(Reflect.ownKeys(globalThis));
const first=boot({seed:'BOUNDARYA',diff:'normal',countryIdx:35,render:false,gridW:120,gridH:69});
const second=boot({seed:'BOUNDARYB',diff:'hard',countryIdx:12,render:false,gridW:120,gridH:69});

assert.equal(first.S.difficulty,'normal');
assert.equal(first.S.STRUCT,STRUCT);
assert.equal(first.S.SHIPS,SHIPS);
assert.equal(first.S.AIR,AIR);
assert.notEqual(first.S.players,second.S.players,'booted engines share actor collections');
assert.notEqual(first.S.owner,second.S.owner,'booted engines share map storage');
assert.notEqual(first.S.REPLAY,second.S.REPLAY,'booted engines share replay state');
const secondHash=second.S.stateHash(),secondTick=second.S.tickN;
first.tick(5);
first.S.REPLAY.on=true;
assert.equal(second.S.tickN,secondTick,'ticking one engine advanced another');
assert.equal(second.S.stateHash(),secondHash,'ticking one engine mutated another');
assert.equal(second.S.REPLAY.on,false,'replay configuration leaked between engines');
assert.deepEqual(Reflect.ownKeys(globalThis).filter(key=>!before.has(key)),[],'harness created process globals');

assert.throws(()=>boot({file:'alternate.js',render:false}),/Custom simulation source files are unsupported/);
assert.throws(()=>boot({render:true}),/browser\/Playwright renderer capture path/);

console.log('Harness direct-import boundary and isolation checks PASS');
