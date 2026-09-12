// Statefall trailer: headless engine, scripted player, keyframed camera, captions.
const fs=require('fs'); const { createCanvas, Image } = require('canvas');
const html=fs.readFileSync('/mnt/user-data/outputs/statefall/index.html','utf8'); const src=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
global.Image=Image; const W0=1280,H0=720; const main=createCanvas(W0,H0);
const stub=()=>new Proxy(function(){}, {get:(t,k)=>k==='length'?0:k==='checked'?false:k==='value'?'50':k==='style'?stub():k==='classList'?stub():(k===Symbol.toPrimitive?()=>800:stub()), set:()=>true, apply:()=>stub()});
const els={}; global.document={querySelector:()=>stub(),getElementById:(id)=>{ if(id==='map') return main; return els[id]||(els[id]=stub()); },createElement:(tag)=>tag==='canvas'?createCanvas(64,64):stub(),querySelectorAll:()=>[],body:stub(),addEventListener(){}};
global.window={addEventListener(){},innerWidth:W0,innerHeight:H0,STATEFALL_WP:null,devicePixelRatio:1,location:{search:''}};
let __now=0; global.performance={now:()=>__now}; global.localStorage={getItem:()=>null,setItem(){},removeItem(){}}; global.sessionStorage=global.localStorage;
global.requestAnimationFrame=()=>{}; global.setInterval=()=>1; global.clearInterval=()=>{}; global.setTimeout=(f)=>{}; global.location={search:''}; global.crypto={subtle:{}}; global.navigator={clipboard:null};
global.tip=stub(); global.ovTitle=stub(); global.ovText=stub(); global.overlay=stub(); global.ratio={value:50};
main.getBoundingClientRect=()=>({left:0,top:0,width:W0,height:H0}); main.addEventListener=()=>{}; main.style={};
const SEED=process.argv[2]||'TRAILER'; const COUNTRY=process.argv[3]||'Norway';
let code=src.replace("$('startBtn').onclick=()=>{","global.__start=()=>{").replace("let chosen='normal'","let chosen='hard'").replace("START.seed=($('seedIn').value.trim().replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,16))||newSeed();","START.seed='"+SEED+"';");
code=code.replace("function end(title,text){","function end(title,text){ if(!global.__allowEnd) return;");
code=code.replace("  { const total=(ROLL.tEnd||ROLL.dur)+6;","  if(!global.__trailer){ const total=(ROLL.tEnd||ROLL.dur)+6;");
code=code.replace("  else { const bw=110,bh=34,bx=Wd-bw-16,by=Hd-bh-12; ROLL.skipBox=[bx,by,bw,bh];","  else if(!global.__trailer){ const bw=110,bh=34,bx=Wd-bw-16,by=Hd-bh-12; ROLL.skipBox=[bx,by,bw,bh];");
{ const k=code.indexOf("ctx.fillText(ROLL.paused?'Paused · ← → seek · wheel to scroll'"); if(k>0){ const ls=code.lastIndexOf("\n",k); const le=code.indexOf("\n",k); code=code.slice(0,ls+1)+"  if(!global.__trailer){"+code.slice(ls+1,le)+" }"+code.slice(le); } }
code+=`\nglobal.S={get me(){return me},get players(){return players},get cam(){return cam},render:()=>render(),tick:()=>tick(),get W(){return W},get H(){return H},get tickN(){return tickN},get owner(){return owner},get land(){return land},get structures(){return structures},get warships(){return warships},get transports(){return transports},get missiles(){return missiles},get attacks(){return attacks},
  ownTilesOf,coastTilesOf,centroid,launchAttack,placeStructure,orderWarship,launchMissile,isCoast,idx,inb,get START(){return START},set startCountry(n){ const i=COUNTRIES.findIndex(c=>c.name===n); if(i>=0){ chosenFlag=countryByIdx(i); els['countrySel'].value=String(i); } },
  statsSnapshot,beginCredits,get ROLL(){return ROLL},drawCredits:()=>drawCredits(),get userPaused(){return userPaused},set userPaused(v){userPaused=v},get me_(){return me},get COUNTRIES(){return COUNTRIES},set chosenIdx(i){ chosenFlag=countryByIdx(i); },get draft(){return draft},set over(v){over=v},get banners(){return banners}};`;
