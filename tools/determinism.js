// Run a match through the command layer, then replay it in a separate process and compare canonical state.
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {firstDifference}=require('../tests/tools/state-oracle.js');

const SEED=process.env.SEED||'DETERMINISM';
const TICKS=+process.env.TICKS||3000;
const DIFF=process.env.DIFF||'hard';
const GAR=!!process.env.GAR;
const isDefaultBaseline=!['SEED','TICKS','DIFF','GAR','QUICK','GAME'].some(name=>process.env[name]);

function ownTiles(S,id){ const a=[]; for(let t=0;t<S.W*S.H;t+=3) if(S.owner[t]===id) a.push(t); return a; }
function borderTiles(S,id){ const out=[]; const W=S.W; for(let t=0;t<S.W*S.H;t+=2){ if(S.owner[t]===id){ const x=t%W,y=(t-x)/W; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ if(S.inb(x+dx,y+dy)){ const n=S.idx(x+dx,y+dy); const o=S.owner[n]; if(S.land[n]&&o!==id&&o>=0){ out.push(n); break; } } } } } return out; }

function play(transferFile,resultFile,stateFile){
  fs.writeFileSync(resultFile,JSON.stringify({phase:'load'}));
  const boot=require('./harness.js');
  const {inspect,assertInvariants}=require('../tests/tools/state-oracle.js');
  const {assertSimulationBaseline}=require('../tests/tools/simulation-baselines.js');
  const A=boot({seed:SEED,diff:DIFF,countryIdx:35,garrison:GAR,quick:!!process.env.QUICK,render:false});
  fs.writeFileSync(resultFile,JSON.stringify({phase:'ticks',tick:0}));
  const S=A.S;
  let rng=1234;
  const rnd=()=>{ rng=(rng*1103515245+12345)&0x7fffffff; return rng/0x7fffffff; };
  for(let k=0;k<TICKS;k++){
    A.tick(1);
    if(k%100===99) fs.writeFileSync(resultFile,JSON.stringify({phase:'ticks',tick:k+1}));
    if(k%40===0&&k>0){ const r=rnd(); if(r<0.5){ const bt=borderTiles(S,S.me.id); if(bt.length) S.issueClick(bt[Math.floor(rnd()*bt.length)],{ratio:50,pick:null,build:null}); }
      else if(r<0.8){ const own=ownTiles(S,S.me.id); if(own.length) S.issueClick(own[Math.floor(rnd()*own.length)],{ratio:50,pick:null,build:['city','factory','port','sam','fort'][Math.floor(rnd()*5)]}); if(rnd()<0.5){ S.setBuild(['city','factory'][Math.floor(rnd()*2)]); S.issueClick(own[Math.floor(rnd()*own.length)]); S.setBuild(null); } }
      else S.issue('focus',Math.round(rnd()*100)/100); }
    if(k===600){ const own=ownTiles(S,S.me.id); if(own.length) S.issueMenu({act:'build',type:'port'},own[0],[],-1,50,0,0); }
    if(k===900||k===1300){ const port=S.structures.find(st=>st.owner===S.me.id&&st.type==='port'&&!st.building); if(port){ const W=S.W; const x=port.t%W,y=(port.t-x)/W; for(let r=1;r<8;r++){ let done=false; for(let dy=-r;dy<=r&&!done;dy++) for(let dx=-r;dx<=r&&!done;dx++){ if(S.inb(x+dx,y+dy)&&!S.land[S.idx(x+dx,y+dy)]){ S.issueMenu({act:'warship',cls:'warship'},S.idx(x+dx,y+dy),[],-1,50,0,0); done=true; } } if(done) break; } } }
    if(k===1800){ const ws=S.warships.filter(w=>w.owner===S.me.id); if(ws.length){ const W=S.W; const t=S.idx(Math.floor(ws[0].x)+15,Math.floor(ws[0].y)); if(!S.land[t]) S.issueMenu({act:'move'},t,ws.map(w=>w.id),-1,50,0,0); } }
    if(k===1500){ const own=ownTiles(S,S.me.id); if(own.length) S.issueMenu({act:'build',type:'silo'},own[0],[],-1,50,0,0); }
  }
  fs.writeFileSync(resultFile,JSON.stringify({phase:'oracle'}));
  assertInvariants(S,'determinism run 1');
  const log=S.CMD.log.slice(),hashes=S.CMD.hashes.slice(),finalHash=S.stateHash(),oracle=inspect(S);
  if(isDefaultBaseline) assertSimulationBaseline('determinism','default-production-grid',{legacyHash:finalHash,sha256:oracle.digest});
  fs.writeFileSync(transferFile,JSON.stringify({log,hashes,tick:S.tickN}));
  fs.writeFileSync(stateFile,oracle.serialization);
  fs.writeFileSync(resultFile,JSON.stringify({finalHash,digest:oracle.digest,tiles:S.me.tiles,tick:S.tickN,commands:log.length,checkpoints:hashes.length}));
}

