// Run a match with random player orders issued through the command layer; save the log; replay it; compare hashes.
const boot=require('./harness.js');
function ownTiles(S,id){ const a=[]; for(let t=0;t<S.W*S.H;t+=3) if(S.owner[t]===id) a.push(t); return a; }
function borderTiles(S,id){ const out=[]; const W=S.W; for(let t=0;t<S.W*S.H;t+=2){ if(S.owner[t]===id){ const x=t%W,y=(t-x)/W; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ if(S.inb(x+dx,y+dy)){ const n=S.idx(x+dx,y+dy); const o=S.owner[n]; if(S.land[n]&&o!==id&&o>=0){ out.push(n); break; } } } } } return out; }
const SEED=process.env.SEED||'DETERMINISM'; const TICKS=+process.env.TICKS||3000; const DIFF=process.env.DIFF||'hard'; const GAR=!!process.env.GAR;
// ---- run 1: play with random orders
global.__now=48213; let A=boot({seed:SEED,diff:DIFF,country:'Norway',garrison:GAR,quick:!!process.env.QUICK,render:false}); let S=A.S; let rng=1234; const rnd=()=>{ rng=(rng*1103515245+12345)&0x7fffffff; return rng/0x7fffffff; };
for(let k=0;k<TICKS;k++){ A.tick(1);
  if(k%40===0&&k>0){ const r=rnd(); if(r<0.5){ const bt=borderTiles(S,S.me.id); if(bt.length) S.issueClick(bt[Math.floor(rnd()*bt.length)],{ratio:50,pick:null,build:null}); }
    else if(r<0.8){ const own=ownTiles(S,S.me.id); if(own.length) S.issueClick(own[Math.floor(rnd()*own.length)],{ratio:50,pick:null,build:['city','factory','port','sam','fort'][Math.floor(rnd()*5)]}); if(rnd()<0.5){ S.setBuild(['city','factory'][Math.floor(rnd()*2)]); S.issueClick(own[Math.floor(rnd()*own.length)]); S.setBuild(null); } }
    else { S.issue('focus',Math.round(rnd()*100)/100); } }
  if(k===600){ const own=ownTiles(S,S.me.id); if(own.length) S.issueMenu({act:'build',type:'port'},own[0],[],-1,50,0,0); }
  if(k===900||k===1300){ const port=S.structures.find(st=>st.owner===S.me.id&&st.type==='port'&&!st.building); if(port){ const W=S.W; const x=port.t%W,y=(port.t-x)/W; for(let r=1;r<8;r++){ let done=false; for(let dy=-r;dy<=r&&!done;dy++) for(let dx=-r;dx<=r&&!done;dx++){ if(S.inb(x+dx,y+dy)&&!S.land[S.idx(x+dx,y+dy)]){ S.issueMenu({act:'warship',cls:'warship'},S.idx(x+dx,y+dy),[],-1,50,0,0); done=true; } } if(done) break; } } }
  if(k===1800){ const ws=S.warships.filter(w=>w.owner===S.me.id); if(ws.length){ const W=S.W; const t=S.idx(Math.floor(ws[0].x)+15,Math.floor(ws[0].y)); if(!S.land[t]) S.issueMenu({act:'move'},t,ws.map(w=>w.id),-1,50,0,0); } }
  if(k===1500){ const own=ownTiles(S,S.me.id); if(own.length) S.issueMenu({act:'build',type:'silo'},own[0],[],-1,50,0,0); }
}
const log=S.CMD.log.slice(), hashes=S.CMD.hashes.slice(); const finalA=S.stateHash();
console.log('run 1: commands',log.length,'checkpoints',hashes.length,'final',finalA,'tiles',S.me.tiles);
// ---- run 2: cold replay in a fresh engine
global.__now=3021; const B=boot({seed:SEED,diff:DIFF,country:'Norway',garrison:GAR,quick:!!process.env.QUICK,render:false}); const T=B.S; T.REPLAY.on=true; T.REPLAY.hashv=2; T.REPLAY.cmds=log; T.REPLAY.i=0; T.REPLAY.hashes=hashes; T.REPLAY.speed=1;
for(let k=0;k<TICKS;k++) B.tick(1);
const finalB=T.stateHash();
console.log('run 2: final',finalB,'tiles',T.me.tiles,'diverged flag',!!T.REPLAY.mismatch,'applied',T.REPLAY.i,'/',log.length);
const ok=finalA===finalB&&!T.REPLAY.mismatch&&T.REPLAY.i===log.length&&T.tickN===S.tickN;
console.log(ok?'DETERMINISTIC ✓':'MISMATCH ✗');
if(!ok) process.exitCode=1;