eval(code);
// ---------------- start
const ci=S.COUNTRIES.findIndex(c=>c.name===COUNTRY); if(ci>=0) S.chosenIdx=ci;
__start();
const me=S.me; me.gold=1200; // a comfortable early war chest
const W=S.W,H=S.H; const cam=S.cam;
// ---------------- helpers
const rnd=(a,b)=>a+Math.random()*(b-a); const pick=a=>a[Math.floor(Math.random()*a.length)];
function centerOf(p){ const c=S.centroid(p); return {x:c[0],y:c[1]}; }
function tileXY(t){ return {x:t%W+.5,y:(t-t%W)/W+.5}; }
function interior(p){ const own=S.ownTilesOf(p.id); const inner=own.filter(t=>{ const x=t%W,y=(t-x)/W; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(!S.inb(x+dx,y+dy)||S.owner[S.idx(x+dx,y+dy)]!==p.id) return false; return true; }); return inner.length?inner:own; }
function neighbours(p){ const set=new Set(); const own=S.ownTilesOf(p.id); for(const t of own){ const x=t%W,y=(t-x)/W; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(S.inb(x+dx,y+dy)){ const o=S.owner[S.idx(x+dx,y+dy)]; if(o>=0&&o!==p.id&&S.players[o].alive&&S.land[S.idx(x+dx,y+dy)]) set.add(o); } } return [...set].map(i=>S.players[i]); }
function borderTile(p,q){ const own=S.ownTilesOf(q.id); for(const t of own){ const x=t%W,y=(t-x)/W; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(S.inb(x+dx,y+dy)&&S.owner[S.idx(x+dx,y+dy)]===p.id) return t; } return own[0]; }
function waterNear(t,r=6){ const x=t%W,y=(t-x)/W; for(let rr=1;rr<=r;rr++) for(let dy=-rr;dy<=rr;dy++) for(let dx=-rr;dx<=rr;dx++){ if(S.inb(x+dx,y+dy)&&!S.land[S.idx(x+dx,y+dy)]) return S.idx(x+dx,y+dy); } return -1; }
// ---------------- autopilot for the player (cinematic, not optimal)
let lastAttack=0, builtCity=false, builtPort=false, builtSilo=false, navy=0, nukesFired=0, builtFactory=0;
const EV=[]; // events of interest: {tick, kind, t}
function autopilot(tk){
  const p=me; if(!p.alive) return;
  if(tk%20===0){ const nb=neighbours(p).filter(q=>q.kind==='neutral'||q.tiles<p.tiles*0.8); if(nb.length&&tk-lastAttack>=25){ const q=nb.sort((a,b)=>a.troops-b.troops)[0]; const bt=borderTile(p,q); if(S.launchAttack(p,q.id,Math.max(20,p.troops*0.5))){ lastAttack=tk; EV.push({tick:tk,kind:'attack',t:bt}); } } }
  const own=S.ownTilesOf(p.id);
  if(!builtCity&&tk>60&&p.gold>=140){ const t=pick(interior(p)); if(S.placeStructure(p,'city',t)){ builtCity=true; EV.push({tick:tk,kind:'build',t}); } }
  if(builtFactory<2&&tk>150&&p.gold>=130){ const t=pick(interior(p)); if(S.placeStructure(p,'factory',t)){ builtFactory++; } }
  if(!builtPort&&tk>240&&p.gold>=180){ const cs=S.coastTilesOf(p.id); if(cs.length){ const t=pick(cs); if(S.placeStructure(p,'port',t)){ builtPort=true; EV.push({tick:tk,kind:'port',t}); } } }
  if(builtPort&&navy<3&&tk>520&&p.gold>=230){ const port=S.structures.find(s=>s.owner===p.id&&s.type==='port'&&!s.building); if(port){ const w=waterNear(port.t,7); if(w>=0&&S.orderWarship(p,w,navy===0?'warship':navy===1?'cruiser':'warship')){ navy++; EV.push({tick:tk,kind:'navy',t:w}); } } }
  if(!builtSilo&&tk>900&&p.gold>=440){ const t=pick(interior(p)); if(S.placeStructure(p,'silo',t)){ builtSilo=true; EV.push({tick:tk,kind:'silo',t}); } }
  if(builtSilo&&nukesFired<2&&tk>2200&&p.gold>=300){ const rivals=S.players.filter(q=>q.kind==='bot'&&q.alive&&q.tiles>300).sort((a,b)=>b.tiles-a.tiles); if(rivals.length){ const q=rivals[0]; const c=centerOf(q); const t=S.idx(Math.floor(c.x),Math.floor(c.y)); if(S.land[t]&&S.owner[t]===q.id&&S.launchMissile(p,t)){ nukesFired++; EV.push({tick:tk,kind:'nuke',t}); } } }
  if(tk%50===0&&p.gold>2500) p.gold=2500; // keep the war chest sensible
  if(tk%300===0) p.gold+=600; // trailer subsidy: keeps the action coming
}
// ---------------- camera director
let camT={x:0,y:0,s:1}; function look(x,y,s){ camT={x:W0/2-x*s,y:H0/2-y*s,s}; } function lerpCam(k){ cam.s+= (camT.s-cam.s)*k; cam.x+=(camT.x-cam.x)*k; cam.y+=(camT.y-cam.y)*k; }
// ---------------- captions & overlays
const FONT='"DejaVu Sans","Segoe UI",sans-serif';
function caption(ctx,text,sub,alpha,top){ if(alpha<=0||process.env.NOCAP) return; const Y=top?H0*0.12:H0*0.82; ctx.save(); ctx.globalAlpha=alpha; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=`bold 52px ${FONT}`; ctx.lineWidth=8; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.fillStyle='#fff'; ctx.strokeText(text,W0/2,Y); ctx.fillText(text,W0/2,Y); if(sub){ ctx.font=`500 22px ${FONT}`; ctx.fillStyle='#ffd27a'; ctx.lineWidth=5; ctx.strokeText(sub,W0/2,Y+46); ctx.fillText(sub,W0/2,Y+46); } ctx.restore(); }
function titleCard(ctx,alpha,line1,line2,line3){ ctx.save(); ctx.fillStyle='#0f1a26'; ctx.fillRect(0,0,W0,H0); ctx.globalAlpha=alpha; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.font=`bold 96px ${FONT}`; ctx.letterSpacing='10px'; ctx.fillText(line1,W0/2,H0/2-30); ctx.letterSpacing='0px'; ctx.fillStyle='#ffd27a'; ctx.font=`600 30px ${FONT}`; ctx.fillText(line2,W0/2,H0/2+50); if(line3){ ctx.fillStyle='#8fa3b8'; ctx.font=`400 22px ${FONT}`; ctx.fillText(line3,W0/2,H0/2+96); } ctx.restore(); }
function vignette(ctx){ const g=ctx.createRadialGradient(W0/2,H0/2,H0*0.35,W0/2,H0/2,H0*0.85); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.45)'); ctx.fillStyle=g; ctx.fillRect(0,0,W0,H0); }
// ---------------- shot list (game ticks). Each shot: from..to ticks, camera fn (per tick), caption
const meC=()=>centerOf(me);
const shots=[
 {from:0,to:280,cam:tk=>{ const c=meC(); look(c.x,c.y,7-tk/280*2.5); },cap:['Start as one small nation.','among a hundred'],lead:20},
 {from:280,to:700,cam:tk=>{ const c=meC(); look(c.x,c.y,4.2-(tk-280)/420*1.6); },cap:['Eat the neutrals around you.','they push back when you spread thin'],lead:20},
 {from:700,to:1000,cam:tk=>{ const ev=EV.filter(e=>e.kind==='port'||e.kind==='navy').pop(); const c=ev?tileXY(ev.t):meC(); look(c.x,c.y,5.5); },cap:['Build a navy.','ports, warships, transports'],lead:20},
 {from:1000,to:1500,cam:tk=>{ const tr=S.transports.filter(x=>x.owner===me.id)[0]; const a=S.attacks.find(x=>x.owner===me.id&&x.naval); const c=a?tileXY([...a.front][0]):tr?{x:tr.x,y:tr.y}:meC(); look(c.x,c.y,5); },cap:['Cross the sea.','land where they least expect it'],lead:20},
 {from:1500,to:2200,wide:true,cam:tk=>{ const c=meC(); look(c.x,c.y,2.4); },cap:['Unify a continent.','and the windfall is yours'],lead:20},
 {from:2200,to:2700,cam:tk=>{ const m=S.missiles.find(x=>x.owner===me.id); const ev=EV.filter(e=>e.kind==='nuke').pop(); const c=m?tileXY(m.t):ev?tileXY(ev.t):meC(); look(c.x,c.y,m?4.5:3.2); },cap:['Bring the rain.','missiles, bombers, shield domes, SAMs'],lead:20},
 {from:2700,to:3200,wide:true,cam:tk=>{ look(W/2,H/2,Math.min(W0/W,H0/H)*1.02); },cap:['Hold 72% of the world.','against nine rivals who want it too'],lead:20},
];
const LAST=3200; const frames=[]; let fi=0; const OUT=process.env.OUT||'/tmp/trailer'; fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT);
const ctx=main.getContext('2d');
function save(){ fs.writeFileSync(`${OUT}/f${String(fi++).padStart(5,'0')}.jpg`,main.toBuffer('image/jpeg',{quality:0.92})); }
// opening
if(!process.env.NOTITLE){ for(let i=0;i<55;i++){ titleCard(ctx,Math.min(1,i/14),'STATEFALL','A real-time strategy game in your browser','WorldRTS.com'); if(i>44) { ctx.fillStyle=`rgba(15,26,38,${(i-44)/10})`; ctx.fillRect(0,0,W0,H0); } save(); } }
// gameplay
{ const c=meC(); cam.s=7; cam.x=W0/2-c.x*7; cam.y=H0/2-c.y*7; }
for(let tk=0;tk<=LAST;tk++){
  __now+=100; autopilot(tk); S.tick();
  const sh=shots.find(s=>tk>=s.from&&tk<s.to)||shots[shots.length-1]; sh.cam(tk); lerpCam(0.06);
  if(tk%2===1) continue;
  S.render(); vignette(ctx);
  const into=tk-sh.from, len=sh.to-sh.from; const a=Math.min(1,Math.max(0,(into-sh.lead)/12))*Math.min(1,Math.max(0,(len-into)/12)); caption(ctx,sh.cap[0],sh.cap[1],a);
  if(tk<12){ ctx.fillStyle=`rgba(15,26,38,${1-tk/12})`; ctx.fillRect(0,0,W0,H0); }
  save();
}
// credits slice
global.__allowEnd=true; global.__trailer=true; const d=S.statsSnapshot('Victory'); d.player='YOU'; S.userPaused=true; S.over=true;
S.beginCredits(d,'builtin',false); S.ROLL.t0=__now; 
for(let i=0;i<420;i++){ __now+=41.6; S.ROLL.t0-=0; S.render(); const a=i<20?i/20:i>400?(420-i)/20:1; if(i>60) caption(ctx,'Then roll the credits.','your campaign, your rivals, your nemesis — to your own music',Math.min(1,Math.max(0,(i-60)/12))*Math.min(1,(420-i)/16),true); if(i<16){ ctx.fillStyle=`rgba(15,26,38,${1-i/16})`; ctx.fillRect(0,0,W0,H0); } if(process.env.NOTITLE&&i>400){ ctx.fillStyle=`rgba(15,26,38,${(i-400)/20})`; ctx.fillRect(0,0,W0,H0); } save(); }
// end card
if(!process.env.NOTITLE){ for(let i=0;i<110;i++){ titleCard(ctx,Math.min(1,i/14),'STATEFALL','Play free at WorldRTS.com','No download. No install. Just your browser.'); if(i>96){ ctx.fillStyle=`rgba(15,26,38,${(i-96)/14})`; ctx.fillRect(0,0,W0,H0); } save(); } }
console.log('frames',fi,'events',EV.map(e=>e.kind+'@'+e.tick).join(' '));
