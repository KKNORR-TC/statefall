const assert=require('node:assert/strict');
const boot=require('../tools/harness.js');

function run(name,options={}){
  const ticks=600;
  const game=boot({seed:'RESTART'+name.toUpperCase(),diff:'hard',country:'Norway',render:false,gridW:240,gridH:138,...options});
  const {S}=game;
  let rng=7;
  const rnd=()=>{ rng=(rng*1103515245+12345)&0x7fffffff; return rng/0x7fffffff; };
  const ownTiles=()=>{ const out=[]; for(let t=0;t<S.W*S.H;t+=3) if(S.owner[t]===S.me.id) out.push(t); return out; };
  const borderTiles=()=>{ const out=[]; for(let t=0;t<S.W*S.H;t+=2){ if(S.owner[t]!==S.me.id) continue; const x=t%S.W,y=(t-x)/S.W; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ if(!S.inb(x+dx,y+dy)) continue; const n=S.idx(x+dx,y+dy),owner=S.owner[n]; if(S.land[n]&&owner!==S.me.id&&owner>=0){ out.push(n); break; } } } return out; };

  for(let tick=0;tick<ticks;tick++){
    game.tick();
    if(tick%40!==0||tick===0) continue;
    if(rnd()<0.6){ const targets=borderTiles(); if(targets.length) S.issueClick(targets[Math.floor(rnd()*targets.length)],{ratio:50,pick:null,build:null}); }
    else { const tiles=ownTiles(); if(tiles.length) S.issueMenu({act:'build',type:'city'},tiles[Math.floor(rnd()*tiles.length)],[],-1,50,0,0); }
  }

  const commands=S.CMD.log.slice(),hashes=S.CMD.hashes.slice(),hash=S.stateHash(),tiles=S.me.tiles;
  assert.ok(commands.length>0,name+': first run recorded no commands');
  S.REPLAY.on=true; S.REPLAY.creditsMode=true; S.REPLAY.cmds=commands; S.REPLAY.i=0; S.REPLAY.hashes=hashes; S.REPLAY.hashv=2; S.REPLAY.mismatch=false; S.REPLAY.speed=1;
  S.resetWorld(); S.restart();
  for(let tick=0;tick<ticks;tick++) game.tick();
  assert.equal(S.REPLAY.i,commands.length,name+': replay did not apply every command');
  assert.equal(S.REPLAY.mismatch,false,name+': restart replay diverged: '+(S.REPLAY.why||'checkpoint mismatch'));
  assert.equal(S.me.tiles,tiles,name+': restart replay produced a different tile count');
  assert.equal(S.stateHash(),hash,name+': restart replay produced a different final state');
  console.log('RESTART REPLAY MATCH',name,hash,tiles+' tiles',commands.length+' commands');
}

const scenarios={standard:{},fog:{fog:true},garrisons:{garrison:true}};
const selected=process.argv[2]||'standard';
assert.ok(scenarios[selected],'unknown restart/replay scenario: '+selected);
run(selected,scenarios[selected]);
