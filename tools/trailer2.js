// Features trailer: real-world maps montage, then deep late-game footage with callouts for buildings, ships and aircraft.
const fs=require('fs'); const boot=require('./harness.js');
const OUT=process.env.OUT||'/tmp/trailerB'; fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT); let fi=0;
const FONT='"DejaVu Sans","Segoe UI",sans-serif';
function save(main){ fs.writeFileSync(`${OUT}/f${String(fi++).padStart(5,'0')}.jpg`,main.toBuffer('image/jpeg',{quality:0.92})); }
function vignette(ctx,W0,H0){ const g=ctx.createRadialGradient(W0/2,H0/2,H0*0.35,W0/2,H0/2,H0*0.85); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.45)'); ctx.fillStyle=g; ctx.fillRect(0,0,W0,H0); }
function titleCard(ctx,W0,H0,alpha,l1,l2,l3){ ctx.save(); ctx.fillStyle='#0f1a26'; ctx.fillRect(0,0,W0,H0); ctx.globalAlpha=alpha; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.font=`bold 96px ${FONT}`; ctx.letterSpacing='10px'; ctx.fillText(l1,W0/2,H0/2-30); ctx.letterSpacing='0px'; ctx.fillStyle='#ffd27a'; ctx.font=`600 30px ${FONT}`; ctx.fillText(l2,W0/2,H0/2+50); if(l3){ ctx.fillStyle='#8fa3b8'; ctx.font=`400 22px ${FONT}`; ctx.fillText(l3,W0/2,H0/2+96); } ctx.restore(); }
function chip(ctx,text,x,y,alpha=1){ ctx.save(); ctx.globalAlpha=alpha; ctx.font=`600 15px ${FONT}`; const w=ctx.measureText(text).width+18; ctx.fillStyle='rgba(15,26,38,.92)'; ctx.strokeStyle='rgba(255,210,122,.8)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.roundRect(x-w/2,y-13,w,26,7); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,x,y); ctx.restore(); }
function callout(ctx,label,sx,sy,dx,dy,alpha=1){ ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle='rgba(255,210,122,.9)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+dx,sy+dy); ctx.stroke(); ctx.fillStyle='#ffd27a'; ctx.beginPath(); ctx.arc(sx,sy,3,0,6.3); ctx.fill(); ctx.restore(); chip(ctx,label,sx+dx+(dx>0?40:-40),sy+dy,alpha); }
function header(ctx,W0,text,alpha){ if(alpha<=0) return; ctx.save(); ctx.globalAlpha=alpha; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font=`bold 30px ${FONT}`; ctx.lineWidth=6; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.fillStyle='#fff'; ctx.strokeText(text,28,40); ctx.fillText(text,28,40); ctx.restore(); }
const fadeIn=(i,n=12)=>Math.min(1,i/n), fadeOut=(i,len,n=12)=>Math.min(1,(len-i)/n);
// ---------------- Part 1: real-world maps
const MAPS=[['world','World'],['europe','Europe'],['americas','The Americas'],['africa','Africa'],['asia','Asia'],['mideast','Middle East']];
let first=true;
if(!process.env.SKIPMAPS) for(const [id,name] of MAPS){
  const G=boot({seed:'MAPS-'+id,diff:'superhard',quick:true,instant:true,map:id}); const {S,main,ctx,W0,H0}=G; G.tick(500);
  const fit=Math.min(W0/S.W,H0/S.H); const len=84;
  for(let i=0;i<len;i++){ G.tick(2); const s=fit*(1.0+0.16*i/len); S.cam.s=s; S.cam.x=W0/2-S.W/2*s; S.cam.y=H0/2-S.H/2*s; S.render(); vignette(ctx,W0,H0); header(ctx,W0,name,Math.min(fadeIn(i,10),fadeOut(i,len,10))); if(first&&i<12){ ctx.fillStyle=`rgba(15,26,38,${1-i/12})`; ctx.fillRect(0,0,W0,H0); } if(i>=len-6){ ctx.fillStyle=`rgba(15,26,38,${(i-(len-6))/6})`; ctx.fillRect(0,0,W0,H0); } save(main); }
  first=false; console.log('map',id,'frames',fi);
}
// ---------------- Part 2: deep late game
const G=boot({seed:'DEEP2',diff:'impossible',quick:true,instant:true,noCap:true,map:'random',frenzy:true}); const {S,main,ctx,W0,H0}=G; const W=S.W,H=S.H; const cam=S.cam;
for(let k=0;k<5200;k++){ G.tick(1); if(k%100===0) for(const p of S.players) if(p.kind==='bot'&&p.alive) p.gold+=450; } console.log('deep sim ready: ships',S.warships.length,'aircraft',S.aircraft.length,'structures',S.structures.length);
let camT={x:0,y:0,s:1}; function look(x,y,s){ camT={x:W0/2-x*s,y:H0/2-y*s,s}; } function lerpCam(k){ cam.s+=(camT.s-cam.s)*k; cam.x+=(camT.x-cam.x)*k; cam.y+=(camT.y-cam.y)*k; } function snap(){ cam.s=camT.s; cam.x=camT.x; cam.y=camT.y; }
const scr=(x,y)=>[cam.x+x*cam.s,cam.y+y*cam.s];
const AIRLABEL={fighter:'Stealth fighter',bomber:'Stealth bomber',carrier:'Troop transport',spy:'Spy plane'};
function biggestBot(){ return S.players.filter(p=>p.kind==='bot'&&p.alive).sort((a,b)=>b.tiles-a.tiles)[0]; }
function densest(items,r=28){ let best=null,bn=0; for(const a of items){ let n=0; for(const b of items) if(Math.hypot(a.x-b.x,a.y-b.y)<r) n++; if(n>bn){ bn=n; best=a; } } return best; }
function shot(len,camFn,labelFn,title){ let chosen=null; for(let i=0;i<len;i++){ G.tick(2); camFn(i); lerpCam(i===0?1:0.08); S.render(); vignette(ctx,W0,H0); const a=Math.min(fadeIn(i),fadeOut(i,len)); if(i===0&&labelFn) chosen=labelFn(); if(chosen) for(const c of chosen){ const [sx,sy]=scr(c.x(),c.y()); if(sx>-50&&sx<W0+50&&sy>-50&&sy<H0+50) callout(ctx,c.label,sx,sy,c.dx,c.dy,a); } header(ctx,W0,title,a); if(i>=len-6){ ctx.fillStyle=`rgba(15,26,38,${(i-(len-6))/6})`; ctx.fillRect(0,0,W0,H0); } if(i<6){ ctx.fillStyle=`rgba(15,26,38,${1-i/6})`; ctx.fillRect(0,0,W0,H0); } save(main); } }
const offsets=[[70,-60],[90,20],[-80,-50],[-90,40],[60,80],[-60,90],[110,-20],[-110,-10]];
function pickStructures(p,cx,cy,r){ const seen=new Set(); const out=[]; const near=S.structures.filter(st=>st.owner===p.id&&!st.building&&Math.hypot(st.t%W-cx,(st.t-st.t%W)/W-cy)<r); for(const st of near){ if(seen.has(st.type)||out.length>=7) continue; seen.add(st.type); const o=offsets[out.length]; out.push({label:S.STRUCT[st.type].label+((st.level||1)>=2?' II':''),x:()=>st.t%W+.5,y:()=>(st.t-st.t%W)/W+.5,dx:o[0],dy:o[1]}); } return out; }
// shot A: buildings — biggest bot's heartland
{ const p=biggestBot(); const c=S.centroid(p); const cx=c[0],cy=c[1]; shot(220,i=>look(cx+Math.sin(i/70)*18,cy+Math.cos(i/90)*10,6.5),()=>pickStructures(p,cx,cy,60),'Twenty buildings to choose from'); }
// shot B: coastal defenses — a coast with guns/batteries/ports
{ const st=S.structures.find(s=>['battery','shore','bertha','port'].includes(s.type)&&!s.building)||S.structures[0]; const cx=st.t%W+.5,cy=(st.t-st.t%W)/W+.5; const p=S.players[st.owner]; shot(160,i=>look(cx+Math.sin(i/60)*10,cy,7),()=>pickStructures(p,cx,cy,40),'Coast and artillery'); }
// shot C: navy — densest fleet
{ const w=densest(S.warships.filter(x=>!x.dead))||S.warships[0]; shot(220,i=>{ const ww=densest(S.warships.filter(x=>!x.dead))||w; look(ww.x,ww.y,5.5); },()=>{ const seen=new Set(); const out=[]; for(const x of S.warships){ if(x.dead||seen.has(x.cls)||out.length>=7) continue; if(Math.hypot(x.x-w.x,x.y-w.y)>60) continue; seen.add(x.cls); const o=offsets[out.length]; out.push({label:S.SHIPS[x.cls]?S.SHIPS[x.cls].label:x.cls,x:()=>x.x,y:()=>x.y,dx:o[0],dy:o[1]}); } return out; },'Eight classes of ship'); }
// shot D: air — follow a plane, label the wing
{ const planes=S.aircraft.filter(a=>!a.dead&&a.state!=='hangar'); const af=S.structures.find(s=>s.type==='airfield'&&!s.building); const lead=planes[0]||null; shot(200,i=>{ const pl=S.aircraft.find(a=>!a.dead&&a.state!=='hangar')||lead; if(pl) look(pl.x,pl.y,6); else if(af) look(af.t%W+.5,(af.t-af.t%W)/W+.5,6); },()=>{ const seen=new Set(); const out=[]; for(const a of S.aircraft){ if(a.dead||seen.has(a.type)||out.length>=5) continue; seen.add(a.type); const o=offsets[out.length]; out.push({label:AIRLABEL[a.type]||a.type,x:()=>a.x,y:()=>a.y,dx:o[0],dy:o[1]}); } if(af){ const o=offsets[out.length]; out.push({label:'Airfield'+((af.level||1)>=2?' II':''),x:()=>af.t%W+.5,y:()=>(af.t-af.t%W)/W+.5,dx:o[0],dy:o[1]}); } return out; },'Fighters, bombers, paradrops, spy planes'); }
// shot E: missiles and shields
{ const sh=S.structures.find(s=>s.type==='shield'&&!s.building)||S.structures.find(s=>s.type==='silo'&&!s.building)||S.structures[0]; const cx=sh.t%W+.5,cy=(sh.t-sh.t%W)/W+.5; const p=S.players[sh.owner]; shot(160,i=>look(cx,cy,6.5),()=>pickStructures(p,cx,cy,40),'Missiles, SAMs, shield domes'); }
// shot F: the whole busy world
{ const fit=Math.min(W0/W,H0/H); shot(180,i=>look(W/2,H/2,fit*(1.02+0.1*i/180)),null,'A hundred nations. One map.'); }
// end card
for(let i=0;i<100;i++){ titleCard(ctx,W0,H0,Math.min(1,i/14),'STATEFALL','Play free at WorldRTS.com','No download. No install. Just your browser.'); if(i>86){ ctx.fillStyle=`rgba(15,26,38,${(i-86)/14})`; ctx.fillRect(0,0,W0,H0); } save(main); }
console.log('frames',fi);
