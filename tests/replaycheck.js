'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {validateReplay,verifyReplay}=require('../tools/replaycheck.js');

const root=path.resolve(__dirname,'..');
const fixturePath=path.join(__dirname,'fixtures','replays','public-v1.10.7-focus.json');
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'statefall-replaycheck-'));

function run(args){
  return spawnSync(process.execPath,['tools/replaycheck.js',...args],{cwd:root,encoding:'utf8',timeout:120000});
}

function runMutation(name,mutate){
  const replay=structuredClone(fixture);
  mutate(replay);
  const file=path.join(temp,name+'.json');
  fs.writeFileSync(file,JSON.stringify(replay));
  return run([file]);
}

function failed(result,pattern,code=1){
  assert.equal(result.status,code,result.stdout+result.stderr);
  assert.match(result.stdout+result.stderr,pattern);
}

function verifyMutation(mutate,pattern){
  const replay=structuredClone(fixture);
  mutate(replay);
  assert.deepEqual(validateReplay(replay),[]);
  const result=verifyReplay(replay,{logger:{log(){}},bootOptions:{gridW:120,gridH:69}});
  assert.equal(result.ok,false);
  assert.match(result.errors.join('\n'),pattern);
}

try{
  const help=run(['--help']);
  assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/Usage: node tools\/replaycheck\.js/);
  failed(run([]),/missing replay file/,2);

  assert.deepEqual(validateReplay(fixture),[]);
  const missingCheckpoint=structuredClone(fixture);
  missingCheckpoint.hashes.pop();
  assert.match(validateReplay(missingCheckpoint).join('\n'),/missing checkpoint 200/);

  const positive=run([fixturePath]);
  assert.equal(positive.status,0,positive.stdout+positive.stderr);
  assert.match(positive.stdout,/REPLAY MATCH PUBLICREPLAY1 200 ticks 1 commands 2 checkpoints final 2697f587/);

  failed(runMutation('divergence',replay=>{
    replay.tick=100;
    replay.hashes=replay.hashes.slice(0,1);
    replay.hashes[0][1]='00000000';
    delete replay.finalHash;
    delete replay.finalDigest;
  }),/checkpoint 100 diverged/);

  failed(runMutation('missing-checkpoint',replay=>{
    replay.hashes.pop();
  }),/missing checkpoint 200/,2);

  verifyMutation(replay=>{
    replay.tick=1;
    replay.hashes=[];
    replay.cmds=[{t:2,k:'focus',a:[0.2]}];
    delete replay.finalHash;
    delete replay.finalDigest;
  },/unapplied commands: applied 0 of 1/);

  verifyMutation(replay=>{
    replay.tick=25;
    replay.hashes=[];
    replay.cmds=[{t:1,k:'accept',a:[999999,'ally',0]}];
    delete replay.finalHash;
    delete replay.finalDigest;
  },/replay command failed at tick 1/);

  const finalTick=structuredClone(fixture);
  finalTick.tick=25;
  finalTick.hashes=[];
  finalTick.cmds=[{t:25,k:'focus',a:[0.75]}];
  delete finalTick.finalHash;
  delete finalTick.finalDigest;
  const finalResult=verifyReplay(finalTick,{logger:{log(){}},bootOptions:{gridW:120,gridH:69}});
  assert.equal(finalResult.ok,true,finalResult.errors.join('\n'));
  assert.equal(finalResult.commandsApplied,1,'command stamped at target tick was not resolved');

  const invalidArgs=structuredClone(fixture);
  invalidArgs.cmds=[{t:1,k:'focus',a:[2]}];
  assert.match(validateReplay(invalidArgs).join('\n'),/invalid arguments for focus/);
  const tooLong=structuredClone(fixture);
  tooLong.tick=10_000_001;
  assert.match(validateReplay(tooLong).join('\n'),/no greater than 10000000/);
  const tooMany=structuredClone(fixture);
  tooMany.cmds=new Array(100_001).fill(null);
  assert.match(validateReplay(tooMany).join('\n'),/at most 100000 commands/);

  verifyMutation(replay=>{
    replay.tick=1;
    replay.hashes=[];
    replay.cmds=[];
    replay.settings.risky=true;
    delete replay.finalHash;
    delete replay.finalDigest;
  },/failed to reach target tick 1/);

  verifyMutation(replay=>{
    replay.finalHash='00000000';
    replay.finalDigest.sha256='0'.repeat(64);
  },/final state mismatch: recorded 00000000, replay [0-9a-f]{8}[\s\S]*final canonical digest mismatch/);

  console.log('Replay checker strict positive and negative checks PASS');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
