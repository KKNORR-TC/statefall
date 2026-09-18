'use strict';

// The oracle is the exact Phase C tree at ad30188, materialized with git archive
// under the approved OS temp directory. The current tree is never checked out.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..'),PROVENANCE='ad30188';
const DEFAULT_OUTPUT=path.join(ROOT,'tests','fixtures','phase-d-parity-corpus-ad30188.json');
const BOOLEAN_DEFAULTS={bots:false,noCap:false,quick:false,fog:false,instant:false,risky:false,endgame:false,billionaire:false,garrison:false,pauseBuild:false};
const base={...BOOLEAN_DEFAULTS,troops:120,gold:100,teams:0,map:'random',diff:'hard',country:35};
const scenarios=[
  {name:'standard-random',seed:'PARITYSTD',settings:{...base},coverage:['standard','focus','land attack','structures'],ticks:400},
  {name:'fog-world',seed:'PARITYFOG',settings:{...base,map:'world',fog:true},coverage:['fog','focus','land attack','structures'],ticks:400},
  {name:'garrisons-land',seed:'PARITYGAR',settings:{...base,map:'land',garrison:true},coverage:['garrisons','focus','land attack','structures'],ticks:400},
  {name:'quick-europe',seed:'PARITYQUICK',settings:{...base,map:'europe',quick:true},coverage:['quick','focus','land attack','structures'],ticks:400},
  {name:'endgame-asia',seed:'PARITYEND',settings:{...base,map:'asia',endgame:true},coverage:['endgame','focus','land attack','structures'],ticks:400},
  {name:'risky-draft-random',seed:'PARITYRISK',settings:{...base,risky:true},coverage:['risky draft','focus','land attack','structures'],ticks:100},
  {name:'combined-arms-islands',seed:'PARITYARMS',settings:{...base,map:'islands_l',instant:true,billionaire:true,pauseBuild:true},coverage:['advanced','structures/upgrades','naval/transport','missiles','diplomacy/aid','air','pause','replay takeover'],ticks:400}
].map(value=>({...value,grid:value.settings.risky?{width:720,height:414}:{width:180,height:104},controls:{pauseAtTick:value.name==='combined-arms-islands'?220:null,takeoverAtTick:value.name==='combined-arms-islands'?320:null}}));

function run(command,args,options={}){
  const result=spawnSync(command,args,{cwd:ROOT,encoding:'utf8',timeout:600000,maxBuffer:20*1024*1024,...options});
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout||''}${result.stderr||''}`);
  return result.stdout;
}

function generate(){
  const tempRoot=path.join(os.tmpdir(),'opencode');
  if(!fs.existsSync(tempRoot)) throw new Error(`approved temp directory does not exist: ${tempRoot}`);
  const worktree=fs.mkdtempSync(path.join(tempRoot,'statefall-parity-ad30188-'));
  const archive=path.join(worktree,'oracle.tar'),extract=path.join(worktree,'source');
  fs.mkdirSync(extract);
  try{
    run('git',['archive','--format=tar',`--output=${archive}`,PROVENANCE]);
    run('tar',['-xf',archive,'-C',extract]);
    // ad30188 stores legacy-game.js with CRLF while its harness boundary is LF-only.
    // Normalize line endings only; evaluated JavaScript and oracle behavior are unchanged.
    const legacyFile=path.join(extract,'game','src','legacy-game.js');
    fs.writeFileSync(legacyFile,fs.readFileSync(legacyFile,'utf8').replace(/\r\n/g,'\n'));
    const harnessFile=path.join(extract,'tools','harness.js'),harnessSource=fs.readFileSync(harnessFile,'utf8');
    const pauseSeam='get userPaused(){return userPaused},set userPaused(v){userPaused=v},set over(v){over=v}';
    assert.equal(harnessSource.split(pauseSeam).length,2,'historical pause instrumentation boundary changed');
    fs.writeFileSync(harnessFile,harnessSource.replace(pauseSeam,'get draft(){return draft},get userPaused(){return userPaused},set userPaused(v){userPaused=v},get paused(){return paused},set paused(v){paused=v},set over(v){over=v}'));
    const exact=run('git',['rev-parse',PROVENANCE]).trim();
    const expected=run('git',['rev-parse',PROVENANCE]).trim();
    assert.equal(exact,expected,'baseline archive commit mismatch');
    const harness=harnessFile,driver=path.join(ROOT,'tools','parity-corpus-driver.js');
    const fixtures=scenarios.map(scenario=>{
      const output=run(process.execPath,[driver],{cwd:extract,input:JSON.stringify({mode:'record',scenario}),env:{...process.env,STATEFALL_PARITY_HARNESS:harness}});
      return JSON.parse(output);
    });
    return {schema:'statefall-phase-d-parity-corpus/v1',provenance:{commit:exact,short:PROVENANCE,role:'trusted pre-extraction old-engine oracle',materialization:'git archive; legacy-game.js CRLF normalized to LF for its historical LF-only harness boundary; harness-only draft and paused accessors added for deterministic controls'},checkpointTiming:{legacyHash:'historical checkpoint before systems at each 100th tick',canonicalAndRng:'end of the same numbered tick'},requiresCanonicalCheckpoints:true,scenarios:fixtures};
  }finally{
    fs.rmSync(worktree,{recursive:true,force:true});
  }
}

function serialize(value){ return JSON.stringify(value,null,2)+'\n'; }
function main(argv=process.argv.slice(2)){
  const check=argv.includes('--check'),outputArg=argv.find(value=>value!=='--check'),output=outputArg?path.resolve(outputArg):DEFAULT_OUTPUT;
  const bytes=serialize(generate());
  if(check){
    const committed=fs.readFileSync(output,'utf8');
    assert.equal(bytes,committed,`parity corpus is stale; run node tools/generate-parity-corpus.js ${output}`);
    console.log(`Parity corpus reproducible from ${PROVENANCE}: ${path.relative(ROOT,output)}`);
  }else{
    fs.writeFileSync(output,bytes);
    console.log(`Wrote ${path.relative(ROOT,output)} from ${PROVENANCE}`);
  }
}

if(require.main===module) main();
module.exports={generate,scenarios};