function replay(transferFile,resultFile,stateFile,firstStateFile){
  fs.writeFileSync(resultFile,JSON.stringify({phase:'load'}));
  const boot=require('./harness.js');
  const {inspect,assertInvariants}=require('../tests/tools/state-oracle.js');
  const {assertSimulationBaseline}=require('../tests/tools/simulation-baselines.js');
  const {log,hashes}=JSON.parse(fs.readFileSync(transferFile,'utf8'));
  const B=boot({seed:SEED,diff:DIFF,countryIdx:35,garrison:GAR,quick:!!process.env.QUICK,render:false});
  const S=B.S;
  S.REPLAY.on=true; S.REPLAY.hashv=2; S.REPLAY.cmds=log; S.REPLAY.i=0; S.REPLAY.hashes=hashes; S.REPLAY.speed=1; S.REPLAY.toTick=TICKS;
  fs.writeFileSync(resultFile,JSON.stringify({phase:'ticks',tick:0}));
  for(let k=0;k<TICKS;k++){ B.tick(1); if(k%100===99) fs.writeFileSync(resultFile,JSON.stringify({phase:'ticks',tick:k+1})); }
  fs.writeFileSync(resultFile,JSON.stringify({phase:'oracle'}));
  assertInvariants(S,'determinism run 2');
  const finalHash=S.stateHash(),oracle=inspect(S);
  if(isDefaultBaseline) assertSimulationBaseline('determinism','default-production-grid',{legacyHash:finalHash,sha256:oracle.digest},firstDifference(fs.readFileSync(firstStateFile,'utf8'),oracle.serialization));
  fs.writeFileSync(stateFile,oracle.serialization);
  fs.writeFileSync(resultFile,JSON.stringify({finalHash,digest:oracle.digest,tiles:S.me.tiles,tick:S.tickN,mismatch:!!S.REPLAY.mismatch,applied:S.REPLAY.i,commands:log.length}));
}

function runWorker(mode,files){
  const result=spawnSync(process.execPath,[__filename,'--worker',mode,...files],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:600000,maxBuffer:10*1024*1024});
  process.stdout.write(result.stdout||'');
  process.stderr.write(result.stderr||'');
  if(result.error) throw result.error;
  const progressFile=files[1];
  const progress=result.status===0||!fs.existsSync(progressFile)?'':`; last progress ${fs.readFileSync(progressFile,'utf8')}`;
  assert.equal(result.status,0,`determinism ${mode} child exited with ${result.signal||result.status}${progress}`);
}

function main(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'statefall-determinism-'));
  const transfer=path.join(dir,'commands.json'),resultAFile=path.join(dir,'run-1.json'),resultBFile=path.join(dir,'run-2.json'),stateA=path.join(dir,'state-1.json'),stateB=path.join(dir,'state-2.json');
  try{
    runWorker('play',[transfer,resultAFile,stateA]);
    const A=JSON.parse(fs.readFileSync(resultAFile,'utf8'));
    console.log('run 1: commands',A.commands,'checkpoints',A.checkpoints,'final',A.finalHash,A.digest.slice(0,12),'tiles',A.tiles);
    runWorker('replay',[transfer,resultBFile,stateB,stateA]);
    const B=JSON.parse(fs.readFileSync(resultBFile,'utf8'));
    console.log('run 2: final',B.finalHash,B.digest.slice(0,12),'tiles',B.tiles,'diverged flag',B.mismatch,'applied',B.applied,'/',B.commands);
    const ok=A.finalHash===B.finalHash&&A.digest===B.digest&&!B.mismatch&&B.applied===B.commands&&B.tick===A.tick;
    if(A.digest!==B.digest) console.log('oracle difference:',firstDifference(fs.readFileSync(stateA,'utf8'),fs.readFileSync(stateB,'utf8')));
    console.log(ok?'DETERMINISTIC ✓':'MISMATCH ✗');
    if(!ok) process.exitCode=1;
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

if(process.argv[2]==='--worker'){
  const mode=process.argv[3];
  if(mode==='play') play(...process.argv.slice(4));
  else if(mode==='replay') replay(...process.argv.slice(4));
  else throw new Error(`unknown determinism worker: ${mode}`);
  process.exit(0);
}else main();
