const assert=require('node:assert/strict');
const boot=require('../tools/harness.js');

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

for(const [name,options] of scenarios){
  const game=boot({seed:'SMOKE'+name.replace(/\W/g,'').toUpperCase().slice(0,8),diff:'hard',country:'Norway',render:false,gridW:240,gridH:138,...options});
  const {S}=game;
  assert.ok(S.landCount>1000,`${name}: map has too little land`);
  assert.ok(S.players.length>2,`${name}: players were not created`);
  assert.ok(S.me&&S.me.alive,`${name}: human player was not created`);
  game.tick(300);
  if(options.risky) assert.equal(S.tickN,0,`${name}: draft should wait for the human before advancing the clock`);
  else assert.equal(S.tickN,300,`${name}: simulation stopped before 300 ticks`);
  assert.match(S.stateHash(),/^[0-9a-f]{8}$/,`${name}: invalid state hash`);
  for(const player of S.players){
    assert.ok(Number.isFinite(player.tiles),`${name}: ${player.name} has invalid tiles`);
    assert.ok(Number.isFinite(player.troops),`${name}: ${player.name} has invalid troops`);
    assert.ok(Number.isFinite(player.gold),`${name}: ${player.name} has invalid gold`);
  }
  console.log('PASS',name,S.landCount+' land',S.players.length+' players',S.stateHash());
}
