const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const scenarios=[
  ['continents',{map:'random'}],
  ['world',{map:'world'}],
  ['europe',{map:'europe'}],
  ['atoll',{map:'atoll'}],
  ['medium islands',{map:'islands_m'}],
  ['quick start',{quick:true}],
  ['fog',{fog:true}],
  ['end game',{endgame:true}],
  ['garrisons',{garrison:true}],
  ['risky start',{risky:true}],
];

function runScenario(index){
  const boot=require('../tools/harness.js');
  const {inspect,assertInvariants}=require('./tools/state-oracle.js');
  const {assertSimulationBaseline}=require('./tools/simulation-baselines.js');
  const [name,options]=scenarios[index];
  const game=boot({seed:'SMOKE'+name.replace(/\W/g,'').toUpperCase().slice(0,8),diff:'hard',countryIdx:35,render:false,gridW:240,gridH:138,...options});
  const {S}=game;
  assert.ok(S.landCount>1000,`${name}: map has too little land`);
  assert.ok(S.players.length>2,`${name}: players were not created`);
  assert.ok(S.me&&S.me.alive,`${name}: human player was not created`);
  game.tick(300);
  if(options.risky) assert.equal(S.tickN,0,`${name}: draft should wait for the human before advancing the clock`);
  else assert.equal(S.tickN,300,`${name}: simulation stopped before 300 ticks`);
  assert.match(S.stateHash(),/^[0-9a-f]{8}$/,`${name}: invalid state hash`);
  assertInvariants(S,name);
  const oracle=inspect(S);
  assert.match(oracle.digest,/^[0-9a-f]{64}$/,`${name}: invalid authoritative digest`);
  assertSimulationBaseline('smoke',name,{legacyHash:S.stateHash(),sha256:oracle.digest});
  for(const player of S.players){
    assert.ok(Number.isFinite(player.tiles),`${name}: ${player.name} has invalid tiles`);
    assert.ok(Number.isFinite(player.troops),`${name}: ${player.name} has invalid troops`);
    assert.ok(Number.isFinite(player.gold),`${name}: ${player.name} has invalid gold`);
  }
  console.log('PASS',name,S.landCount+' land',S.players.length+' players',S.stateHash(),oracle.digest.slice(0,12));
}

if(process.argv[2]==='--scenario'){
  const index=Number(process.argv[3]);
  assert.ok(Number.isInteger(index)&&scenarios[index],`unknown smoke scenario index: ${process.argv[3]}`);
  runScenario(index);
}else{
  const root=path.resolve(__dirname,'..');
  for(let index=0;index<scenarios.length;index++){
    const result=spawnSync(process.execPath,[__filename,'--scenario',String(index)],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:10*1024*1024});
    process.stdout.write(result.stdout||'');
    process.stderr.write(result.stderr||'');
    if(result.error) throw result.error;
    assert.equal(result.status,0,`${scenarios[index][0]}: smoke child exited with ${result.signal||result.status}`);
  }
}
