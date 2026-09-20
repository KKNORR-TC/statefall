'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createCandidateSourceEvidence,verifyCandidateSourceEvidence}=require('../tools/source-evidence-manifest');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'statefall-f1-source-'));
try{
  fs.mkdirSync(path.join(root,'game','src','config'),{recursive:true});
  fs.mkdirSync(path.join(root,'game','src','rendering'),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),'{"version":"1.2.3"}\n');
  fs.writeFileSync(path.join(root,'game','src','config','build.js'),"export const GAME_BUILD='fixture-build';\n");
  execFileSync('git',['init','-q'],{cwd:root}); execFileSync('git',['add','package.json','game/src/config/build.js'],{cwd:root}); execFileSync('git',['-c','user.name=Statefall Test','-c','user.email=test@example.invalid','commit','-qm','fixture'],{cwd:root});
  const terrain=path.join(root,'game','src','rendering','terrain-raster-model.mjs'); fs.writeFileSync(terrain,'export const terrain = 1;\n');
  for(const file of ['terrain-raster-client.mjs','terrain-raster-worker.mjs']) fs.writeFileSync(path.join(root,'game','src','rendering',file),'export const terrain = 1;\n');
  const recorded=createCandidateSourceEvidence(root); for(const file of ['terrain-raster-model.mjs','terrain-raster-client.mjs','terrain-raster-worker.mjs']) assert(recorded.files.some(value=>value.path===`game/src/rendering/${file}`),`untracked ${file} must be included`); verifyCandidateSourceEvidence(root,recorded);
  fs.writeFileSync(terrain,'export const terrain = 2;\n');
  assert.throws(()=>verifyCandidateSourceEvidence(root,recorded),/Candidate source mismatch|path\/hash list differs/,'changing untracked terrain source must fail verification');
  console.log('Phase F2 complete candidate source evidence PASS');
}finally{ fs.rmSync(root,{recursive:true,force:true}); }
