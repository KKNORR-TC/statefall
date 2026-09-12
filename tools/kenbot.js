// Benchmark: a scripted player that mimics Ken's opening (city spam, constant border attacks, shore guns from 1:30, transports)
const boot=require('./harness.js'); const fs=require('fs');
const FILE=process.env.GAME||'/mnt/user-data/outputs/statefall/index.html';
function run(diff,seed,maxTicks){
  const G=boot({seed,diff,countryIdx:52,troops:120,gold:100,file:FILE}); const S=G.S; const W=S.W; const me=S.me;
  const own=()=>S.ownTilesOf(me.id); const interior=()=>{ const o=own(); const inn=o.filter(t=>{ const x=t%W,y=(t-x)/W; return !S.isCoast(t)&&!S.structures.some(st=>st.t===t); }); return inn.length?inn:o; };
  const border=()=>{ const out=[]; const o=own(); const seen=new Set(); for(const t of o){ const x=t%W,y=(t-x)/W; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ if(S.inb(x+dx,y+dy)){ const n=S.idx(x+dx,y+dy); const q=S.owner[n]; if(S.land[n]&&q!==me.id&&q>=0&&!seen.has(q)&&S.players[q].alive){ seen.add(q); out.push({o:q,t:n}); } } } } return out; };
  const pickR=a=>a[Math.floor(Math.random()*a.length)];
  let lastAttack=-100,lastCity=-100,lastGun=-100,lastTr=-100,gunsBuilt=0; let win=null;
  for(let k=1;k<=maxTicks;k++){ G.tick(1); if(!me.alive) return {result:'dead',tick:k,land:0};
    const land=me.tiles/S.players.reduce((a,p)=>a+ (p.alive?p.tiles:0),0);
    if(me.tiles/ S.landCount>=0.72){ win=k; break; }
    if(process.env.PROBE&&k%600===0){ const bb=S.players.filter(p=>p.kind==='bot'&&p.alive).sort((a,b)=>b.troops-a.troops)[0]; const cities=S.structures.filter(st=>st.owner===me.id&&st.type==='city').length; const bc=bb?S.structures.filter(st=>st.owner===bb.id&&st.type==='city').length:0; const att=S.attacks.filter(a=>a.target===me.id).map(a=>S.players[a.owner].name+':'+Math.round(a.troops)).join(' '); console.log('  ',Math.floor(k/600)+':00','me',Math.round(me.troops)+'t/'+Math.round(me.gold)+'g/'+me.tiles+'tiles/'+cities+'c','| top bot',bb?bb.name+' '+Math.round(bb.troops)+'t/'+Math.round(bb.gold)+'g/'+bb.tiles+'tiles/'+bc+'c':'-','| attacks on me',att||'-'); }
    if(k-lastCity>=20&&me.gold>=120){ const inn=interior(); if(inn.length&&S.issueMenu({act:'build',type:'city'},pickR(inn),[],-1,50,0,0)!==false) lastCity=k; }
    if(k-lastAttack>=40){ const b=border(); if(b.length){ const weakest=b.map(x=>({...x,d:S.players[x.o].troops/Math.max(1,S.players[x.o].tiles)})).sort((a,b)=>a.d-b.d)[0]; S.issueClick(weakest.t,{ratio:50,pick:null,build:null}); lastAttack=k; } else if(k-lastTr>=120&&me.troops>2000){ const vict=S.players.filter(q=>q.alive&&q!==me&&q.tiles>100).sort((a,b)=>a.troops/a.tiles-b.troops/b.tiles)[0]; if(vict){ const c=S.coastTilesOf(vict.id); if(c.length){ S.issueMenu({act:'transport'},pickR(c),[],-1,50,0,0); lastTr=k; } } } }
    if(k>=900&&k-lastGun>=30&&me.gold>=150&&gunsBuilt<Math.floor(S.coastTilesOf(me.id).length/120)+2){ const c=S.coastTilesOf(me.id).filter(t=>!S.structures.some(st=>st.t===t)); if(c.length&&S.issueMenu({act:'build',type:'shore'},pickR(c),[],-1,50,0,0)!==false){ lastGun=k; gunsBuilt++; } }
  }
  const best=S.players.filter(p=>p.kind==='bot'&&p.alive).sort((a,b)=>b.tiles-a.tiles)[0];
  return {result:win?'won':'timeout',tick:win||maxTicks,land:Math.round(me.tiles/S.landCount*1000)/10,troops:Math.round(me.troops),bestBot:best?best.name+' '+Math.round(best.tiles/S.landCount*1000)/10+'% '+Math.round(best.troops)+'t/'+Math.round(best.gold)+'g':'-'};
}
const diff=process.argv[2]||'superhard'; const seeds=(process.argv[3]||'A1,B2,C3').split(',');
for(const sd of seeds){ const r=run(diff,sd,+process.env.MAX||7200); console.log(diff,sd,r.result,'at',Math.floor(r.tick/600)+':'+String(Math.floor(r.tick/10)%60).padStart(2,'0'),'land',r.land+'%','troops',r.troops,'best bot',r.bestBot); }
