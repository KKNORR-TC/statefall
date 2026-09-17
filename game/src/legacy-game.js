import {GAME_VERSION,GAME_BUILD,REQUIRES_PLUGIN} from './config/build.js';
import {MAPS,NE_ALIAS} from './config/maps.js';
import {COUNTRIES,EMBLEMS,EMBLEM_LABEL,drawEmblem,drawFlag} from './config/flags.mjs';
import {createPlatform} from './integration/platform.js';
import {createAudioState,saveAudioLevels} from './audio/audio-state.js';
import {STATEFALL_SIGN_KEY} from './config/signing.js';

// ---------------------------------------------------------------- config
const W=720, H=414, TICK=100;               // map size in tiles, ms per tick
const WIN_SHARE=0.72, BOTS=9, TILES_PER_NEUTRAL=1300;
const DIFFS={
  supereasy:{label:'Super easy', eco:0.55, aggr:0.5,  build:0.25, brain:0, desc:'Bots grow at half speed, rarely pick fights and never learn. Learn the map.'},
  easy:     {label:'Easy',       eco:0.75, aggr:0.75, build:0.35, brain:1, desc:'Bots are slower and cautious; they place defenses sensibly but don\'t react.'},
  normal:   {label:'Normal',     eco:1.0,  aggr:1.0,  build:0.5, brain:2, desc:'Even footing. Bots build at half pace, place defenses sensibly and reinforce a winning attack, but don\'t react to being hit or manage their economy.'},
  hard:     {label:'Hard',       eco:1.2,  aggr:1.15, build:0.8, brain:3, desc:'Bots manage their economy, remember where they were hit and build answers, pick a focus enemy, break off losing attacks, and gang up on a runaway leader.'},
  superhard:{label:'Super hard', eco:1.4,  aggr:1.3,  build:1.4, brain:4, coalition:0.45, desc:'Everything in Hard plus a real economy: bots open with cities, never sit on gold, fortify their coasts, land where your guns are not, and turn on the leader together. Air power by minute six.'},
  impossible:{label:'Impossible',eco:1.7,  aggr:1.5,  build:4.0, brain:5, coalition:0.28, desc:'The Super hard brain with a city rush that ignores every cooldown, more guns, an earlier navy, and a coalition against anyone holding more than a quarter of the map.'},
};
let DIFF=DIFFS.normal;
const PLATFORM=createPlatform();
const WP=PLATFORM.config;
const IDENTITY=PLATFORM.identity(), CAPABILITIES=PLATFORM.capabilities();
async function sfSign(rec){ const canon=JSON.stringify({when:rec.when,result:rec.result,country:rec.country,map:rec.map,diff:rec.diff,fog:!!rec.fog,risky:!!rec.risky,cls:rec.cls,land:rec.land,minutes:rec.minutes,kills:rec.kills,peak:rec.peak,gold:rec.gold,seed:rec.seed}); const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(STATEFALL_SIGN_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']); const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(canon)); return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function sfPost(rec){ rec.flag=me&&me.flag&&me.flag.custom?{name:me.flag.name,layers:me.flag.layers}:null; if(!CAPABILITIES.scores){ console.info('[statefall] score not posted: '+(WP?'not logged in':'not hosted')); return {skipped:true}; } try{ const sig=await sfSign(rec); console.info('[statefall] posting score',rec); const result=await PLATFORM.score({...rec,sig}); console.info('[statefall] post result',result); return result; }catch(e){ console.error('[statefall] post failed',e); return {error:e.body?.error||'network',message:e.body?.message||String(e),status:e.status}; } }
function sfOutbox(){ try{ return JSON.parse(localStorage.getItem('statefall-outbox')||'[]'); }catch(e){ return []; } }
function sfSaveOutbox(b){ try{ localStorage.setItem('statefall-outbox',JSON.stringify(b.slice(-20))); }catch(e){} }
async function sfFlushOutbox(){ if(!IDENTITY) return; const box=sfOutbox(); if(!box.length) return; const keep=[]; for(const rec of box){ const res=await sfPost(rec); if(res.error&&res.status!==422&&res.status!==403) keep.push(rec); } sfSaveOutbox(keep); }
const HOTKEYS={c:'city',f:'factory',p:'port',s:'sam',m:'silo',d:'fort',k:'command',n:'nuke',h:'shield',g:'shore',b:'battery',t:'bertha',a:'airfield',o:'flightops',r:'radar',l:'lradar',j:'jammer',u:'subbase',e:'engcmd',y:'troopcmd',i:'satellite'};
const KEY_OF={}; for(const kk in HOTKEYS) KEY_OF[HOTKEYS[kk]]=kk.toUpperCase();
const START={troops:120,gold:100,bots:false,teams:0,noCap:false,map:'random',quick:false,fog:false,instant:false,risky:false,endgame:false,billionaire:false,garrison:false,pauseBuild:false,seed:0};
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function seedFrom(str){ let h=2166136261; for(const ch of String(str)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
function newSeed(){ return Math.floor(Math.random()*1e9).toString(36).toUpperCase(); } let draft=null, draftPicks=[], draftDoneAt=0, draftTicks=0;
const FOG={base:8,radar:45,lradar:110,rship:60,jam:30,plane:{r:35,dur:450,cd:900,cost:40,speed:6,grace:150,hit:0.15,maxShots:3},sat:{cost:400,dur:450,cd:1200}};
let hoverAir=null, hoverArea=-1, hoverPickArea=-1; let vis=null, radarLayer=null, planes=[], satUntil=0, satCool=0, planeCool=0, myBorders=new Set(); const QUICK_TILES=2200; let PRESET=null, cid=null; const TEAM_NAMES=['Red','Blue','Green','Gold'], TEAM_COLS=['#e35d5d','#4da3ff','#5fc76a','#e5a53c']; const ALLOWED=new Set(['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','troopcmd','engcmd','radar','lradar','satellite','jammer','scout','sub','hunter','rship','privateer','warship','cruiser','battleship','missile']);
const STRUCT={
  city:   {key:'city',   label:'City',        cost:120, desc:'+300 troops now, +cap and growth; linked factories add troops'},
  factory:{key:'factory',label:'Factory',     cost:110, desc:'15 s to build. +2.2 gold / s, +30% per supply line'},
  port:   {key:'port',   label:'Port',        cost:160, desc:'Coast only, 20 s to build. Ships, trade, +gold', coast:true},
  sam:    {key:'sam',    label:'SAM site',    cost:220, desc:'30 s to build. Near-certain kill on hostile missiles in range, 2.5 s reload. Knocked out under bombardment'},
  silo:   {key:'silo',   label:'Missile silo',cost:420, desc:'2 min to build. Launches missiles; 20 s reload per silo'},
  fort:   {key:'fort',   label:'Bastion',        cost:90,  desc:'Doubles the cost of taking land within 16 tiles — and every extra bastion covering the same ground doubles it again, up to 64×. Each one you own makes the next 40 gold dearer. Upgrade to II and III for range. Fortified ground never falls to a collapse and always costs a wall toll to take, garrison or not. Shelling cancels it; overrun destroys it'},
  command:{key:'command',label:'Missile command',cost:350, desc:'90 s to build. Controls silos within 45 tiles and fires them at high-value targets. Overlapping centers make missiles cheaper'},
  shield: {key:'shield', label:'Shield generator',cost:900, desc:'150 s to build. 12-tile dome that stops every missile aimed inside it, 100%, losing 2 of 10 hit points per hit. Repair from the right-click menu'},
  battery:{key:'battery',label:'Coastal battery',cost:420, desc:'60 s to build, coast only. 34-tile gun, 3 damage every 8 s. Knocked out under bombardment', coast:true},
  shore:  {key:'shore',  label:'Shore guns',   cost:150, desc:'20 s to build, coast only. 14-tile rapid fire: shreds transports and light ships', coast:true},
  bertha: {key:'bertha', label:'Big Bertha',   cost:700, desc:'2 min to build. 60-tile artillery, one shell every 20 s at the nearest enemy building. Cannot be intercepted'},
  airfield:{key:'airfield',label:'Airfield',cost:600, desc:'90 s to build. Hangar for up to 4 aircraft; buy fighters and bombers from its right-click menu. Spy planes fly from here'},
  flightops:{key:'flightops',label:'Flight operations',cost:400, desc:'60 s to build. Runs your air war: buys aircraft (keeping a gold reserve), keeps fighter patrols over your assets, recalls damaged pilots, and strikes with bombers when the sky is clear'},
  subbase:{key:'subbase',label:'Submarine base',cost:450, desc:'60 s to build, coast only, needs a level II port within 34 tiles. Builds attack subs and hunter subs', coast:true},
  engcmd:{key:'engcmd',label:'Engineering command',cost:450, desc:'60 s to build. Sends up to 4 repair trucks over your contiguous land to fix shields, airfield shields, guns, Big Bertha and port II guns, 15 gold per pip'},
  troopcmd:{key:'troopcmd',label:'Troop command',cost:400, desc:'90 s to build. +10% troop growth each, up to four. With Garrisons it runs logistics: heavy transport or paradrop to any area under 40% of home density, keeping a reserve'},
  radar:  {key:'radar',  label:'Radar station',cost:180, desc:'20 s to build. Reveals 45 tiles around it (fog of war)', fog:true},
  lradar: {key:'lradar', label:'Long-range radar',cost:500, desc:'60 s to build. Reveals 110 tiles around it (fog of war)', fog:true},
  jammer: {key:'jammer', label:'Radar jammer',cost:400, desc:'45 s to build. Blanks enemy radar stations, long-range radar and radar ships within 30 tiles. Eyes still see: territory, warships, spy planes, satellites', fog:true},
  satellite:{key:'satellite',label:'Satellite launch site',cost:900, desc:'3 min to build. Launch a spy satellite for 400 gold: the whole map for 45 s', fog:true},
};
const CMD_RANGE=45, CMD_DISCOUNT=0.15, CMD_DISCOUNT_MAX=0.45;
const BUILD_TICKS={city:0,fort:0,factory:150,port:200,sam:300,silo:1200,command:900,radar:200,lradar:600,satellite:1800,jammer:450,airfield:900,flightops:600,subbase:600,troopcmd:900,engcmd:600,battery:600,shore:200,bertha:1200,shield:1500}, SHIELD={r:12,hp:10,hit:2,repairCost:25,repairTicks:60}, UPGRADE={port:{cost:500,ticks:600},airfield:{cost:600,ticks:900},fort:{cost:200,ticks:300,max:3,cost3:400,ticks3:600}}, LSHIELD={r:8,hp:6}, HEAVY={hp:4,speedMul:0.75,gun:12,dmg:1,cd:5}, CRUISE={cost:400,ticks:300,range:120,count:2,cd:400,speed:2.5,radius:3,samMul:0.6}, AIR={hangar:4,reserve:300,
  fighter:{cost:350,build:300,speed:6,range:160,patrol:25,endurance:6000,refuel:1200,hp:5,heal:200,dog:30},
  bomber:{cost:450,build:400,speed:5,range:260,bombs:8,spacing:4,radius:2,rearm:300},
  carrier:{cost:500,build:400,speed:5,range:200,capacity:1500,rearm:200}},
GUNS={battery:{range:34,dmg:3,cd:80,hp:6},shore:{range:14,dmg:1,cd:4,hp:3},bertha:{range:60,cd:200,radius:3,hp:8}}, ARMOR={scout:1,rship:1,privateer:1,warship:2,cruiser:3,battleship:5,sub:1,hunter:1}, CMD_RESERVE=150, SHIP_BUILD={scout:0,sub:350,hunter:350,rship:200,privateer:300,warship:250,cruiser:450,battleship:900}, CANCEL_REFUND=0.5;
const CITY_POP=300, CONQUEST_GOLD=0.12, CONQUEST_EARLY=3, CONQUEST_EARLY_TICKS=4800;
const NAP_TICKS=1800, BETRAY_TICKS=600, PROPOSAL_TTL=250;
const PROVOKE_TICKS=400, FORT_RANGE=16, STRUCT_SPACING=6, WALL_TOLL=15;
const REGION_MIN=120, LAND_MIN=40, CONTINENT_MIN=3500, CAPTURE_BONUS=0.22, HOLD_BONUS=0.003;
const SHIPS={
  sub:       {key:'sub',       label:'Attack sub',     cost:300, hp:3,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:1.6, sub:true, torpedo:{range:14,dmg:3,cd:100}, desc:'Invisible beyond 8 tiles of a destroyer, hunter or radar ship. Torpedoes: 3 damage, one-shot ordinary transports, 10 s reload'},
  hunter:    {key:'hunter',    label:'Hunter sub',     cost:300, hp:3,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:1.7, sub:true, hunter:true, torpedo:{range:14,dmg:3,cd:80}, desc:'Sees subs at 20 tiles and torpedoes them. Fires at nothing else'},
  rship:     {key:'rship',     label:'Radar ship',     cost:250, hp:3,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:1.6, desc:'Unarmed picket that reveals 60 tiles around it. Easy prey — escort it'},
  privateer: {key:'privateer', label:'Privateer',      cost:300, hp:4,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:2.2, pirate:{range:8,board:20,cd:100}, desc:'Boards merchants within 8 tiles and sails them to your nearest port for double cargo. Piracy starts hostilities'},
  scout:     {key:'scout',     label:'Scout boat',     cost:110, hp:2,  gun:12, dmg:1, sam:0,  samHit:0,    samCd:99, speed:3.2, desc:'Very fast, lightly armed, fragile. Picket and courier'},
  warship:   {key:'warship',   label:'Destroyer',      cost:200, hp:5,  gun:26, dmg:1, sam:16, samHit:0.6,  samCd:80, speed:1.4, desc:'Fast escort, deadly to cruisers. Short-range SAM'},
  cruiser:   {key:'cruiser',   label:'Missile cruiser',cost:450, hp:6,  gun:22, dmg:1, sam:26, samHit:0.75, samCd:60, speed:0.95, barrage:{range:30,count:4,radius:2,cd:150}, desc:'Bombards enemy land, hunting SAM sites first. Medium SAM. Thin armor: destroyers hit it twice as hard'},
  battleship:{key:'battleship',label:'Battleship',     cost:900, hp:12, gun:32, dmg:2, sam:26, samHit:0.75, samCd:60, speed:0.6, barrage:{range:36,count:6,radius:3,cd:250}, desc:'Heavy guns, land missiles and SAM. Slow reload, slow to arrive'},
};
const WARSHIP_COST=200, SHIP_SPEED=1.1, WARSHIP_RANGE=26, WARSHIP_HP=5, SHELL_SPEED=4, TRADE_INTERVAL=220, TRADE_GOLD=18, TRADE_PER_TILE=0.12, TRADE_SPEED=1.3, SHIP_SAM_RANGE=16, SHIP_SAM_COOLDOWN=80, SHIP_SAM_HIT=0.6, SINK_BOUNTY=0.3, BARRAGE_KILL_FLAT=20, BARRAGE_KILL_PCT=0.008, BARRAGE_KILL_CAP=150, SUPPRESS_TICKS=300, SUPPRESS_RING=3, SUPPRESS_COST=0.5, LINK_RANGE=34, LINK_MAX_PER_CITY=3, LINK_MAX_PER_PORT=2, LINK_MAX_PER_FACTORY=4, LINK_GOLD_PER=0.3, LINK_TROOPS=1.2, LINK_PORT_GOLD=1.0, LINK_SHIP_DISCOUNT=0.15;
const NUKE_COST=280, NUKE_RADIUS=20, SAM_RANGE=40, SAM_HIT=0.96, SAM_REACT=6, INTERCEPTOR_SPEED=9, SAM_COOLDOWN=25, SILO_COOLDOWN=200;
const BOT_NAMES=['Vardania','Kestrel Union','Orrin','Thalassa','Novgard','Serendib','Ashkar','Meridia','Cordova','Halvard','Zephyria','Ostmark'];
const NEUTRAL_NAMES=['Free Tribes','Hill Clans','Coastal League','Old Kingdom','Marsh Folk','Steppe Horde','Island Council','Mountain Holds'];
const COLORS=['#4da3ff','#e35d5d','#5fc76a','#e5a53c','#b06ee8','#3fc9c9','#f07ab0','#a8d15a','#ff8f4d','#8b93ff','#d4c34a','#5ad1a5','#e07b9f','#7fd0ff'];

// ---------------------------------------------------------------- state
let land, owner, struct, structOwner, region, river, shelled, rough;  // typed arrays per tile
let regions=[], regCount=null, NP=0; const unclaimed=new Set();                   // landmasses and per-owner tile counts
let simMs=0, uidSeq=0; let players=[], attacks=[], missiles=[], structures=[], transports=[], warships=[], shots=[], interceptors=[], shells=[], links=[], traders=[], aircraft=[], trucks=[]; const hostile={};
let landCount=0, tickN=0, over=false, startTime=0, freeplay=false, spectating=false, decided=false, paused=false, userPaused=false, pausedAt=0;
let me=null;
const N4=[[1,0],[-1,0],[0,1],[0,-1]];
const N8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const idx=(x,y)=>y*W+x;
const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
let srandN=0; let srand=Math.random; const urnd=(a,b)=>a+Math.random()*(b-a), upick=a=>a[Math.floor(Math.random()*a.length)]; // browser RNG for visuals/UI
const rnd=(a,b)=>a+srand()*(b-a);
const pick=a=>a[Math.floor(srand()*a.length)];

// ---------------------------------------------------------------- audio (all sounds synthesized with Web Audio; no files)
const AUD=createAudioState(); // levels persist; Music / Ambient / Mute all always start on, off, off
function audioInit(){
  if(AUD.ctx||!PLATFORM.audioPermission()) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const C=new AC(); AUD.ctx=C;
  AUD.bus.master=C.createGain(); AUD.bus.master.connect(C.destination);
  for(const b of ['sfx','alert','amb','music']){ AUD.bus[b]=C.createGain(); AUD.bus[b].connect(AUD.bus.master); }
  applyVolumes(); startAmbient(); if(!(AUD.menuMute&&!me)) MUS.start(me?'game':'menu');
}
function applyVolumes(){ if(!AUD.ctx) return; const v=AUD.vol; AUD.bus.master.gain.value=v.mute?0:v.master; AUD.bus.sfx.gain.value=v.sfx; AUD.bus.alert.gain.value=v.alert; AUD.bus.amb.gain.value=v.ambOn?v.amb:0; AUD.bus.music.gain.value=v.musicOn?v.music:0;
  saveAudioLevels(localStorage,v); }
window.addEventListener('pointerdown',()=>{ audioInit(); if(AUD.ctx&&AUD.ctx.state==='suspended') AUD.ctx.resume().then(()=>{ const h=document.getElementById('musicHint'); if(h) h.style.display='none'; }); },{passive:true});
window.addEventListener('keydown',()=>{ audioInit(); if(AUD.ctx&&AUD.ctx.state==='suspended') AUD.ctx.resume().then(()=>{ const h=document.getElementById('musicHint'); if(h) h.style.display='none'; }); },{passive:true});
// try to start immediately: browsers allow it when the visitor arrived from our own site, and the first click covers the rest
window.addEventListener('load',()=>{ try{ audioInit(); const h=document.getElementById('musicHint'); const check=()=>{ if(!AUD.ctx) return; if(AUD.ctx.state==='running'){ if(h) h.style.display='none'; } else { if(h&&AUD.vol.musicOn) h.style.display=''; AUD.ctx.resume().catch(()=>{}); } }; check(); setTimeout(check,800); AUD.ctx.onstatechange=check; }catch(e){} });
let SND_MULT=1; // set per call by snd(): importance tier × zoom × ducking
function tone(o){ // {f, f2, dur, type, g, bus, a, when}
  if(!AUD.ctx) return; const C=AUD.ctx, t=C.currentTime+(o.when||0), osc=C.createOscillator(), g=C.createGain();
  osc.type=o.type||'sine'; osc.frequency.setValueAtTime(o.f,t); if(o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2,t+o.dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,(o.g||0.2)*SND_MULT),t+(o.a||0.01)); g.gain.exponentialRampToValueAtTime(0.0001,t+o.dur);
  osc.connect(g); g.connect(AUD.bus[o.bus||'sfx']); osc.start(t); osc.stop(t+o.dur+0.05);
}
let noiseBuf=null;
function getNoise(){ const C=AUD.ctx; if(!noiseBuf){ noiseBuf=C.createBuffer(1,C.sampleRate*2,C.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; } return noiseBuf; }
function noise(o){ // {dur, g, bus, lp, lp2, hp, a, when, q}
  if(!AUD.ctx) return; const C=AUD.ctx;
  const t=C.currentTime+(o.when||0), src=C.createBufferSource(); src.buffer=getNoise(); src.loop=true;
  let node=src; if(o.lp){ const f=C.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(o.lp,t); if(o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2,t+o.dur); f.Q.value=o.q||0.7; node.connect(f); node=f; }
  if(o.bp){ const f=C.createBiquadFilter(); f.type='bandpass'; f.frequency.setValueAtTime(o.bp,t); if(o.bp2){ if(o.bp3){ f.frequency.exponentialRampToValueAtTime(o.bp2,t+o.dur*0.45); f.frequency.exponentialRampToValueAtTime(o.bp3,t+o.dur); } else f.frequency.exponentialRampToValueAtTime(o.bp2,t+o.dur); } f.Q.value=o.q||1.2; node.connect(f); node=f; }
  if(o.hp){ const f=C.createBiquadFilter(); f.type='highpass'; f.frequency.value=o.hp; node.connect(f); node=f; }
  const g=C.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,SND_MULT*(o.g||0.2)),t+(o.a||0.01)); g.gain.exponentialRampToValueAtTime(0.0001,t+o.dur);
  node.connect(g); g.connect(AUD.bus[o.bus||'sfx']); src.start(t); src.stop(t+o.dur+0.05);
}
function onScreen(x,y){ if(x==null) return true; const px=cam.x+x*cam.s, py=cam.y+y*cam.s; return px>-60&&py>-60&&px<cv.width+60&&py<cv.height+60; }
function snd(name,x,y){
  if(!AUD.ctx||AUD.vol.mute||SAVES.catchup||REPLAY.creditsMode) return;
  const TIER={siren:'A',taps:'A',fanfare:'A',invaded:'A',impact:'A',betray:'A',request:'A',win:'A',lose:'A',pushback:'A',
    tapsq:'D',fanfareq:'D',missile_in:'A',missile_other:'D',impact_other:'C',
    shell:'C',shellhit:'C',sunk:'C',intercept:'C',interceptor:'C',shoreguns:'C',battery:'C',bertha:'C',bomb:'C',dogfight:'C',torpedo:'C',aam:'C'};
  const tier=TIER[name]||'B'; const now=performance.now();
  if(tier==='C'){ if(!onScreen(x,y)) return; AUD.cRecent=(AUD.cRecent||[]).filter(t=>now-t<1000); AUD.cRecent.push(now); const zoomK=Math.max(0.35,Math.min(1,cam.s/1.2)); const duck=1/(1+0.18*(AUD.cRecent.length-1)); SND_MULT=zoomK*duck; }
  else if(tier==='B'){ SND_MULT=(x!=null&&!onScreen(x,y))?0.6:1; }
  else if(tier==='D'){ SND_MULT=0.35; }
  else SND_MULT=1; const thr={siren:9000,taps:3000,tapsq:3000,fanfare:3000,fanfareq:3000,invaded:4000,shell:250,shellhit:250,sunk:1200,shoreguns:420,battery:400,bertha:600,bomb:250,dogfight:400,jet:800,torpedo:500,attack:300,build:150,error:300,interceptor:300,coin:900,cash:250,intercept:400}[name]; if(thr&&now-(AUD.last[name]||0)<thr) return; AUD.last[name]=now;
  switch(name){
    case 'attack': noise({dur:.35,g:.22,bp:180,bp2:90,q:1.5}); tone({f:64,f2:38,dur:.32,g:.28,a:.005}); noise({dur:.08,g:.12,hp:2500,when:.02}); break; // drum hit and snap
    case 'invaded': for(const w of [0,.45]){ tone({f:330,f2:520,dur:.22,type:'triangle',g:.07,a:.03,bus:'alert',when:w}); tone({f:335,f2:525,dur:.22,type:'triangle',g:.04,a:.03,bus:'alert',when:w}); } break; // rising klaxon, twice
    case 'missile': case 'missile_in': case 'missile_other': noise({dur:1.3,g:.4,bp:250,bp2:2600,bp3:600,q:1.8,a:.12}); tone({f:40,f2:75,dur:1.1,g:.16,a:.15}); noise({dur:.5,g:.15,lp:300,a:.02}); break; // whoosh: bandpass sweeps up through the mids and falls away
    case 'interceptor': noise({dur:.05,g:.09,hp:2500,lp:7000}); tone({f:1800,f2:900,dur:.05,g:.04,a:.003}); break; // soft launch click
    case 'impact': case 'impact_other': // deep detonation: sub-bass drop, long low rumble, a muffled crack, and a slow low-frequency tail
      tone({f:42,f2:18,dur:3.2,g:.6,a:.004}); tone({f:64,f2:26,dur:2.2,g:.35,a:.004,type:'triangle'});
      noise({dur:3.8,g:.6,lp:90,a:.02}); noise({dur:2.6,g:.35,lp:220,lp2:60,a:.01,q:1.2});
      noise({dur:.5,g:.22,lp:700,lp2:120,a:.005}); noise({dur:4.5,g:.25,lp:55,a:.4,when:.3});
      break;
    case 'intercept': noise({dur:.09,g:.14,hp:1800,lp:6000}); tone({f:400,f2:180,dur:.12,g:.07,a:.003}); break; // short pop
    case 'torpedo': noise({dur:.5,g:.12,bp:300,bp2:900,q:2,a:.05}); tone({f:90,f2:70,dur:.4,g:.05,a:.02}); break;
    case 'jet': noise({dur:.9,g:.16,bp:900,bp2:3200,bp3:1400,q:1.4,a:.15}); tone({f:120,f2:60,dur:.8,g:.05,a:.1}); break;
    case 'bomb': noise({dur:.5,g:.22,lp:220,lp2:70,a:.005}); tone({f:70,f2:35,dur:.45,g:.2,a:.003}); break;
    case 'dogfight': noise({dur:.4,g:.12,bp:1200,bp2:4200,bp3:2000,q:2,a:.02}); break;
    case 'battery': tone({f:70,f2:32,dur:.6,g:.35,a:.004}); noise({dur:.5,g:.3,lp:260,lp2:70,a:.005}); noise({dur:1.4,g:.12,bp:2500,bp2:600,q:3,a:.05,when:.1}); break; // bark and a long whistle
    case 'shoreguns': { const C=AUD.ctx, t=C.currentTime; const o=C.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(115,t+.45);
      const f=C.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; f.Q.value=2; const g=C.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.11,t+.02); g.gain.setValueAtTime(0.11,t+.38); g.gain.exponentialRampToValueAtTime(0.0001,t+.48);
      const lfo=C.createOscillator(); lfo.type='square'; lfo.frequency.value=16; const lg=C.createGain(); lg.gain.value=0.5; const bias=C.createConstantSource(); bias.offset.value=0.5; // gate: 0..1 square wave
      const gate=C.createGain(); gate.gain.value=0; lfo.connect(lg); lg.connect(gate.gain); bias.connect(gate.gain);
      o.connect(f); f.connect(gate); gate.connect(g); g.connect(AUD.bus.sfx); o.start(t); lfo.start(t); bias.start(t); o.stop(t+.5); lfo.stop(t+.5); bias.stop(t+.5);
      noise({dur:.45,g:.05,bp:2200,q:1.5,a:.02}); break; } // rotary-cannon brrrt: sawtooth gated at 16 Hz
    case 'bertha': tone({f:38,f2:16,dur:2.2,g:.55,a:.004}); noise({dur:1.6,g:.45,lp:110,a:.01}); noise({dur:2.2,g:.14,bp:3000,bp2:400,q:3,a:.1,when:.15}); break; // the deepest gun, then a falling whistle
    case 'shell': noise({dur:.35,g:.08,bp:600,bp2:2800,bp3:900,q:2,a:.02}); break;
    case 'shellhit': noise({dur:.28,g:.16,bp:1200,bp2:150,q:1}); tone({f:90,f2:45,dur:.25,g:.16,a:.003}); break;
    case 'sunk': noise({dur:.9,g:.18,bp:1400,bp2:150,q:.9,a:.02}); tone({f:80,f2:30,dur:.6,g:.16}); for(let i=0;i<6;i++) tone({f:600+Math.random()*900,f2:900+Math.random()*900,dur:.06,g:.04,a:.01,when:.25+Math.random()*.5}); break; // splash and bubbles
    case 'foghorn': tone({f:110,dur:.9,type:'triangle',g:.07,a:.15}); tone({f:165,dur:.9,g:.03,a:.2}); tone({f:220,dur:.8,g:.015,a:.2}); noise({dur:.9,g:.025,lp:350,a:.2}); break;
    case 'build': for(const w of [0,.14]){ noise({dur:.06,g:.16,bp:900,bp2:300,q:1,when:w}); tone({f:180,f2:120,dur:.1,g:.14,a:.003,when:w}); } break; // two hammer knocks
    case 'city': noise({dur:.9,g:.09,lp:1600,hp:250,a:.35}); [262,330,392].forEach((f,i)=>tone({f,dur:.9,g:.035,a:.25,when:.05+i*.04})); break;
    case 'error': tone({f:150,dur:.1,g:.09,a:.01}); noise({dur:.06,g:.04,lp:600}); break;
    case 'cash': noise({dur:.05,g:.18,hp:3500}); [2093,2637].forEach((f,i)=>{ tone({f,dur:.55,g:.09,a:.004,when:.06+i*.05}); tone({f:f*1.01,dur:.45,g:.04,a:.004,when:.06+i*.05}); }); tone({f:1568,dur:.35,g:.05,a:.004,when:.16}); break; // cha-ching: register snap then two bright bell tones
    case 'coin': tone({f:2637,dur:.22,g:.025,a:.003}); tone({f:3136,dur:.18,g:.018,a:.003,when:.06}); break; // small trade arrival
    case 'unified': [523,659,784,1047].forEach((f,i)=>{ tone({f,dur:2.2,g:.06,a:.02,when:i*.09}); tone({f:f*1.003,dur:2.2,g:.03,a:.02,when:i*.09}); }); break; // bell chord
    case 'fanfare': case 'fanfareq': { const q=1; /* herald trumpets: tonic call, dotted answer, held cadence on the fifth and octave */
      const seq=[[392,0,.22],[392,.25,.1],[392,.37,.22],[523,.62,.35],[392,1.0,.12],[523,1.15,.12],[659,1.3,.5],[784,1.85,1.1]];
      for(const [f,when,dur] of seq){ tone({f,f2:f,dur:dur+.08,g:.13*q,a:.015,when,type:'sawtooth'}); tone({f,f2:f,dur:dur+.08,g:.06*q,a:.02,when,type:'square'}); tone({f:f*2,f2:f*2,dur:dur,g:.025*q,a:.02,when,type:'sawtooth'}); }
      tone({f:587,f2:587,dur:1.2,g:.08*q,a:.05,when:1.85,type:'sawtooth'}); tone({f:392,f2:392,dur:1.2,g:.07*q,a:.05,when:1.85,type:'sawtooth'}); noise({dur:.08,g:.05*q,bp:1800,q:2,when:1.85}); break; }
    case 'siren': { for(let i=0;i<4;i++){ tone({f:420,f2:720,dur:1.1,g:.11,a:.4,when:i*2.2,type:'sawtooth',bus:'alert'}); tone({f:720,f2:420,dur:1.1,g:.11,a:.05,when:i*2.2+1.1,type:'sawtooth',bus:'alert'}); tone({f:422,f2:722,dur:1.1,g:.05,a:.4,when:i*2.2,type:'square',bus:'alert'}); tone({f:722,f2:422,dur:1.1,g:.05,a:.05,when:i*2.2+1.1,type:'square',bus:'alert'}); } break; }
    case 'taps': case 'tapsq': { const q=1; const notes=[[392,0,.35],[392,.4,.15],[523,.55,.7],[392,1.35,.35],[523,1.75,.15],[659,1.9,.9]]; for(const [f,when,dur] of notes){ tone({f,f2:f,dur:dur+.15,g:.16*q,a:.04,when,type:'triangle'}); tone({f:f*2,f2:f*2,dur:dur+.1,g:.03*q,a:.05,when,type:'sine'}); } break; }
    case 'conquered': tone({f:110,f2:40,dur:.5,g:.4,a:.003}); noise({dur:.4,g:.22,lp:500,lp2:100}); [196,247,294].forEach((f,i)=>tone({f,dur:.9,type:'triangle',g:.05,a:.12,when:.08+i*.03})); break; // timpani and a short brass swell
    case 'pushback': for(const w of [0,.3,.6]){ tone({f:290,f2:260,dur:.2,type:'triangle',g:.08,a:.02,bus:'alert',when:w}); } break;
    case 'victory': if(JUKE.loaded&&JUKE.stings.victory){ break; } [262,330,392,523,659].forEach((f,i)=>{ tone({f,dur:3,g:.07,a:.5,when:i*.22}); tone({f:f*1.004,dur:3,g:.03,a:.5,when:i*.22}); }); noise({dur:2.5,g:.05,lp:2000,hp:400,a:1}); break;
    case 'defeat': if(JUKE.loaded&&JUKE.stings.defeat){ break; } [220,196,165,131,110].forEach((f,i)=>tone({f,dur:2,g:.07,a:.4,when:i*.5})); tone({f:55,dur:4,g:.08,a:1.5,when:1}); break;
  }
}
// ---------------------------------------------------------------- music: a written menu theme and a generative in-game score
// ---------------------------------------------------------------- jukebox: site-hosted music library with a Red Alert style player
const JUKE={seq:0,list:{menu:[],game:[]},stings:{},ctx:'menu',cur:null,src:null,gain:null,mode:'order',sel:new Set(),bufs:{},loaded:false,startedAt:0,dur:0,paused:false,hist:[]};
const BUILTIN={id:'builtin',title:'Dynamic score (built-in)'};
function jukePrefs(){ try{ const p=JSON.parse(localStorage.getItem('statefall-juke')||'{}'); if(p.mode) JUKE.mode=p.mode; if(Array.isArray(p.sel)) JUKE.sel=new Set(p.sel); JUKE.known=new Set(Array.isArray(p.known)?p.known:[]); }catch(e){} }
function jukeSave(){ try{ localStorage.setItem('statefall-juke',JSON.stringify({mode:JUKE.mode,sel:[...JUKE.sel],known:[...(JUKE.known||[])]})); }catch(e){} }
async function jukeLoad(){ if(!WP||!WP.playlist) return; try{ const r=await fetch(WP.playlist,{credentials:'same-origin'}); const j=await r.json(); JUKE.list.menu=j.menu||[]; JUKE.list.game=j.game||[]; JUKE.stings=j.stings||{}; JUKE.loaded=true; jukePrefs(); JUKE.known=JUKE.known||new Set(); let changed=false; for(const t of [...JUKE.list.menu,...JUKE.list.game]){ if(!JUKE.known.has(t.id)){ JUKE.known.add(t.id); JUKE.sel.add(t.id); changed=true; } } // tracks added to the library since the last visit join the rotation automatically
    if(!JUKE.sel.size){ for(const t of [...JUKE.list.menu,...JUKE.list.game]) JUKE.sel.add(t.id); if(!JUKE.list.menu.length&&!JUKE.list.game.length) JUKE.sel.add('builtin'); changed=true; } if(changed) jukeSave(); jukeRender(); JUKE.ctx=me?'game':'menu'; if(AUD.ctx&&AUD.vol.musicOn&&!ROLL.on&&!(AUD.menuMute&&!me)) jukeStart(JUKE.ctx); }catch(e){ console.warn('[statefall] playlist unavailable',e); } }
function jukeTracks(ctx){ const real=JUKE.list[ctx]||[]; return real.length?real:[BUILTIN]; }
function jukeQueue(ctx){ const all=jukeTracks(ctx); const q=all.filter(t=>JUKE.sel.has(t.id)); return q.length?q:(all.length&&all[0].id!=='builtin'?[all[0]]:all); }
async function jukeBuf(url){ if(JUKE.bufs[url]) return JUKE.bufs[url]; const r=await fetch(url,{credentials:'same-origin'}); const ab=await r.arrayBuffer(); const b=await AUD.ctx.decodeAudioData(ab); JUKE.bufs[url]=b; return b; }
function jukeStopSrc(fade=1.2){ if(JUKE.src){ const s=JUKE.src, g=JUKE.gain, t=AUD.ctx.currentTime; try{ g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(0.0001,t+fade); s.stop(t+fade+0.05); }catch(e){} JUKE.src=null; JUKE.gain=null; } }
async function jukePlay(track,ctx){ if(!AUD.ctx) return; const seq=++JUKE.seq; JUKE.cur=track; JUKE.paused=false; jukeRender();
  if(track.id==='builtin'){ jukeStopSrc(); MUS._start(ctx); JUKE.startedAt=AUD.ctx.currentTime; JUKE.dur=240; if(JUKE.turn) clearTimeout(JUKE.turn); if(JUKE.mode!=='one'&&jukeQueue(ctx).length>1) JUKE.turn=setTimeout(()=>{ if(JUKE.cur===track&&!JUKE.paused) jukeNext(); },240000); return; }
  MUS.stop(); jukeStopSrc(); if(JUKE.turn){ clearTimeout(JUKE.turn); JUKE.turn=null; }
  let buf; try{ buf=await jukeBuf(track.url); }catch(e){ console.warn('[statefall] track failed',track.title,e); return jukeNext(); }
  if(JUKE.cur!==track||JUKE.seq!==seq) return; // superseded while loading
  jukeStopSrc();
  if(me&&!ROLL.on&&!CUSTOM.previewing&&JUKE.lastAnnounced!==track.id){ JUKE.lastAnnounced=track.id; songBanner=({title:track.title,age:0,life:70}); }
  const src=AUD.ctx.createBufferSource(); src.buffer=buf; const g=AUD.ctx.createGain(); const t=AUD.ctx.currentTime; g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(1,t+1.5); src.connect(g); g.connect(AUD.bus.music);
  src.loop=JUKE.mode==='one'&&!JUKE.hold; JUKE.src=src; JUKE.gain=g; JUKE.startedAt=t; JUKE.dur=buf.duration; src.onended=()=>{ if(JUKE.src!==src||JUKE.paused||JUKE.hold) return; if(JUKE.mode==='one'){ jukePlay(track,JUKE.ctx); } else jukeNext(1); }; src.start(t); }
function jukeStart(ctx){ const same=JUKE.ctx===ctx; JUKE.ctx=ctx; const q=jukeQueue(ctx); if(!q.length) return; let t=q[0]; if(JUKE.mode==='shuffle') t=upick(q); else if(same&&JUKE.cur&&q.includes(JUKE.cur)) t=JUKE.cur; if(JUKE.cur===t&&JUKE.src&&same) return; jukePlay(t,ctx); }
function jukeNext(dir=1){ const q=jukeQueue(JUKE.ctx); if(!q.length) return; let i=q.indexOf(JUKE.cur); let t; if(JUKE.mode==='shuffle'&&q.length>1){ do{ t=upick(q); }while(t===JUKE.cur); } else t=q[((i<0?0:i)+dir+q.length)%q.length]; jukePlay(t,JUKE.ctx); }
function jukePause(){ if(!AUD.ctx) return; if(JUKE.paused){ JUKE.paused=false; if(JUKE.cur) jukePlay(JUKE.cur,JUKE.ctx); else jukeStart(JUKE.ctx); } else { JUKE.paused=true; jukeStopSrc(0.3); MUS.stop(); } jukeRender(); }
function jukeStingPick(kind){ const v=JUKE.stings&&JUKE.stings[kind]; if(!v) return null; return Array.isArray(v)?(v.length?upick(v):null):v; }
async function jukeSting(kind){ const st=jukeStingPick(kind); if(!st||!AUD.ctx) return false; try{ const buf=await jukeBuf(st.url); const t=AUD.ctx.currentTime; if(JUKE.gain){ JUKE.gain.gain.setValueAtTime(JUKE.gain.gain.value,t); JUKE.gain.gain.linearRampToValueAtTime(0.15,t+0.4); JUKE.gain.gain.setValueAtTime(0.15,t+buf.duration-0.5); JUKE.gain.gain.linearRampToValueAtTime(1,t+buf.duration+1); } const s=AUD.ctx.createBufferSource(); s.buffer=buf; s.connect(AUD.bus.music); s.start(t); return true; }catch(e){ return false; } }
function jukeRender(){ const box=$('jukeBox'); if(!box) return; { const mp=$('miniPlayer'); if(mp){ mp.style.display=(JUKE.loaded&&me)?'':'none'; const now=$('mpNow'); if(now){ const el=JUKE.src&&AUD.ctx?Math.max(0,AUD.ctx.currentTime-JUKE.startedAt):0; const fm=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'); now.textContent=(JUKE.paused?'▮▮ ':'♪ ')+(JUKE.cur?JUKE.cur.title:'—')+(JUKE.dur&&JUKE.src?' · '+fm(el)+' / '+fm(JUKE.dur):''); } } } if(!JUKE.loaded){ box.style.display='none'; return; } box.style.display='';
  const q=jukeTracks(JUKE.ctx); const now=JUKE.cur?JUKE.cur.title:'—'; const el=JUKE.src&&AUD.ctx?Math.max(0,AUD.ctx.currentTime-JUKE.startedAt):0; const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  $('jukeNow').innerHTML=`<b>${JUKE.paused?'▮▮ ':''}${now}</b>${JUKE.dur&&(JUKE.src||(JUKE.cur&&JUKE.cur.id==='builtin'))?` <span class="muted">${fmt(el)} / ${fmt(JUKE.dur)}</span>`:''}`;
  $('jukeMode').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.mode===JUKE.mode));
  const row=t=>`<label style="display:flex;gap:6px;align-items:center;padding:1px 0;font-size:12px;${JUKE.cur===t?'color:#ffd27a':''}"><input type="checkbox" data-jt="${t.id}" ${JUKE.sel.has(t.id)?'checked':''}> <span style="flex:1;cursor:pointer" data-jp="${t.id}">${t.title}</span>${t.seconds?`<span class="muted">${fmt(t.seconds)}</span>`:''}</label>`;
  const head=(k,label)=>`<div style="margin:6px 0 2px;font-size:11px;letter-spacing:1px;color:${JUKE.ctx===k?'#ffd27a':'#8fa3b8'};display:flex;justify-content:space-between"><span>${label}${JUKE.ctx===k?' · playing':''}</span><span style="letter-spacing:0"><a href="#" data-jall="${k}">all</a> · <a href="#" data-jnone="${k}">none</a></span></div>`;
  $('jukeList').innerHTML=head('menu','PRE-GAME')+jukeTracks('menu').map(row).join('')+head('game','IN-GAME')+jukeTracks('game').map(row).join('');
  $('jukeList').querySelectorAll('[data-jt]').forEach(c=>c.onchange=()=>{ if(c.checked) JUKE.sel.add(c.dataset.jt); else JUKE.sel.delete(c.dataset.jt); jukeSave(); jukeRender(); });
  $('jukeList').querySelectorAll('[data-jall]').forEach(a=>a.onclick=e=>{ e.preventDefault(); for(const t of jukeTracks(a.dataset.jall)) JUKE.sel.add(t.id); jukeSave(); jukeRender(); });
  $('jukeList').querySelectorAll('[data-jnone]').forEach(a=>a.onclick=e=>{ e.preventDefault(); for(const t of jukeTracks(a.dataset.jnone)) JUKE.sel.delete(t.id); jukeSave(); jukeRender(); });
  $('jukeList').querySelectorAll('[data-jp]').forEach(sp=>sp.onclick=()=>{ const t=[...jukeTracks('menu'),...jukeTracks('game')].find(x=>x.id===sp.dataset.jp); if(t){ audioInit(); jukePlay(t,JUKE.ctx); } }); }

// ---------------------------------------------------------------- match record: counters, timeline, superlatives → credit roll
function showNotice(o){ const box=$('notices'); if(!box||SAVES.catchup||REPLAY.creditsMode||REPLAY.on&&o.buttons) return null; const n=document.createElement('div'); n.className='notice '+(o.kind||''); if(o.flag){ const img=document.createElement('img'); img.src=flagURL(o.flag); img.alt=''; n.appendChild(img); } const text=document.createElement('div'),title=document.createElement('b'),detail=document.createElement('span'); text.className='t'; title.textContent=o.title||''; detail.textContent=o.text||''; text.appendChild(title); text.appendChild(detail); n.appendChild(text); for(const b of (o.buttons||[])){ const bt=document.createElement('button'); bt.textContent=b.label; if(b.primary) bt.style.background='#2f5a8c'; bt.onclick=()=>{ n.remove(); if(b.onClick) b.onClick(); }; n.appendChild(bt); } if(!o.buttons||!o.buttons.length||o.closeable!==false){ const x=document.createElement('button'); x.textContent='✕'; x.title='Dismiss'; x.style.padding='4px 8px'; x.onclick=()=>n.remove(); n.appendChild(x); } box.appendChild(n); while(box.children.length>4) box.firstChild.remove(); if(o.ttl!==0) setTimeout(()=>{ if(n.parentNode) n.remove(); },o.ttl||9000); return n; }
function invasionNotice(p,t,naval){ if(!me||over) return; const k='inv'+p.id; const now=performance.now(); if((notedAt[k]||0)+60000>now) return; notedAt[k]=now; showNotice({kind:'warn',flag:p.flag,title:`You are being invaded by ${p.name}`,text:naval?'A landing force is coming ashore.':'Ground forces are crossing your border.',buttons:[{label:'Take me there',primary:true,onClick:()=>goTo(t)}],ttl:12000}); }
const notedAt={};
function goTo(t){ const x=t%W,y=(t-x)/W; cam.s=Math.max(cam.s,2.2); cam.x=cv.width/2-(x+.5)*cam.s; cam.y=cv.height/2-(y+.5)*cam.s; }
const STATS={c:{},tl:[],nukedBy:{},campaigns:{},bigLoss:{n:0,by:''}};
function sInc(k,n=1){ STATS.c[k]=(STATS.c[k]||0)+n; }
function sMin(){ return Math.max(0,((userPaused?pausedAt:performance.now())-startTime)/60000); }
function sEvent(text,kind='note'){ if(STATS.tl.length<200) STATS.tl.push({m:Math.round(sMin()*10)/10,t:text,k:kind}); }
function statsSnapshot(title){
  const c=STATS.c; const rivals=players.filter(p=>p.kind==='bot').map(p=>({name:p.name,flag:p.flag,alive:p.alive,land:Math.round(p.tiles/landCount*1000)/10,peak:Math.round(p.peakTroops||p.troops||0),killedBy:p.killedBy!=null?players[p.killedBy].name:null,diedAt:p.diedAt!=null?Math.round((p.diedAt*TICK/60000)*10)/10:null}));
  const fallen=players.filter(p=>p.kind!=='neutral'&&!p.alive&&p.killedBy!=null).map(p=>({name:p.name,flag:p.flag,by:players[p.killedBy].name,m:p.diedAt!=null?Math.round((p.diedAt*TICK/60000)*10)/10:null}));
  let nemesis=null,nn=0; for(const k in STATS.nukedBy) if(STATS.nukedBy[k]>nn){ nn=STATS.nukedBy[k]; nemesis=k; }
  let longest=null,ln=0; for(const k in STATS.campaigns){ const d=STATS.campaigns[k].end!=null?STATS.campaigns[k].end-STATS.campaigns[k].start:0; if(d>ln){ ln=d; longest=k; } }
  const hon=[]; if(nemesis) hon.push(`Nemesis: ${nemesis} — nuked you ${nn} time${nn>1?'s':''}`); if(longest&&ln>=1) hon.push(`Longest campaign: ${longest}, ${ln.toFixed(1)} min`); if(STATS.bigLoss.n>0) hon.push(`Heaviest single loss: ${fmtN(STATS.bigLoss.n)} troops to ${STATS.bigLoss.by}`);
  if((c.shipsSunk||0)>=5) hon.push(`Admiral: ${c.shipsSunk} enemy ships sunk`); if((c.intercepts||0)>=5) hon.push(`Iron dome: ${c.intercepts} missiles shot down`); if((c.continents||0)>=1) hon.push(`Unifier: ${c.continents} continent${c.continents>1?'s':''}`); if((c.merchantsCaptured||0)>=3) hon.push(`Privateer: ${c.merchantsCaptured} merchants taken`); if((c.planesDown||0)>=3) hon.push(`Ace: ${c.planesDown} aircraft shot down`);
  // flags only for nations that appear in the roll: rivals, the fallen, and anyone named in the timeline
  const named=new Set([...rivals.map(r=>r.name),...fallen.map(f=>f.name),...Object.keys(STATS.nukedBy)]); for(const e of STATS.tl) for(const p of players) if(p.kind!=='neutral'&&e.t.includes(p.name)) named.add(p.name);
  const flags={}; for(const p of players) if(named.has(p.name)) flags[p.name]=p.flag;
  return {v:1,title,name:me.name,player:(WP&&WP.user)?WP.user.name:me.name,flag:me.flag,flags,color:me.color,result:title,minutes:Math.round(sMin()*10)/10,land:Math.round(me.tiles/landCount*1000)/10,c,tl:STATS.tl,hon,rivals,fallen,seed:START.seed,map:START.map,diff:chosen,cls:matchClass()};
}
// ---- the roll
const ROLLIMG={}; function rollImg(key){ if(ROLLIMG[key]) return ROLLIMG[key]; if(typeof Image==='undefined') return null; let url=''; const col='#7fb3ff'; if(key.startsWith('ship:')) url=shipURL(key.slice(5),col); else if(key.startsWith('air:')) url=airURL(key.slice(4),col); else if(key==='skull'||key==='star'||key==='medal'||key==='hands'||key==='heart'||key==='flag'){ const c=document.createElement('canvas'); c.width=40; c.height=40; const x=c.getContext('2d'); x.translate(20,20); if(key==='hands') drawHandshake(x,0,0,16); else if(key==='heart') drawBrokenHeart(x,0,0,16); else { x.fillStyle='#0f1a26'; x.beginPath(); x.arc(0,0,17,0,6.3); x.fill(); x.strokeStyle='#ffd27a'; x.lineWidth=2; x.stroke(); x.fillStyle='#ffd27a'; x.strokeStyle='#ffd27a'; if(key==='star'||key==='medal'){ x.beginPath(); for(let i=0;i<10;i++){ const ang=-Math.PI/2+i*Math.PI/5, rr=i%2?4:10; x.lineTo(Math.cos(ang)*rr,Math.sin(ang)*rr); } x.closePath(); x.fill(); } else if(key==='skull'){ x.beginPath(); x.arc(0,-2,8,Math.PI,0); x.lineTo(8,4); x.lineTo(-8,4); x.closePath(); x.fill(); x.fillRect(-6,4,12,4); x.fillStyle='#0f1a26'; x.beginPath(); x.arc(-3.5,-2,2.2,0,6.3); x.arc(3.5,-2,2.2,0,6.3); x.fill(); x.fillRect(-1,1,2,3); } else { x.fillRect(-8,-9,2,18); x.beginPath(); x.moveTo(-6,-9); x.lineTo(9,-5); x.lineTo(-6,-1); x.closePath(); x.fill(); } } url=c.toDataURL(); } else url=iconURL(key,col); const im=new Image(); im.src=url; ROLLIMG[key]=im; return im; }
const ROLL={on:false,data:null,lines:[],y:0,h:0,dur:90,t0:0,paused:false,drift:0,done:false,watch:false};
const QUOTES_SERIOUS_WIN=["A hard campaign, fairly fought. They earned the map.","We were beaten by a better plan. There is no dishonour in that.","I have written to their general. I called it a masterclass. I meant it.","Our soldiers held as long as soldiers can. The rest was strategy, and it was theirs.","They took the coast, the continent, and our respect, in that order.","I would serve under that command. Tell them so.","History will record the victor. It should also record that we did not yield cheaply.","Whatever they teach at their academy, we should teach it at ours.","They saw the whole board. We saw our corner of it.","The war is over. The lessons are not.","Their navy was patient and their timing was exact. That is generalship.","We fought well. They fought better. That is the whole of it."];
const QUOTES_SERIOUS_LOSE=["They came with courage and left with our regard. The map, however, is ours.","A determined enemy. On another day, with another plan, they might have had it.","We do not gloat. We hold the coast, and we note who tried to take it.","Their landings were brave. Bravery is not a supply line.","I salute the general. I keep the province.","They will be back, and we will be ready, and it will be a fair fight again.","Our thanks to the enemy for a war worth the name.","They lost with discipline. It counts for something. Not for territory.","We respect the attempt. We defend the result.","A worthy opponent, and a settled matter.","Their army fought for every tile. So did ours. Ours are still standing on them.","Let the record show it was close, and let the map show who held."];
const QUOTES_BRUTAL_WIN=["We had a plan. They had a plan for our plan. We are no longer permitted plans.","I told the capital they were bluffing. The capital is now their capital.","Our fleet was the pride of the nation. It is now a reef.","I have been asked what went wrong. I have been asked this by the enemy, from my office.","We fired every missile we had. They sent a bomber to thank us.","Our neutrals joined them. Our allies joined them. I am considering joining them.","They took our ports before breakfast. By lunch they had opinions about our cooking.","I would call it a defeat, but that implies we were in it.","Every general has one war they cannot explain. Mine has a seed number.","They did not need a second army. I am told they built one out of habit.","We surrendered by radio. They had already replied by land.","There will be an inquiry. I have asked them to hold it somewhere we still own."];
const GENERALS=['Vasquez','Okonkwo','Lindqvist','Haddad','Petrov','Nakamura','Ferreira','Bianchi','Marchetti','O\u2019Rourke','Dlamini','Aydin','Kowalski','Rasmussen','Delacroix','Tanaka','Mbeki','Castellanos','Ivanova','Brandt'];
const ARMIES=['1st Army','3rd Fleet','5th Armoured','Coastal Command','2nd Airborne','7th Marines','Home Guard','Northern Front','Grand Fleet','Missile Corps'];
const QUOTES_WIN=[
"Never seen such a tough general. I\u2019ll get you next time.",
"We had the coast, the guns and the numbers. We did not have whatever that was.",
"I have seen many invasions. I have not seen one arrive from three directions at once, on purpose.",
"Our SAM crews would like it known that they fired at everything. Everything.",
"Tell the ministry the shield held. Then tell them what came over it.",
"The map was ours for eleven minutes. History will remember the other fourteen.",
"I advised surrender at 0:40. I was overruled. I was right.",
"My compliments. My resignation. In that order.",
"We were promised a rival. We were sent a weather system.",
"There is no shame in losing to that. There is considerable paperwork.",
"We held the river. They took the river. We are now discussing the river.",
"In my report I have listed the cause of defeat as \u2018the enemy\u2019. It seemed sufficient.",
"I have commanded for thirty years. I would like the last twenty minutes struck from the record.",
"Our intelligence said they had no navy. Our intelligence has been reassigned to the navy they didn\u2019t have.",
"They unified the continent while we were arguing about the border. The border is no longer an issue.",
"I ordered the fleet to sea. It went to sea. It is still at sea, in pieces.",
"We called it an impregnable coast. They called it Tuesday.",
"Whoever taught that general to use transports should be arrested. Then promoted.",
"The shore guns fired until they were overrun. I am told the overrunning took nine seconds.",
"We requested reinforcements from the capital. The capital was, by then, theirs.",
"They built a battery within range of our port and simply waited. Waiting is a weapon. I did not know that.",
"Our merchant fleet has been captured, twice, and returned to us as the enemy\u2019s.",
"I am filing this from a very small island. It is the last one.",
"Their missile command was patient. Ours was expensive. There is a difference.",
"We saw the spy plane. We shot at the spy plane. The spy plane saw us back.",
"A lesser commander would blame the terrain. I blame the terrain and the commander.",
"Their bombers ignored our air defence entirely. Our air defence has taken it personally.",
"We were allies for three minutes. I have had longer conversations with the enemy.",
"I told the capital they would come by sea. They came by sea. I was not congratulated.",
"Our fighters were recalled in time. Our generals were not.",
"They did not so much invade as arrive.",
"Somewhere in there was a plan. We never found it, but we were certainly standing on it.",
"I have signed the surrender. I would like to note that the pen was also theirs.",
"They took the ports first. The rest was arithmetic.",
"Our garrison was adequate for a normal enemy. Please send a normal enemy.",
"History will say we were outnumbered. History is being generous.",
"I asked for a shield generator. I got one. It was very impressive for eleven seconds.",
"We should have watched the transports. We were watching the missiles. There were also transports.",
"My staff assure me the retreat was orderly. My staff are no longer in contact.",
"They landed at night. It was not night. It just felt that way.",
"If there is a next time, I would like to be on their side.",
"They marched our army into the sea and then, I am told, sank the sea.",
"Send my regards to the victor and my luggage to the coast.",
"The dome held nine missiles. The tenth was a bomber.",
"I have lost wars before. I have not previously lost one to a supply line.",
"Their engineers repaired faster than we could break. We now break slower, out of respect.",
"We hoped for a stalemate. We were not consulted.",
"I would call it a rout, but a rout implies we were running somewhere.",
"Our defeat was total, efficient, and slightly ahead of schedule.",
"Tell the next general: the neutrals remember. So does that one."
];
const QUOTES_LOSE=[
"I have fought children\u2019s birthday parties with better strategy.",
"They landed troops. On our beach. Facing our guns. It was not a fair fight and it was not us who suffered.",
"We have named a lake after their invasion. It is a small lake.",
"I would call it a campaign, but campaigns have a plan.",
"Their navy arrived one transport at a time. We were grateful for the practice.",
"We never found their capital. We are not certain they did either.",
"I was told they had a billion troops once. Where did they put them?",
"Our neutrals mobilised. Their neutrals also mobilised. Against them.",
"The shield generator was a nice touch. The missiles went around it.",
"Please send them again. Morale has never been higher.",
"Their bombers were very stealthy. We only saw them on the way down.",
"Tell them the continent is unified. Under us.",
"They declared war at 2:10 and peace at 2:11. We accepted both.",
"I have had harder fights with my quartermaster.",
"They attacked at fifty percent. We would have preferred a hundred. It would have been over sooner.",
"Their spy plane found nothing. To be fair, there was nothing to find on their side either.",
"We were warned of a great general. We met a great deal of general.",
"They sent a privateer. We sent it back with a receipt.",
"Their fleet was impressive. It looked much larger before it met ours.",
"I would offer terms, but I don\u2019t believe they read.",
"Their missile command held fire until it was affordable. It is still holding.",
"They called it a beachhead. We called it a picnic.",
"We captured their transports, their merchants and, at one point, their attention.",
"If ambition were territory they would own the map. It is not, and they do not.",
"They unified an island. It was a very good island. It is ours now.",
"We heard a rumour they had built a shield. We heard it from the bomber crew.",
"Their pacts lasted longer than their armies. This is not the compliment it sounds like.",
"They surrendered the coast to save the interior. The interior sends its regards from our capital.",
"Please inform their general that the river was never a border. It was a suggestion.",
"I have written a manual on their tactics. It is one page. It is blank.",
"They fought bravely, briefly, and in the wrong place.",
"We were told to expect a counter-invasion. We are still expecting it.",
"They built a Big Bertha. It was aimed at us. That is the last thing it did.",
"Their air force was stealthy enough that we sometimes forgot it was losing.",
"They had the numbers. We had the map. Look at the map.",
"Their economy slider was set to gold. Their army noticed.",
"I would like to thank the enemy for the ports. We have no use for their ships.",
"They paused. We did not. That is the whole report.",
"Somebody told them coastal batteries outrange battleships. Somebody did not tell them where our batteries were.",
"They came to our shores as an invasion and left as a lesson.",
"Their general fought like a man reading the instructions for the first time. Mid-battle.",
"We are keeping their flag. It matches the curtains.",
"I have seen more resistance from the neutrals.",
"They took a province. We took the rest.",
"Their submarines were invisible. So, eventually, was their fleet.",
"Please tell them we accept their surrender, their gold, and their seed. We\u2019ll play it again.",
"They spent nine minutes building and one minute losing. An efficient schedule.",
"I did not need my second army. I did not need my first.",
"They repaired the dome three times. We only needed the fourth.",
"Next time, tell them, bring a plan. Or a bigger map."
];
function quoteMemory(){ try{ return JSON.parse(localStorage.getItem('statefall-quotes-seen')||'[]'); }catch(e){ return []; } }
function rollQuote(d,won,usedNames,usedQuotes,tone='wry'){ const rivals=(d.rivals||[]).filter(r=>!usedNames.has(r.name)); const r=rivals.length?upick(rivals):(d.rivals&&d.rivals.length?upick(d.rivals):null); if(!r) return null; usedNames.add(r.name);
  const bank=tone==='serious'?(won?QUOTES_SERIOUS_WIN:QUOTES_SERIOUS_LOSE):tone==='brutal'?(won?QUOTES_BRUTAL_WIN:QUOTES_LOSE):(won?QUOTES_WIN:QUOTES_LOSE); const seen=new Set(quoteMemory()); let pool=bank.filter(q=>!usedQuotes.has(q)&&!seen.has(q)); if(!pool.length) pool=bank.filter(q=>!usedQuotes.has(q)); if(!pool.length) pool=bank; const q=upick(pool); usedQuotes.add(q);
  try{ const mem=quoteMemory().filter(x=>x!==q); mem.push(q); localStorage.setItem('statefall-quotes-seen',JSON.stringify(mem.slice(-60))); }catch(e){}
  return {k:'quote',text:q,who:`General ${upick(GENERALS)}`,unit:`${upick(ARMIES)}, ${r.name}`,flagName:r.name}; }
function rollLines(d){ const L=[]; const won=/ictory/.test(d.result||''); const H=(t,icon)=>L.push({t,k:'h',icon}); const P=(t,s,icon)=>L.push({t,s,k:'p',icon}); const G=(n=1)=>{ for(let i=0;i<n;i++) L.push({k:'gap'}); }; const mm=v=>v==null?'':`${Math.floor(v)}:${String(Math.round((v%1)*60)).padStart(2,'0')}`; const used=new Set(), usedQ=new Set(); let firstQ=true; const Q=()=>{ const q=rollQuote(d,won,used,usedQ,tone); if(q){ if(firstQ&&cu&&cu.quote){ q.reply=true; } firstQ=false; G(); L.push(q); G(); } };
  const cu=d.custom||null; const tone=cu?cu.tone:'wry';
  L.push({k:'open'}); L.push({k:'star',won});
  if(cu&&cu.quote){ L.push({k:'pquote',text:cu.quote,who:d.player||d.name,title:cu.title||'Supreme Commander',nation:d.name}); }
  L.push({k:'title'}); G();
  if(d.tl.length){ H('THE CAMPAIGN','city'); for(const e of d.tl) P(e.t,mm(e.m),e.k==='nuke'?'silo':e.k==='unify'?'flag':e.k==='kill'?'fort':e.k==='diplo'?'hands':e.k==='death'?'skull':e.k==='milestone'?'star':null); Q(); }
  const c=d.c; const per=(n)=>d.minutes&&n>=5?` — one every ${(d.minutes*60/n).toFixed(0)} s`:'';
  const rows=[['Provinces taken',c.conquests,'fort',per(c.conquests||0)],['Countries eliminated',c.kills,'skull'],['Continents unified',c.continents,'flag'],['Islands unified',c.islands,'flag'],['Peak army',c.peak,'city'],['Gold earned',c.gold,'factory'],['Buildings built',c.built,'factory'],['Missiles launched',c.missiles,'silo'],['Missiles shot down',c.intercepts,'sam'],['Nukes taken',c.nuked,'silo'],['Ships built',c.shipsBuilt,'ship:warship'],['Ships sunk',c.shipsSunk,'ship:cruiser'],['Ships lost',c.shipsLost,'ship:transport'],['Landings',c.landings,'ship:transport'],['Merchants captured',c.merchantsCaptured,'ship:privateer'],['Aircraft built',c.planesBuilt,'air:fighter'],['Aircraft shot down',c.planesDown,'air:fighter'],['Aircraft lost',c.planesLost,'air:bomber'],['Bombs dropped',c.bombs,'air:bomber'],['Paradrops',c.paradrops,'air:carrier'],['Pacts signed',c.pacts,'hands'],['Alliances',c.alliances,'hands'],['Betrayed',c.betrayed,'heart'],['Betrayals',c.betrayals,'heart']].filter(r=>r[1]);
  if(rows.length){ H('BY THE NUMBERS','factory'); for(const [a,b,ic,extra] of rows) P(a+(extra||''),fmtN(b),ic); Q(); }
  if(d.hon&&d.hon.length){ H('HONOURS','star'); for(const h of d.hon) P(h,'','medal'); Q(); }
  if(cu&&cu.nemesis&&(d.rivals||[]).some(r=>r.name===cu.nemesis)){ const r=d.rivals.find(x=>x.name===cu.nemesis); L.push({k:'nemesis',name:r.name,fate:r.alive?`survived with ${r.land}% of the land`:(r.killedBy?`fell to ${r.killedBy===d.name?'you':r.killedBy}`:'was eliminated'),peak:r.peak,nuked:(d.c&&d.c.nuked)||0}); const q=rollQuote(Object.assign({},d,{rivals:[r]}),won,new Set(),usedQ,tone); if(q){ G(); L.push(q); } G(); }
  if(cu&&cu.highlight>=0&&d.tl&&d.tl[cu.highlight]){ const e=d.tl[cu.highlight]; L.push({k:'highlight',text:e.t,m:e.m}); G(); }
  if(d.rivals&&d.rivals.length){ H('ALSO STARRING','flag'); for(const r of d.rivals){ const fate=r.alive?`survived with ${r.land}% of the land`:(r.killedBy?`fell to ${r.killedBy===d.name?'you':r.killedBy}${r.diedAt!=null?' at '+mm(r.diedAt):''}`:'was eliminated'); P(`${r.name} — ${fate}`,'peak '+fmtN(r.peak),'flag:'+r.name); } G(); }
  if(d.fallen&&d.fallen.length){ H('FALLEN NATIONS','skull'); for(const f of d.fallen) P(`${f.name} — killed by ${f.by===d.name?'you':f.by}`,mm(f.m),'flag:'+f.name); Q(); }
  G(); L.push({k:'card',lines:['PRODUCED AND DIRECTED BY','Ken Knorr']}); G();
  L.push({k:'card',lines:['MUSIC','the WorldRTS.com library']}); G();
  L.push({k:'disc'}); G();
  L.push({k:'end',won,dedication:cu&&cu.dedication?cu.dedication:'',goad:won?upick(['The map will not stay yours.','Somewhere, a bot is rebuilding its navy.','Seventy-two percent is not a hundred.','They are already drafting the counter-invasion.']):upick(['They are still out there. Take it back.','The seed is below. The map owes you one.','Every general in these credits is laughing. Prove them wrong.','Same map. Same seed. Different ending.'])}); return L; }
const DISCLAIMER=["No artificial intelligences were harmed in the making of this game.","Several were mildly inconvenienced.","The bots you defeated have been debriefed, offered tea, and reassured that it was not personal.","Any resemblance between the nations in this game and actual nations is coincidental, approximate, and frankly a little flattering to some of them.","The continents are procedural. The rivers are procedural. The grudges held by the neutrals are entirely real.","No transports were sunk without a reasonable expectation of being sunk.","The missile command AI would like it noted that it 'held fire until the salvo was affordable' and that this was the correct decision.","Shield generators are 100% effective against everything they are 100% effective against.","Coastal batteries outrange battleships. Battleships have been informed.","If you played this on Billionaire mode, the leaderboard has quietly filed your score under 'well, obviously'.","Repair trucks work an eight-second pip and will not be rushed.","Fighter pilots who were recalled in time thank you. The others have been converted to pips.","The seed for this match is printed below so that you can do it all again, or prove it was the map's fault.","This disclaimer is longer than strictly necessary and was written by an assistant that enjoyed doing it.","Thank you for playing."];
function beginCredits(d,song,watch=false){ try{ audioInit(); }catch(e){}
  ROLL.data=d; ROLL.lines=rollLines(d); ROLL.watch=watch; ROLL.done=false; ROLL.paused=false; ROLL.y=0; ROLL.drift=0; ROLL.playBox=null; ROLL.skipBox=null; ROLL.replay=!!(watch&&ROLL.watchReplay&&REPLAY.creditsMode); ROLL.speedSet=false;
  // a live match replays itself behind the roll: restart from the seed and feed the recorded orders at a pace that ends with the credits
  if(!watch&&!REPLAY.on&&CMD.log.length&&over){ try{ ROLL.saved={title:ovTitle.textContent,text:ovText.textContent,post:(document.getElementById('ovPost')||{}).textContent||'',tick:tickN,log:CMD.log.slice(),hashes:CMD.hashes.slice()}; REPLAY.on=true; REPLAY.creditsMode=true; REPLAY.cmds=ROLL.saved.log; REPLAY.i=0; REPLAY.hashes=ROLL.saved.hashes; REPLAY.hashv=2; REPLAY.mismatch=false; REPLAY.toTick=ROLL.saved.tick; REPLAY.resume=false; ROLL.replay=true; ROLL.on=true; resetWorld(); $('startBtn').click(); overlay.style.display='none'; }catch(e){ console.warn('[statefall] credits replay',e); ROLL.replay=false; REPLAY.on=false; REPLAY.creditsMode=false; } }
  ROLL.dur=90; ROLL.t0=performance.now(); ROLL.on=true; overlay.style.display='none'; $('side').classList.add('rolling'); JUKE.hold=true; MUS.stop(); jukeStopSrc(0.4); if(AUD.ctx){ ROLL.musicWas=AUD.vol.musicOn; AUD.bus.music.gain.value=AUD.vol.mute?0:Math.max(AUD.vol.music,0.25); } cv.style.cursor='default'; hover=-1; hoverShip=null; hoverStruct=null; tip.style.display='none'; hideCtx();
  // the song joins when it is ready; the roll never waits on the network
  (async()=>{ try{ if(song&&song!=='builtin'&&JUKE.loaded&&AUD.ctx){ const t=[...Object.values(JUKE.stings||{}).flat(),...JUKE.list.game,...JUKE.list.menu].find(x=>x&&x.id===song); if(t){ const buf=await Promise.race([jukeBuf(t.url),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),6000))]); if(!ROLL.on) return; ROLL.dur=t.seconds||buf.duration||90; JUKE.mode='one'; await jukePlay(t,'game'); if(JUKE.src) JUKE.src.loop=false; return; } }
      if(AUD.ctx&&ROLL.on) MUS._start('menu'); }catch(e){ console.warn('[statefall] credits music',e); if(AUD.ctx&&ROLL.on) MUS._start('menu'); } })(); }
async function watchCredits(id){ try{ const r=await fetch(WP.rest+'scores/'+encodeURIComponent(id),{credentials:'same-origin'}); const j=await r.json(); if(!r.ok||!j.stats) throw new Error(j.message||'no stats'); const d=j.stats; d.name=d.name||j.country; d.player=d.player||(j.user&&j.user.name)||d.name; if(j.custom) d.custom=j.custom; const qs2=new URLSearchParams(location.search); const wantEdit=qs2.get('edit')==='1'&&WP.user&&j.user&&WP.user.id===j.user.id; lastPostId=j.id; lastStats=d; // set up the map from the record's seed so the roll has a backdrop
    let rep=null; try{ const rr=await fetch(WP.rest+'scores/'+encodeURIComponent(id)+'/replay',{credentials:'same-origin'}); if(rr.ok){ const rj=await rr.json(); if(rj&&rj.data&&Array.isArray(rj.data.cmds)) rep=rj.data; } }catch(e){}
    if(rep&&!wantEdit){ applySettings(rep.settings||{}); $('seedIn').value=rep.seed||j.seed; REPLAY.on=true; REPLAY.creditsMode=true; REPLAY.cmds=rep.cmds; REPLAY.i=0; REPLAY.hashes=rep.hashes||[]; REPLAY.hashv=rep.hashv||1; REPLAY.mismatch=false; REPLAY.toTick=rep.tick||0; REPLAY.resume=false; ROLL.watchReplay=true; ROLL.on=true; resetWorld(); $('startBtn').click(); $('start').style.display='none'; $('overlay').style.display='none'; }
    else { $('seedIn').value=j.seed; START.map=j.map; document.querySelectorAll('#maps button').forEach(x=>x.classList.toggle('on',x.dataset.m===START.map)); const ci=COUNTRIES.findIndex(c=>c.name===j.country); if(ci>=0){ chosenFlag=countryByIdx(ci); $('countrySel').value=ci; }
    $('startBtn').click(); userPaused=true; pausedAt=performance.now(); $('start').style.display='none'; $('overlay').style.display='none'; spectating=true; over=true; }
    { const cl=document.getElementById('credLoad'); if(cl) cl.remove(); }
    setTimeout(()=>{ if(wantEdit){ openBuilder(d,j.custom||null); return; } const st=jukeStingPick(/ictory/.test(d.result||'')?'victory':'defeat')||jukeStingPick('credits'); beginCredits(d,(d.custom&&d.custom.song)||(st?st.id:'builtin'),true); },600); }catch(e){ console.warn('[statefall] credits unavailable',e); const cl=document.getElementById('credLoad'); if(cl) cl.textContent='Could not load those credits.'; } }
function rollSeek(sec){ if(ROLL.paused){ ROLL.t0-=sec*1000; const now=ROLL.pausedAt; if(now-ROLL.t0<0) ROLL.t0=now; } else { ROLL.t0-=sec*1000; if(performance.now()-ROLL.t0<0) ROLL.t0=performance.now(); } ROLL.done=false; }
function rollTogglePause(){ if(ROLL.paused){ ROLL.t0+=performance.now()-ROLL.pausedAt; ROLL.paused=false; if(AUD.ctx) AUD.ctx.resume(); } else { ROLL.paused=true; ROLL.pausedAt=performance.now(); if(AUD.ctx) AUD.ctx.suspend(); } }
function resetWorld(){ players=[]; attacks=[]; missiles=[]; structures=[]; transports=[]; warships=[]; shots=[]; interceptors=[]; shells=[]; links=[]; traders=[]; aircraft=[]; trucks=[]; planes=[]; vis=null; radarLayer=null; satUntil=0; satCool=0; planeCool=0; myBorders=new Set(); for(const k in hostile) delete hostile[k]; proposals=[]; badges=[]; nukeAlerts=[]; songBanner=null; flashes=[]; floaters=[]; sparks=[]; puffs=[]; wrecks=[]; frags=[]; tracers=[]; scorches=[]; draftPicks=[]; draft=null; selected.clear(); unclaimed.clear(); areaOf=null; nextAreaId=1; for(const k in supplyAt) delete supplyAt[k]; tickN=0; simMs=0; uidSeq=0; over=false; freeplay=false; spectating=false; decided=false; paused=false; userPaused=false; pickMode=null; buildMode=null; STATS.c={}; STATS.tl=[]; STATS.nukedBy={}; STATS.campaigns={}; STATS.bigLoss={n:0,by:''}; for(const k in notedAt) delete notedAt[k]; CMD.log=[]; CMD.hashes=[]; me=null; }
function postedModal(){ const url=(WP&&(WP.creditsUrl||WP.base))+(lastPostId||'')+'/'; const fb='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url); overlay.style.display='none';
  const m=openModal(`<div class="card" style="text-align:center;width:min(520px,94vw)"><h2 style="margin:0 0 6px;font-size:24px">Your credits are posted</h2><p class="muted" style="font-size:13px;margin:0 0 14px">Anyone with the link can watch them, with the whole match replayed behind the roll.</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px"><a href="${fb}" target="_blank" rel="noopener" class="sf-fb">Share on Facebook</a><button id="pmCopy">Copy link</button></div><div style="display:grid;gap:8px;grid-template-columns:1fr 1fr"><button id="pmPlay" style="background:#2f5a8c;font-weight:600;padding:10px">Play another match</button><button id="pmBoard" style="padding:10px">Leaderboard</button><button id="pmHome" style="padding:10px">Home page</button><button id="pmWatch" style="padding:10px">Watch again</button></div></div>`);
  m.querySelector('#pmCopy').onclick=()=>{ const b=m.querySelector('#pmCopy'); (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>{ b.textContent='Copied'; setTimeout(()=>{ b.textContent='Copy link'; },1800); }).catch(()=>prompt('Copy this link:',url)); };
  m.querySelector('#pmPlay').onclick=()=>location.reload(); m.querySelector('#pmBoard').onclick=()=>{ location.href=WP&&WP.boardUrl?WP.boardUrl:'/leaderboard/'; }; m.querySelector('#pmHome').onclick=()=>{ location.href=WP&&WP.homeUrl?WP.homeUrl:'/'; }; m.querySelector('#pmWatch').onclick=()=>{ closeModal(); if(lastStats){ CUSTOM.previewing=false; beginCredits(Object.assign({},lastStats,{custom:CUSTOM.data}),(CUSTOM.data&&CUSTOM.data.song)||ROLL.autoSong||'builtin',false); } }; }
function endCredits(){ ROLL.on=false; ROLL.speedSet=false; $('side').classList.remove('rolling'); if(ROLL.watchReplay){ ROLL.watchReplay=false; ROLL.replay=false; REPLAY.creditsMode=false; REPLAY.on=false; paused=true; userPaused=true; over=true; $('start').style.display='flex'; return; } if(AUD.ctx) applyVolumes();
  if(ROLL.replay&&REPLAY.creditsMode){ const sv=ROLL.saved; const finish=()=>{ REPLAY.on=false; REPLAY.creditsMode=false; REPLAY.speed=1; over=true; userPaused=false; paused=true; CMD.log=sv.log; CMD.hashes=sv.hashes; overlay.classList.remove('replay'); ovTitle.textContent=sv.title; ovText.textContent=sv.text; const el=document.getElementById('ovPost'); if(el) el.textContent=sv.post; $('replayBar').style.display='none'; overlay.style.display='flex'; ROLL.replay=false; };
    if(tickN<sv.tick){ ROLL.replay=false; replayCatchUp(sv.tick,'Finishing the replay',{label:'Continue',fn:()=>{ finish(); paused=true; }}); return; } finish(); return; } ROLL.playBox=null; ROLL.editBox=null; ROLL.approveBox=null; CUSTOM.previewing=false; JUKE.hold=false; { const cb=document.getElementById('ovCredits'); if(cb) cb.textContent='Watch credits again'; } cv.style.cursor=buildMode?'cell':'crosshair'; if(ROLL.top1Pending){ ROLL.top1Pending=false; setTimeout(()=>jukeSting('top1'),600); } if(ROLL.watch){ $('start').style.display='flex'; } else { overlay.style.display='flex'; } MUS.stop(); jukeStopSrc(); if(AUD.vol.musicOn) MUS.start(me?'game':'menu'); }
function drawCredits(){ if(!ROLL.on) return; const d=ROLL.data; const Wd=cv.width, Hd=cv.height;
  // the map drifts slowly but never leaves the screen: fit-to-screen zoom, sinusoidal wander within the margins
  const el=(ROLL.paused?ROLL.pausedAt:performance.now())-ROLL.t0; const fitS=Math.min(Wd/W,Hd/H); cam.s=fitS*1.15; const mw=W*cam.s, mh=H*cam.s; const wx=Math.max(0,mw-Wd), wy=Math.max(0,mh-Hd); cam.x=-wx*(0.5+0.5*Math.sin(el/38000)); cam.y=-wy*(0.5+0.5*Math.cos(el/29000));
  ctx.fillStyle=ROLL.replay?'rgba(8,14,22,.5)':'rgba(8,14,22,.74)'; ctx.fillRect(0,0,Wd,Hd);
  const lineH=42, hH=72, gapH=46, openH=Hd*0.7, starH=Hd*0.7, titleH=Hd*0.75, cardH=Hd*0.45, quoteH=260, discH=DISCLAIMER.length*34+120, endH=Hd*0.9, HOLD=2.5;
  const hOf=ln=>ln.k==='pquote'?quoteH:ln.k==='nemesis'?cardH*1.3:ln.k==='highlight'?cardH:ln.k==='open'?openH:ln.k==='star'?starH:ln.k==='title'?titleH:ln.k==='h'?hH:ln.k==='gap'?gapH:ln.k==='card'?cardH:ln.k==='quote'?quoteH:ln.k==='disc'?discH:ln.k==='end'?endH:lineH;
  let total=0; for(const ln of ROLL.lines) total+=hOf(ln);
  const t=el/1000; const fade=Math.min(1,t/1.2); const SPEED=62; // px per second
  // offsets of the disclaimer and end card within the roll
  let discTop=0, endTop=0, acc=0; for(const ln of ROLL.lines){ if(ln.k==='disc') discTop=acc; if(ln.k==='end') endTop=acc; acc+=hOf(ln); }
  const startY=(Hd-openH)/2; // line y = startY + lineTop - off; the disclaimer holds when its top reaches 70 px, the end card when it is centred
  const DHOLD=16; // seconds the disclaimer stays on screen
  const dist1=Math.max(0,startY+discTop-70); // scroll offset (px) at the disclaimer hold
  const dist2=Math.max(0,(startY+endTop-(Hd-endH)/2)-dist1); // further offset to the end card
  const t1=HOLD+Math.max(0,dist1)/SPEED, t2=t1+DHOLD, t3=t2+Math.max(0,dist2)/SPEED; ROLL.tEnd=t3;
  if(ROLL.replay&&REPLAY.on&&!ROLL.speedSet){ ROLL.speedSet=true; const need=Math.max(1,Math.ceil(REPLAY.toTick/Math.max(20,t2)/10)); REPLAY.speed=Math.min(15,need); }
  let off; if(t<HOLD) off=0; else if(t<t1) off=(t-HOLD)*SPEED; else if(t<t2) off=dist1; else if(t<t3) off=dist1+(t-t2)*SPEED; else off=dist1+dist2;
  const y0=startY-off; const endFade=t>t2?Math.min(1,Math.max(0,(t-t2)/1.5)):0; // the disclaimer fades as we leave it
  ctx.save(); ctx.globalAlpha=fade; ctx.textBaseline='middle'; let y=y0; const cx=Wd/2; const F=(w,px)=>`${w} ${px}px "Segoe UI",system-ui,sans-serif`;
  for(const ln of ROLL.lines){ const h=hOf(ln);
    if(y+h>-40&&y<Hd+40){
      if(ln.k==='open'){ const ty=y+openH*0.5; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font=F('bold',64); ctx.letterSpacing='6px'; ctx.fillText('STATEFALL',cx,ty-26); ctx.letterSpacing='0px'; ctx.fillStyle='#8fa3b8'; ctx.font=F('500',22); ctx.fillText('at WorldRTS.com',cx,ty+30); }
      else if(ln.k==='star'){ const ty=y+starH*0.5; ctx.textAlign='center'; const big=Math.min(84,Math.max(40,Wd/14));
        if(ln.won){ ctx.fillStyle='#ffd27a'; ctx.font=F('bold',22); ctx.letterSpacing='5px'; ctx.fillText('STARRING',cx,ty-70); ctx.fillText('THE WINNER',cx,ty-40); ctx.letterSpacing='0px'; ctx.fillStyle='#fff'; ctx.font=F('bold',big); ctx.fillText((d.player||d.name).toUpperCase(),cx,ty+30); }
        else { ctx.fillStyle='#ffd27a'; ctx.font=F('bold',22); ctx.letterSpacing='5px'; ctx.fillText('STARRING',cx,ty-90); ctx.letterSpacing='0px'; ctx.fillStyle='#fff'; ctx.font=F('bold',Math.min(56,big)); ctx.fillText('THE OTHER COUNTRIES',cx,ty-40); const riv=(d.rivals||[]).slice(0,10); const fw=44,fh=30,gap=10; let x0=cx-(riv.length*(fw+gap)-gap)/2; for(const r of riv){ const fl=d.flags&&d.flags[r.name]; if(fl){ drawFlag(ctx,fl,x0,ty-14,fw,fh); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1; ctx.strokeRect(x0,ty-14,fw,fh); } x0+=fw+gap; } ctx.fillStyle='#ffd27a'; ctx.font=F('bold',18); ctx.letterSpacing='4px'; ctx.fillText('CO-STARRING',cx,ty+50); ctx.letterSpacing='0px'; ctx.fillStyle='#fff'; ctx.font=F('bold',Math.min(48,big)); ctx.fillText((d.player||d.name).toUpperCase(),cx,ty+92); } }
      else if(ln.k==='title'){ const ty=y+titleH*0.45; drawFlag(ctx,d.flag,cx-96,ty-150,192,128); ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=1; ctx.strokeRect(cx-96,ty-150,192,128); ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font=F('bold',40); ctx.fillText('AS '+d.name.toUpperCase(),cx,ty+24); ctx.fillStyle='#ffd27a'; ctx.font=F('bold',30); ctx.fillText(d.result.toUpperCase(),cx,ty+70); ctx.fillStyle='#bfd0e2'; ctx.font=F('400',19); ctx.fillText(`${d.minutes} min · ${d.land}% of the land · ${(DIFFS[d.diff]||{}).label||d.diff} · ${d.cls}`,cx,ty+106); }
      else if(ln.k==='h'){ ctx.textAlign='center'; ctx.fillStyle='#ffd27a'; ctx.font=F('bold',24); ctx.letterSpacing='5px'; const tw=ctx.measureText(ln.t).width; ctx.fillText(ln.t,cx,y+hH*0.62); ctx.letterSpacing='0px'; if(ln.icon){ const im=rollImg(ln.icon); if(im&&im.complete&&im.naturalWidth) ctx.drawImage(im,cx-tw/2-52,y+hH*0.62-20,40,40); } }
      else if(ln.k==='p'){ ctx.font=F('400',23); const my=y+lineH/2; let tx=cx+16; if(ln.icon&&ln.s){ if(ln.icon.startsWith('flag:')){ const fl=d.flags&&d.flags[ln.icon.slice(5)]; if(fl){ drawFlag(ctx,fl,tx,my-11,33,22); ctx.strokeStyle='rgba(255,255,255,.3)'; ctx.lineWidth=1; ctx.strokeRect(tx,my-11,33,22); tx+=42; } } else { const im=rollImg(ln.icon); if(im&&im.complete&&im.naturalWidth){ const w=ln.icon.startsWith('ship:')?44:ln.icon.startsWith('air:')?40:28; const h=ln.icon.startsWith('ship:')?24:ln.icon.startsWith('air:')?25:28; ctx.drawImage(im,tx,my-h/2,w,h); tx+=w+10; } } }
        if(ln.s){ ctx.textAlign='right'; ctx.fillStyle='#8fa3b8'; ctx.fillText(ln.s,cx-16,my); ctx.textAlign='left'; ctx.fillStyle='#e8ecef'; ctx.fillText(ln.t,tx,my); } else { ctx.textAlign='left'; ctx.fillStyle='#e8ecef'; const w=ctx.measureText(ln.t).width; const sx=Math.max(40,cx-(w+(tx-cx-16))/2); if(ln.icon&&!ln.icon.startsWith('flag:')){ const im=rollImg(ln.icon); if(im&&im.complete&&im.naturalWidth) ctx.drawImage(im,sx-38,my-14,28,28); } ctx.fillText(ln.t,sx,my); } }
      else if(ln.k==='pquote'){ ctx.font=`italic 400 29px "Segoe UI",system-ui,sans-serif`; const boxW=Math.min(Wd-80,860); const maxW=boxW-160; const words=ln.text.split(' '); const lines=[]; let cur=''; for(const w of words){ const t2=cur?cur+' '+w:w; if(ctx.measureText(t2).width>maxW&&cur){ lines.push(cur); cur=w; } else cur=t2; } if(cur) lines.push(cur); const boxH=lines.length*38+100; const bx=cx-boxW/2, by=y+(quoteH-boxH)/2; ctx.fillStyle='rgba(255,210,122,.14)'; ctx.strokeStyle='rgba(255,210,122,.7)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect?ctx.roundRect(bx,by,boxW,boxH,14):ctx.rect(bx,by,boxW,boxH); ctx.fill(); ctx.stroke(); ctx.fillStyle='rgba(255,210,122,.8)'; ctx.fillRect(bx,by,6,boxH); drawFlag(ctx,d.flag,bx+28,by+22,66,44); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1; ctx.strokeRect(bx+28,by+22,66,44); ctx.textAlign='left'; ctx.fillStyle='#fff'; let yy=by+46; const tx0=bx+120; for(const l of lines){ ctx.fillText('\u201c'+l+(l===lines[lines.length-1]?'\u201d':''),tx0,yy); yy+=38; } ctx.fillStyle='#ffd27a'; ctx.font=F('600',19); ctx.fillText('— '+ln.who+', '+ln.title+', '+ln.nation,tx0,yy+14); }
      else if(ln.k==='nemesis'){ const ty=y+cardH*0.5; ctx.textAlign='center'; ctx.fillStyle='#ff9a9a'; ctx.font=F('bold',20); ctx.letterSpacing='4px'; ctx.fillText('NEMESIS',cx,ty-52); ctx.letterSpacing='0px'; const fl=d.flags&&d.flags[ln.name]; if(fl){ drawFlag(ctx,fl,cx-45,ty-36,90,60); ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=1; ctx.strokeRect(cx-45,ty-36,90,60); } ctx.fillStyle='#fff'; ctx.font=F('bold',34); ctx.fillText(ln.name.toUpperCase(),cx,ty+56); ctx.fillStyle='#bfd0e2'; ctx.font=F('400',18); ctx.fillText(`${ln.fate} · peak army ${fmtN(ln.peak)}${ln.nuked?' · nuked you '+ln.nuked+' time'+(ln.nuked>1?'s':''):''}`,cx,ty+88); }
      else if(ln.k==='highlight'){ const ty=y+cardH*0.5; ctx.textAlign='center'; ctx.fillStyle='#ffd27a'; ctx.font=F('bold',20); ctx.letterSpacing='4px'; ctx.fillText('THE MOMENT',cx,ty-40); ctx.letterSpacing='0px'; ctx.fillStyle='#8fa3b8'; ctx.font=F('400',22); ctx.fillText(`${Math.floor(ln.m)}:${String(Math.round((ln.m%1)*60)).padStart(2,'0')}`,cx,ty); ctx.fillStyle='#fff'; ctx.font=F('bold',34); ctx.fillText(ln.text,cx,ty+46); }
      else if(ln.k==='quote'){ ctx.font=`italic 400 27px "Segoe UI",system-ui,sans-serif`; const boxW=Math.min(Wd-80,860); const maxW=boxW-160; const words=ln.text.split(' '); const lines=[]; let cur=''; for(const w of words){ const t2=cur?cur+' '+w:w; if(ctx.measureText(t2).width>maxW&&cur){ lines.push(cur); cur=w; } else cur=t2; } if(cur) lines.push(cur);
        const boxH=lines.length*36+96; const bx=cx-boxW/2, by=y+(quoteH-boxH)/2; ctx.fillStyle='rgba(47,90,140,.35)'; ctx.strokeStyle='rgba(127,179,255,.55)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect?ctx.roundRect(bx,by,boxW,boxH,14):ctx.rect(bx,by,boxW,boxH); ctx.fill(); ctx.stroke(); ctx.fillStyle='rgba(127,179,255,.6)'; ctx.fillRect(bx,by,6,boxH);
        const fl=d.flags&&d.flags[ln.flagName]; if(fl){ drawFlag(ctx,fl,bx+28,by+22,66,44); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1; ctx.strokeRect(bx+28,by+22,66,44); }
        if(ln.reply){ ctx.textAlign='left'; ctx.fillStyle='#8fa3b8'; ctx.font=F('600',15); ctx.letterSpacing='2px'; ctx.fillText('IN REPLY TO THAT',bx+120,by-12); ctx.letterSpacing='0px'; }
        ctx.textAlign='left'; ctx.fillStyle='#e8ecef'; ctx.font=`italic 400 27px "Segoe UI",system-ui,sans-serif`; let yy=by+44; const tx0=bx+120; for(const l of lines){ ctx.fillText('\u201c'+l+(l===lines[lines.length-1]?'\u201d':''),tx0,yy); yy+=36; } ctx.fillStyle='#ffd27a'; ctx.font=F('600',19); ctx.fillText('— '+ln.who+', '+ln.unit,tx0,yy+14); }
      else if(ln.k==='card'){ const ty=y+cardH*0.5; ctx.textAlign='center'; ctx.fillStyle='#ffd27a'; ctx.font=F('bold',20); ctx.letterSpacing='4px'; ctx.fillText(ln.lines[0],cx,ty-30); ctx.letterSpacing='0px'; ctx.fillStyle='#fff'; ctx.font=F('bold',44); ctx.fillText(ln.lines[1],cx,ty+26); }
      else if(ln.k==='disc'){ ctx.save(); ctx.globalAlpha=fade*(1-endFade*0.85); ctx.textAlign='center'; ctx.fillStyle='#ffd27a'; ctx.font=F('bold',22); ctx.letterSpacing='4px'; ctx.fillText('DISCLAIMER',cx,y+40); ctx.letterSpacing='0px'; ctx.fillStyle='#d6e0ea'; ctx.font=F('400',19); const maxW=Math.min(Wd-80,860); let yy=y+90; for(const para of DISCLAIMER){ const words=para.split(' '); let line=''; for(const w of words){ const test=line?line+' '+w:w; if(ctx.measureText(test).width>maxW){ ctx.fillText(line,cx,yy); yy+=24; line=w; } else line=test; } ctx.fillText(line,cx,yy); yy+=34; } ctx.restore(); }
      else if(ln.k==='end'){ ctx.globalAlpha=fade*Math.min(1,Math.max(0,(t-(ROLL.tEnd||0)+1.2)/1.2)); const ty=y+endH*0.35; ctx.textAlign='center'; ctx.fillStyle='#ffd27a'; ctx.font=F('bold',28); ctx.fillText(ln.goad||'',cx,ty-60); ctx.fillStyle='#fff'; ctx.font=F('bold',40); ctx.letterSpacing='6px'; ctx.fillText('STATEFALL',cx,ty); ctx.letterSpacing='0px'; ctx.fillStyle='#8fa3b8'; ctx.font=F('400',17); ctx.fillText('worldrts.com · seed '+d.seed,cx,ty+40); if(ln.dedication){ ctx.fillStyle='#e8ecef'; ctx.font=`italic 400 22px "Segoe UI",system-ui,sans-serif`; ctx.fillText(ln.dedication,cx,ty-110); }
        { const bw=320,bh=46,bx=cx-bw/2,by=ty+80; ROLL.playBox=[bx,by,bw,bh]; ctx.fillStyle='#2f5a8c'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(bx,by,bw,bh,10):ctx.rect(bx,by,bw,bh); ctx.fill(); ctx.fillStyle='#fff'; ctx.font=F('600',18); ctx.fillText(ln.won?'Play again — same seed, same class':'Take it back — same seed, same class',cx,by+bh/2); } }
    }
    y+=h; }
  ctx.restore();
  { const total=(ROLL.tEnd||ROLL.dur)+6; const prog=Math.max(0,Math.min(1,t/total)); const bw=300,bh=40,bx=cx-bw/2,by=Hd-bh-12; ctx.fillStyle='rgba(26,38,52,.92)'; ctx.strokeStyle='#33475c'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect?ctx.roundRect(bx,by,bw,bh,10):ctx.rect(bx,by,bw,bh); ctx.fill(); ctx.stroke();
    const btns=[['⏮',()=>{ ROLL.t0=ROLL.paused?ROLL.pausedAt:performance.now(); ROLL.done=false; }],['◀◀',()=>rollSeek(-10)],[ROLL.paused?'▶':'▮▮',()=>rollTogglePause()],['▶▶',()=>rollSeek(10)]]; ROLL.tBoxes=[]; ctx.font='16px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#e8ecef'; btns.forEach((b,i)=>{ const x0=bx+14+i*68, w=56; ROLL.tBoxes.push([x0,by+4,w,bh-8,b[1]]); ctx.fillText(b[0],x0+w/2,by+bh/2); }); ctx.textBaseline='alphabetic';
    ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(bx,by+bh-3,bw,3); ctx.fillStyle='#ffd27a'; ctx.fillRect(bx,by+bh-3,bw*prog,3);
    if(ROLL.mx!=null&&ROLL.tBoxes.some(b=>ROLL.mx>=b[0]&&ROLL.mx<=b[0]+b[2]&&ROLL.my>=b[1]&&ROLL.my<=b[1]+b[3])) cv.style.cursor='pointer'; }
  ctx.textAlign='left'; ctx.fillStyle='rgba(191,208,226,.7)'; ctx.font='12px "Segoe UI",system-ui,sans-serif'; ctx.textBaseline='alphabetic'; ctx.fillText(ROLL.paused?'Paused · ← → seek · wheel to scroll':'Space pause · ← → seek · wheel to scroll',16,Hd-14);
  if(CUSTOM.previewing){ const bh=40; const b1=[16,Hd-bh-12,110,bh], b2=[Wd-190-16,Hd-bh-12,190,bh]; ROLL.editBox=b1; ROLL.approveBox=b2; ROLL.skipBox=null; ctx.font='15px "Segoe UI",system-ui,sans-serif'; ctx.textBaseline='middle'; ctx.textAlign='center'; for(const [b,label,col] of [[b1,'◀ Edit','rgba(26,38,52,.95)'],[b2,CUSTOM.approved?'✓ Posted — share':'✓ Approve & post','#2f5a8c']]){ ctx.fillStyle=col; ctx.strokeStyle='#33475c'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect?ctx.roundRect(b[0],b[1],b[2],b[3],8):ctx.rect(b[0],b[1],b[2],b[3]); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff'; ctx.fillText(label,b[0]+b[2]/2,b[1]+b[3]/2); } ctx.textBaseline='alphabetic'; if(ROLL.mx!=null){ const inB=[b1,b2].some(b=>ROLL.mx>=b[0]&&ROLL.mx<=b[0]+b[2]&&ROLL.my>=b[1]&&ROLL.my<=b[1]+b[3]); cv.style.cursor=inB?'pointer':'default'; } }
  else { const bw=110,bh=34,bx=Wd-bw-16,by=Hd-bh-12; ROLL.skipBox=[bx,by,bw,bh]; if(ROLL.mx!=null){ const inS=ROLL.mx>=bx&&ROLL.mx<=bx+bw&&ROLL.my>=by&&ROLL.my<=by+bh; const pb=ROLL.playBox; const inP=pb&&ROLL.mx>=pb[0]&&ROLL.mx<=pb[0]+pb[2]&&ROLL.my>=pb[1]&&ROLL.my<=pb[1]+pb[3]; cv.style.cursor=(inS||inP)?'pointer':'default'; } ctx.fillStyle='rgba(26,38,52,.92)'; ctx.strokeStyle='#33475c'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect?ctx.roundRect(bx,by,bw,bh,8):ctx.rect(bx,by,bw,bh); ctx.fill(); ctx.stroke(); ctx.fillStyle='#e8ecef'; ctx.font='14px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Skip ▸',bx+bw/2,by+bh/2); ctx.textBaseline='alphabetic'; if(JUKE.cur&&JUKE.cur.id!=='builtin'){ ctx.textAlign='right'; ctx.fillStyle='rgba(191,208,226,.6)'; ctx.font='12px "Segoe UI",system-ui,sans-serif'; ctx.fillText('♪ '+JUKE.cur.title,bx-12,Hd-14); } }
  if(!ROLL.paused&&!ROLL.done&&t>=(ROLL.tEnd||ROLL.dur)+6){ ROLL.done=true; ROLL.paused=true; ROLL.pausedAt=performance.now(); } }
function creditsCardPNG(d){ const c=document.createElement('canvas'); c.width=1200; c.height=630; const x=c.getContext('2d'); x.fillStyle='#0f1a26'; x.fillRect(0,0,1200,630); x.fillStyle='#1a2634'; x.fillRect(40,40,1120,550); x.strokeStyle=d.color||'#7fb3ff'; x.lineWidth=6; x.strokeRect(40,40,1120,550);
  drawFlag(x,d.flag,80,90,240,160); x.strokeStyle='rgba(255,255,255,.4)'; x.lineWidth=2; x.strokeRect(80,90,240,160);
  x.fillStyle='#fff'; x.font='bold 64px "Segoe UI",system-ui,sans-serif'; x.textAlign='left'; x.fillText(d.name.toUpperCase(),360,150); x.fillStyle='#ffd27a'; x.font='bold 34px "Segoe UI",system-ui,sans-serif'; x.fillText(d.result.toUpperCase(),360,205); x.fillStyle='#bfd0e2'; x.font='22px "Segoe UI",system-ui,sans-serif'; x.fillText(`${d.minutes} min · ${d.land}% of the land · ${(DIFFS[d.diff]||{}).label||d.diff} · ${d.cls}`,360,245);
  const c2=d.c||{}; const rows=[['Provinces',c2.conquests],['Eliminated',c2.kills],['Continents',c2.continents],['Ships sunk',c2.shipsSunk],['Missiles',c2.missiles],['Shot down',c2.intercepts],['Peak army',c2.peak],['Aircraft down',c2.planesDown]].filter(r=>r[1]).slice(0,8);
  x.font='22px "Segoe UI",system-ui,sans-serif'; rows.forEach((r,i)=>{ const col=i%2, row=Math.floor(i/2); const bx=80+col*540, by=320+row*58; x.fillStyle='#8fa3b8'; x.textAlign='left'; x.fillText(r[0],bx,by); x.fillStyle='#fff'; x.font='bold 26px "Segoe UI",system-ui,sans-serif'; x.textAlign='right'; x.fillText(fmtN(r[1]),bx+500,by); x.font='22px "Segoe UI",system-ui,sans-serif'; });
  x.fillStyle='#8fa3b8'; x.font='18px "Segoe UI",system-ui,sans-serif'; x.textAlign='right'; x.fillText('STATEFALL · worldrts.com · seed '+d.seed,1120,565);
  return new Promise(res=>c.toBlob(res,'image/png')); }

// ---------------------------------------------------------------- custom credits builder
const CUSTOM={open:false,data:null,previewing:false};
function cleanText(t,max){ return String(t||'').replace(/[^\p{L}\p{N}\s.,!?'\-:;]/gu,'').replace(/\s+/g,' ').trim().slice(0,max); }
function builderHTML(d){ const songs=(JUKE.loaded?[...new Map([...Object.values(JUKE.stings||{}).flat(),...JUKE.list.game,...JUKE.list.menu].filter(Boolean).map(t=>[t.id,t])).values()]:[]);
  const rivals=(d.rivals||[]); const events=(d.tl||[]);
  return `<div class="card" style="text-align:left;width:min(640px,94vw);max-height:92vh;overflow:auto">
  <h2 style="margin:0 0 6px;font-size:22px">Make custom credits you can share</h2>
  <p class="muted" style="font-size:13px;margin:0 0 12px">These credits get a public page anyone can watch. Choose a song, add your words, preview, then approve. Nothing is public until you approve. Your quote appears right after your name — the generals reply to it.</p>
  <div class="bld">
    <label>Song<select id="cbSong">${songs.map(t=>`<option value="${t.id}">${t.title}${t.seconds?' ('+Math.floor(t.seconds/60)+':'+String(Math.floor(t.seconds%60)).padStart(2,'0')+')':''}</option>`).join('')||'<option value="builtin">Built-in score</option>'}</select><button id="cbPreviewSong" type="button" style="margin-left:6px;padding:4px 10px">▶ listen</button></label>
    <label>Your quote <span class="muted" id="cbQuoteN">0/200</span><textarea id="cbQuote" maxlength="200" rows="3" placeholder="What the world should remember you saying"></textarea></label>
    <label>Your title <input id="cbTitle" maxlength="40" value="Supreme Commander"></label>
    <label>Dedication <span class="muted">(shown on the final card)</span><input id="cbDed" maxlength="120" placeholder="For anyone who told me to give up"></label>
    <label>Nemesis <select id="cbNem"><option value="">— none —</option>${rivals.map(r=>`<option value="${r.name}">${r.name}</option>`).join('')}</select></label>
    <label>Highlight <select id="cbHi"><option value="-1">— none —</option>${events.map((e,i)=>`<option value="${i}">${Math.floor(e.m)}:${String(Math.round((e.m%1)*60)).padStart(2,'0')} — ${e.t}</option>`).join('')}</select></label>
    <label>Tone <select id="cbTone"><option value="serious">Serious — respectful generals</option><option value="wry" selected>Wry — the usual</option><option value="brutal">Brutal — no mercy</option></select></label>
  </div>
  <p id="cbErr" style="color:#ff9a9a;font-size:13px;min-height:18px;margin:8px 0"></p>
  <div style="display:flex;gap:8px;justify-content:flex-end"><button id="cbCancel">Cancel</button><button id="cbPreview" style="font-weight:600">Preview</button></div></div>`; }
function openBuilder(d,existing){ if(!WP||!WP.user){ fail('Log in on the site to make shareable credits.'); return; } const box=$('builder'); box.innerHTML=builderHTML(d); box.style.display='flex'; CUSTOM.open=true; overlay.style.display='none';
  const c=existing||CUSTOM.data||{}; if(c.song) $('cbSong').value=c.song; else if(ROLL.autoSong) $('cbSong').value=ROLL.autoSong; if(c.quote) $('cbQuote').value=c.quote; if(c.title) $('cbTitle').value=c.title; if(c.dedication) $('cbDed').value=c.dedication; if(c.nemesis) $('cbNem').value=c.nemesis; if(c.highlight!=null) $('cbHi').value=String(c.highlight); if(c.tone) $('cbTone').value=c.tone;
  $('cbQuote').oninput=()=>{ $('cbQuoteN').textContent=$('cbQuote').value.length+'/200'; }; $('cbQuote').oninput();
  $('cbPreviewSong').onclick=()=>{ audioInit(); const t=[...Object.values(JUKE.stings||{}).flat(),...JUKE.list.game,...JUKE.list.menu].find(x=>x&&x.id===$('cbSong').value); if(!t) return; if(JUKE.cur===t&&JUKE.src){ jukeStopSrc(0.3); $('cbPreviewSong').textContent='▶ listen'; } else { JUKE.hold=true; jukePlay(t,JUKE.ctx); $('cbPreviewSong').textContent='■ stop'; } };
  $('cbCancel').onclick=()=>{ closeBuilder(); overlay.style.display='flex'; };
  $('cbPreview').onclick=async()=>{ const draft={song:$('cbSong').value,quote:cleanText($('cbQuote').value,200),title:cleanText($('cbTitle').value,40)||'Supreme Commander',dedication:cleanText($('cbDed').value,120),nemesis:$('cbNem').value,highlight:+$('cbHi').value,tone:$('cbTone').value};
    $('cbErr').textContent=''; if(draft.quote||draft.dedication||draft.title!=='Supreme Commander'){ $('cbPreview').disabled=true; try{ const r=await fetch(WP.rest+'moderate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-WP-Nonce':WP.nonce},body:JSON.stringify({quote:draft.quote,title:draft.title,dedication:draft.dedication})}); const j=await r.json(); if(!r.ok){ $('cbErr').textContent=j.message||'Could not check the text.'; $('cbPreview').disabled=false; return; } const bad=Object.keys(j.fields||{}).filter(k=>j.fields[k].ok===false); if(bad.length){ $('cbErr').textContent=`Your ${bad.join(' and ')} contain${bad.length>1?'':'s'} a word we can't show — please reword.`; $('cbPreview').disabled=false; return; } for(const k in j.fields) draft[k]=j.fields[k].text; }catch(e){ $('cbErr').textContent='Could not reach the site to check the text.'; $('cbPreview').disabled=false; return; } $('cbPreview').disabled=false; }
    CUSTOM.data=draft; closeBuilder(); jukeStopSrc(0.3); CUSTOM.previewing=true; beginCredits(Object.assign({},d,{custom:draft}),draft.song,false); }; }
function closeBuilder(){ $('builder').style.display='none'; CUSTOM.open=false; jukeStopSrc(0.3); JUKE.hold=false; }
async function approveCustom(){ if(!lastPostId||!CUSTOM.data) { fail('Post a score first — the custom credits attach to your posted match.'); return; }
  try{ const r=await fetch(WP.rest+'scores/'+lastPostId+'/custom',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-WP-Nonce':WP.nonce},body:JSON.stringify(CUSTOM.data)}); const j=await r.json().catch(()=>({})); if(!r.ok){ fail(j.message||'Could not save the credits.'); return false; } CUSTOM.approved=true; log('Custom credits posted — the watch page and share link now show them.',true); return true; }catch(e){ fail('Could not reach the site.'); return false; } }

// ---------------------------------------------------------------- command layer: every player action is a serialisable command (replays, saves, multiplayer)
const CMD={log:[],replaying:false,hashes:[]};
const DECIDE={share:null,war:null}; const REPLAY={on:false,cmds:[],i:0,speed:1,resume:false,toTick:0};
function cmdLog(kind,args){ if(CMD.replaying||!me||REPLAY.on) return; CMD.log.push({t:tickN,k:kind,a:args}); }
function shipById(id){ return warships.find(w=>w.id===id); }
function structAtT(t){ return structures.find(s=>s.t===t); }
function issueMenu(d,t,selIds,siteT,ratioV,aidGold,aidTroops){ if(REPLAY.on) return; if(userPaused&&!START.pauseBuild&&!over&&!['toggle','focus','unfocus','pickattack','pickreinf','ally','nap','war','askGold','askTroops','giveGold','giveTroops'].includes(d.act)){ fail('Paused — unpause to give orders (or tick "Paused orders" on the start card).'); return; } cmdLog('menu',[d,t,selIds,siteT,ratioV,aidGold,aidTroops]); menuAction(d,t,selIds.map(shipById).filter(Boolean),siteT>=0?structAtT(siteT):null,ratioV,aidGold,aidTroops); }
function issueClick(t,env){ if(REPLAY.on) return; if(userPaused&&!START.pauseBuild&&!over&&!draft){ fail('Paused — unpause to give orders (or tick "Paused orders" on the start card).'); return; } env=env||{ratio:+ratio.value,pick:pickMode?{kind:pickMode.kind,t:pickMode.t}:null,build:buildMode||null}; cmdLog('click',[t,env]); clickTile(t,env); }
function issue(kind,...args){ if(REPLAY.on) return; cmdLog(kind,args); applySimple(kind,args); }
function applySimple(kind,a){ switch(kind){
  case 'focus': me.focus=a[0]; break;
  case 'airAuto': me.airAuto=a[0]; break;
  case 'logAuto': me.logisticsAuto=a[0]; break;
  case 'autoFire': me.autoFire=a[0]; break;
  case 'recall': { const ac=aircraft.find(x=>x.id===a[0]); if(ac) recallAircraft(ac); break; }
  case 'recallAll': aircraft.filter(x=>x.owner===me.id&&(a[0]==='dmg'?(x.type==='fighter'&&x.hp<=2):true)).forEach(recallAircraft); break;
  case 'sat': launchSatellite(); break;
  case 'accept': { const f=players[a[0]]; const ty=a[1]; proposals=proposals.filter(q=>q.from!==f.id); if(ty==='reqTroops') sendTroops(me,f,a[2]); else if(ty==='reqGold') sendGold(me,f,a[2]); else { setRelation(me,f,ty); log(`${ty==='ally'?'Alliance':'Pact'} with ${f.name}.`,true); snd('unified'); } break; }
  case 'decline': proposals=proposals.filter(q=>q.from!==a[0]); break;
  case 'decShare': if(DECIDE.share) DECIDE.share(); break;
  case 'decWar': if(DECIDE.war) DECIDE.war(); break;
} if(!CMD.replaying) updateUI(); }
function replayApply(c){ CMD.replaying=true; try{ if(c.k==='menu') menuAction(c.a[0],c.a[1],c.a[2].map(shipById).filter(Boolean),c.a[3]>=0?structAtT(c.a[3]):null,c.a[4],c.a[5],c.a[6]); else if(c.k==='click') clickTile(c.a[0],c.a[1]); else applySimple(c.k,c.a); }catch(e){ console.warn('[statefall] replay command failed',c,e); } finally{ CMD.replaying=false; } }
function resolveReplayCommands(){ if(REPLAY.on){ while(REPLAY.i<REPLAY.cmds.length&&REPLAY.cmds[REPLAY.i].t<=tickN){ replayApply(REPLAY.cmds[REPLAY.i]); REPLAY.i++; } } }
function stateDetail(){ const d={rng:srandN}; for(const p of players){ if(p.kind==='neutral'||!p.alive) continue; d[p.id]=[Math.round(p.troops),Math.round(p.gold),p.tiles]; } d.n=[warships.length,attacks.length,structures.length,transports.length]; return d; }
function stateDiff(a,b){ if(!a||!b) return ''; const out=[]; if(a.rng!=null&&b.rng!=null&&a.rng!==b.rng) out.push(`random draws recorded ${a.rng} vs ${b.rng}`); for(const k in a){ if(k==='n'||k==='rng') continue; const x=a[k],y=b[k]; if(!y){ out.push(`${players[+k]?players[+k].name:k} missing`); continue; } if(x[0]!==y[0]||x[1]!==y[1]||x[2]!==y[2]) out.push(`${players[+k]?players[+k].name:k}: recorded ${x.join('/')} vs ${y.join('/')}`); } if(a.n&&b.n&&a.n.join()!==b.n.join()) out.push(`counts ${a.n.join('/')} vs ${b.n.join('/')}`); return out.slice(0,6).join('; '); }
function stateHash(full){ if(full==null) full=!(REPLAY.on&&REPLAY.hashv!==2); let h=2166136261; const mix=v=>{ h^=(v|0)&0xffffffff; h=Math.imul(h,16777619); };
  const step=full?1:5; for(let t=0;t<W*H;t+=step) mix(owner[t]+2+(struct[t]?100:0));
  for(const p of players){ if(!p.alive) continue; mix(p.id); mix(Math.round(p.troops*10)); mix(Math.round(p.gold*10)); mix(p.tiles); }
  mix(warships.length); for(const w of warships) mix(Math.round(w.x*4)+Math.round(w.y*4)*4096+w.hp*1e6);
  mix(attacks.length); for(const a of attacks) mix(Math.round(a.troops)+a.front.size*1e5);
  mix(structures.length); mix(missiles.length); mix(transports.length); mix(aircraft.length);
  return (h>>>0).toString(16).padStart(8,'0'); }
// Phase 0 state oracle. This is separate from stateHash and replay files so their shipped formats stay unchanged.
const STATE_ORACLE_VERSION='statefall-authoritative-state/v1';
function authoritativeState(){ return {
  version:STATE_ORACLE_VERSION, clock:{tickN,simMs,uidSeq,srandN,over,freeplay,spectating,decided,paused,userPaused,draftTicks,satUntil,satCool,planeCool,nextAreaId},
  rules:{W,H,settings:START,difficulty:chosen,allowed:ALLOWED},
  map:{land,owner,struct,structOwner,region,river,shelled,rough,landCount,regions,regCount,NP,unclaimed},
  actors:{me:me&&me.id,players,attacks,missiles,structures,transports,warships,shots,interceptors,shells,links,traders,aircraft,trucks,planes},
  fog:{vis,radarLayer,myBorders}, diplomacy:{hostile,proposals}, garrison:{areaOf,supplyAt}, draft:{draft,draftPicks}
}; }
function canonicalState(){
  let nextId=1; const seen=new Map();
  const norm=value=>{
    if(value===null||typeof value==='string'||typeof value==='boolean') return value;
    if(typeof value==='number'){ if(Number.isNaN(value)) return {$number:'NaN'}; if(value===Infinity) return {$number:'Infinity'}; if(value===-Infinity) return {$number:'-Infinity'}; if(Object.is(value,-0)) return {$number:'-0'}; return value; }
    if(typeof value==='undefined') return {$undefined:true};
    if(typeof value==='bigint') return {$bigint:String(value)};
    if(typeof value==='function'||typeof value==='symbol') return {$unsupported:typeof value};
    if(seen.has(value)) return {$ref:seen.get(value)};
    const id=nextId++; seen.set(value,id);
    if(ArrayBuffer.isView(value)){ const values=new Array(value.length); for(let i=0;i<value.length;i++) values[i]=value[i]; return {$id:id,$typed:value.constructor.name,$values:values}; }
    if(value instanceof Set){ const values=Array.from(value,norm).map((value,index)=>({value,index,key:JSON.stringify(value)})); values.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:a.index-b.index); return {$id:id,$set:values.map(x=>x.value)}; }
    if(value instanceof Map){ const entries=Array.from(value,([k,v],index)=>({entry:[norm(k),norm(v)],index})); entries.sort((a,b)=>{ const x=JSON.stringify(a.entry[0]),y=JSON.stringify(b.entry[0]); return x<y?-1:x>y?1:a.index-b.index; }); return {$id:id,$map:entries.map(x=>x.entry)}; }
    if(Array.isArray(value)) return {$id:id,$array:value.map(norm)};
    const out={$id:id}; for(const key of Object.keys(value).sort()){ if(!key.startsWith('_u')&&key!=='labelDraw') out[key]=norm(value[key]); } return out;
  };
  return JSON.stringify(norm(authoritativeState()));
}
function checkStateInvariants(){
  const errors=[], n=W*H, arrays={land,owner,struct,structOwner,region,river,shelled,rough};
  for(const [name,a] of Object.entries(arrays)) if(!a||a.length!==n) errors.push(`${name} length ${a&&a.length} != ${n}`);
  if(!players.length) errors.push('players is empty');
  if(me&&players[me.id]!==me) errors.push('human player is not indexed by id');
  const tileCounts=new Int32Array(players.length), regionCounts=new Int32Array(regCount?regCount.length:0); let countedLand=0, unclaimedCount=0;
  if(land&&owner) for(let t=0;t<n;t++){
    const o=owner[t]; if(land[t]) countedLand++; else if(o>=0) errors.push(`water tile ${t} has owner ${o}`);
    if(o>=0){ if(o>=players.length) errors.push(`tile ${t} has invalid owner ${o}`); else { tileCounts[o]++; const r=region&&region[t]; if(r>=0&&r<regions.length&&r*NP+o<regionCounts.length) regionCounts[r*NP+o]++; } }
    if(land[t]&&o<0){ unclaimedCount++; if(!unclaimed.has(t)) errors.push(`unclaimed land tile ${t} missing from index`); }
    else if(unclaimed.has(t)) errors.push(`tile ${t} incorrectly present in unclaimed index`);
    if(errors.length>=100) break;
  }
  if(countedLand!==landCount) errors.push(`landCount ${landCount} != ${countedLand}`);
  if(unclaimed.size!==unclaimedCount) errors.push(`unclaimed size ${unclaimed.size} != ${unclaimedCount}`);
  players.forEach((p,i)=>{ if(p.id!==i) errors.push(`player index ${i} has id ${p.id}`); if(p.tiles!==tileCounts[i]) errors.push(`player ${i} tiles ${p.tiles} != ${tileCounts[i]}`); for(const k in p.rel){ const q=players[+k]; if(!q||q.rel[i]!==p.rel[k]) errors.push(`relationship ${i}/${k} is not symmetric`); } });
  if(regCount&&regionCounts.length===regCount.length) for(let i=0;i<regCount.length;i++) if(regCount[i]!==regionCounts[i]){ errors.push(`regCount ${i} is ${regCount[i]} != ${regionCounts[i]}`); if(errors.length>=100) break; }
  const byTile=new Map(); for(const st of structures){ if(!Number.isInteger(st.t)||st.t<0||st.t>=n) errors.push(`structure has invalid tile ${st.t}`); else { if(byTile.has(st.t)) errors.push(`duplicate structure at tile ${st.t}`); byTile.set(st.t,st); if(!struct[st.t]) errors.push(`structure at ${st.t} missing from tile index`); if(structOwner[st.t]!==st.owner) errors.push(`structure owner index differs at ${st.t}`); if(owner[st.t]!==st.owner) errors.push(`structure owner differs from land owner at ${st.t}`); } if(!players[st.owner]) errors.push(`structure has invalid owner ${st.owner}`); }
  if(struct) for(let t=0;t<n;t++) if(!!struct[t]!==byTile.has(t)){ errors.push(`structure tile index differs at ${t}`); if(errors.length>=100) break; }
  const visited=new Set(); const findBad=(v,path)=>{ if(errors.length>=100||v==null) return; if(typeof v==='number'){ if(Number.isNaN(v)) errors.push(`${path} is NaN`); return; } if(typeof v!=='object'||visited.has(v)) return; visited.add(v); if(ArrayBuffer.isView(v)) return; if(v instanceof Set){ let i=0; for(const x of v) findBad(x,`${path}.set[${i++}]`); return; } for(const k of Object.keys(v)) findBad(v[k],`${path}.${k}`); };
  findBad(authoritativeState(),'state'); return errors;
}
Object.defineProperties(stateHash,{oracleVersion:{value:STATE_ORACLE_VERSION},serializeCanonical:{value:canonicalState},checkInvariants:{value:checkStateInvariants}});
function exposeStateOracle(){ const s=typeof globalThis!=='undefined'&&globalThis.S; if(!s||s.stateHash!==stateHash) return; Object.defineProperties(s,{stateOracleVersion:{value:STATE_ORACLE_VERSION},serializeCanonicalState:{value:canonicalState},checkStateInvariants:{value:checkStateInvariants}}); }
function replayFile(result){ return {v:1,hashv:2,game:GAME_VERSION,seed:START.seed,settings:{...START,diff:chosen,country:me&&me.flag&&me.flag.idx!=null?me.flag.idx:null,customFlag:me&&me.flag&&me.flag.custom?{name:me.flag.name,layers:me.flag.layers,userId:me.flag.userId}:null,customBots:START.customBots||null,allowed:[...ALLOWED]},cmds:CMD.log,hashes:CMD.hashes,result:result||null,tick:tickN,when:Date.now()}; }
function saveReplayDownload(kind){ const f=replayFile(over?ovTitle.textContent:'in progress'); const name=`statefall-${kind==='save'?'game':'replay'}-${START.seed}-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.state`;
  try{ const blob=new Blob([JSON.stringify(f)],{type:'application/octet-stream'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); }catch(e){}
  log(`${kind==='save'?'Game saved':'Replay saved'} — ${name}.`,true); return f; }
function applySettings(st){ // put a saved match's settings back onto the start card, so pressing Start reproduces it
  const set=(id,v)=>{ const el=$(id); if(el&&typeof v==='boolean') el.checked=v; };
  set('garrisonOn',!!st.garrison); set('quickStart',!!st.quick); set('riskyOn',!!st.risky); set('endgameOn',!!st.endgame); set('fogOn',!!st.fog); set('instantOn',!!st.instant); set('billionaireOn',!!st.billionaire); set('stNoCap',!!st.noCap); set('stBots',!!st.bots); set('stPauseBuild',!!st.pauseBuild);
  if($('stTroops')) $('stTroops').value=st.troops; if($('stGold')) $('stGold').value=st.gold; START.teams=st.teams||0; if($('teamSel')) $('teamSel').value=String(START.teams);
  START.map=st.map||'random'; document.querySelectorAll('#maps button').forEach(x=>x.classList.toggle('on',x.dataset.m===START.map));
  if(st.diff&&DIFFS[st.diff]){ chosen=st.diff; if($('diffSel')) $('diffSel').value=chosen; }
  if(st.customFlag&&st.customFlag.layers){ const f=replayIdentity(st.customFlag); chosenFlag={name:f.name,layers:f.layers,idx:-1,custom:true,userId:f.userId}; }
  else if(st.country!=null&&COUNTRIES[st.country]){ chosenFlag=countryByIdx(st.country); if($('countrySel')) $('countrySel').value=st.country; }
  START.customBots=Array.isArray(st.customBots)?st.customBots.slice(0,9).map((b,i)=>replayIdentity(b,i)):null;
  if(Array.isArray(st.allowed)){ ALLOWED.clear(); for(const k of st.allowed) ALLOWED.add(k); }
}
function replayName(value){ return String(value||'').replace(/[<>&"]/g,'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,40)||'Unnamed nation'; }
function replayLayers(value){ const layers=Array.isArray(value)&&value.length&&value.length<=8?value:null, col=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v), num=(v,a,b)=>Number.isFinite(+v)&&+v>=a&&+v<=b, emb=new Set(['anchor','warship','battleship','sub','fighter','bomber','missile','gun','city','factory','radar','satellite','shield','samstar','eagle','lion','sun','crescent','crown','sword','laurel','tree','mountain','tower','torch']); if(!layers) return [['h','#ffffff','#0038a8']]; const ok=L=>{ if(!Array.isArray(L)||typeof L[0]!=='string') return false; switch(L[0]){ case'h':case'v':return L.length>=2&&L.length<=4&&L.slice(1).every(col); case'diag':return L.length===3&&col(L[1])&&col(L[2]); case'rect':return L.length===6&&col(L[1])&&L.slice(2).every(v=>num(v,0,1)); case'disc':return L.length===5&&col(L[1])&&L.slice(2).every(v=>num(v,0,1)); case'ring':return L.length===6&&col(L[1])&&L.slice(2).every(v=>num(v,0,1)); case'star':return (L.length===5||L.length===6)&&col(L[1])&&num(L[2],0,1)&&num(L[3],0,1)&&num(L[4],0,.6)&&(L.length===5||num(L[5],3,12)); case'cross':return L.length===4&&col(L[1])&&num(L[2],0,.6)&&num(L[3],0,1); case'sal':return L.length===3&&col(L[1])&&num(L[2],0,.6); case'tri':return L.length>=5&&L.length<=8&&col(L[1])&&L.slice(2).every(p=>Array.isArray(p)&&p.length===2&&num(p[0],0,1)&&num(p[1],0,1)); case'emb':return (L.length===6||L.length===7)&&col(L[1])&&emb.has(L[2])&&num(L[3],0,1)&&num(L[4],0,1)&&num(L[5],.05,.6)&&(L.length===6||L[6]==null||col(L[6])); default:return false; } }; return layers.every(ok)?layers:[['h','#ffffff','#0038a8']]; }
function replayIdentity(value,slot){ const v=value&&typeof value==='object'?value:{}; return {name:replayName(v.name),layers:replayLayers(v.layers),userId:Number.isInteger(+v.userId)?+v.userId:0,...(slot==null?{}:{slot:Math.max(0,Math.min(8,Number.isInteger(+v.slot)?+v.slot:slot))})}; }
function loadReplayFile(f,mode,item){ REPLAY.saveId=item&&item.id||null; // mode 'watch' = replay at chosen speed; 'resume' = fast-forward silently, then hand control back
  if(!f||!Array.isArray(f.cmds)) { fail('That is not a Statefall replay or save file.'); return; }
  REPLAY.otherVersion=!!(f.game&&f.game!==GAME_VERSION); if(REPLAY.otherVersion) log(`This replay was recorded on game ${f.game}; you are on ${GAME_VERSION}. Rules have changed since, so it may play out differently.`,true);
  applySettings(f.settings||{}); $('seedIn').value=f.seed||'';
  REPLAY.fileGame=f.game||''; REPLAY.hashv=f.hashv||1; REPLAY.on=true; REPLAY.cmds=f.cmds; REPLAY.i=0; REPLAY.resume=mode==='resume'; REPLAY.toTick=f.tick||0; REPLAY.hashes=f.hashes||[]; REPLAY.mismatch=false; REPLAY.speed=1;
  $('startBtn').click();
  if(REPLAY.resume){ replayCatchUp(REPLAY.toTick,'Loading your match',{label:'▶ Play now',fn:()=>{ replayTakeOver(); log(`Resumed at ${Math.floor(tickN*TICK/60000)}:${String(Math.floor(tickN*TICK/1000%60)).padStart(2,'0')}.`,true); }}); }
  else if(!REPLAY.creditsMode){ $('replayBar').style.display='flex'; userPaused=true; paused=true; $('pauseBtn').textContent='\u25B6'; openModal(`<div class="card" style="text-align:center;width:min(440px,94vw)"><h2 style="margin:0 0 6px;font-size:22px">Replay loaded</h2><p class="muted" style="font-size:13px;margin:0 0 12px">${REPLAY.cmds.length} orders · ${Math.floor(REPLAY.toTick*TICK/60000)} min. Use the bar at the bottom for speed, and Take over to play it yourself from any point.</p><button id="rpPlay" style="background:#2f5a8c;font-weight:600;font-size:15px;padding:10px 24px;text-align:center">▶ Watch</button></div>`); $('modal').querySelector('#rpPlay').onclick=()=>{ closeModal(); userPaused=false; paused=false; $('pauseBtn').textContent='\u275A\u275A'; }; }
}
function replayFastForward(){ replayCatchUp(REPLAY.toTick,'Loading',{label:'▶ Play now',fn:replayTakeOver}); }
function divergenceCard(){ if(!REPLAY.on) return; userPaused=true; paused=true; $('pauseBtn').textContent='\u25B6'; const clock=`${Math.floor(REPLAY.divTick*TICK/60000)}:${String(Math.floor(REPLAY.divTick*TICK/1000%60)).padStart(2,'0')}`;
  const m=openModal(`<div class="card" style="text-align:center;width:min(520px,94vw)"><h2 style="margin:0 0 8px;font-size:22px;color:#ff9a9a">This replay has diverged</h2><p class="muted" style="font-size:13px;margin:0 0 6px">At ${clock} the replay stopped matching what was recorded. That is a bug on our side, not something you did. Reporting it sends the details to the site's admins so it can be fixed.</p><p style="font-size:12px;margin:0 0 12px;color:#bfd0e2">${REPLAY.why||''}</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button id="dvReport" style="background:#2f5a8c;font-weight:600">Report this error</button><button id="dvCont">Continue anyway</button><button id="dvStop">Stop</button></div><p id="dvMsg" class="muted" style="font-size:12px;margin:10px 0 0"></p></div>`);
  const resume=()=>{ closeModal(); userPaused=false; paused=false; $('pauseBtn').textContent='\u275A\u275A'; };
  m.querySelector('#dvCont').onclick=resume; m.querySelector('#dvStop').onclick=()=>{ location.href=WP&&WP.homeUrl?WP.homeUrl:'/'; };
  m.querySelector('#dvReport').onclick=async()=>{ const msg=m.querySelector('#dvMsg'); if(!WP||!WP.user){ msg.textContent='Log in to send a report.'; return; } msg.textContent='Sending…'; try{ const r=await sfApi('reports',{method:'POST',body:{kind:'divergence',gameVersion:GAME_VERSION,saveId:REPLAY.saveId||null,tick:REPLAY.divTick,summary:`Replay diverged at ${clock}: ${REPLAY.why||''}`,data:{seed:START.seed,settings:{...START,diff:chosen},mode:REPLAY.resume?'resume':'watch',speed:REPLAY.speed,tick:REPLAY.divTick,recorded:REPLAY.divRec,replay:REPLAY.divNow,commandsApplied:REPLAY.i,commandsTotal:REPLAY.cmds.length,recentCommands:REPLAY.cmds.slice(Math.max(0,REPLAY.i-12),REPLAY.i),hashes:(REPLAY.hashes||[]).slice(0,Math.max(1,Math.floor(REPLAY.divTick/100))).map(h=>[h[0],h[1]]),ua:navigator.userAgent}}}); msg.textContent=`Thank you — report #${r.id} sent.`; m.querySelector('#dvReport').disabled=true; }catch(e){ msg.textContent='Could not send the report: '+e.message; } }; }
function replayTakeOver(){ REPLAY.on=false; $('replayBar').style.display='none'; CMD.log=REPLAY.cmds.slice(0,REPLAY.i); userPaused=false; paused=false; $('pauseBtn').textContent='\u275A\u275A'; updateUI(); }

// ---------------------------------------------------------------- saves and replays on the site (logged-in players only)
const SAVES={list:[],loaded:false,catchup:false};
function canSave(){ return CAPABILITIES.accountSaves; }
function loginPitch(title){ return `<div class="card" style="text-align:center;width:min(480px,94vw)"><h2 style="margin:0 0 8px;font-size:22px">${title||'Save games and replays'}</h2><p class="muted" style="font-size:14px;margin:0 0 14px">Create a free account to save a match and pick it up later on any device, keep a replay of every game you finish, and post to the leaderboard.</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><a href="${WP?WP.registerUrl:'#'}" class="sf-fb" style="background:#2f5a8c">Register</a><a href="${WP?WP.loginUrl:'#'}" class="sf-fb" style="background:#33475c">Log in</a><button data-close style="padding:7px 14px">Not now</button></div></div>`; }
function openModal(html){ const m=$('modal'); m.innerHTML=html; m.style.display='flex'; m.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal); return m; }
function closeModal(){ const m=$('modal'); m.style.display='none'; m.innerHTML=''; }
async function sfApi(path,opt={}){ return PLATFORM.request(path,opt); }
function slotName(){ const mapName={random:'Continents',land:'Land',islands_l:'Large islands',islands_m:'Medium islands',islands_s:'Small islands',atoll:'Atoll',world:'World',europe:'Europe',americas:'Americas',africa:'Africa',asia:'Asia',mideast:'Middle East'}[START.map]||START.map; return `${me.name} on ${mapName} · ${Math.floor(tickN*TICK/60000)} min`; }
async function siteSave(kind,slot,opts={}){ if(!canSave()||!me) return null; const data=replayFile(kind==='replay'?(opts.result||ovTitle.textContent||'finished'):'in progress'); const body={kind,slot,data,country:me.name,cls:matchClass()}; if(opts.id) body.id=opts.id; if(opts.bySlot) body.bySlot=true; return PLATFORM.save(body); }
async function autoSave(){ if(!me||over||REPLAY.on||SAVES.catchup||tickN<100||!canSave()) return; try{ await siteSave('save','Autosave',{bySlot:true}); }catch(e){ console.warn('[statefall] autosave',e); } }
async function saveAndQuit(){ if(!canSave()){ openModal(loginPitch('Save this match')); return; } const name=slotName(); try{ const r=await siteSave('save',name); if(r&&r.dropped) console.info('[statefall] oldest save dropped:',r.dropped); showNotice({kind:'good',title:'Saved to your account',text:name,ttl:4000}); setTimeout(()=>PLATFORM.navigate(WP.homeUrl||'/'),900); }catch(e){ fail('Could not save: '+e.message); } }
function openSaveModal(){ if(!canSave()){ openModal(loginPitch('Save this match')); return; } if(!me||over){ return; } const name=slotName();
  const m=openModal(`<div class="card" style="text-align:center;width:min(480px,94vw)"><h2 style="margin:0 0 8px;font-size:22px">Save this match?</h2><p class="muted" style="font-size:13px;margin:0 0 10px">It goes to your account on the site; resume it from Games &amp; replays on any device.</p><label style="display:block;font-size:13px;margin:0 0 12px">Name<input id="svName" value="${name.replace(/"/g,'&quot;')}" maxlength="80" style="display:block;width:100%;margin-top:4px;background:var(--panel2);color:var(--ink);border:1px solid #33475c;border-radius:6px;padding:6px 8px;font:inherit"></label><div style="display:flex;gap:8px;justify-content:center"><button id="svGo" style="background:#2f5a8c;font-weight:600">Save</button><button data-close>Cancel</button></div><p id="svMsg" class="muted" style="font-size:12px;margin:10px 0 0"></p></div>`);
  m.querySelector('#svGo').onclick=async()=>{ const nm=cleanText(m.querySelector('#svName').value,80)||name; m.querySelector('#svMsg').textContent='Saving…'; try{ await siteSave('save',nm); closeModal(); showNotice({kind:'good',title:'Saved to your account',text:nm,ttl:5000}); }catch(e){ m.querySelector('#svMsg').textContent='Could not save: '+e.message; } }; }
// ---- pause modal
function openPauseModal(){ if(!me||over||ROLL.on) return; if(!userPaused) togglePause(); const m=openModal(`<div class="card" style="text-align:center;width:min(440px,94vw)"><h2 style="margin:0 0 6px;font-size:26px">Paused</h2><p class="muted" style="margin:0 0 16px;font-size:13px">The clock is stopped. Look around the map if you like.</p><div style="display:grid;gap:8px"><button id="pmResume" style="background:#2f5a8c;font-weight:600;text-align:center;font-size:15px;padding:10px">▶ Resume</button><button id="pmSave" style="text-align:center;padding:10px">Save &amp; quit — keep this match on your account and leave</button><button id="pmRestart" style="text-align:center;padding:10px">Restart — abandon this match</button></div><p class="muted" style="font-size:11px;margin:12px 0 0">Space or Esc resumes.</p></div>`);
  m.querySelector('#pmResume').onclick=()=>{ closeModal(); if(userPaused) togglePause(); };
  m.querySelector('#pmSave').onclick=()=>{ closeModal(); saveAndQuit(); };
  m.querySelector('#pmRestart').onclick=()=>{ closeModal(); $('restart').style.display='flex'; $('restart').dataset.wasPaused='1'; }; }
function closePauseModal(){ const m=$('modal'); if(m.style.display!=='none'&&m.querySelector('#pmResume')){ closeModal(); if(userPaused) togglePause(); return true; } return false; }
// ---- Games & replays
async function openGamesModal(){ if(!canSave()){ openModal(loginPitch('Games & replays')); return; }
  const m=openModal(`<div class="card" style="text-align:left;width:min(760px,94vw);max-height:90vh;overflow:auto"><div class="row" style="align-items:center"><h2 style="margin:0;font-size:22px">Games &amp; replays</h2><button data-close>Close</button></div><p class="muted" style="font-size:13px;margin:6px 0 10px">Saved matches resume where you left off. Finished matches are kept as replays you can watch at up to 8× — or take over and play differently.</p><div id="gmBody"><p class="muted">Loading…</p></div></div>`);
  const body=m.querySelector('#gmBody'); const fmtT=s=>{ const d=new Date(s.replace(' ','T')+'Z'); return isNaN(d)?s:d.toLocaleString(); };
  try{ const j=await sfApi('saves'); SAVES.list=j.saves||[]; SAVES.loaded=true; const saves=SAVES.list.filter(x=>x.kind==='save'), reps=SAVES.list.filter(x=>x.kind==='replay');
    const row=(x,isRep)=>`<tr data-id="${x.id}"><td><b>${x.slot}</b><br><span class="muted" style="font-size:11px">${x.seed} · ${x.country} · ${(DIFFS[x.diff]||{}).label||x.diff} · ${x.cls||''} · v${x.gameVersion}</span></td><td>${x.minutes} min${isRep?'<br><span class="muted" style="font-size:11px">'+x.result+'</span>':''}</td><td class="muted" style="font-size:12px">${fmtT(x.updatedAt)}</td><td style="white-space:nowrap"><button data-act="${isRep?'watch':'resume'}" style="padding:4px 10px;background:#2f5a8c">${isRep?'Watch':'Resume'}</button> ${isRep?'':'<button data-act="watch" style="padding:4px 8px">Watch</button> '}<button data-act="rename" style="padding:4px 8px">Rename</button> <button data-act="dl" style="padding:4px 8px" title="Download a copy (.state)">Download</button> <button data-act="del" style="padding:4px 8px">Delete</button></td></tr>`;
    body.innerHTML=`<h3 style="margin:8px 0 4px;font-size:14px;color:var(--muted)">SAVED GAMES (${saves.length}/${j.limits.save})</h3>`+(saves.length?`<table class="lbt">${saves.map(x=>row(x,false)).join('')}</table>`:'<p class="muted" style="font-size:13px">No saved games. The game autosaves every 30 seconds while you play; Save &amp; quit on the pause card keeps a named copy.</p>')+`<h3 style="margin:14px 0 4px;font-size:14px;color:var(--muted)">REPLAYS (${reps.length}/${j.limits.replay})</h3>`+(reps.length?`<table class="lbt">${reps.map(x=>row(x,true)).join('')}</table>`:'<p class="muted" style="font-size:13px">No replays yet — every match you finish is kept here automatically.</p>');
    body.querySelectorAll('button[data-act]').forEach(b=>b.onclick=async()=>{ const id=+b.closest('tr').dataset.id; const act=b.dataset.act; const item=SAVES.list.find(x=>x.id===id);
      if(act==='del'){ if(!confirm(`Delete "${item.slot}"?`)) return; await sfApi('saves/'+id,{method:'DELETE'}); openGamesModal(); return; }
      if(act==='rename'){ const nm=prompt('New name',item.slot); if(!nm) return; await sfApi('saves/'+id,{method:'POST',body:{slot:cleanText(nm,80)}}); openGamesModal(); return; }
      const full=await sfApi('saves/'+id); if(act==='dl'){ const blob=new Blob([JSON.stringify(full.data)],{type:'application/octet-stream'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`statefall-${item.kind==='replay'?'replay':'game'}-${item.seed}-${item.updatedAt.slice(0,10)}.state`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); return; }
      closeModal(); loadReplayFile(full.data,act==='resume'?'resume':'watch',item); }); }
  catch(e){ body.innerHTML='<p class="muted">Could not load your saves ('+e.message+').</p>'; } }
// ---- catch-up: run the sim silently in slices with a progress bar, then wait for Play now
function replayCatchUp(target,label,onDone){ SAVES.catchup=true; paused=false; userPaused=false; const startTick=tickN; const m=openModal(`<div class="card" style="text-align:center;width:min(460px,94vw)"><h2 style="margin:0 0 6px;font-size:22px">${label||'Loading your match'}</h2><p class="muted" id="cuInfo" style="font-size:13px;margin:0 0 10px">Catching up…</p><div style="height:10px;background:#0f1a26;border-radius:5px;overflow:hidden"><div id="cuBar" style="height:100%;width:0;background:#7fb3ff"></div></div><div id="cuDone" style="display:none;margin-top:14px"><p style="margin:0 0 10px">Game loaded.</p><button id="cuPlay" style="background:#2f5a8c;font-weight:600;font-size:15px;padding:10px 24px;text-align:center">${onDone&&onDone.label||'▶ Play now'}</button></div></div>`);
  const bar=m.querySelector('#cuBar'), info=m.querySelector('#cuInfo'); const clock=t=>`${Math.floor(t*TICK/60000)}:${String(Math.floor(t*TICK/1000%60)).padStart(2,'0')}`;
  const step=()=>{ const t0=performance.now(); while(tickN<target&&performance.now()-t0<60) tick(); const pr=Math.min(1,(tickN-startTick)/Math.max(1,target-startTick)); bar.style.width=(pr*100).toFixed(1)+'%'; info.textContent=`Catching up… ${clock(tickN)} of ${clock(target)}`;
    if(tickN<target&&!over){ requestAnimationFrame(step); return; }
    SAVES.catchup=false; document.querySelectorAll('#notices .notice').forEach(n=>n.remove()); badges.length=0; nukeAlerts.length=0; songBanner=null; drawMap(); updateUI(); computeLabelPos(); info.textContent=`Ready at ${clock(tickN)}.`; bar.style.width='100%'; m.querySelector('#cuDone').style.display='';
    userPaused=true; paused=true; $('pauseBtn').textContent='\u25B6';
    m.querySelector('#cuPlay').onclick=()=>{ closeModal(); if(onDone&&onDone.fn) onDone.fn(); userPaused=false; paused=false; $('pauseBtn').textContent='\u275A\u275A'; if(AUD.ctx&&AUD.vol.musicOn) MUS.start('game'); }; };
  requestAnimationFrame(step); }

const MUS={mode:null,next:0,bar:0,timer:null,section:0,intensity:0,lead:0};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function mnote(o){ // {m midi, t start, d dur, g gain, type, a attack, det, lp}
  const C=AUD.ctx; const t=o.t, f=mtof(o.m); const g=C.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(o.g,t+(o.a||0.02)); g.gain.setValueAtTime(o.g,t+Math.max(o.a||0.02,o.d-0.08)); g.gain.exponentialRampToValueAtTime(0.0001,t+o.d+0.02);
  let node=g; if(o.lp){ const fl=C.createBiquadFilter(); fl.type='lowpass'; fl.frequency.setValueAtTime(o.lp,t); if(o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2,t+o.d); fl.Q.value=0.8; g.connect(fl); node=fl; }
  node.connect(AUD.bus.music);
  const voices=o.det?[-o.det,0,o.det]:[0];
  for(const dv of voices){ const osc=C.createOscillator(); osc.type=o.type||'triangle'; osc.frequency.value=f*Math.pow(2,dv/1200); osc.connect(g); osc.start(t); osc.stop(t+o.d+0.05); }
}
function mperc(kind,t,g){ const C=AudioContextRef(); if(!C) return; const src=C.createBufferSource(); src.buffer=getNoise(); const f=C.createBiquadFilter(); const gn=C.createGain();
  if(kind==='hat'){ f.type='highpass'; f.frequency.value=6000; gn.gain.setValueAtTime(g,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.05); }
  else { f.type='lowpass'; f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(60,t+0.25); gn.gain.setValueAtTime(g,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.3); const o=C.createOscillator(); o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(40,t+0.25); const og=C.createGain(); og.gain.setValueAtTime(g*1.2,t); og.gain.exponentialRampToValueAtTime(0.0001,t+0.3); o.connect(og); og.connect(AUD.bus.music); o.start(t); o.stop(t+0.35); }
  src.connect(f); f.connect(gn); gn.connect(AUD.bus.music); src.start(t); src.stop(t+0.4); }
function AudioContextRef(){ return AUD.ctx; }
// --- menu theme: D minor, 84 bpm, 32 bars. chords as root midi + intervals; melody as [bar, beat, midi, beats]
const MENU={bpm:84,chords:[[50,[0,3,7]],[46,[0,4,7]],[41,[0,4,7]],[48,[0,4,7]],[50,[0,3,7]],[46,[0,4,7]],[43,[0,3,7]],[45,[0,4,7]]],
  melody:[[0,0,69,2],[0,2,72,1],[0,3,74,1],[1,0,77,3],[1,3,74,1],[2,0,72,2],[2,2,69,1],[2,3,72,1],[3,0,74,4],
          [4,0,69,2],[4,2,72,1],[4,3,74,1],[5,0,77,2],[5,2,79,2],[6,0,77,1],[6,1,74,1],[6,2,72,1],[6,3,70,1],[7,0,69,4],
          [8,0,74,1],[8,1,77,1],[8,2,81,2],[9,0,79,3],[9,3,77,1],[10,0,74,2],[10,2,72,2],[11,0,70,4],
          [12,0,74,1],[12,1,77,1],[12,2,81,2],[13,0,84,2],[13,2,81,2],[14,0,79,2],[14,2,77,1],[14,3,74,1],[15,0,73,3],[15,3,74,1]]};
// --- game score: sections cycle every 64 bars; each has a progression and a scale for arpeggios
const GAME={bpm:72,sections:[
  {chords:[[45,[0,3,7,10]],[41,[0,4,7,11]],[48,[0,4,7]],[43,[0,4,7]]],scale:[57,59,60,62,64,65,67,69,71,72,74,76]},        // A minor / C major
  {chords:[[41,[0,4,7,11]],[43,[0,4,7,9]],[45,[0,3,7]],[43,[0,4,7]]],scale:[53,55,57,59,60,62,64,65,67,69,71,72]},         // F lydian
  {chords:[[38,[0,3,7,10]],[46,[0,4,7,11]],[41,[0,4,7]],[45,[0,4,7]]],scale:[50,53,55,57,58,60,62,65,67,69,70,72]},        // D dorian-ish
]};
const ARP_PATTERNS=[[0,1,2,3,2,1,0,1],[0,2,1,3,0,2,1,3],[0,1,2,1,3,2,1,0],[3,2,1,0,1,2,3,2],[0,0,2,1,3,3,1,2]];
MUS._start=function(mode){ if(!AUD.ctx) return; if(MUS.timer) clearInterval(MUS.timer); MUS.mode=mode; MUS.bar=0; MUS.section=0; MUS.next=AUD.ctx.currentTime+0.1; MUS.timer=setInterval(MUS.tick,200); };
MUS.start=function(mode){ if(JUKE.loaded){ jukeStart(mode); return; } MUS._start(mode); };
MUS.stop=function(){ if(MUS.timer) clearInterval(MUS.timer); MUS.timer=null; MUS.mode=null; };
MUS.tick=function(){ if(!AUD.ctx||!MUS.mode||!AUD.vol.musicOn) return; while(MUS.next<AUD.ctx.currentTime+1.2){ MUS.mode==='menu'?MUS.menuBar():MUS.gameBar(); } };
MUS.menuBar=function(){ const t=MUS.next, bl=60/MENU.bpm*4, b=MUS.bar%16; const [root,iv]=MENU.chords[b%8];
  // pad: three detuned saws through a slow filter; bass: root every bar with a lift on beat 3
  for(const i of iv) mnote({m:root+12+i,t,d:bl*0.98,g:0.045,type:'sawtooth',a:0.9,det:7,lp:900,lp2:500});
  mnote({m:root,t,d:bl*0.5,g:0.12,type:'sine',a:0.02}); mnote({m:root+7,t:t+bl*0.5,d:bl*0.45,g:0.08,type:'sine',a:0.02});
  for(const [bar,beat,m,beats] of MENU.melody){ if(bar!==b) continue; mnote({m,t:t+beat*bl/4,d:beats*bl/4*0.92,g:0.07,type:'triangle',a:0.05,det:5,lp:2200}); mnote({m:m-12,t:t+beat*bl/4,d:beats*bl/4*0.92,g:0.03,type:'sawtooth',a:0.08,lp:900}); }
  if(b>=8){ for(let k=0;k<4;k++) mperc('hat',t+k*bl/4+bl/8,0.02); mperc('kick',t,0.18); mperc('kick',t+bl*0.5,0.1); }
  MUS.next+=bl; MUS.bar++; };
MUS.gameBar=function(){ const t=MUS.next, bl=60/GAME.bpm*4; if(MUS.bar%64===0&&MUS.bar>0) MUS.section=(MUS.section+1)%GAME.sections.length;
  const S=GAME.sections[MUS.section]; const [root,iv]=S.chords[MUS.bar%4];
  // intensity: how hard the player is being pressed right now (0..1), smoothed
  const pressed=me?attacks.filter(a=>a.target===me.id).reduce((n,a)=>n+a.troops,0):0; const want=me?Math.min(1,pressed/Math.max(200,me.troops*0.4)):0; MUS.intensity+=(want-MUS.intensity)*0.25;
  // pad every bar, quieter when calm
  for(const i of iv) mnote({m:root+12+i,t,d:bl*0.98,g:0.035+0.02*MUS.intensity,type:'sawtooth',a:1.2,det:6,lp:700+500*MUS.intensity,lp2:450});
  // bass: root on 1, sometimes the fifth on the and-of-3
  mnote({m:root,t,d:bl*0.6,g:0.09,type:'sine',a:0.03}); if(Math.random()<0.5) mnote({m:root+7,t:t+bl*0.625,d:bl*0.3,g:0.06,type:'sine',a:0.02});
  // arpeggio: a pattern from the bank over the chord tones, sparse when calm, denser when pressed
  const tones=iv.map(i=>root+24+i); const pat=upick(ARP_PATTERNS); const dens=0.35+0.5*MUS.intensity;
  for(let k=0;k<8;k++){ if(Math.random()>dens&&k%2) continue; const m=tones[pat[k]%tones.length]+(Math.random()<0.15?12:0); mnote({m,t:t+k*bl/8,d:bl/8*0.9,g:0.04,type:'triangle',a:0.01,lp:2600,lp2:900}); }
  // lead: an occasional short phrase from the scale, more often in the second half of a section
  if(MUS.lead<=0&&Math.random()<(MUS.bar%64>32?0.35:0.18)){ MUS.lead=2+Math.floor(Math.random()*3); let m=upick(S.scale.slice(4,10)); const n=3+Math.floor(Math.random()*4); let tt=t+bl*(Math.random()<0.5?0:0.5);
    for(let k=0;k<n;k++){ const step=[-2,-1,-1,1,1,2][Math.floor(Math.random()*6)]; const i=Math.max(0,Math.min(S.scale.length-1,S.scale.indexOf(m)+step)); m=S.scale[i]; const d=bl/4*(k===n-1?1.6:[0.5,1,1,1.5][Math.floor(Math.random()*4)]); mnote({m:m+12,t:tt,d:d*0.9,g:0.05,type:'triangle',a:0.04,det:4,lp:2000}); tt+=d; } }
  else MUS.lead--;
  // pulse and hats rise with intensity
  if(MUS.intensity>0.25){ mperc('kick',t,0.14*MUS.intensity); mperc('kick',t+bl*0.5,0.08*MUS.intensity); if(MUS.intensity>0.5) for(let k=0;k<8;k++) mperc('hat',t+k*bl/8,0.012*MUS.intensity); }
  MUS.next+=bl; MUS.bar++; };
function startAmbient(){ const C=AUD.ctx;
  const src=C.createBufferSource(); src.buffer=getNoise(); src.loop=true; const f=C.createBiquadFilter(); f.type='lowpass'; f.frequency.value=260; const g=C.createGain(); g.gain.value=0.35;
  const lfo=C.createOscillator(); lfo.frequency.value=0.12; const lg=C.createGain(); lg.gain.value=0.18; lfo.connect(lg); lg.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(AUD.bus.amb); src.start(); lfo.start();
  for(const [fr,gn] of [[55,.06],[82.4,.03],[55.5,.04]]){ const o=C.createOscillator(); o.type='sine'; o.frequency.value=fr; const og=C.createGain(); og.gain.value=gn; o.connect(og); og.connect(AUD.bus.amb); o.start(); }
}

// ---------------------------------------------------------------- map generation (value noise)
function genMap(){
  land=new Uint8Array(W*H); owner=new Int16Array(W*H).fill(-1);
  struct=new Uint8Array(W*H); structOwner=new Int16Array(W*H).fill(-1); river=new Uint8Array(W*H); shelled=new Int32Array(W*H); rough=new Float32Array(W*H);
  const layers=[[18,.5],[36,.5],[72,.6],[144,.7]];
  const grids=layers.map(([s])=>{
    const gw=Math.ceil(W/s)+2, gh=Math.ceil(H/s)+2;
    return {s,gw,gh,v:Float32Array.from({length:gw*gh},()=>srand())};
  });
  const smooth=t=>t*t*(3-2*t);
  const n=(x,y)=>{
    let v=0, amp=0;
    grids.forEach((g,i)=>{
      const fx=x/g.s, fy=y/g.s, x0=Math.floor(fx), y0=Math.floor(fy), tx=smooth(fx-x0), ty=smooth(fy-y0);
      const a=g.v[y0*g.gw+x0], b=g.v[y0*g.gw+x0+1], c=g.v[(y0+1)*g.gw+x0], d=g.v[(y0+1)*g.gw+x0+1];
      v+=((a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty)*layers[i][1]; amp+=layers[i][1];
    });
    return v/amp;
  };
  // seed several continents far apart, shape each with noise, sprinkle islands in open ocean
  const GEN={random:{K:[6,8],r:[70,125],gap:18,body:0.7,thr:0.25,isl:0.68},islands_l:{K:[12,16],r:[38,62],gap:14,body:0.75,thr:0.25,isl:0.72},islands_m:{K:[22,30],r:[24,38],gap:10,body:0.8,thr:0.25,isl:0.74},islands_s:{K:[45,65],r:[12,22],gap:7,body:0.9,thr:0.22,isl:0.76}}[START.map]||{K:[6,8],r:[70,125],gap:18,body:0.7,thr:0.25,isl:0.68};
  const conts=[]; const K=GEN.K[0]+Math.floor(srand()*(GEN.K[1]-GEN.K[0]+1));
  for(let tries=0;tries<4000&&conts.length<K;tries++){
    const r=rnd(GEN.r[0],GEN.r[1]), x=rnd(r+6,W-r-6), y=rnd(r+6,H-r-6);
    if(conts.every(c=>Math.hypot(c.x-x,c.y-y)>c.r+r+GEN.gap)) conts.push({x,y,r,ax:rnd(0.75,1.35),rot:rnd(0,Math.PI),a1:rnd(0.12,0.32),k1:2+Math.floor(srand()*3),p1:rnd(0,6.28),a2:rnd(0.05,0.18),k2:5+Math.floor(srand()*4),p2:rnd(0,6.28)});
  }
  const rn=(()=>{ const L=[[6,.5],[12,.5],[24,.7]]; const gs=L.map(([sz])=>{ const gw=Math.ceil(W/sz)+2, gh=Math.ceil(H/sz)+2; return {sz,gw,v:Float32Array.from({length:gw*gh},()=>srand())}; });
    return (x,y)=>{ let v=0,amp=0; gs.forEach((g,i)=>{ const fx=x/g.sz,fy=y/g.sz,x0=Math.floor(fx),y0=Math.floor(fy),tx=smooth(fx-x0),ty=smooth(fy-y0); const a=g.v[y0*g.gw+x0],b=g.v[y0*g.gw+x0+1],c=g.v[(y0+1)*g.gw+x0],d=g.v[(y0+1)*g.gw+x0+1]; v+=((a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty)*L[i][1]; amp+=L[i][1]; }); return v/amp; }; })();
  if(MAPS[START.map]){ // prebuilt map: decode the country grid
    PRESET=MAPS[START.map]; cid=new Int16Array(W*H); let i=0; const r=PRESET.rle; for(let k=0;k<r.length;k+=2){ const v=r[k]-1, n=r[k+1]; for(let j=0;j<n;j++) cid[i++]=v; }
    landCount=0; for(let t=0;t<W*H;t++){ rough[t]=rn(t%W,(t-t%W)/W); if(cid[t]>=0){ land[t]=1; landCount++; } }
    findRegions(); for(const rg of regions) if(rg.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===rg.id){ land[t]=0; region[t]=-1; landCount--; } rg.size=0; }
    nameRegionsByContinent(); carveRivers(); cleanupFragments(); return;
  }
  PRESET=null; cid=null;
  if(START.map==='atoll'){ // a great ring of land around a central lagoon, open sea outside, gaps and lumps from the noise
    const cx=W/2, cy=H/2, ax=W*0.36, ay=H*0.33, rot=rnd(-0.2,0.2), a1=rnd(0.05,0.12), k1=2+Math.floor(srand()*3), p1=rnd(0,6.28);
    const chans=[]; { const nC=2+Math.floor(srand()*2); const base=rnd(0,6.28); for(let i=0;i<nC;i++) chans.push({a:base+i*6.28/nC+rnd(-0.5,0.5),w:rnd(0.05,0.09)}); } // passages from the sea into the lagoon
    landCount=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); rough[t]=rn(x,y);
      const ux=x-cx, uy=y-cy; const rx=ux*Math.cos(rot)+uy*Math.sin(rot), ry=-ux*Math.sin(rot)+uy*Math.cos(rot);
      const th=Math.atan2(ry/ay,rx/ax); const e=Math.hypot(rx/ax,ry/ay)*(1+a1*Math.sin(k1*th+p1)); // 1 = ring centerline
      const width=0.22+0.09*Math.sin(3*th+p1*2)+0.07*Math.sin(7*th-p1); // ring thickness varies around the loop
      const ring=1-Math.abs(e-1)/width; // 1 at the centerline, 0 at the edges of the ring
      const v=ring*0.75+n(x,y)*0.45+rough[t]*0.3-0.42;
      const lagoonIsle=e<0.45&&n(x,y)>0.74&&rough[t]>0.5; // a few islets inside the lagoon
      const inChannel=chans.some(c=>{ let d=th-c.a; d=Math.atan2(Math.sin(d),Math.cos(d)); return Math.abs(d)<c.w&&e>0.55; });
      if((v>0.25&&!inChannel)||lagoonIsle){ land[t]=1; landCount++; } }
    findRegions(); for(const rg of regions) if(rg.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===rg.id){ land[t]=0; region[t]=-1; landCount--; } rg.size=0; }
    carveRivers(); cleanupFragments(); return;
  }
  if(START.map==='land'){ // one great landmass: lakes from the noise field, many rivers, no ocean
    landCount=0; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); rough[t]=rn(x,y); const v=n(x,y); if(v<0.71){ land[t]=1; landCount++; } }
    findRegions(); for(const rg of regions) if(rg.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===rg.id){ land[t]=0; region[t]=-1; landCount--; } rg.size=0; }
    // small ponds become land again so lakes are few and large
    { const seen=new Uint8Array(W*H), q=new Int32Array(W*H); for(let t0=0;t0<W*H;t0++){ if(land[t0]||seen[t0]) continue; let h=0,tl=0; q[tl++]=t0; seen[t0]=1; const ch=[t0];
      while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const nn=idx(x+dx,y+dy); if(!land[nn]&&!seen[nn]){ seen[nn]=1; q[tl++]=nn; ch.push(nn); } } }
      if(ch.length<400){ for(const t of ch){ land[t]=1; landCount++; } } }
      findRegions(); }
    carveRivers(true); cleanupFragments(); return;
  }
  landCount=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    rough[idx(x,y)]=rn(x,y);
    let best=0, near=1e9;
    for(const c of conts){ const ux=x-c.x, uy=y-c.y; const rx=ux*Math.cos(c.rot)+uy*Math.sin(c.rot), ry=-ux*Math.sin(c.rot)+uy*Math.cos(c.rot); const th=Math.atan2(ry,rx);
      const rr=c.r*(1+c.a1*Math.sin(c.k1*th+c.p1)+c.a2*Math.sin(c.k2*th+c.p2)); // lumpy outline, different for every island
      const d=Math.hypot(rx*c.ax,ry/c.ax); near=Math.min(near,d-rr); const f=1-d/rr; if(f>best) best=f; }
    const nv=n(x,y);
    let v=best*GEN.body+nv*0.45+rough[idx(x,y)]*0.3-0.28;
    if(near>12&&nv>GEN.isl) v=1;
    if(v>GEN.thr){land[idx(x,y)]=1;landCount++;}
  }
  findRegions();
  for(const r of regions) if(r.size<LAND_MIN){ for(let t=0;t<W*H;t++) if(region[t]===r.id){ land[t]=0; region[t]=-1; landCount--; } r.size=0; }
  carveRivers(); cleanupFragments();
}
function cleanupFragments(){
  { // fragments the rivers cut off (or created mid-stream) that are too small to matter become water
    const seen=new Uint8Array(W*H), q=new Int32Array(W*H);
    for(let t0=0;t0<W*H;t0++){ if(!land[t0]||seen[t0]) continue; let h=0,tl=0; q[tl++]=t0; seen[t0]=1; const chunk=[t0];
      while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&!seen[n]){ seen[n]=1; q[tl++]=n; chunk.push(n); } } }
      if(chunk.length<LAND_MIN) for(const t of chunk){ land[t]=0; river[t]=1; landCount--; if(region[t]>=0) regions[region[t]].size--; } }
  }
}
function nameRegionsByContinent(){ // on real maps, landmasses take the name of the continent most of their countries belong to
  const used={};
  for(const rg of regions){ if(rg.size<REGION_MIN) continue; const tally={}; for(let t=0;t<W*H;t+=3){ if(region[t]!==rg.id||cid[t]<0) continue; const c=PRESET.cont[cid[t]]||'Land'; tally[c]=(tally[c]||0)+1; }
    let best='Land',bn=0; for(const k in tally) if(tally[k]>bn){bn=tally[k];best=k;} used[best]=(used[best]||0)+1; rg.name=used[best]>1?`${best} (${used[best]})`:best; rg.cont=rg.size>=CONTINENT_MIN; }
}
const SYL=['al','dra','ke','sh','or','mi','van','tor','is','el','ra','no','qu','ith','ar','bel','os','ty','ul','mar'];
function regionName(cont){ let n=''; const k=2+Math.floor(srand()*2); for(let i=0;i<k;i++) n+=pick(SYL); n=n[0].toUpperCase()+n.slice(1); return cont?n:'Isle of '+n; }
function findRegions(){ // flood-fill landmasses
  region=new Int16Array(W*H).fill(-1); regions=[]; const q=new Int32Array(W*H);
  for(let t0=0;t0<W*H;t0++){ if(!land[t0]||region[t0]>=0) continue;
    const id=regions.length; let h=0,tl=0; q[tl++]=t0; region[t0]=id; let size=0, sx=0, sy=0;
    while(h<tl){ const c=q[h++]; size++; sx+=c%W; sy+=(c-c%W)/W; const x=c%W,y=(c-x)/W;
      for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&region[n]<0){region[n]=id;q[tl++]=n;} } }
    regions.push({id,size,cx:sx/size,cy:sy/size,cont:size>=CONTINENT_MIN,name:''});
  }
  for(const r of regions) if(r.size>=REGION_MIN) r.name=regionName(r.cont);
}
function carveRivers(landMode){
  for(const r of regions){ if(!r.cont) continue;
    const coast=[]; for(let t=0;t<W*H;t+=2){ if(region[t]!==r.id||!land[t]) continue; const x=t%W,y=(t-x)/W; if(isCoast(t)||(landMode&&(x<2||y<2||x>=W-2||y>=H-2))) coast.push(t); }
    if(coast.length<20) continue;
    const count=landMode?Math.min(14,4+Math.floor(r.size/12000)):Math.min(3,1+Math.floor(r.size/9000));
    for(let k=0;k<count;k++){
      const A=pick(coast); const ax=A%W,ay=(A-ax)/W; let B=A,bd=0;
      for(let i=0;i<40;i++){ const c=pick(coast); const d=(c%W-ax)**2+((c-c%W)/W-ay)**2; if(d>bd){bd=d;B=c;} }
      const bx=B%W,by=(B-bx)/W, L=Math.hypot(bx-ax,by-ay); if(L<60) continue;
      const nx=-(by-ay)/L, ny=(bx-ax)/L, a1=rnd(8,22), a2=rnd(3,8), f1=rnd(1,2.5), f2=rnd(4,7), p1=rnd(0,6.28), p2=rnd(0,6.28);
      for(let i=0;i<=L;i+=0.7){ const u=i/L, off=a1*Math.sin(u*Math.PI*f1+p1)*Math.sin(u*Math.PI)+a2*Math.sin(u*Math.PI*f2+p2);
        const x=ax+(bx-ax)*u+nx*off, y=ay+(by-ay)*u+ny*off;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const X=Math.round(x+dx),Y=Math.round(y+dy); if(!inb(X,Y)) continue; if(dx*dx+dy*dy>1.5) continue;
          const t=idx(X,Y); if(land[t]){ land[t]=0; river[t]=1; landCount--; regions[region[t]].size--; } } }
    }
  }
}
function markHostile(a,b){ if(a<0||b<0||a===b) return; hostile[a+','+b]=tickN; hostile[b+','+a]=tickN; }
function inConflict(a,b){ if(a===b) return false; if(atPeace(a,b)) return false; const h=hostile[a+','+b]; return h!=null&&tickN-h<600; }
function setOwner(t,o){ // every ownership change goes through here
  const prev=owner[t]; if(prev===o) return;
  if(prev>=0){ players[prev].tiles--; regCount[region[t]*NP+prev]--; }
  if(o>=0){ players[o].tiles++; regCount[region[t]*NP+o]++; unclaimed.delete(t); } else if(land[t]) unclaimed.add(t);
  owner[t]=o;
}
function isCoast(t){
  const x=t%W,y=(t-x)/W;
  return land[t]&&N4.some(([dx,dy])=>inb(x+dx,y+dy)&&!land[idx(x+dx,y+dy)]);
}
function claimBlob(p,cx,cy,r){
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
    if(inb(x,y)&&land[idx(x,y)]&&(owner[idx(x,y)]<0||players[owner[idx(x,y)]].kind==='neutral')&&(x-cx)**2+(y-cy)**2<=r*r) setOwner(idx(x,y),p.id);
  }
}
function findSpawn(minDist){
  for(let tries=0;tries<400;tries++){
    const x=Math.floor(rnd(6,W-6)), y=Math.floor(rnd(6,H-6));
    if(!land[idx(x,y)]||regions[region[idx(x,y)]].size<(START.map==='islands_s'?300:START.map==='islands_m'?700:1500)) continue;
    let ok=true;
    for(const p of players){ if(p.sx==null) continue; if((p.sx-x)**2+(p.sy-y)**2<minDist*minDist){ok=false;break;} }
    if(ok) return [x,y];
  }
  return null;
}

// ---------------------------------------------------------------- flags (real countries, drawn from a small layer spec)
// layers: ['h',c1,c2,...] equal horizontal bands · ['v',...] vertical · ['rect',c,x,y,w,h] · ['disc',c,cx,cy,r] · ['ring',c,cx,cy,r,t]
// ['star',c,cx,cy,r,pts] · ['tri',c,[x,y],[x,y],[x,y]] · ['cross',c,t,cx] (nordic) · ['sal',c,t] saltire · ['cres',c,cx,cy,r,bg]
function flagURL(f,w=36,h=24){ const key='_u'+w; if(f[key]) return f[key]; const cv2=document.createElement('canvas'); cv2.width=w; cv2.height=h; drawFlag(cv2.getContext('2d'),f,0,0,w,h); f[key]=cv2.toDataURL(); return f[key]; }
let countryPool=[];
function resetCountryPool(){ countryPool=COUNTRIES.map((c,i)=>i); for(let i=countryPool.length-1;i>0;i--){ const j=Math.floor(srand()*(i+1)); [countryPool[i],countryPool[j]]=[countryPool[j],countryPool[i]]; } }
function takeCountry(){ if(!countryPool.length) return null; const i=countryPool.pop(); return {name:COUNTRIES[i][0],layers:COUNTRIES[i].slice(1),idx:i}; }
function countryByIdx(i){ return {name:COUNTRIES[i][0],layers:COUNTRIES[i].slice(1),idx:i}; }
function myNation(){ const n=WP&&WP.user&&WP.user.nation; if(!n||!n.flag||!Array.isArray(n.flag.layers)||!(n.tier>=1)) return null; return {name:n.tier>=2&&n.name?n.name:(WP.user.name||'Your nation'),layers:n.flag.layers,idx:-1,custom:true,userId:WP.user.id}; }
function nationOption(){ const sel=$('countrySel'); if(!sel||sel.querySelector('option[value="-1"]')) return; const n=myNation(); if(!n) return; const o=document.createElement('option'); o.value='-1'; o.textContent='★ '+n.name+' (your nation)'; sel.insertBefore(o,sel.firstChild); }
function renderFlagPicker(){ const g=$('flags'); g.innerHTML=''; const pool=COUNTRIES.map((c,i)=>i).sort(()=>Math.random()-.5).slice(0,12);
  { const n=myNation(); if(n){ nationOption(); const b=document.createElement('button'); b.className='flagbtn on'; b.style.outline='2px solid var(--gold)'; b.title=n.name; b.innerHTML=`<img src="${flagURL(n,72,48)}" alt=""><span>★ ${n.name}</span>`; b.onclick=()=>{ chosenFlag=n; document.querySelectorAll('.flagbtn').forEach(x=>x.classList.remove('on')); b.classList.add('on'); $('countrySel').value='-1'; }; g.appendChild(b); chosenFlag=n; $('countrySel').value='-1'; pool.length=11; } }
  pool.forEach((i,n)=>{ const f=countryByIdx(i); const b=document.createElement('button'); b.className='flagbtn'; b.title=f.name; b.innerHTML=`<img src="${flagURL(f,72,48)}" alt=""><span>${f.name}</span>`; b.onclick=()=>{ chosenFlag=f; document.querySelectorAll('.flagbtn').forEach(x=>x.classList.remove('on')); b.classList.add('on'); $('countrySel').value=i; }; g.appendChild(b); if(n===0&&!myNation()){ chosenFlag=f; b.classList.add('on'); $('countrySel').value=i; } }); }
let chosenFlag=null;

// ---------------------------------------------------------------- players
function hslHex(h,sl,l){ const a=sl*Math.min(l,1-l)/100*100; const f=n=>{const k=(n+h/30)%12; const c=l*100-a*Math.max(-1,Math.min(k-3,9-k,1)); return Math.round(c*2.55).toString(16).padStart(2,'0');}; return '#'+f(0)+f(8)+f(4); }
const NEUTRAL_KIND=['Republic of ','Kingdom of ','Duchy of ','Emirate of ','Free State of ','Commonwealth of ','Principality of ',''];
function flagFor(name){ const n=NE_ALIAS[name]||name; const i=COUNTRIES.findIndex(c=>c[0]===n); return i>=0?countryByIdx(i):{name,layers:[['rect','#8a8f86',0,0,1,1]],generic:true}; }
function makeNeutrals(){
  if(PRESET){ const byC={}; for(let t=0;t<W*H;t++){ if(!land[t]||cid[t]<0) continue; (byC[cid[t]]??=[]).push(t); }
    const q=new Int32Array(W*H);
    const per=Math.max(TILES_PER_NEUTRAL,landCount/75); // the same country-size rule as generated maps: big real countries split into provinces
    for(const k in byC){ const tiles=byC[k]; if(tiles.length<80) continue; const name=PRESET.names[k]; const flag=flagFor(name);
      const parts=Math.max(1,Math.round(tiles.length/per));
      if(parts===1){ const p=makePlayer(name,hslHex(srand()*360,18+srand()*10,48+srand()*12),'neutral'); p.flag=flag; p.name=name; p.country=+k; for(const t of tiles) setOwner(t,p.id); continue; }
      // multi-source flood fill inside the country's own tiles, seeds spread apart
      const seeds=[]; for(let tries=0;tries<400&&seeds.length<parts;tries++){ const t=pick(tiles); const x=t%W,y=(t-x)/W; if(seeds.every(sd=>(sd%W-x)**2+((sd-sd%W)/W-y)**2>(Math.sqrt(tiles.length/parts)*0.6)**2)) seeds.push(t); }
      const hue=srand()*360; const ids=seeds.map((sd,i)=>{ const p=makePlayer(`${name} (${regionName(true)})`,hslHex((hue+i*23)%360,18+srand()*10,44+srand()*16),'neutral'); p.flag=flag; p.name=`${name} (${regionName(true)})`; p.country=+k; return p.id; });
      let h=0,tl=0; const mine=new Uint8Array(W*H); for(const t of tiles) mine[t]=1;
      seeds.forEach((sd,i)=>{ setOwner(sd,ids[i]); q[tl++]=sd; });
      while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W, o=owner[c]; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const nn=idx(x+dx,y+dy); if(mine[nn]&&owner[nn]<0){ setOwner(nn,o); q[tl++]=nn; } } }
    }
    for(let t0=0;t0<W*H;t0++){ if(!land[t0]||owner[t0]>=0) continue;
      let h=0,tl=0; q[tl++]=t0; const chunk=[t0]; const seen=new Set([t0]);
      while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]<0&&!seen.has(n)){ seen.add(n); q[tl++]=n; chunk.push(n); } } }
      const cx=chunk[0]%W, cy=(chunk[0]-cx)/W; let best=-1,bd=1e12;
      for(let rr=2;rr<=60&&best<0;rr+=2){ for(let y=cy-rr;y<=cy+rr;y+=1)for(let x=cx-rr;x<=cx+rr;x+=1){ if(!inb(x,y)) continue; const t=idx(x,y); if(owner[t]<0) continue; const d=(x-cx)**2+(y-cy)**2; if(d<bd){bd=d;best=owner[t];} } }
      if(best>=0) for(const t of chunk) setOwner(t,best); else for(const t of chunk) owner[t]=-2; }
    for(let t=0;t<W*H;t++) if(owner[t]===-2) owner[t]=-1;
    for(const p of players) if(p.kind==='neutral'){ p.troops=p.tiles*0.05+15; p.nextThink=rnd(1000,3000); }
    return; }
  // seed neutral nations per landmass, grow them with a multi-source flood fill so borders follow terrain
  const seeds=[];
  for(const r of regions){ if(r.size<REGION_MIN) continue; // smaller islands are absorbed by whoever is nearest
    const per=Math.max(TILES_PER_NEUTRAL,landCount/75); // bigger land, bigger countries: about 75 neutral nations at most
    const k=Math.max(1,Math.round(r.size/per));
    const tiles=[]; for(let t=0;t<W*H;t+=3) if(region[t]===r.id&&land[t]) tiles.push(t);
    for(let i=0;i<k;i++){ const p=makePlayer(regionName(true),hslHex(srand()*360,18+srand()*10,48+srand()*12),'neutral'); seeds.push([pick(tiles),p.id]); }
  }
  const q=new Int32Array(W*H); let h=0,tl=0;
  for(const [t,id] of seeds){ if(owner[t]<0){ setOwner(t,id); q[tl++]=t; } }
  while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W, o=owner[c];
    for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]<0){ setOwner(n,o); q[tl++]=n; } } }
  // land cut off by rivers or missed by seeding: each sizeable chunk becomes its own small nation
  for(let t0=0;t0<W*H;t0++){ if(!land[t0]||owner[t0]>=0) continue;
    let h=0,tl=0; q[tl++]=t0; const chunk=[t0]; const seen=new Set([t0]);
    while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]<0&&!seen.has(n)){ seen.add(n); q[tl++]=n; chunk.push(n); } } }
    if(chunk.length>=80&&players.length<NP-1){ const p=makePlayer(regionName(true),hslHex(srand()*360,18+srand()*10,48+srand()*12),'neutral'); for(const t of chunk) setOwner(t,p.id); }
    else { // a sliver: hand it to the nearest nation so no land is ever unclaimable
      const cx=chunk[0]%W, cy=(chunk[0]-cx)/W; let best=-1,bd=1e12;
      for(let rr=2;rr<=40&&best<0;rr+=2){ for(let y=cy-rr;y<=cy+rr;y+=1)for(let x=cx-rr;x<=cx+rr;x+=1){ if(!inb(x,y)) continue; const t=idx(x,y); if(owner[t]<0) continue; const d=(x-cx)**2+(y-cy)**2; if(d<bd){bd=d;best=owner[t];} } }
      if(best>=0) for(const t of chunk) setOwner(t,best); else for(const t of chunk) owner[t]=-2;
    }
  }
  for(let t=0;t<W*H;t++) if(owner[t]===-2) owner[t]=-1;
  for(const p of players) if(p.kind==='neutral'){ p.troops=p.tiles*0.05+15; p.nextThink=rnd(1000,3000); }
}
function makePlayer(name,color,kind){
  const c=kind==='neutral'&&PRESET?null:takeCountry(); const p={id:players.length,name:c?c.name:name,color,kind,flag:c||{name,layers:[['rect',color,0,0,1,1]]},troops:120,gold:100,tiles:0,alive:true,
    cities:0,factories:0,ports:0,sams:0,silos:0,nextThink:rnd(2000,5000),held:new Set(),claimed:new Set(),grudge:{},focus:0.5,rel:{},rep:0.7,penaltyUntil:0,lastProposal:{}};
  players.push(p); return p;
}
function maxTroops(p){ if(p.kind==='neutral') return 60+p.tiles*0.15; return 120+p.tiles*0.34+p.cities*400; }
function troopGrowth(p){ // per second
  const cap=maxTroops(p), fill=START.noCap&&p.kind!=='neutral'?1:Math.max(0,1-p.troops/cap);
  if(p.kind==='neutral') return (1+p.tiles*0.0015)*(isProvoked(p)?2:1)*fill; // about a quarter of a player's rate per tile, slower still when calm
  let held=0; for(const id of p.held) held+=regions[id].size;
  const empire=1+0.4*(p.tiles/Math.max(1,landCount));
  const pen=p.penaltyUntil>tickN?0.5:1; const tc=1+0.1*Math.min(4,p.troopcmds||0);
  return pen*tc*(4+p.tiles*0.0068+p.cities*3+(p.cityLinks||0)*LINK_TROOPS+held*HOLD_BONUS)*empire*(0.3+0.7*fill)*troopMult(p);
}
function goldGrowth(p){return (1.2+p.tiles*0.00077+p.factories*2.2+(p.factoryLinks||0)*2.2*LINK_GOLD_PER+p.ports*1.4+(p.portLinks||0)*LINK_PORT_GOLD)*goldMult(p);}
function troopMult(p){return p.kind==='neutral'?1:(0.4+1.2*p.focus)*(p.kind==='bot'?bd(p).eco:1);}
function goldMult(p){return p.kind==='neutral'?1:(0.4+1.2*(1-p.focus))*(p.kind==='bot'?bd(p).eco:1);}
function density(p){return p.troops/Math.max(1,p.tiles);}

function setup(){
  genMap();
  resetCountryPool(); if(chosenFlag) countryPool=countryPool.filter(i=>i!==chosenFlag.idx);
  me=makePlayer('You',COLORS[0],'human'); if(chosenFlag){ me.flag=chosenFlag; } me.name=me.flag.name; me.sx=null;
  for(let i=0;i<BOTS;i++) makePlayer(BOT_NAMES[i],COLORS[i+1],'bot');
  if(START.customBots) for(const cb of START.customBots){ const bots=players.filter(q=>q.kind==='bot'); const b=bots[Math.min(bots.length-1,cb.slot|0)]; if(b){ b.flag={name:cb.name,layers:cb.layers,idx:-1,custom:true,userId:cb.userId}; b.name=cb.name; b.customNation={userId:cb.userId,name:cb.name}; setTimeout(()=>{ log(`${cb.name}, another player's nation, has joined this war — it plays at ${(DIFF.brain||2)<4?'Super hard':DIFF.label} regardless of your difficulty.`,true); showNotice({kind:'gold',flag:b.flag,title:`${cb.name} has entered the war`,text:`A player's own nation, playing at ${(DIFF.brain||2)<4?'Super hard':DIFF.label}. Beat it and it goes on their record.`,ttl:12000}); },1500); } }
  const nPlayers=players.length;
  // neutrals are created next; size regCount for everyone once we know the total
  NP=256; regCount=new Int32Array(regions.length*NP);
  makeNeutrals();
  if(START.risky){ for(const p of players) if(p.kind!=='neutral'){ p.sx=W/2; p.sy=H/2; } }
  else if(PRESET){ // each player takes over a whole country: yours by choice, bots the biggest free ones spread out
    const free=(cap=3000)=>players.filter(q=>q.kind==='neutral'&&q.alive&&q.tiles>=250&&q.tiles<=cap); // bots don't get to start as Russia
    const takeover=(p,c)=>{ for(let t=0;t<W*H;t++) if(owner[t]===c.id) setOwner(t,p.id); c.alive=false; c.tiles=0; const siblings=players.filter(q=>q.country===c.country).length; if(!(p.flag&&p.flag.custom)){ p.name=(c.country!=null&&siblings===1)?PRESET.names[c.country]:c.name; p.flag=c.flag; } p.country=c.country; const ce=centroid(p); p.sx=ce[0]; p.sy=ce[1]; };
    const want=chosenFlag?players.filter(q=>q.kind==='neutral'&&q.alive&&q.country!=null&&(PRESET.names[q.country]===chosenFlag.name||NE_ALIAS[PRESET.names[q.country]]===chosenFlag.name)).sort((a,b)=>b.tiles-a.tiles)[0]:null;
    takeover(me, want&&want.tiles>=120?want:pick(free(4000).sort((a,b)=>b.tiles-a.tiles).slice(0,25)));
    for(const p of players){ if(p.kind!=='bot') continue; const cands=free().filter(q=>{ const c=centroid(q); return players.every(o=>o.sx==null||(o.sx-c[0])**2+(o.sy-c[1])**2>60*60); }).sort((a,b)=>b.tiles-a.tiles).slice(0,12); const c=cands.length?pick(cands):pick(free()); if(c) takeover(p,c); else { const s2=findSpawn(18)||[W>>1,H>>1]; p.sx=s2[0]; p.sy=s2[1]; claimBlob(p,s2[0],s2[1],9); } }
  } else for(const p of players){ if(p.kind==='neutral') continue;
    const s=findSpawn(START.map.startsWith('islands')?36:60)||findSpawn(18)||[W>>1,H>>1];
    p.sx=s[0];p.sy=s[1];
    claimBlob(p,s[0],s[1],9);
  }
  if(START.endgame){ // the whole map is already carved up: flood-fill outward from every player until no neutral land is left
    const q=new Int32Array(W*H); let h=0,tl=0; for(let t=0;t<W*H;t++){ if(owner[t]>=0&&players[owner[t]].kind!=='neutral') q[tl++]=t; }
    while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W, o=owner[c]; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&(owner[n]<0||players[owner[n]].kind==='neutral')){ if(struct[n]) captureStructure(n,players[o]); setOwner(n,o); q[tl++]=n; } } }
    for(let t=0;t<W*H;t++){ if(!land[t]||(owner[t]>=0&&players[owner[t]].kind!=='neutral')) continue; // islands nobody reached: nearest player
      const x=t%W,y=(t-x)/W; let best=-1,bd=1e12; for(const p of players){ if(p.kind==='neutral'||p.sx==null) continue; const d=(p.sx-x)**2+(p.sy-y)**2; if(d<bd){bd=d;best=p.id;} } if(best>=0) setOwner(t,best); }
    for(const p of players) if(p.kind==='neutral'){ p.alive=false; p.tiles=0; }
    for(const p of players) if(p.kind!=='neutral'){ const c=centroid(p); p.sx=c[0]; p.sy=c[1]; }
  }
  if(START.quick&&!START.endgame&&!START.risky){ // grow each player into its neutral neighbours until it holds a solid contiguous block
    for(const p of players){ if(p.kind==='neutral') continue;
      for(let guard=0;guard<40&&p.tiles<QUICK_TILES;guard++){ const {r}=borderOwners(p); const nb=Object.keys(r).map(Number).filter(o=>players[o].kind==='neutral'&&players[o].alive).sort((a,b)=>r[b]-r[a]);
        if(!nb.length) break; const c=players[nb[0]]; for(let t=0;t<W*H;t++) if(owner[t]===c.id) setOwner(t,p.id); for(const st of structures) if(st.owner===c.id) captureStructure(st.t,p); c.alive=false; c.tiles=0; }
      const ce=centroid(p); p.sx=ce[0]; p.sy=ce[1]; } }
  for(let t=0;t<W*H;t++) if(land[t]&&owner[t]<0) unclaimed.add(t);
  for(const p of players) if(p.kind==='neutral'&&p.tiles<=0) p.alive=false;
  me.troops=START.troops; me.gold=START.gold; if(START.bots) for(const p of players) if(p.kind==='bot'){ p.troops=START.troops; p.gold=START.gold; }
  if(START.quick&&!START.endgame) for(const p of players) if(p.kind!=='neutral'){ p.troops*=4; p.gold*=5; }
  if(START.endgame) for(const p of players) if(p.kind!=='neutral'){ p.troops=45000; p.gold=15000; }
  if(START.billionaire){ me.troops=1e9; me.gold=1e9; }
  rebuildAreas();
  if(START.risky) startDraft();
  if(START.teams>0){ const ps=players.filter(q=>q.kind!=='neutral'); ps.forEach((q,i)=>{ q.team=i%START.teams; }); }
  startTime=performance.now();
  log('Matches last about 20 minutes. Expand fast, but keep troops in reserve — a thin army invites invasion.');
}

// ---------------------------------------------------------------- diplomacy
let proposals=[]; // incoming to the human: {from, type, until}
function relation(a,b){ if(a.team!=null&&a.team===b.team&&a!==b) return {type:'ally',until:Infinity,team:true}; const r=a.rel[b.id]; if(!r) return null; if(r.type==='nap'&&r.until<=tickN){ delete a.rel[b.id]; delete b.rel[a.id]; return null; } return r; }
function atPeace(aId,bId){ if(aId<0||bId<0||aId===bId) return false; const a=players[aId], b=players[bId]; if(a.kind==='neutral'||b.kind==='neutral') return false; return !!relation(a,b); }
function setRelation(a,b,type){ const r={type,until:type==='nap'?tickN+NAP_TICKS:Infinity,since:tickN}; a.rel[b.id]=r; b.rel[a.id]=r; if(a===me||b===me){ const o=a===me?b:a; sInc(type==='ally'?'alliances':'pacts'); sEvent(`${type==='ally'?'Alliance':'Pact'} with ${o.name}`,'diplo'); } if(a===me||b===me){ const other=a===me?b:a; other.handshake=tickN+120; }
  // an existing attack between them stands down
  attacks=attacks.filter(x=>{ const hit=(x.owner===a.id&&x.target===b.id)||(x.owner===b.id&&x.target===a.id); if(hit) players[x.owner].troops+=x.troops*0.9; return !hit; });
  transports=transports.filter(x=>{ const hit=(x.owner===a.id&&x.target===b.id)||(x.owner===b.id&&x.target===a.id); if(hit) players[x.owner].troops+=x.troops; return !hit; }); }
function breakRelation(a,b){ const r=relation(a,b); if(!r) return false; if(r.team){ if(a===me) fail('Teammates cannot go to war.'); return false; } delete a.rel[b.id]; delete b.rel[a.id];
  if(a===me||b===me){ const other=a===me?b:a; other.heartbreak=tickN+150; me.heartbreak=tickN+150; if(a===me){ sInc('betrayals'); sEvent(`Broke with ${other.name}`,'diplo'); } else { sInc('betrayed'); sEvent(`Betrayed by ${other.name}`,'diplo'); } }
  a.penaltyUntil=tickN+BETRAY_TICKS*(r.type==='ally'?2:1); a.rep=Math.max(0,a.rep-(r.type==='ally'?0.4:0.25)); if(b.kind==='bot') b.rep=Math.min(1,b.rep+0.05);
  log(`${a.name} broke ${r.type==='ally'?'the alliance':'the pact'} with ${b.name}!`, a===me||b===me); if(a===me||b===me) snd('pushback'); return true; }
function botConsider(bot,from,type){ if(botLevel(bot)>=3&&from.tiles/landCount>=0.45&&type==='nap') return false; // would this bot accept?
  if(relation(bot,from)) return false;
  const str=from.tiles/Math.max(1,bot.tiles); const busy=attacks.some(x=>x.owner===bot.id&&x.target!==from.id)||attacks.some(x=>x.target===bot.id&&x.owner!==from.id);
  let pr=0.15+from.rep*0.4+(str>1.2?0.3:str<0.6?-0.2:0)+(busy?0.25:0)-(neutralShare()<0.15?0.1:0);
  if(type==='ally') pr-=0.25; pr/=bd(bot).aggr; return srand()<Math.max(0.03,Math.min(0.95,pr)); }
function propose(from,to,type){
  if(from===me){ const last=from.lastProposal[to.id]||-1e9; if(tickN-last<300) return fail(`${to.name} isn't ready to talk again yet.`); from.lastProposal[to.id]=tickN;
    if(botConsider(to,from,type)){ setRelation(from,to,type); log(`${to.name} accepted ${type==='ally'?'an alliance':'a non-aggression pact'}.`,true); snd('unified'); showNotice({kind:'good',flag:to.flag,title:`${to.name} accepted`,text:type==='ally'?'You are now allies.':'Non-aggression pact for three minutes.',ttl:8000}); }
    else { log(`${to.name} declined ${type==='ally'?'the alliance':'the pact'}.`,true); snd('error'); showNotice({kind:'warn',flag:to.flag,title:`${to.name} declined`,text:type==='ally'?'No alliance — they are not convinced yet.':'No pact — try again later.',ttl:8000}); } return; }
  if(to===me){ if(proposals.some(q=>q.from===from.id)) return; proposals.push({from:from.id,type,until:tickN+PROPOSAL_TTL}); log(`${from.name} proposes ${type==='ally'?'an alliance':'a non-aggression pact'}.`,true); snd('foghorn');
    showNotice({kind:'gold',flag:from.flag,title:`${from.name} proposes ${type==='ally'?'an alliance':'a non-aggression pact'}`,text:type==='ally'?'Permanent: shared defense, vision and trade. Breaking it costs reputation.':'Three minutes of peace on both sides.',closeable:false,ttl:PROPOSAL_TTL*100,buttons:[{label:'Accept',primary:true,onClick:()=>{ if(!proposals.some(q=>q.from===from.id)) return; issue('accept',from.id,type,0); }},{label:'Decline',onClick:()=>{ issue('decline',from.id); }}]}); return; }
  if(botConsider(to,from,type)) setRelation(from,to,type);
}
function stepDiplomacy(){
  proposals=proposals.filter(q=>q.until>tickN&&players[q.from].alive);
  if(tickN%40) return;
  const ns=neutralShare();
  for(const p of players){ if(p.kind!=='bot'||!p.alive) continue;
    // sue for peace when under attack by someone bigger
    for(const a of attacks){ if(a.target!==p.id) continue; const from=players[a.owner]; if(from.kind==='neutral'||relation(p,from)) continue;
      if(from.tiles>p.tiles*1.3&&srand()<0.12/bd(p).aggr) propose(p,from,'nap'); }
    // an ally under attack asks for help
    for(const k in p.rel){ const q=players[k]; const r=relation(p,q); if(!r||r.type!=='ally'||q!==me) continue;
      const under=attacks.some(a=>a.target===p.id&&players[a.owner].kind!=='neutral');
      if(under&&p.troops<maxTroops(p)*0.35&&srand()<0.15&&!proposals.some(x=>x.from===p.id)){ proposals.push({from:p.id,type:'reqTroops',amt:Math.round(maxTroops(p)*0.25),until:tickN+PROPOSAL_TTL}); log(`${p.name} asks for ${Math.round(maxTroops(p)*0.25)} troops.`,true); snd('foghorn'); }
      else if(p.gold<120&&srand()<0.06&&!proposals.some(x=>x.from===p.id)){ proposals.push({from:p.id,type:'reqGold',amt:200,until:tickN+PROPOSAL_TTL}); log(`${p.name} asks for 200 gold.`,true); } }
    // a strong bot offers an alliance to a strong neighbour now and then
    if(srand()<0.02){ const cand=players.filter(q=>q!==p&&q.alive&&q.kind!=='neutral'&&!relation(p,q)&&q.tiles>p.tiles*0.7); if(cand.length) propose(p,pick(cand),'nap'); }
    // betrayal: once the land grab is over, drop a pact with a partner that has gone soft
    if(ns<0.15) for(const k in p.rel){ const q=players[k]; const r=relation(p,q); if(!r) continue;
      if(q.tiles<p.tiles*0.5&&density(q)<density(p)*0.6&&srand()<0.02*bd(p).aggr) breakRelation(p,q); }
  }
}
function shareBorder(a,b){ for(let y=0;y<H;y+=1)for(let x=0;x<W;x+=1){ const t=idx(x,y); if(owner[t]!==a) continue; for(const [dx,dy] of N4){ if(inb(x+dx,y+dy)&&owner[idx(x+dx,y+dy)]===b) return true; } } return false; }
function sendGold(from,to,amt){ amt=Math.min(Math.floor(amt),Math.floor(from.gold)); if(amt<=0) return false; from.gold-=amt; to.gold+=amt; log(`${from.name} sent ${amt} gold to ${to.name}.`, from===me||to===me); if(to===me){ snd('cash'); const c=centroid(to); cashFloat(c[0],c[1],amt); } else if(from===me) snd('coin'); return true; }
function sendTroops(from,to,amt){ amt=Math.min(Math.floor(amt),Math.floor(from.troops)); if(amt<10) return false;
  if(shareBorder(from.id,to.id)){ if(gOn(from)) takeTroopsFrom(from,from.areas[0],amt); else from.troops-=amt; if(gOn(to)) addTroopsAt(to,null,amt); else to.troops+=amt; log(`${from.name} sent ${amt} troops to ${to.name}.`, from===me||to===me); if(from===me||to===me) snd('foghorn'); return true; }
  const coast=coastTilesOf(to.id); if(!coast.length){ if(from===me) fail(`${to.name} has no coastline to land on.`); return false; }
  const seed=nearestCoastOf(to.id,nearestCoast(from,coast[0])>=0?nearestCoast(from,coast[0]):coast[0],-1);
  const fromT=nearestCoast(from,seed>=0?seed:coast[0]); if(fromT<0){ if(from===me) fail('You need a coastline to embark from.'); return false; }
  const path=waterPath(waterNeighbor(fromT),waterNeighbor(seed>=0?seed:coast[0])); if(!path){ if(from===me) fail('No sea route to your ally.'); return false; }
  if(gOn(from)) takeTroopsFrom(from,from.areas.find(a=>a.coast)||from.areas[0],amt); else from.troops-=amt; { const hv=heavyFrom(from,fromT,areaAt(fromT)); transports.push({owner:from.id,target:to.id,troops:amt,seed:seed>=0?seed:coast[0],path,pos:0,hdg:0,wake:[],gift:true,heavy:hv,hp:hv?HEAVY.hp:1}); }
  log(`${from.name} shipped ${amt} troops to ${to.name}.`, from===me||to===me); if(from===me) snd('foghorn'); return true; }
function botAnswerRequest(bot,from,kind,amt){ const r=relation(bot,from); if(!r||r.type!=='ally') return false;
  if(kind==='gold'){ const spare=bot.gold-300; if(spare<50) return false; return sendGold(bot,from,Math.min(amt,spare*0.6)); }
  const spare=bot.troops-maxTroops(bot)*0.45; if(spare<100) return false; return sendTroops(bot,from,Math.min(amt,spare*0.6)); }
function knownTroops(p){ if(!START.fog||p===me||relation(me,p)?.type==='ally'||myBorders.has(p.id)) return String(Math.round(p.troops)); const c=centroid(p); if(visAt(c[0],c[1])) return String(Math.round(p.troops)); return '?'; }
function relText(p){ const r=p===me?null:relation(me,p); if(!r) return ''; return `<span class="muted"> — ${r.type==='ally'?'ally':'pact, '+Math.ceil((r.until-tickN)/10)+'s left'}</span>`; }
function relBadge(p){ const r=p===me?null:relation(me,p); if(!r) return ''; return `<span style="font-size:10px;color:${r.type==='ally'?'#7fd0ff':'#bde5b8'};margin-left:4px">${r.type==='ally'?'ALLY':'PACT'}</span>`; }

// ---------------------------------------------------------------- attacks
function frontierOf(att,target,areaId){ // tiles owned by target adjacent to att (optionally only to one of att's areas)
  const f=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const t=idx(x,y); if(owner[t]!==att) continue; if(areaId!=null&&areaOf&&areaOf[t]!==areaId) continue;
    for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]===target) f.add(n); }
  }
  return f;
}
function launchAttack(p,target,troops,seed,fromArea){ if(pausedBlock(p)) return false;
  if(atPeace(p.id,target)){ if(p===me) fail(`You have ${relation(p,players[target]).type==='ally'?'an alliance':'a pact'} with ${players[target].name}. Declare war first.`); return false; }
  let origin=null; if(gOn(p)&&p.areas&&p.areas.length){ origin=fromArea||(seed!=null?null:areaTouching(p,target)); if(seed!=null&&!origin){ const c=nearestCoast(p,seed); origin=(c>=0&&areaAt(c))||p.areas.find(a=>a.coast)||p.areas[0]; } if(!origin){ if(p===me) fail('None of your areas borders that nation — send a transport from one of them.'); return false; } troops=Math.min(troops,origin.troops); if(p===me&&fromArea==null) p.lastOrigin=origin; }
  else troops=Math.min(troops,p.troops);
  if(troops<5){ if(p===me) fail(origin?`${areaLabel(p,origin)} has too few troops to attack with.`:'Need at least 5 troops to attack.'); return false; }
  // merge into existing attack on same target
  const ex=attacks.find(a=>a.owner===p.id&&a.target===target);
  if(ex&&!seed&&(!origin||ex.origin===origin.id)){ex.troops+=takeTroopsFrom(p,origin,troops); ex.spent=ex.spent||0;if(p===me) snd('attack');return true;}
  if(seed!=null) return launchTransport(p,target,troops,seed,origin);
  const front=frontierOf(p.id,target,origin?origin.id:null);
  if(front.size===0){ if(p===me&&origin) fail('That area does not border the target.'); return false; }
  troops=takeTroopsFrom(p,origin,troops);
  if(p===me&&target>=0&&!STATS.campaigns[players[target].name]){ STATS.campaigns[players[target].name]={start:sMin()}; if(!STATS.c.firstAttack){ sInc('firstAttack'); sEvent(`First campaign: ${players[target].name}`); } }
  attacks.push({owner:p.id,target,troops,front,naval:false,age:0,origin:origin?origin.id:null,startTiles:target>=0?players[target].tiles:0});
  if(target===me.id&&p!==me) invasionNotice(p,[...front][0],false);
  if(p===me) snd('attack');
  return true;
}
function fortRange(st){ return (st.level||1)>=3?32:(st.level||1)>=2?24:FORT_RANGE; }
function fortStack(t,id){ const x=t%W,y=(t-x)/W; let n=0; for(const st of structures){ if(st.type!=='fort'||st.building||st.owner!==id) continue; const r=fortRange(st); if((st.t%W-x)**2+((st.t-st.t%W)/W-y)**2<=r*r){ n++; if(n>=6) break; } } return n; }
function fortMult(t,id){ const n=fortStack(t,id); return n?Math.min(64,Math.pow(2,n)):1; }
function fortified(t,id){ return fortStack(t,id)>0; }
function tileCost(a,def,t){
  const dloc=(def&&t!=null&&gOn(def))?densityAt(def,t):null;
  const terr=t!=null?0.65+0.7*rough[t]:1; // easy ground and hard ground: fronts flow along the cheap paths
  if(def==null) return 0.38*terr;
  const d=Math.min(8,dloc!=null?dloc:density(def)); // packing troops denser than 8 per tile stops raising the price
  return terr*(def.kind==='neutral'?0.3+d*1.2:0.38+d*2.8)*(a.naval?1.4:1)*(players[a.owner].kind==='neutral'?1.5:1)*(t!=null&&shelled[t]>tickN?SUPPRESS_COST:(t!=null?fortMult(t,def.id):1));
}
function absorbRemnant(def,p,force,front){ // a nation cut down to scraps, or with no army left, is finished off by its conqueror — but only the land the fight can reach, and never fortified ground
  if(!force&&(def===me||def.tiles>=25)) return; if(def.tiles<=0||!def.alive) return;
  // flood from the front (or from wherever the attacker touches the defender) through the defender's own connected land
  const seen=new Uint8Array(W*H), q=[]; const push=t=>{ if(t>=0&&t<W*H&&!seen[t]&&owner[t]===def.id){ seen[t]=1; q.push(t); } };
  if(front) for(const t of front) push(t);
  if(!q.length){ for(let t=0;t<W*H;t++){ if(owner[t]!==def.id) continue; const x=t%W,y=(t-x)/W; for(const [dx,dy] of N4){ if(inb(x+dx,y+dy)&&owner[idx(x+dx,y+dy)]===p.id){ push(t); break; } } } }
  let taken=0; for(let h=0;h<q.length;h++){ const c=q[h]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(inb(x+dx,y+dy)) push(idx(x+dx,y+dy)); } }
  const keep=[]; for(const t of q){ if(def.kind!=='neutral'&&fortStack(t,def.id)>0&&!(shelled[t]>tickN)){ keep.push(t); continue; } setOwner(t,p.id); if(struct[t]) captureStructure(t,p); taken++; }
  if(keep.length&&(p===me||def===me)) log(`${def.name}'s fortified ground held — ${keep.length} tiles behind the bastions did not fall.`,true);
  const left=def.tiles;
  if(left>0&&def.kind!=='neutral') log(`${def.name} collapsed here; ${left} tiles of holdings elsewhere remain.`, p===me||def===me);
  structCounts(def); }
function stepAttacks(){
  for(const a of attacks){
    a.age++;
    const p=players[a.owner], def=a.target>=0?players[a.target]:null;
    if(!p.alive){a.dead=true;continue;}
    // advance speed scales with how badly the attacker outmatches the defense along this front
    const unit=tileCost(a,def,null), strength=a.troops/Math.max(1,a.front.size*unit); // how many full sweeps of the frontier the force can pay for
    const pace=Math.min(3,Math.max(0.25,0.3+0.4*Math.sqrt(strength)));
    const take=Math.max(1,Math.ceil(a.front.size*0.22*pace));
    let n=0;
    const it=Array.from(a.front);
    for(let i=0;i<it.length;i++){ const j=i+Math.floor(srand()*(it.length-i)); [it[i],it[j]]=[it[j],it[i]]; } // random order, not insertion order
    for(const t of it){
      if(n>=take) break;
      // tiles hemmed in on several sides fall first; exposed salients wait — rounds the front and fills pockets
      { const x=t%W,y=(t-x)/W; let k=0; for(const [dx,dy] of N4){ if(inb(x+dx,y+dy)&&owner[idx(x+dx,y+dy)]===p.id) k++; } if(k===0&&a.took){ a.front.delete(t); continue; } if(k===1&&a.took&&srand()<0.4) continue; } // a tile must touch the attacker; lone salients fall slowly, so two fronts can't leapfrog into a checkerboard
      a.front.delete(t);
      if(owner[t]!==a.target||!land[t]) continue;
      let cost=def?tileCost(a,def,t):0; // unclaimed land is free to take: the force just has to be there
      if(def){ const pool=gOn(def)?(areaAt(t)?areaAt(t).troops:def.troops):def.troops; const base=0.38*(0.65+0.7*rough[t]); const cap=base+Math.max(0,pool)*1.5/Math.max(1,a.front.size); cost=Math.min(cost,Math.max(base,cap)); if(def.kind!=='neutral'&&!(shelled[t]>tickN)){ const n=fortStack(t,def.id); if(n) cost+=WALL_TOLL*Math.pow(2,n-1); } } // you can't lose more than the defender has to spend — except the walls, which cost what they cost
      if(a.troops<cost){a.dead=true;break;}
      a.troops-=cost; a.spent=(a.spent||0)+cost;
      if(def){ if(gOn(def)) loseTroopsAt(def,t,cost*0.55); else def.troops=Math.max(0,def.troops-cost*0.55); if(def.kind==='neutral'&&p.kind!=='neutral'){ def.grudge[p.id]=tickN; if(!isProvokedBy(def,p.id,1)) def.warned=false; }}
      setOwner(t,p.id);n++; a.took=(a.took||0)+1; if(visAt(t%W,(t-t%W)/W)) fxSpark(t%W,(t-t%W)/W,p.color); if(def) markHostile(p.id,def.id); if(def===me) snd('invaded');
      if(struct[t]){captureStructure(t,p);}
      const x=t%W,y=(t-x)/W;
      for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const m=idx(x+dx,y+dy); if(land[m]&&owner[m]===a.target) a.front.add(m); }
    }
    if(a.front.size===0) a.dead=true;
    if(def&&def.alive&&def.tiles>0&&n>0&&(def.tiles<25||def.troops<1)){ if(def.troops<1&&def.tiles>=25) log(`${def.name} has no army left — ${p.name} takes the rest.`, p===me||def===me); absorbRemnant(def,p,def.troops<1,a.front); }
    if(def&&def.tiles<=0&&def.alive){ def.alive=false; if(p===me){ snd('conquered'); me.kills=(me.kills||0)+1; sInc('conquests'); if(def.kind!=='neutral') sInc('kills'); sEvent(def.kind==='neutral'?`Conquered ${def.name}`:`Eliminated ${def.name}`,def.kind==='neutral'?'note':'kill'); if(STATS.campaigns[def.name]) STATS.campaigns[def.name].end=sMin(); } if(def===me&&p.kind!=='neutral') sEvent(`Fell to ${p.name}`,'death');
      if(def.kind!=='neutral'){ def.killedBy=p.id; def.diedAt=tickN; badges.push({text:`${def.name}`,sub:`killed by ${p.name}`,flag:def.flag,kflag:p.flag,col:p.color,age:0,life:130,snd:(p===me||def===me)?'taps':'tapsq'}); }
      if(def.kind==='neutral'&&p.kind!=='neutral'){ const early=1+(CONQUEST_EARLY-1)*Math.max(0,1-tickN/CONQUEST_EARLY_TICKS); const g=Math.round(a.startTiles*CONQUEST_GOLD*early); p.gold+=g; if(p===me){ snd('cash'); log(`Conquered ${def.name}: +${g} gold plunder${early>1.5?' (early-game bonus)':''}.`,true); cashFloat(centroid(def)[0],centroid(def)[1],g); } }
      else if(def.kind!=='neutral'&&p.kind!=='neutral'){ const g=Math.floor(def.gold); def.gold=0; if(g>0){ p.gold+=g; log(`${p.name} seized ${def.name}'s treasury: ${g} gold.`, p===me||def===me); if(p===me){ snd('cash'); cashFloat(centroid(def)[0],centroid(def)[1],g); } } } log(p.kind==='neutral'?`${def.name} overextended and was conquered by ${p.name}.`:`${p.name} wiped out ${def.name}.`, p===me||def===me); }
  }
  attacks=attacks.filter(a=>{ if(a.dead){ const p=players[a.owner]; const back=Math.max(0,a.troops-(a.target<0?0:(a.spent||0)*0.1)); /* unspent troops all come home; attrition is 10% of what the fight cost */ if(gOn(p)){ const ar=a.origin!=null?areaById(a.origin):null; if(ar&&ar.owner===p.id){ ar.troops+=back; syncTroops(p); } else addTroopsAt(p,a.landAt!=null&&owner[a.landAt]===p.id?a.landAt:null,back); } else p.troops+=back; return false;} return true; }); // everyone comes home from unclaimed land; 10% attrition from a real fight
}

// ---------------------------------------------------------------- structures
function rebuildLinks(){ // factories tie to nearby same-owner cities and ports; every link boosts both ends
  links=[]; const load=new Map();
  const hubs=structures.filter(st=>(st.type==='city'||st.type==='port')&&!st.building), facs=structures.filter(st=>st.type==='factory'&&!st.building);
  for(const st of structures){ st.links=0; }
  for(const f of facs){ const fx=f.t%W,fy=(f.t-fx)/W; const cands=[];
    for(const h of hubs){ if(h.owner!==f.owner) continue; const hx=h.t%W,hy=(h.t-hx)/W; const d=(hx-fx)**2+(hy-fy)**2; if(d<=LINK_RANGE*LINK_RANGE) cands.push([d,h]); }
    cands.sort((u,v)=>u[0]-v[0]);
    for(const [,h] of cands){ if(f.links>=LINK_MAX_PER_FACTORY) break; const cap=h.type==='city'?LINK_MAX_PER_CITY:LINK_MAX_PER_PORT; if((load.get(h)||0)>=cap) continue;
      links.push({a:f,b:h,owner:f.owner}); load.set(h,(load.get(h)||0)+1); f.links++; h.links++; } }
  for(const p of players){ p.factoryLinks=0; p.cityLinks=0; p.portLinks=0; }
  for(const l of links){ const p=players[l.owner]; p.factoryLinks+=1; if(l.b.type==='city') p.cityLinks++; else p.portLinks++; }
  for(const st of structures) st.linked=st.links>0;
}
function structCounts(p){ p.cities=p.factories=p.ports=p.sams=p.silos=p.forts=p.commands=p.troopcmds=0;
  for(const s of structures) if(s.owner===p.id&&!s.building){ if(s.type==='city')p.cities++; else if(s.type==='factory')p.factories++; else if(s.type==='port')p.ports++; else if(s.type==='sam')p.sams++; else if(s.type==='silo')p.silos++; else if(s.type==='fort')p.forts++; else if(s.type==='command')p.commands++; else if(s.type==='troopcmd')p.troopcmds++; } }
function crowded(t){ const x=t%W,y=(t-x)/W; for(const st of structures){ const dx=st.t%W-x, dy=(st.t-st.t%W)/W-y; if(dx*dx+dy*dy<STRUCT_SPACING*STRUCT_SPACING) return true; } return false; }
function snapBuild(p,t,type,R=5){ const S=STRUCT[type]; const ok=c=>land[c]&&owner[c]===p.id&&!struct[c]&&!crowded(c)&&(!S.coast||isCoast(c)); if(ok(t)) return t; const x=t%W,y=(t-x)/W; let best=-1,bd=1e9; for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const X=x+dx,Y=y+dy; if(!inb(X,Y)) continue; const c=idx(X,Y); if(!ok(c)) continue; const d=dx*dx+dy*dy; if(d<bd){bd=d;best=c;} } return best; }
function snapToCoast(p,t,R=5){ if(isCoast(t)&&owner[t]===p.id&&!struct[t]) return t; const x=t%W,y=(t-x)/W; let best=-1,bd=1e9; for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const X=x+dx,Y=y+dy; if(!inb(X,Y)) continue; const c=idx(X,Y); if(!land[c]||owner[c]!==p.id||struct[c]||!isCoast(c)||crowded(c)) continue; const d=dx*dx+dy*dy; if(d<bd){bd=d;best=c;} } return best; }
function industrialNear(p,t){ const x=t%W,y=(t-x)/W; for(const c of structures){ if(c.type!=='city'||c.owner!==p.id||c.building||(c.links||0)<3) continue; if((c.t%W-x)**2+((c.t-c.t%W)/W-y)**2<=LINK_RANGE*LINK_RANGE) return true; } return false; }
function pausedBlock(p){ if(p===me&&userPaused&&!START.pauseBuild&&!over){ fail('Paused — unpause to give orders (or tick "Paused orders" on the start card).'); return true; } return false; }
function structCost(p,type){ const base=STRUCT[type].cost; if(type==='fort'){ const n=structures.filter(st=>st.type==='fort'&&st.owner===p.id).length; return base+40*n; } return base; }
function placeStructure(p,type,t){ if(pausedBlock(p)) return false; if(p.kind==='bot'){ if(p.nextBuildAt>simMs) return false; }
  const S=STRUCT[type]; if(!ALLOWED.has(type)) return false;
  { const c=snapBuild(p,t,type); if(c<0) return false; t=c; }
  if(type==='subbase'){ const ok=structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===p.id&&((st.t%W-t%W)**2+((st.t-st.t%W)/W-(t-t%W)/W)**2)<=LINK_RANGE*LINK_RANGE); if(!ok){ if(p===me) fail('Submarine bases need a level II port within 34 tiles.'); return false; } }
  const cost=structCost(p,type); if(owner[t]!==p.id||struct[t]||crowded(t)) return false; if(p.gold<cost){ if(p===me) fail(`Not enough gold — ${STRUCT[type].label.toLowerCase()} costs ${cost}.`); return false; }
  if(S.coast&&!isCoast(t)) return false;
  p.gold-=cost; struct[t]=1; structOwner[t]=p.id;
  let ticks=(START.instant&&type!=='shield')?0:(BUILD_TICKS[type]||0); if(ticks&&industrialNear(p,t)) ticks=Math.round(ticks*0.75); /* shields keep their timer even with Instant build, so they can be worn down */
  if(p===me) sInc('built'); if(p.kind==='bot') p.nextBuildAt=simMs+rnd(6000,12000)/(bd(p).build||1);
  const st={type,owner:p.id,t,cost,building:ticks>0,done:tickN+ticks,total:ticks}; if(GUNS[type]) st.hp=GUNS[type].hp; if(type==='shield') st.hp=SHIELD.hp; structures.push(st); structCounts(p);
  if(p===me) snd(type==='city'?'city':'build');
  if(st.building&&p===me) log(`${S.label} under construction — ${Math.ceil(ticks/10)} s.`,true);
  if(type==='city'){ if(gOn(p)) addTroopsAt(p,t,CITY_POP); else p.troops+=CITY_POP; if(p===me) log(`New city: ${CITY_POP} citizens joined the army.`,true); }
  return true;
}
function captureStructure(t,p){
  const s=structures.find(s=>s.t===t); if(!s) return; fxPuff(t%W,(t-t%W)/W,3,'200,200,200');
  if(s.type==='fort'||s.type==='shore'||s.type==='battery'||s.type==='shield'){ const old=players[s.owner]; destroyStructure(t); structCounts(old); flashes.push({x:t%W,y:(t-t%W)/W,r:3,age:0,col:'#ffb347'}); if(p===me||old===me) log(`${p.name} overran ${old.name}'s bastion.`,true); return; }
  const old=players[s.owner]; s.owner=p.id; structOwner[t]=p.id; structCounts(old); structCounts(p);
  if(p===me) log(`Captured a ${STRUCT[s.type].label.toLowerCase()} from ${old.name}.`,true);
}
function destroyStructure(t){ const st=structures.find(q=>q.t===t); structures=structures.filter(s=>s.t!==t); struct[t]=0; structOwner[t]=-1; if(st){ fxPuff(t%W,(t-t%W)/W,6,'90,90,90'); fxScorch(t%W+.5,(t-t%W)/W+.5,st.type==='shield'?5:3.5); if(st.type==='shield'||(st.type==='airfield'&&(st.level||1)>=2)) wrecks.push({kind:'dome',x:t%W+.5,y:(t-t%W)/W+.5,r:domeR(st),age:0}); } }

// ---------------------------------------------------------------- missiles
function siloReadyIn(p){ let best=1e9; for(const s of structures) if(s.owner===p.id&&s.type==='silo') best=Math.min(best,Math.max(0,(s.cool||0)-tickN)); return best===1e9?0:best; }
function silosReady(p,cmdOnly){ let n=0; for(const s of structures) if(s.owner===p.id&&s.type==='silo'&&!s.building&&!(s.cool>tickN)&&(!cmdOnly||commandCover(s.t)>0)) n++; return n; }
function launchMissile(p,t,cmdOnly){ if(!cmdOnly&&pausedBlock(p)) return false;
  if(!ALLOWED.has('missile')||p.silos<1||!land[t]) return false;
  if(atPeace(p.id,owner[t])){ if(p===me) fail(`You're at peace with ${players[owner[t]].name}.`); return false; }
  const readySilos=structures.filter(s=>s.owner===p.id&&s.type==='silo'&&!s.building&&!(s.cool>tickN)&&(!cmdOnly||commandCover(s.t)>0)).sort((a,b)=>missileCost(p,a)-missileCost(p,b));
  const silo=readySilos[0];
  if(!silo){ if(p===me) log(`All silos reloading — next ready in ${Math.ceil((siloReadyIn(p))/10)}s.`,true); return false; }
  const cost=missileCost(p,silo); if(p.gold<cost) return false;
  p.gold-=cost; silo.cool=tickN+SILO_COOLDOWN;
  if(p===me){ sInc('missiles'); } missiles.push({owner:p.id,t,from:silo.t,age:0,flight:55}); snd(owner[t]===me.id?'missile_in':p===me?'missile':'missile_other',silo.t%W,(silo.t-silo.t%W)/W); markHostile(p.id,owner[t]);
  log(`${p.name} launched a missile!`, true); return true;
}
function missilePos(m,age){ // tile-space position along a lobbed arc (cruise missiles fly flat)
  const k=Math.min(1,age/m.flight), x0=m.from%W+.5,y0=(m.from-m.from%W)/W+.5, x1=m.t%W+.5,y1=(m.t-m.t%W)/W+.5;
  const h=m.cruise?0:Math.hypot(x1-x0,y1-y0)*0.35;
  return [x0+(x1-x0)*k, y0+(y1-y0)*k-Math.sin(k*Math.PI)*h];
}
function stepInterceptors(){
  // One battery engages each inbound at a time: the nearest ready SAM site or ship. If it misses, the next one fires.
  for(const m of missiles){ if(m.done||m.age<SAM_REACT||m.age>m.flight-8) continue;
    if(interceptors.some(it=>it.target===m&&!it.done)) continue;
    const tx=m.t%W,ty=(m.t-tx)/W; const [mx,my]=missilePos(m,m.age); let best=null,bd=1e12;
    // a battery engages when the missile is inside its umbrella now, or is headed for a point inside it — so a ring of sites covers the approach, not just the target
    const inRange=(x,y,R)=>((x-mx)**2+(y-my)**2<=R*R)||((x-tx)**2+(y-ty)**2<=R*R);
    // who has standing to shoot: the nation whose land is targeted, its allies, and anyone at war with the launcher
    const tow=owner[m.t]; const defends=id=>id===tow||(tow>=0&&relation(players[tow],players[id])?.type==='ally')||inConflict(id,m.owner);
    for(const st of structures){ if(st.type!=='sam'||st.building||st.owner===m.owner||st.cool>tickN||shelled[st.t]>tickN||atPeace(st.owner,m.owner)||!defends(st.owner)) continue; if(START.fog&&st.owner===me.id&&!visAt(mx,my)) continue; if(m.fired&&m.fired.has(st.t)) continue;
      const sx=st.t%W+.5,sy=(st.t-st.t%W)/W+.5; if(!inRange(sx,sy,SAM_RANGE)) continue; const d=(sx-mx)**2+(sy-my)**2; if(d<bd){ bd=d; best={kind:'site',st,x:sx,y:sy,owner:st.owner,hit:SAM_HIT,key:st.t}; } }
    warships.forEach((w,i)=>{ const S=SHIPS[w.cls]; if(!S.sam||w.owner===m.owner||w.samCool>tickN||w.hp<=0||atPeace(w.owner,m.owner)||!defends(w.owner)) return; if(START.fog&&w.owner===me.id&&!visAt(mx,my)) return; if(m.fired&&m.fired.has('w'+i)) return;
      if(!inRange(w.x,w.y,S.sam)) return; const d=(w.x-mx)**2+(w.y-my)**2; if(d<bd){ bd=d; best={kind:'ship',w,S,x:w.x,y:w.y,owner:w.owner,hit:S.samHit,key:'w'+i}; } });
    if(!best) continue;
    if(m.cruise) best.hit=best.hit*CRUISE.samMul;
    (m.fired??=new Set()).add(best.key);
    if(best.kind==='site'){ best.st.cool=tickN+SAM_COOLDOWN; if(best.owner===me.id) log('SAM site launched an interceptor.',true); }
    else { best.w.samCool=tickN+best.S.samCd; if(best.owner===me.id) log(`${best.S.label} launched an interceptor.`,true); }
    interceptors.push({owner:best.owner,target:m,x:best.x,y:best.y,trail:[],age:0,hit:best.hit,ship:best.kind==='ship'}); snd('interceptor');
  }
  for(const it of interceptors){
    it.age++; const m=it.target; if(m.done){ it.done=true; continue; }
    let mx,my; { let aimed=null; for(let k=1;k<=m.flight-m.age;k++){ const [px,py]=missilePos(m,m.age+k); if(Math.hypot(px-it.x,py-it.y)<=INTERCEPTOR_SPEED*k){ aimed=[px,py]; break; } } if(!aimed) aimed=missilePos(m,m.age); [mx,my]=aimed; } // lead the missile: aim where it will be when we can get there
    const [cx2,cy2]=missilePos(m,m.age); const dx=mx-it.x, dy=my-it.y, d=Math.hypot(dx,dy); const dNow=Math.hypot(cx2-it.x,cy2-it.y);
    it.trail.push([it.x,it.y]); if(it.trail.length>10) it.trail.shift();
    if(dNow<=INTERCEPTOR_SPEED*1.2||d<=INTERCEPTOR_SPEED){ it.done=true; mx=cx2; my=cy2;
      if(srand()<(it.hit??SAM_HIT)){ m.done=true; m.intercepted=true; if(it.owner===me.id) sInc('intercepts'); flashes.push({x:mx,y:my,r:4,age:0,col:'#9df'}); { const [nx2,ny2]=missilePos(m,m.age+1); fxFrags(mx,my,Math.atan2(ny2-my,nx2-mx),8,'#ffd27a'); fxPuff(mx-.5,my-.5,4,'200,220,255'); } snd('intercept');
        log(`${players[it.owner].name}'s ${it.ship?'warship':'SAM site'} shot down ${players[m.owner].name}'s missile.`, it.owner===me.id||m.owner===me.id); }
      else { flashes.push({x:it.x,y:it.y,r:1.5,age:0,col:'#9df'}); frags.push({x:it.x,y:it.y,vx:dx/Math.max(1,d)*1.2,vy:dy/Math.max(1,d)*1.2+0.2,age:0,life:28,col:'#bfe6ff',dud:true}); }
      continue; }
    it.x+=dx/d*INTERCEPTOR_SPEED; it.y+=dy/d*INTERCEPTOR_SPEED;
  }
  interceptors=interceptors.filter(i=>!i.done);
  missiles=missiles.filter(m=>!m.done);
}
function domeR(st){ return st.type==='shield'?SHIELD.r:LSHIELD.r; }
function domeHp(st){ return st.type==='shield'?st.hp:(st.lshield||0); }
function domeMax(st){ return st.type==='shield'?SHIELD.hp:LSHIELD.hp; }
function isDome(st){ return !st.building&&((st.type==='shield'&&st.hp>0)||(st.type==='airfield'&&(st.level||1)>=2&&(st.lshield||0)>0)); }
function hitDome(st,n,who){ if(st.type==='shield') st.hp-=n; else st.lshield=(st.lshield||0)-n; st.flash=tickN+8; const own=players[st.owner];
  if(domeHp(st)<=0){ if(st.type==='shield'){ destroyStructure(st.t); structCounts(own); flashes.push({x:st.t%W,y:(st.t-st.t%W)/W,r:6,age:0,col:'#9df'}); log(`${own.name}'s shield generator burned out.`, own===me||who===me.id); if(own===me) snd('pushback'); }
    else { st.lshield=0; wrecks.push({kind:'dome',x:st.t%W+.5,y:(st.t-st.t%W)/W+.5,r:LSHIELD.r,age:0}); log(`${own.name}'s airfield shield is down.`, own===me||who===me.id); } } }
function domeFor(t,owner){ const x=t%W,y=(t-x)/W; let best=null,bd=1e12; for(const st of structures){ if(!isDome(st)||atPeace(st.owner,owner)||st.owner===owner) continue; const r=domeR(st); const d=(st.t%W-x)**2+((st.t-st.t%W)/W-y)**2; if(d<=r*r&&d<bd){bd=d;best=st;} } return best; }
function stepShields(){
  for(const m of missiles){ if(m.done) continue; const dome=domeFor(m.t,m.owner); if(!dome) continue;
    const [mx,my]=missilePos(m,m.age); const dx=mx-(dome.t%W+.5), dy=my-((dome.t-dome.t%W)/W+.5);
    if(dx*dx+dy*dy>(domeR(dome)+1)**2) continue; // not at the edge yet
    m.done=true; flashes.push({x:mx,y:my,r:5,age:0,col:'#9df'}); snd('intercept',mx,my); hitDome(dome,m.cruise?1:SHIELD.hit,m.owner);
    log(`${players[dome.owner].name}'s shield absorbed ${players[m.owner].name}'s missile (${Math.max(0,domeHp(dome))}/${domeMax(dome)}).`, dome.owner===me.id||m.owner===me.id);
  }
  missiles=missiles.filter(m=>!m.done);
  // repairs
  for(const st of structures){ if(!st.repairing) continue; if(st.flash&&st.flash+150>tickN&&st.repairAt<tickN+SHIELD.repairTicks){ st.repairAt=tickN+SHIELD.repairTicks; continue; } // crews take cover for 15 s after a hit
    if(st.repairAt<=tickN){ if(st.type==='shield'){ st.hp=Math.min(SHIELD.hp,st.hp+1); if(st.hp>=SHIELD.hp){ st.repairing=false; if(st.owner===me.id) log('Shield generator fully repaired.',true); } else st.repairAt=tickN+SHIELD.repairTicks; } else if(st.type==='port'){ st.gunHp=Math.min(4,(st.gunHp||0)+1); if(st.gunHp>=4){ st.repairing=false; if(st.owner===me.id) log('Port guns repaired.',true); } else st.repairAt=tickN+SHIELD.repairTicks; } else { st.lshield=Math.min(LSHIELD.hp,(st.lshield||0)+1); if(st.lshield>=LSHIELD.hp){ st.repairing=false; if(st.owner===me.id) log('Airfield shield restored.',true); } else st.repairAt=tickN+SHIELD.repairTicks; } } }
}
function stepMissiles(){
  for(const m of missiles){
    m.age++;
    if(m.age<m.flight) continue;
    { const dome=domeFor(m.t,m.owner); if(dome){ m.done=true; const [mx,my]=missilePos(m,m.age); flashes.push({x:mx,y:my,r:5,age:0,col:'#9df'}); snd('intercept',mx,my); hitDome(dome,m.cruise?1:SHIELD.hit,m.owner); log(`${players[dome.owner].name}'s shield absorbed ${players[m.owner].name}'s missile (${Math.max(0,domeHp(dome))}/${domeMax(dome)}).`, dome.owner===me.id||m.owner===me.id); continue; } }
    m.done=true;
    if(m.cruise){ const cx=m.t%W,cy=(m.t-cx)/W; fxTracer(m.from%W+.5,(m.from-m.from%W)/W+.5,cx+.5,cy+.5,'255,200,120'); fxPuff(cx,cy,4,'110,100,90'); crater(cx,cy,CRUISE.radius,m.owner,{flat:40,pct:0.006,cap:120}); snd('bomb',cx,cy); continue; }
    const tx=m.t%W,ty=(m.t-tx)/W, victim=owner[m.t];
    flashes.push({x:tx,y:ty,r:NUKE_RADIUS,age:0,col:'#ffb347'}); snd(victim===me.id||m.owner===me.id?'impact':'impact_other',tx,ty);
    if(victim>=0) noteThreat(victim,m.t,'missile',m.owner);
    if(victim===me.id&&m.owner!==me.id){ sInc('nuked'); STATS.nukedBy[players[m.owner].name]=(STATS.nukedBy[players[m.owner].name]||0)+1; sEvent(`Nuked by ${players[m.owner].name}`,'nuke'); const lx=m.from%W+.5, ly=(m.from-m.from%W)/W+.5; nukeAlerts.push({from:[lx,ly],at:[tx+.5,ty+.5],owner:m.owner,age:0,life:88}); /* matches the siren: four 2.2 s sweeps */ snd('siren'); }
    // domes overlapping the blast shield the ground under them and take a hit for it
    const domes=structures.filter(st=>isDome(st)&&st.owner!==m.owner&&!atPeace(st.owner,m.owner)&&((st.t%W-tx)**2+((st.t-st.t%W)/W-ty)**2)<(NUKE_RADIUS+domeR(st))**2);
    const underDome=(x,y)=>domes.some(dm=>(dm.t%W-x)**2+((dm.t-dm.t%W)/W-y)**2<=domeR(dm)*domeR(dm));
    for(const dm of domes){ log(`${players[dm.owner].name}'s shield held against the blast (${Math.max(0,domeHp(dm)-SHIELD.hit)}/${domeMax(dm)}).`, dm.owner===me.id||m.owner===me.id); }
    const lost={};
    for(let y=ty-NUKE_RADIUS;y<=ty+NUKE_RADIUS;y++)for(let x=tx-NUKE_RADIUS;x<=tx+NUKE_RADIUS;x++){
      if(!inb(x,y)||(x-tx)**2+(y-ty)**2>NUKE_RADIUS**2) continue;
      const t=idx(x,y); if(!land[t]) continue;
      if(underDome(x,y)) continue;
      if(struct[t]) destroyStructure(t);
      const o=owner[t]; if(o>=0){ lost[o]=(lost[o]||0)+1; setOwner(t,-1); }
    }
    for(const dm of domes) if(structures.includes(dm)) hitDome(dm,SHIELD.hit,m.owner);
    for(const o in lost){ const q=players[o]; const pool=gOn(q)?((areaAt(m.t)&&areaAt(m.t).owner===q.id)?areaAt(m.t).troops:(q.areas&&q.areas[0]?q.areas[0].troops:q.troops)):q.troops; const dloc=gOn(q)?densityAt(q,m.t):density(q); const kn=Math.min(lost[o]*dloc*1.0,pool); // the garrison standing on the cratered ground dies; cover the whole island and that's everyone
      if(gOn(q)) loseTroopsAt(q,m.t,kn); else q.troops=Math.max(0,q.troops-kn); if(q===me&&kn>STATS.bigLoss.n) STATS.bigLoss={n:Math.round(kn),by:`${players[m.owner].name}'s missile`}; if(q===me||m.owner===me.id) log(`Missile killed ${Math.round(kn)} ${q.name} troops.`,true); structCounts(q);
      if(q.tiles<=0&&q.alive){q.alive=false;log(`${q.name} was annihilated.`,true); seizeTreasury(players[m.owner],q);} }
    log(`Missile struck ${victim>=0?players[victim].name:'open land'}.`, victim===me.id);
  }
  missiles=missiles.filter(m=>!m.done);
}
let songBanner=null, badges=[], nukeAlerts=[], lastStats=null, lastPostId=null; let flashes=[], floaters=[], sparks=[], puffs=[], wrecks=[], frags=[], tracers=[], scorches=[];
function fxSpark(x,y,col){ if(sparks.length<900) sparks.push({x,y,age:0,col}); }
function fxPuff(x,y,n=4,col='120,120,120'){ for(let i=0;i<n;i++) puffs.push({x:x+.5,y:y+.5,vx:(srand()-.5)*.25,vy:-(.1+srand()*.2),r:1+srand()*1.5,age:0,life:30+srand()*25,col}); }
function fxWreck(kind,x,y,hdg,col,cls){ wrecks.push({kind,x,y,hdg,col,cls,age:0,spin:(srand()-.5)*.08}); }
function fxFrags(x,y,ang,n=6,col='#ffd27a'){ for(let i=0;i<n;i++){ const a=ang+(srand()-.5)*1.2; const sp=.6+srand()*1.2; frags.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,age:0,life:12+srand()*10,col}); } }
function fxTracer(x0,y0,x1,y1,col='255,240,200'){ tracers.push({x0,y0,x1,y1,age:0,col}); }
function fxScorch(x,y,r){ if(scorches.length>400) scorches.shift(); scorches.push({x,y,r,age:0}); }


// ---------------------------------------------------------------- naval: transports and warships
function waterNeighbor(t){ const x=t%W,y=(t-x)/W; for(const [dx,dy] of N8){ if(inb(x+dx,y+dy)&&!land[idx(x+dx,y+dy)]) return idx(x+dx,y+dy); } return -1; }
function nearestCoast(p,t){ let best=-1,bd=1e12; const tx=t%W,ty=(t-tx)/W;
  for(let c=0;c<W*H;c++){ if(owner[c]!==p.id) continue; const x=c%W,y=(c-x)/W; const d=(x-tx)**2+(y-ty)**2; if(d<bd&&isCoast(c)){bd=d;best=c;} }
  return best; }
function nearestPort(p,t){ let best=null,bd=1e12; const tx=t%W,ty=(t-tx)/W;
  for(const st of structures){ if(st.type!=='port'||st.building||st.owner!==p.id) continue; const x=st.t%W,y=(st.t-x)/W; const d=(x-tx)**2+(y-ty)**2; if(d<bd){bd=d;best=st;} }
  return best; }
function waterPath(a,b){ // BFS across water, 8-connected
  if(a<0||b<0) return null;
  const par=new Int32Array(W*H).fill(-1), q=new Int32Array(W*H); let h=0,tl=0; q[tl++]=a; par[a]=a;
  while(h<tl){ const c=q[h++]; if(c===b) break; const x=c%W,y=(c-x)/W;
    for(const [dx,dy] of N8){ const nx=x+dx,ny=y+dy; if(!inb(nx,ny)) continue; const n=idx(nx,ny); if(land[n]||par[n]>=0) continue; par[n]=c; q[tl++]=n; } }
  if(par[b]<0) return null;
  const path=[]; for(let c=b;c!==a;c=par[c]) path.push(c); path.push(a); return path.reverse();
}
function shipXY(sh){ const i=Math.min(sh.path.length-1,Math.floor(sh.pos)); const t=sh.path[i]; return [t%W+.5,(t-t%W)/W+.5]; }
function nearestCoastOf(id,t,reg){ let best=-1,bd=1e12; const tx=t%W,ty=(t-tx)/W;
  for(let c=0;c<W*H;c++){ if(owner[c]!==id||(reg>=0&&region[c]!==reg)) continue; const x=c%W,y=(c-x)/W; const d=(x-tx)**2+(y-ty)**2; if(d<bd&&isCoast(c)){bd=d;best=c;} }
  return best; }
function heavyFrom(p,fromTile,origin){ if(gOn(p)&&origin) return structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===p.id&&areaOf&&areaOf[st.t]===origin.id); return structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===p.id); }
function launchTransport(p,target,troops,seed,origin){
  let from=nearestCoast(p,seed); if(origin&&gOn(p)){ let best=-1,bd=1e12; const sx=seed%W,sy=(seed-sx)/W; for(let c=0;c<W*H;c++){ if(owner[c]!==p.id||areaOf[c]!==origin.id||!isCoast(c)) continue; const d=(c%W-sx)**2+((c-c%W)/W-sy)**2; if(d<bd){bd=d;best=c;} } if(best<0){ if(p===me) fail('That area has no coastline to embark from.'); return false; } from=best; } if(from<0){ if(p===me) log('You need some coastline to embark from.',true); return false; }
  if(!isCoast(seed)||owner[seed]!==target){ const near=nearestCoastOf(target,from,region[seed]); if(near>=0) seed=near; }
  const path=waterPath(waterNeighbor(from),waterNeighbor(seed));
  if(!path){ if(p===me) log('No sea route from your coast to that spot.',true); return false; }
  troops=takeTroopsFrom(p,origin,troops); if(p===me) snd('foghorn');
  const heavy=heavyFrom(p,from,origin&&gOn(p)?origin:areaAt(from));
  transports.push({owner:p.id,target,troops,seed,path,pos:0,hdg:0,wake:[],origin:origin?origin.id:null,heavy,hp:heavy?HEAVY.hp:1});
  return true;
}
function moveShip(w,t){ if(land[t]) return false; const cur=idx(Math.floor(w.x),Math.floor(w.y)); const from=!land[cur]?cur:waterNeighbor(cur); const path=waterPath(from,t); if(!path) return false; w.path=path; w.pos=0; w.dest=t; return true; }
function moveSelected(t,group){ let n=0; const ships=(group||[...selected]).filter(w=>warships.includes(w)&&w.hp>0); ships.forEach((w,i)=>{ // spread the group around the point
    let tt=t; if(ships.length>1){ const ang=i/ships.length*Math.PI*2, r=4+Math.floor(ships.length/3); const x=Math.floor(t%W+Math.cos(ang)*r), y=Math.floor((t-t%W)/W+Math.sin(ang)*r); if(inb(x,y)&&!land[idx(x,y)]) tt=idx(x,y); }
    if(moveShip(w,tt)) n++; });
  return n; }
function structAt(px,py){ const r=cv.getBoundingClientRect(); const mx=px-r.left,my=py-r.top; let best=null,bd=1e9; const rad=Math.max(14,cam.s*4.5); for(const st of structures){ if(vis&&!vis[st.t]) continue; const sx=cam.x+(st.t%W+.5)*cam.s, sy=cam.y+((st.t-st.t%W)/W+.5)*cam.s; const d=(sx-mx)**2+(sy-my)**2; if(d<rad*rad&&d<bd){bd=d;best=st;} } return best; }
function shipAt(px,py,any){ const r=cv.getBoundingClientRect(); const mx=px-r.left,my=py-r.top; let best=null,bd=1e9; for(const w of warships){ if((!any&&w.owner!==me.id)||w.x==null||!visAt(w.x,w.y)||(SHIPS[w.cls].sub&&!subSeenBy(w,me.id))) continue; const sx=cam.x+w.x*cam.s, sy=cam.y+w.y*cam.s; const d=(sx-mx)**2+(sy-my)**2; const rad=Math.max(10,cam.s*4); if(d<rad*rad&&d<bd){bd=d;best=w;} } return best; }
function nearestSubBase(p,t){ let best=null,bd=1e12; const tx=t%W,ty=(t-tx)/W; for(const st of structures){ if(st.type!=='subbase'||st.building||st.owner!==p.id) continue; const d=(st.t%W-tx)**2+((st.t-st.t%W)/W-ty)**2; if(d<bd){bd=d;best=st;} } return best; }
function orderWarship(p,t,cls='warship'){ if(pausedBlock(p)) return false; if(p.kind==='bot'){ if(p.nextBuildAt>simMs) return false; p.nextBuildAt=simMs+rnd(4000,8000)/(bd(p).build||1); }
  const S=SHIPS[cls]; if(land[t]||!ALLOWED.has(cls)) return false;
  const port=S.sub?nearestSubBase(p,t):nearestPort(p,t); if(!port){ if(p===me&&S.sub) fail('Subs are built at a submarine base.'); return false; }
  const cost=Math.round(S.cost*(port.linked?1-LINK_SHIP_DISCOUNT:1)); if(p.gold<cost) return false;
  const path=waterPath(waterNeighbor(port.t),t); if(!path) return false;
  p.gold-=cost;
  let ticks=START.instant?0:(SHIP_BUILD[cls]||0); if(ticks&&port.linked) ticks=Math.round(ticks*0.75);
  if(ticks<=0){ warships.push({id:++uidSeq,owner:p.id,cls,path,pos:0,dest:t,hp:S.hp,cool:0,ang:srand()*6.28,hdg:0,wake:[],barCool:0}); return true; }
  port.queue=port.queue||[]; const idle=port.queue.length===0; port.queue.push({cls,dest:t,total:ticks,done:idle?tickN+ticks:0});
  if(p===me) log(`${S.label} laid down at ${S.sub?'the pens':'the yard'}${port.queue.length>1?' (queued)':''} — ${Math.ceil(ticks/10)} s.`,true);
  return true;
}
function enemyOf(w,o){ if(o<0||o===w.owner||atPeace(w.owner,o)) return false; const q=players[o]; if(!q.alive) return false; if(q.kind==='neutral') return !!(q.grudge&&q.grudge[w.owner]!=null&&tickN-q.grudge[w.owner]<PROVOKE_TICKS); return true; }
function cashFloat(x,y,g){ floaters.push({x,y,txt:'+$'+Math.round(g),age:0,col:'#ffd27a',big:true}); }
function seizeTreasury(p,def){ if(!p||p.kind==='neutral'||def.kind==='neutral') return; const g=Math.floor(def.gold); def.gold=0; if(g>0){ p.gold+=g; if(p===me){ snd('cash'); const c=centroid(def); cashFloat(c[0],c[1],g); } log(`${p.name} seized ${def.name}'s treasury: ${g} gold.`, p===me||def===me); } }
function crater(cx,cy,r,by,opt,spare){
  flashes.push({x:cx,y:cy,r:r+1,age:0,col:'#ffb347'}); const lost={}; if(owner[idx(cx,cy)]>=0) markHostile(by,owner[idx(cx,cy)]);
  const R2=r+SUPPRESS_RING; for(let y=cy-R2;y<=cy+R2;y++)for(let x=cx-R2;x<=cx+R2;x++){ if(inb(x,y)&&(x-cx)**2+(y-cy)**2<=R2*R2&&land[idx(x,y)]) shelled[idx(x,y)]=tickN+SUPPRESS_TICKS; }
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){ if(!inb(x,y)||(x-cx)**2+(y-cy)**2>r*r) continue; const t=idx(x,y); if(!land[t]) continue;
    const oo=owner[t]; if(spare!=null&&oo>=0&&(oo===spare||atPeace(spare,oo))) continue;
    if(struct[t]){ const st=structures.find(q=>q.t===t); if(st&&(st.level||1)>=2){ st.level=1; st.lshield=0; if(st.owner===me.id) log(`${STRUCT[st.type].label} knocked back to level I by bombardment.`,true); } else { destroyStructure(t); if(st) structCounts(players[st.owner]); } }
    const o=owner[t]; if(spare!=null&&o>=0&&(o===spare||atPeace(spare,o))) continue; if(o>=0&&o!==by){ lost[o]=(lost[o]||0)+1; setOwner(t,-1); } }
  let cas=0;
  for(const o in lost){ const q=players[o];
    const poolB=gOn(q)?((areaAt(idx(cx,cy))&&areaAt(idx(cx,cy)).owner===q.id)?areaAt(idx(cx,cy)).troops:q.troops):q.troops; const dB=gOn(q)?densityAt(q,idx(cx,cy)):density(q);
    const kill=Math.min(lost[o]*dB*1.0,poolB)+Math.min(opt?opt.cap:BARRAGE_KILL_CAP,(opt?opt.flat:BARRAGE_KILL_FLAT)+q.troops*(opt?opt.pct:BARRAGE_KILL_PCT)); // shrapnel on the tiles plus casualties in the defending army
    const k=Math.min(q.troops,kill); if(gOn(q)) loseTroopsAt(q,idx(cx,cy),k); else q.troops-=k; cas+=k; floaters.push({x:cx,y:cy,txt:'-'+Math.round(k),age:0,col:'#ff9a9a'});
    if(q.kind==='neutral') q.grudge[by]=tickN; if(q.tiles<=0&&q.alive){ q.alive=false; log(`${q.name} was bombarded into oblivion.`,true); seizeTreasury(players[by],q); } if(q===me) snd('invaded'); }
  if(Object.keys(lost).length&&(by===me.id||lost[me.id])) snd('shellhit');
  return cas;
}
function shipPiracy(w){
  const P=SHIPS[w.cls].pirate; if(!P) return;
  if(w.boarding){ const tr=w.boarding; if(tr.done||tr.owner===w.owner){ w.boarding=null; return; }
    tr.held=tickN+3; // grappled: the merchant heaves to while the privateer comes alongside
    const dx=tr.x-w.x, dy=tr.y-w.y, dd=Math.hypot(dx,dy); if(dd>1.2){ const sp=SHIPS[w.cls].speed; steer(w,w.x+dx/dd*Math.min(sp,dd-1),w.y+dy/dd*Math.min(sp,dd-1)); return; }
    if(--w.boardT>0) return; // boarded: the merchant changes hands and sails for our nearest port
    const port=nearestPort(players[w.owner],idx(Math.floor(tr.x),Math.floor(tr.y))); w.boarding=null; w.pirateCool=tickN+P.cd; markHostile(w.owner,tr.owner);
    if(!port){ if(w.owner===me.id) log('Privateer boarded a merchant but you have no port to bring it to.',true); return; }
    const cur=idx(Math.floor(tr.x),Math.floor(tr.y)); const from=!land[cur]?cur:waterNeighbor(cur); const path=waterPath(from,waterNeighbor(port.t)); if(!path) return;
    const victim=players[tr.owner]; tr.from.busy=false; tr.owner=w.owner; tr.to=port; tr.from=port; tr.path=path; tr.pos=0; tr.prize=true; tr.held=0;
    { const cur2=idx(Math.floor(w.x),Math.floor(w.y)); const back=waterPath(!land[cur2]?cur2:waterNeighbor(cur2),w.dest); if(back){ w.path=back; w.pos=0; } }
    if(w.owner===me.id) sInc('merchantsCaptured'); log(`${players[w.owner].name}'s privateer captured a ${victim.name} merchant.`, w.owner===me.id||victim===me); if(w.owner===me.id) snd('cash'); flashes.push({x:tr.x,y:tr.y,r:2,age:0,col:'#ffd27a'}); return; }
  if(w.pirateCool>tickN) return;
  let best=null,bd=P.range*P.range; for(const tr of traders){ if(tr.done||tr.x==null||tr.owner===w.owner||tr.prize||atPeace(w.owner,tr.owner)) continue; const d=(tr.x-w.x)**2+(tr.y-w.y)**2; if(d<bd){bd=d;best=tr;} }
  if(best){ w.boarding=best; w.boardT=P.board; if(w.owner===me.id) log('Privateer boarding a merchant…',true); }
}
function seededTierOrder(candidates,tier,rng=srand){
  return candidates.map((value,index)=>({value,index,key:rng()})).sort((a,b)=>tier(a.value)-tier(b.value)||a.key-b.key||a.value.t-b.value.t||a.value.owner-b.value.owner||a.index-b.index).map(x=>x.value);
}
function cruiseTargets(candidates,rng=srand){ const tier=t=>t.type==='shield'?0:t.type==='sam'?1:2; return seededTierOrder(candidates,tier,rng).slice(0,CRUISE.count); }
function shipCruise(w){ if(!w.cruise||w.cruiseCool>tickN) return; const R=CRUISE.range, cx=w.x,cy=w.y;
  const foes=structures.filter(st=>!st.building&&enemyOf(w,st.owner)&&((st.t%W+.5-cx)**2+((st.t-st.t%W)/W+.5-cy)**2)<=R*R&&!(START.fog&&w.owner===me.id&&vis&&!vis[st.t]));
  if(!foes.length) return;
  w.cruiseCool=tickN+CRUISE.cd; const picks=cruiseTargets(foes);
  for(const st of picks){ const dist=Math.hypot(st.t%W+.5-cx,(st.t-st.t%W)/W+.5-cy); missiles.push({owner:w.owner,t:st.t,from:idx(Math.floor(cx),Math.floor(cy)),age:0,flight:Math.max(40,Math.round(dist/CRUISE.speed)),cruise:true}); }
  markHostile(w.owner,picks[0].owner); if(w.owner===me.id||picks.some(q=>q.owner===me.id)){ snd('missile'); log(`${players[w.owner].name}'s battleship launched cruise missiles at ${players[picks[0].owner].name}'s ${STRUCT[picks[0].type].label.toLowerCase()}${picks.length>1?' and more':''}.`,true); } }
function shipBarrage(w){
  const B=SHIPS[w.cls].barrage; if(!B||w.barCool>tickN) return;
  const R=B.range, cx=Math.round(w.x), cy=Math.round(w.y); const targets=[];
  const sams=[]; for(const st of structures){ const sx=st.t%W,sy=(st.t-sx)/W; if((sx-cx)**2+(sy-cy)**2<=R*R&&enemyOf(w,st.owner)){ ((st.type==='sam'||st.type==='battery'||st.type==='shore'||st.type==='shield'||(st.type==='port'&&(st.level||1)>=2))?sams:targets).push(st.t); if(st.type==='shield') sams.push(st.t,st.t); } }
  if(sams.length){ targets.length=0; for(const t of sams){ targets.push(t,t); } } // air defenses first, double weight
  if(targets.length<B.count){ for(let k=0;k<60&&targets.length<B.count*3;k++){ const x=cx+Math.round(rnd(-R,R)), y=cy+Math.round(rnd(-R,R)); if(!inb(x,y)||(x-cx)**2+(y-cy)**2>R*R) continue; const t=idx(x,y); if(land[t]&&enemyOf(w,owner[t])) targets.push(t); } }
  if(!targets.length) return;
  w.barCool=tickN+B.cd;
  const volley={cas:0,left:B.count,owner:w.owner,victim:owner[targets[0]],cls:w.cls};
  for(let i=0;i<B.count;i++){ const t=pick(targets); const ang=(w.hdg||0)+Math.PI/2+(i/(B.count-1)-0.5)*1.2; const ox=w.x,oy=w.y; // launchers fan out across the beam, staggered by a tenth of a second
    shells.push({owner:w.owner,x:w.x+Math.cos(ang)*1.5,y:w.y+Math.sin(ang)*1.5,kind:'land',tx:t%W+.5,ty:(t-t%W)/W+.5,radius:B.radius,trail:[],delay:i,volley,arc:true,missile:true,speed:3.2,rise:14+i*3,ox,oy}); }
  flashes.push({x:w.x,y:w.y,r:1.5,age:0,col:'#ffd27a'});
  if(w.owner===me.id||targets.some(t=>owner[t]===me.id)) snd('shell');
  if(w.owner===me.id) log(`${SHIPS[w.cls].label} opened a barrage.`,true);
}
function steer(sh,nx,ny){ // move, turn smoothly toward the direction of travel, record a wake
  if(sh.x!=null){ const dx=nx-sh.x, dy=ny-sh.y; if(dx*dx+dy*dy>1e-4){ const want=Math.atan2(dy,dx); let d=want-sh.hdg; d=Math.atan2(Math.sin(d),Math.cos(d)); sh.hdg+=d*0.35; } }
  sh.x=nx; sh.y=ny; sh.wake.push([nx,ny]); if(sh.wake.length>14) sh.wake.shift();
}
function commandCover(t){ const x=t%W,y=(t-x)/W; let n=0; for(const c of structures){ if(c.type!=='command'||c.building) continue; if(c.owner!==structOwner[t]&&c.owner!==owner[t]) continue; if((c.t%W-x)**2+((c.t-c.t%W)/W-y)**2<=CMD_RANGE*CMD_RANGE) n++; } return n; }
function missileCost(p,silo){ const n=silo?commandCover(silo.t):0; return Math.round(NUKE_COST*(1-Math.min(CMD_DISCOUNT_MAX,n*CMD_DISCOUNT))); }
function coveringSam(st){ const x=st.t%W,y=(st.t-x)/W; let best=null,bd=1e12; for(const q of structures){ if(q.type!=='sam'||q.building||q.owner!==st.owner||shelled[q.t]>tickN) continue; const d=(q.t%W-x)**2+((q.t-q.t%W)/W-y)**2; if(d<=SAM_RANGE*SAM_RANGE&&d<bd){bd=d;best=q;} } return best; }
function missileCommand(){
  if(tickN%15) return;
  for(const p of players){ if(!p.alive||p.kind==='neutral'||!(p.commands>0)||p.autoFire===false) continue;
    if(silosReady(p,true)<1) continue; // only silos inside a command center's range are under automatic control
    // focus nation (set by the player) or every nation we are fighting
    let foes; if(p.cmdFocus!=null){ const f=players[p.cmdFocus]; if(!f||!f.alive||atPeace(p.id,f.id)){ p.cmdFocus=null; foes=[]; } else foes=[f]; }
    else foes=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&inConflict(p.id,q.id));
    if(!foes.length) continue;
    const foeIds=new Set(foes.map(q=>q.id));
    // stay on the current objective until it is gone
    let obj=p.cmdTarget; if(obj&&(!structures.includes(obj)||!foeIds.has(obj.owner)||(p===me&&vis&&!vis[obj.t]))) obj=null;
    if(!obj){ let bs=0; const fx=p.cmdFocusT!=null?p.cmdFocusT%W:null, fy=p.cmdFocusT!=null?(p.cmdFocusT-fx)/W:null;
      const nearFocus=st=>fx==null||((st.t%W-fx)**2+((st.t-st.t%W)/W-fy)**2)<=3600; const anyNear=fx!=null&&structures.some(st=>foeIds.has(st.owner)&&nearFocus(st)&&!(p===me&&vis&&!vis[st.t]));
      for(const st of structures){ if(!foeIds.has(st.owner)) continue; if(p===me&&vis&&!vis[st.t]) continue; if(anyNear&&!nearFocus(st)) continue; // no firing blind
        let sc={sam:5,silo:6,command:7,bertha:7,shield:5,airfield:7,flightops:6,battery:4,shore:2,city:4,port:3,factory:2,fort:1}[st.type]||1; if(st.type==='sam'&&shelled[st.t]>tickN) sc=8; if(st.building) sc*=0.6;
        let cover=0; const x=st.t%W,y=(st.t-x)/W; for(const q of structures){ if(q.type!=='sam'||q.building||q.owner!==st.owner||shelled[q.t]>tickN) continue; if((q.t%W-x)**2+((q.t-q.t%W)/W-y)**2<=SAM_RANGE*SAM_RANGE) cover++; }
        sc/= 1+cover*0.7; sc*=0.85+srand()*0.3; if(sc>bs){bs=sc;obj=st;} }
      p.cmdTarget=obj; if(obj&&p===me) log(`Missile command: new objective, ${players[obj.owner].name}'s ${STRUCT[obj.type].label.toLowerCase()}.`,true); }
    if(!obj) continue;
    // if the objective is under an active SAM umbrella, hammer the nearest covering site first — same site, every launch, until it falls
    const dome=obj.type==='shield'?null:domeFor(obj.t,p.id); if(dome){ const needM=Math.ceil(dome.hp/SHIELD.hit); if(silosReady(p,true)<Math.min(needM,Math.max(1,p.silos))||p.gold<needM*NUKE_COST*0.6+CMD_RESERVE){ if(p===me&&p.cmdWait!==dome){ p.cmdWait=dome; log(`Missile command: target is under a shield (${dome.hp} hp, ${needM} missiles to break) — holding until the salvo is affordable.`,true); } continue; } }
    const cover=obj.type==='sam'?null:coveringSam(obj); if(cover&&p===me&&vis&&!vis[cover.t]){ if(p.cmdWait!==cover){ p.cmdWait=cover; log(`Missile command: ${players[obj.owner].name}'s target is under a SAM site you can't see — get eyes on it first.`,true); } continue; } const aim=cover||obj;
    const inflight=missiles.filter(m=>!m.done&&m.owner===p.id&&m.t===aim.t).length;
    if(aim.type!=='sam'&&!domeFor(aim.t,p.id)){ // anything undefended: one missile, then wait to see it land
      if(inflight>0) continue;
      if(launchMissile(p,aim.t,true)&&p===me) log(`Missile command fired at ${players[aim.owner].name}'s ${STRUCT[aim.type].label.toLowerCase()}.`,true);
      continue; }
    // a SAM site: it and every other active site whose umbrella covers it each get about two shots during a flight, so the salvo must be 2 per covering site + 1, launched together
    if(inflight>0) continue;
    const dm=domeFor(aim.t,p.id); const domeNeed=dm?Math.ceil(dm.hp/SHIELD.hit):0;
    const ax=aim.t%W,ay=(aim.t-ax)/W; let cov=0; for(const q of structures){ if(q.type!=='sam'||q.building||q.owner!==aim.owner||shelled[q.t]>tickN||(p===me&&vis&&!vis[q.t])) continue; if((q.t%W-ax)**2+((q.t-q.t%W)/W-ay)**2<=SAM_RANGE*SAM_RANGE) cov++; }
    const ctrl=structures.filter(q=>q.owner===p.id&&q.type==='silo'&&!q.building&&commandCover(q.t)>0).length;
    const need=Math.min(2*cov+1+domeNeed, Math.max(1,ctrl));
    const ready=silosReady(p,true); if(ready<need||p.gold<need*NUKE_COST+CMD_RESERVE){ if(p===me&&p.cmdWait!==aim){ p.cmdWait=aim; log(`Missile command: need a ${need}-missile salvo for ${players[aim.owner].name}'s SAM site — ${ready} of ${need} silos ready.`,true); } continue; }
    p.cmdWait=null; let fired=0; for(let i=0;i<need;i++) if(launchMissile(p,aim.t,true)) fired++;
    if(fired&&p===me) log(`Missile command: ${fired}-missile salvo at ${players[aim.owner].name}'s SAM site${cover?' (clearing the way)':''}.`,true);
  }
}
function stampVis(cx,cy,r){ const R=Math.round(r); for(let y=Math.max(0,cy-R);y<=Math.min(H-1,cy+R);y++){ const dx=Math.floor(Math.sqrt(Math.max(0,R*R-(y-cy)*(y-cy)))); const x0=Math.max(0,cx-dx), x1=Math.min(W-1,cx+dx); vis.fill(1,y*W+x0,y*W+x1+1); } }
function computeVision(){
  if(!START.fog){ vis=null; return; }
  if(!vis) vis=new Uint8Array(W*H); else vis.fill(0);
  if(satUntil>tickN){ vis.fill(1); return; }
  const friends=new Set([me.id]); for(const q of players) if(q!==me&&q.alive&&relation(me,q)?.type==='ally') friends.add(q.id);
  const q=new Int32Array(W*H); const d=new Uint8Array(W*H).fill(255); let h=0,tl=0;
  for(let t=0;t<W*H;t++){ if(owner[t]>=0&&friends.has(owner[t])){ const x=t%W,y=(t-x)/W; let edge=false; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)||!friends.has(owner[idx(x+dx,y+dy)])){edge=true;break;} } vis[t]=1; if(edge){ d[t]=0; q[tl++]=t; } } }
  while(h<tl){ const c=q[h++]; if(d[c]>=FOG.base) continue; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N8){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(d[n]===255){ d[n]=d[c]+1; vis[n]=1; q[tl++]=n; } } }
  // radar vision is a separate layer so jammers can blank it without touching line of sight
  const base=vis; vis=radarLayer||(radarLayer=new Uint8Array(W*H)); vis.fill(0);
  for(const st of structures){ if(st.building||!friends.has(st.owner)) continue; if(st.type==='radar') stampVis(st.t%W,(st.t-st.t%W)/W,FOG.radar); else if(st.type==='lradar') stampVis(st.t%W,(st.t-st.t%W)/W,FOG.lradar); }
  for(const w of warships){ if(!friends.has(w.owner)||w.x==null||w.cls!=='rship') continue; stampVis(Math.round(w.x),Math.round(w.y),FOG.rship); }
  for(const st of structures){ if(st.type!=='jammer'||st.building||friends.has(st.owner)) continue; const cx=st.t%W,cy=(st.t-cx)/W,R=FOG.jam; for(let y=Math.max(0,cy-R);y<=Math.min(H-1,cy+R);y++){ const dx=Math.floor(Math.sqrt(Math.max(0,R*R-(y-cy)*(y-cy)))); vis.fill(0,y*W+Math.max(0,cx-dx),y*W+Math.min(W-1,cx+dx)+1); } }
  for(let t=0;t<W*H;t++) if(vis[t]) base[t]=1; vis=base;
  for(const w of warships){ if(!friends.has(w.owner)||w.x==null||w.cls==='rship') continue; stampVis(Math.round(w.x),Math.round(w.y),Math.max(10,SHIPS[w.cls].gun)); }
  for(const pl of planes){ if(pl.owner===me.id&&pl.phase==='orbit') stampVis(Math.round(pl.tx),Math.round(pl.ty),FOG.plane.r); }
  for(const a of aircraft){ if(friends.has(a.owner)&&a.type==='fighter'&&a.state==='patrol') stampVis(Math.round(a.tx),Math.round(a.ty),AIR.fighter.patrol); }
}
function visAt(x,y){ if(!vis) return true; const X=Math.floor(x),Y=Math.floor(y); if(!inb(X,Y)) return false; return vis[Y*W+X]===1; }
function stepPlanes(){
  for(const pl of planes){
    if(pl.phase==='out'){ const dx=pl.tx-pl.x, dy=pl.ty-pl.y, dd=Math.hypot(dx,dy); if(dd<=FOG.plane.speed){ pl.phase='orbit'; pl.until=tickN+FOG.plane.dur; pl.onStation=tickN; pl.ang=Math.atan2(dy,dx); if(pl.owner===me.id) log('Spy plane on station.',true); } else { pl.x+=dx/dd*FOG.plane.speed; pl.y+=dy/dd*FOG.plane.speed; pl.hdg=Math.atan2(dy,dx); } }
    else if(pl.phase==='orbit'){ pl.ang+=0.045; pl.x=pl.tx+Math.cos(pl.ang)*12; pl.y=pl.ty+Math.sin(pl.ang)*12; pl.hdg=pl.ang+Math.PI/2;
      if(tickN%30===0&&tickN-(pl.onStation||0)>=FOG.plane.grace&&(pl.shots||0)<FOG.plane.maxShots) for(const st of structures){ if(st.type!=='sam'||st.building||st.owner===pl.owner||shelled[st.t]>tickN||atPeace(st.owner,pl.owner)||pl.shot?.has(st.t)) continue; const sx=st.t%W,sy=(st.t-sx)/W; if((sx-pl.tx)**2+(sy-pl.ty)**2>FOG.plane.r*FOG.plane.r) continue;
        (pl.shot??=new Set()).add(st.t); pl.shots=(pl.shots||0)+1; if(pl.shots>FOG.plane.maxShots) break; if(srand()<FOG.plane.hit){ pl.phase='down'; flashes.push({x:pl.x,y:pl.y,r:3,age:0,col:'#ffb347'}); log(`${players[st.owner].name}'s SAM site shot down ${players[pl.owner].name}'s spy plane.`, pl.owner===me.id||st.owner===me.id); if(pl.owner===me.id) snd('intercept'); break; } }
      if(pl.phase==='orbit'&&tickN-(pl.onStation||0)>=50&&enemyPatrolAt(pl.tx,pl.ty,pl.owner).length){ pl.phase='down'; flashes.push({x:pl.x,y:pl.y,r:3,age:0,col:'#ffb347'}); log(`Fighters shot down ${players[pl.owner].name}'s spy plane.`, pl.owner===me.id); }
      if(pl.phase==='orbit'&&pl.until<=tickN){ pl.phase='home'; }
    }
    else if(pl.phase==='home'){ const dx=pl.hx-pl.x, dy=pl.hy-pl.y, dd=Math.hypot(dx,dy); if(dd<=FOG.plane.speed) pl.phase='done'; else { pl.x+=dx/dd*FOG.plane.speed; pl.y+=dy/dd*FOG.plane.speed; pl.hdg=Math.atan2(dy,dx); } }
  }
  planes=planes.filter(pl=>pl.phase!=='done'&&pl.phase!=='down');
}
function callPlane(p,t){ if(pausedBlock(p)) return false;
  if(!START.fog) return false; const fld=airfieldsOf(p).sort((a,b)=>Math.hypot(a.t%W-t%W,(a.t-a.t%W)/W-(t-t%W)/W)-Math.hypot(b.t%W-t%W,(b.t-b.t%W)/W-(t-t%W)/W))[0]; if(!fld||Math.hypot(fld.t%W-t%W,(fld.t-fld.t%W)/W-(t-t%W)/W)>150){ if(p===me) fail(fld?'That point is beyond 150 tiles of your nearest airfield.':'Spy planes need an airfield.'); return false; } if(p===me&&planeCool>tickN){ fail(`Spy plane ready in ${Math.ceil((planeCool-tickN)/10)} s.`); return false; }
  if(p.gold<FOG.plane.cost){ if(p===me) fail('Not enough gold for a spy plane.'); return false; }
  const tx=t%W+.5, ty=(t-t%W)/W+.5; const hx=fld.t%W+.5, hy=(fld.t-fld.t%W)/W+.5;
  p.gold-=FOG.plane.cost; if(p===me) planeCool=tickN+FOG.plane.cd;
  planes.push({owner:p.id,x:hx,y:hy,hx,hy,tx,ty,phase:'out',hdg:0}); if(p===me){ log('Spy plane launched.',true); snd('interceptor'); } return true;
}
function launchSatellite(){ if(!START.fog) return; const site=structures.find(st=>st.owner===me.id&&st.type==='satellite'&&!st.building); if(!site) return fail('You need a finished satellite launch site.');
  if(satCool>tickN) return fail(`Next launch window in ${Math.ceil((satCool-tickN)/10)} s.`); if(me.gold<FOG.sat.cost) return fail('Not enough gold for a satellite launch.');
  me.gold-=FOG.sat.cost; satUntil=tickN+FOG.sat.dur; satCool=tickN+FOG.sat.cd; log('Satellite in orbit — full map for 45 s.',true); snd('missile'); }
function gunTarget(st){ return (GUNS[st.type]&&st.type!=='bertha')||(st.type==='port'&&(st.level||1)>=2&&(st.gunHp||0)>0); }
function stepGuns(){
  for(const st of structures){ const G=GUNS[st.type]||(st.type==='port'&&(st.level||1)>=2?GUNS.shore:null); if(!G||st.building||shelled[st.t]>tickN) continue; if(st.cool>tickN) continue;
    const gx=st.t%W+.5, gy=(st.t-st.t%W)/W+.5, R2=G.range*G.range; const own=st.owner;
    if(st.type==='bertha'){ // nearest enemy building in range; SAM sites and bastions first
      let best=null,bs=1e12; for(const q of structures){ if(q.owner===own||q.building||atPeace(own,q.owner)||!inConflict(own,q.owner)&&players[q.owner].kind!=='neutral') continue; if(players[q.owner].kind==='neutral'&&!(players[q.owner].grudge&&players[q.owner].grudge[own]!=null)) continue;
        const d=(q.t%W+.5-gx)**2+((q.t-q.t%W)/W+.5-gy)**2; if(d>R2) continue; const pri=(q.type==='sam'||q.type==='fort'||q.type==='battery'||q.type==='shore')?0.5:1; if(d*pri<bs){ bs=d*pri; best=q; } }
      if(!best) continue; st.cool=tickN+G.cd; const tx=best.t%W+.5, ty=(best.t-best.t%W)/W+.5;
      shells.push({owner:own,x:gx,y:gy,kind:'land',tx,ty,radius:G.radius,trail:[],delay:0,speed:3,arc:true,volley:{cas:0,left:1,owner:own,victim:best.owner,cls:'bertha'},ox:gx,oy:gy});
      if(own===me.id||best.owner===me.id) snd('bertha',gx,gy); continue; }
    // naval guns: nearest hostile ship or transport in range; shore guns prefer transports and merchants
    let tgt=null,bd=R2,kind=null;
    for(const tr of transports){ if(tr.done||tr.x==null||tr.owner===own||atPeace(own,tr.owner)) continue; // any non-allied transport in range is a target
      const d=(tr.x-gx)**2+(tr.y-gy)**2; if(d<bd){bd=d;tgt=tr;kind='transport';} }
    if(!tgt){ bd=R2; for(const w of warships){ if(w.owner===own||w.hp<=0||w.x==null||SHIPS[w.cls].sub||atPeace(own,w.owner)||!inConflict(own,w.owner)&&!(w.cls==='cruiser'||w.cls==='battleship')) continue; const d=(w.x-gx)**2+(w.y-gy)**2; if(d<bd){bd=d;tgt=w;kind='warship';} } }
    if(!tgt) continue; st.cool=tickN+G.cd;
    const dmg=(st.type==='shore'||st.type==='port')&&kind==='warship'?G.dmg/(ARMOR[tgt.cls]||1):G.dmg; // shore guns barely dent armored hulls
    st.lastShotAt=tgt.owner;
    shells.push({owner:own,cls:st.type==='port'?'shore':st.type,x:gx,y:gy,target:tgt,kind,trail:[],dmg,speed:(st.type==='shore'||st.type==='port')?7:4,from:st});
    if(own===me.id||tgt.owner===me.id) snd((st.type==='shore'||st.type==='port')?'shoreguns':'battery',gx,gy);
  }
}
// ---------------------------------------------------------------- air: airfields, fighters, bombers, flight operations
function airfieldsOf(p){ return structures.filter(st=>st.type==='airfield'&&!st.building&&st.owner===p.id); }
function hangarMax(st){ return (st.level||1)>=2?6:AIR.hangar; }
function hangarCount(st){ return aircraft.filter(a=>a.home===st).length+(st.aq?st.aq.length:0); }
function buyAircraft(p,st,type){ if(pausedBlock(p)) return false; if(p.kind==='bot'){ if(p.nextBuildAt>simMs) return false; p.nextBuildAt=simMs+rnd(4000,8000)/(bd(p).build||1); } const A=AIR[type]; if(!st||st.building||st.type!=='airfield'||st.owner!==p.id) return false; if(hangarCount(st)>=hangarMax(st)||p.gold<A.cost) return false; if(type==='carrier'&&(st.level||1)<2){ if(p===me) fail('Troop transports need a level II airfield.'); return false; }
  p.gold-=A.cost; st.aq=st.aq||[]; const ticks=START.instant?0:A.build; st.aq.push({type,done:tickN+ticks,total:ticks}); if(p===me){ log(`${type==='fighter'?'Stealth fighter':type==='carrier'?'Stealth troop transport':'Stealth bomber'} ordered — ${Math.ceil(ticks/10)} s.`,true); snd('build'); } return true; }
function spawnAircraft(st,type){ if(st.owner===me.id) sInc('planesBuilt'); const x=st.t%W+.5,y=(st.t-st.t%W)/W+.5; const a={id:++uidSeq,owner:st.owner,type,home:st,state:'hangar',x,y,hdg:0,hp:type==='fighter'?AIR.fighter.hp:1,until:0}; aircraft.push(a); return a; }
function idleAircraft(p,type,t){ const x=t%W,y=(t-x)/W; return aircraft.filter(a=>a.owner===p.id&&a.type===type&&a.state==='hangar'&&structures.includes(a.home)&&Math.hypot(a.home.t%W-x,(a.home.t-a.home.t%W)/W-y)<=AIR[type].range).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]; }
function launchFighter(p,t){ if(pausedBlock(p)) return false; const a=idleAircraft(p,'fighter',t); if(!a){ if(p===me) fail('No fighter ready within range of that point.'); return false; } a.state='out'; a.tx=t%W+.5; a.ty=(t-t%W)/W+.5; a.until=0; if(p===me){ log('Fighter patrol launched.',true); snd('jet'); } return true; }
function launchParadrop(p,t,troops){ if(pausedBlock(p)) return false; const a=idleAircraft(p,'carrier',t); if(!a){ if(p===me) fail('No troop transport ready within range of that point.'); return false; }
  const origin=gOn(p)?(areaAt(a.home.t)||p.areas[0]):null; troops=Math.min(troops,AIR.carrier.capacity,origin?origin.troops:p.troops); if(troops<10){ if(p===me) fail('Not enough troops to load.'); return false; }
  const o=owner[t]; if(o>=0&&atPeace(p.id,o)&&o!==p.id){ if(p===me) fail(`You're at peace with ${players[o].name}.`); return false; }
  a.troops=takeTroopsFrom(p,origin,troops); if(p===me) sInc('paradrops'); a.state='out'; a.tx=t%W+.5; a.ty=(t-t%W)/W+.5; a.dropT=t; if(p===me){ log(`Troop transport airborne with ${Math.round(a.troops)} troops.`,true); snd('jet'); } return true; }
function launchBomber(p,t){ if(pausedBlock(p)) return false; const a=idleAircraft(p,'bomber',t); if(!a){ if(p===me) fail('No bomber ready within range of that point.'); return false; } a.state='out'; a.runHdg=srand()*Math.PI*2; const half=AIR.bomber.bombs*AIR.bomber.spacing/2; a.tx=t%W+.5-Math.cos(a.runHdg)*half; a.ty=(t-t%W)/W+.5-Math.sin(a.runHdg)*half; a.bombs=AIR.bomber.bombs; a.dropAt=AIR.bomber.spacing; a.runLen=0; if(p===me){ log('Bomber launched.',true); snd('jet'); } return true; }
function recallAircraft(a){ if(!['out','patrol','run'].includes(a.state)) return false; a.state='return'; if(a.owner===me.id) log(`${a.type==='fighter'?'Fighter':'Bomber'} recalled.`,true); return true; }
function fly(a,tx,ty,sp){ const dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy); if(d<=sp){ a.x=tx; a.y=ty; return true; } a.x+=dx/d*sp; a.y+=dy/d*sp; a.hdg=Math.atan2(dy,dx); return false; }
function enemyPatrolAt(x,y,owner){ return aircraft.filter(f=>f.type==='fighter'&&f.state==='patrol'&&f.owner!==owner&&!atPeace(f.owner,owner)&&Math.hypot(f.tx-x,f.ty-y)<=AIR.fighter.patrol); }
function bomb(a,x,y){ const cx=Math.floor(x),cy=Math.floor(y); if(!inb(cx,cy)) return false; if(a.owner===me.id) sInc('bombs'); const o0=owner[idx(cx,cy)]; if(o0===a.owner||(o0>=0&&atPeace(a.owner,o0))) return false; // hold the bomb over friendly ground
  const dome=domeFor(idx(cx,cy),a.owner);
  if(dome){ flashes.push({x:cx,y:cy,r:2,age:0,col:'#9df'}); hitDome(dome,1,a.owner); return; }
  const t=idx(cx,cy); const st=struct[t]?structures.find(q=>q.t===t):null; const bunker=st&&(st.type==='bertha'||st.type==='battery'||st.type==='shield'||st.type==='silo')&&srand()<0.3;
  if(bunker){ flashes.push({x:cx,y:cy,r:2,age:0,col:'#ffb347'}); return; }
  crater(cx,cy,AIR.bomber.radius,a.owner,{flat:10,pct:0.004,cap:60},a.owner); if(owner[t]>=0) noteThreat(owner[t],t,'bomb',a.owner); if(a.owner===me.id||owner[t]===me.id) snd('bomb',cx,cy); return true; }
function stepAir(){
  for(const st of structures){ if(st.type!=='airfield'||st.building||!st.aq||!st.aq.length) continue; const job=st.aq[0]; if(job.done<=tickN){ st.aq.shift(); spawnAircraft(st,job.type); if(st.owner===me.id) log(`${job.type==='fighter'?'Stealth fighter':job.type==='carrier'?'Stealth troop transport':'Stealth bomber'} ready at the airfield.`,true); } }
  for(const a of aircraft){
    if(!structures.includes(a.home)){ a.dead=true; continue; }
    const F=AIR[a.type]; const hx=a.home.t%W+.5, hy=(a.home.t-a.home.t%W)/W+.5;
    if(a.type==='fighter'){
      if(a.state==='out'){ if(fly(a,a.tx,a.ty,F.speed)){ a.state='patrol'; a.until=tickN+F.endurance; a.ang=0; if(a.owner===me.id) log('Fighter on patrol.',true); } }
      else if(a.state==='patrol'){ a.ang=(a.ang||0)+0.028+0.012*Math.sin((a.ang||0)*2); const jink=(a.hitAt&&tickN-a.hitAt<40)?Math.sin(tickN*0.6)*4:0; const ex=F.patrol*0.75, ey=F.patrol*0.45; const rot=a.rot??(a.rot=srand()*Math.PI); const lx=Math.cos(a.ang)*ex, ly=Math.sin(a.ang)*ey; a.x=a.tx+lx*Math.cos(rot)-ly*Math.sin(rot)+jink; a.y=a.ty+lx*Math.sin(rot)+ly*Math.cos(rot); a.hdg=Math.atan2(a.y-(a.py??a.y),a.x-(a.px??a.x)); a.px=a.x; a.py=a.y; if(a.until<=tickN){ a.state='return'; if(a.owner===me.id) log('Fighter low on fuel, returning to base.',true); } }
      else if(a.state==='return'){ if(fly(a,hx,hy,F.speed)){ a.state=a.hp<F.hp?'heal':'refuel'; a.until=tickN+(a.hp<F.hp?F.heal:F.refuel); } }
      else if(a.state==='refuel'){ if(a.until<=tickN) a.state='hangar'; }
      else if(a.state==='heal'){ if(a.until<=tickN){ a.hp++; if(a.hp>=F.hp){ a.hp=F.hp; a.state='hangar'; if(a.owner===me.id) log('Fighter repaired and ready.',true); } else a.until=tickN+F.heal; } }
    } else if(a.type==='carrier'){ const C=AIR.carrier;
      if(a.state==='out'){ if(fly(a,a.tx,a.ty,C.speed)){ const t=a.dropT, o=owner[t]; a.state='return'; const p=players[a.owner];
          if(!land[t]){ addTroopsAt(p,a.home.t,a.troops); if(p===me) log('Drop zone is water — troops brought home.',true); }
          else if(o===p.id){ addTroopsAt(p,t,a.troops); if(p===me) log(`${Math.round(a.troops)} paratroops landed on your land.`,true); }
          else { attacks.push({owner:p.id,target:o,troops:a.troops,front:new Set([t]),naval:true,age:0,origin:null,landAt:t,startTiles:o>=0?players[o].tiles:0}); log(`${p.name} dropped ${Math.round(a.troops)} paratroops on ${o>=0?players[o].name:'open land'}.`, p===me||o===me.id); if(p===me) snd('attack'); flashes.push({x:a.tx,y:a.ty,r:3,age:0,col:'#fff'}); }
          a.troops=0; } }
      else if(a.state==='return'){ if(fly(a,hx,hy,C.speed)){ a.state='refuel'; a.until=tickN+C.rearm; } }
      else if(a.state==='refuel'){ if(a.until<=tickN) a.state='hangar'; }
    } else {
      const B=AIR.bomber;
      if(a.state==='out'){ if(fly(a,a.tx,a.ty,B.speed)){ a.state='run'; a.hdg=a.runHdg; a.dropAt=0; } }
      else if(a.state==='run'){ a.x+=Math.cos(a.runHdg)*B.speed; a.y+=Math.sin(a.runHdg)*B.speed; a.dropAt+=B.speed; a.runLen=(a.runLen||0)+B.speed; if(a.dropAt>=B.spacing&&a.bombs>0){ a.dropAt=0; if(bomb(a,a.x,a.y)){ a.bombs--; frags.push({x:a.x,y:a.y,vx:Math.cos(a.runHdg)*0.4,vy:Math.sin(a.runHdg)*0.4,age:0,life:8,col:'#222',bomb:true}); } } if(a.bombs<=0||a.runLen>B.bombs*B.spacing*2||!inb(Math.floor(a.x),Math.floor(a.y))) a.state='return'; }
      else if(a.state==='return'){ a.pull=Math.min(1,(a.pull||0)+0.08); if(fly(a,hx,hy,B.speed)){ a.state='refuel'; a.until=tickN+B.rearm; } }
      else if(a.state==='refuel'){ if(a.until<=tickN) a.state='hangar'; }
    }
  }
  for(const b of aircraft){ if(!(b.type==='bomber'||b.type==='carrier')||b.dead||!['out','run','return'].includes(b.state)) continue; const hunters=enemyPatrolAt(b.x,b.y,b.owner); if(hunters.length){ b.dead=true; if(b.owner===me.id) sInc('planesLost'); else if(hunters[0].owner===me.id) sInc('planesDown'); fxWreck('air',b.x,b.y,b.hdg,players[b.owner].color,b.type); if(b.type==='carrier'&&b.troops>0) log(`${Math.round(b.troops)} ${players[b.owner].name} paratroops were lost with the aircraft.`, b.owner===me.id); shells.push({owner:hunters[0].owner,x:hunters[0].x,y:hunters[0].y,kind:'aam',target:{x:b.x,y:b.y,static:true},trail:[],speed:9,dmgDone:true}); flashes.push({x:b.x,y:b.y,r:3,age:0,col:'#ffb347'}); log(`${players[hunters[0].owner].name}'s fighters shot down ${players[b.owner].name}'s ${b.type==='carrier'?'troop transport':'bomber'}.`, b.owner===me.id||hunters[0].owner===me.id); if(b.owner===me.id||hunters[0].owner===me.id) snd('intercept',b.x,b.y); markHostile(hunters[0].owner,b.owner); } }
  if(tickN%AIR.fighter.dog===0){
    for(const f of aircraft){ if(f.type!=='fighter'||f.dead||!['patrol','return'].includes(f.state)) continue; const foes=enemyPatrolAt(f.x,f.y,f.owner); if(!foes.length) continue;
      const friends=aircraft.filter(g=>g.type==='fighter'&&g.state==='patrol'&&g.owner===f.owner&&Math.hypot(g.x-f.x,g.y-f.y)<=AIR.fighter.patrol*1.5).length;
      const outnumbered=foes.length>friends; const hit=srand()<(outnumbered?0.85:0.6); if(hit){ f.hp--; f.hitAt=tickN; shells.push({owner:foes[0].owner,x:foes[0].x,y:foes[0].y,kind:'aam',target:f,trail:[],speed:9,dmgDone:true}); if(f.owner===me.id&&f.hp===2){ log('A fighter is down to 2 hit points — recall it!',true); snd('invaded'); } if(f.owner===me.id||foes[0].owner===me.id) snd('dogfight',f.x,f.y); markHostile(f.owner,foes[0].owner); }
      if(f.hp<=0){ f.dead=true; if(f.owner===me.id) sInc('planesLost'); else if(foes[0].owner===me.id) sInc('planesDown'); flashes.push({x:f.x,y:f.y,r:3,age:0,col:'#ffb347'}); fxWreck('air',f.x,f.y,f.hdg,players[f.owner].color,'fighter'); log(`${players[f.owner].name} lost a fighter in a dogfight.`, f.owner===me.id||foes[0].owner===me.id); } }
  }
  aircraft=aircraft.filter(a=>!a.dead&&players[a.owner].alive);
}
function areaThreats(p){ // for each of p's areas: the hostile troops on its borders, and whether it is under attack
  const th={}; for(const a of p.areas) th[a.id]={hostile:0,attacked:false};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); if(owner[t]!==p.id) continue; const id=areaOf[t]; if(id<0||!th[id]) continue;
    for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const o=owner[idx(x+dx,y+dy)]; if(o<0||o===p.id) continue; const q=players[o]; if(!q.alive||atPeace(p.id,o)) continue;
      const hostile=q.kind==='neutral'?!!(q.grudge&&q.grudge[p.id]!=null&&tickN-q.grudge[p.id]<PROVOKE_TICKS):(inConflict(p.id,o)||density(q)>0); if(hostile&&!th[id]['seen'+o]){ th[id]['seen'+o]=true; th[id].hostile+=gOn(q)?densityAt(q,idx(x+dx,y+dy))*50:Math.min(q.troops,density(q)*50); } } }
  for(const at of attacks){ if(at.target!==p.id) continue; for(const t of at.front){ const id=areaOf[t]; if(id>=0&&th[id]){ th[id].attacked=true; th[id].hostile+=at.troops; break; } } }
  return th; }
function seaRisk(p,origin,dest){ // hostile warships along the route, subs the escort could see, guns at the landing
  const pickCoast=(area,nearT)=>{ let best=-1,bd=1e12; const nx=nearT%W,ny=(nearT-nx)/W; for(let c=0;c<W*H;c++){ if(owner[c]!==p.id||areaOf[c]!==area.id||!isCoast(c)) continue; const d=(c%W-nx)**2+((c-c%W)/W-ny)**2; if(d<bd){bd=d;best=c;} } return best; };
  const dT=idx(Math.round(dest.cx),Math.round(dest.cy)); const to=pickCoast(dest,dT); if(to<0) return 99; const from=pickCoast(origin,to); if(from<0) return 99;
  const path=waterPath(waterNeighbor(from),waterNeighbor(to)); if(!path) return 99;
  let risk=0; const pts=[]; for(let i=0;i<path.length;i+=6) pts.push(path[i]); pts.push(path[path.length-1]);
  for(const t of pts){ const x=t%W,y=(t-x)/W;
    for(const w of warships){ if(w.owner===p.id||w.hp<=0||w.x==null||atPeace(p.id,w.owner)) continue; if(!(inConflict(p.id,w.owner)||SHIPS[w.cls].sub)) continue; if(SHIPS[w.cls].sub&&!subSeenBy(w,p.id)) continue; if((w.x-x)**2+(w.y-y)**2<=(t===path[path.length-1]?900:400)){ risk+=SHIPS[w.cls].sub?1:2; } } }
  const tx=to%W,ty=(to-tx)/W; for(const st of structures){ if(st.building||st.owner===p.id||atPeace(p.id,st.owner)||!inConflict(p.id,st.owner)) continue; if(!(gunTarget(st)||st.type==='bertha')) continue; const R=st.type==='port'?14:(GUNS[st.type]||{range:14}).range; if((st.t%W-tx)**2+((st.t-st.t%W)/W-ty)**2<=(R+4)**2) risk+=2; }
  return risk; }
// ---------------------------------------------------------------- engineering: repair trucks
const TRUCK={max:4,speed:0.4,repairTicks:80,costPip:15,reserve:150};
function repairNeed(st){ if(st.building) return 0; if(st.type==='shield') return SHIELD.hp-st.hp; if(st.type==='airfield'&&(st.level||1)>=2) return LSHIELD.hp-(st.lshield||0); if(st.type==='port'&&(st.level||1)>=2) return 4-(st.gunHp||0); if(GUNS[st.type]&&st.hp!=null) return GUNS[st.type].hp-st.hp; return 0; }
function repairOne(st){ if(st.type==='shield') st.hp++; else if(st.type==='airfield') st.lshield=(st.lshield||0)+1; else if(st.type==='port') st.gunHp=(st.gunHp||0)+1; else st.hp++; }
function landPath(p,a,b){
  const par=new Int32Array(W*H).fill(-1), q=new Int32Array(W*H); let h=0,tl=0; q[tl++]=a; par[a]=a;
  while(h<tl){ const c=q[h++]; if(c===b) break; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(owner[n]!==p.id||par[n]>=0) continue; par[n]=c; q[tl++]=n; } }
  if(par[b]<0) return null; const path=[]; for(let c=b;c!==a;c=par[c]) path.push(c); path.push(a); return path.reverse(); }
function engineering(){
  if(tickN%20) return;
  for(const p of players){ if(!p.alive||p.kind==='neutral') continue; const cmds=structures.filter(st=>st.type==='engcmd'&&!st.building&&st.owner===p.id); if(!cmds.length) continue;
    const mine=trucks.filter(t=>t.owner===p.id); if(mine.length>=TRUCK.max) continue;
    const busy=new Set(mine.map(t=>t.target)); const jobs=structures.filter(st=>st.owner===p.id&&repairNeed(st)>0&&!busy.has(st)&&!st.repairing);
    for(const st of jobs){ if(trucks.filter(t=>t.owner===p.id).length>=TRUCK.max) break; if(p.gold<TRUCK.costPip*repairNeed(st)+TRUCK.reserve) break;
      const base=cmds.sort((a,b)=>((a.t%W-st.t%W)**2+((a.t-a.t%W)/W-(st.t-st.t%W)/W)**2)-((b.t%W-st.t%W)**2+((b.t-b.t%W)/W-(st.t-st.t%W)/W)**2))[0];
      const path=landPath(p,base.t,st.t); if(!path) continue; trucks.push({owner:p.id,target:st,path,pos:0,x:base.t%W+.5,y:(base.t-base.t%W)/W+.5,hdg:0,state:'out',home:base}); if(p===me) log(`Repair truck dispatched to ${STRUCT[st.type].label.toLowerCase()}.`,true); }
  }
}
function stepTrucks(){
  for(const tr of trucks){ const p=players[tr.owner];
    if(!structures.includes(tr.target)||!structures.includes(tr.home)){ tr.dead=true; continue; }
    const drive=()=>{ tr.pos+=TRUCK.speed; const i=Math.min(tr.path.length-1,Math.floor(tr.pos)); const t=tr.path[i]; if(owner[t]!==p.id){ tr.dead=true; if(p===me) log('A repair truck was lost on captured ground.',true); return false; } const nx=t%W+.5, ny=(t-t%W)/W+.5; if(Math.abs(nx-tr.x)+Math.abs(ny-tr.y)>0.01) tr.hdg=Math.atan2(ny-tr.y,nx-tr.x); tr.x=nx; tr.y=ny; return tr.pos>=tr.path.length-1; };
    const goHome=()=>{ tr.state='home'; const back=landPath(p,tr.target.t,tr.home.t); if(back){ tr.path=back; tr.pos=0; } else tr.dead=true; };
    if(tr.state==='out'){ if(drive()){ tr.state='work'; tr.workAt=tickN+TRUCK.repairTicks; } }
    else if(tr.state==='work'){ if(repairNeed(tr.target)<=0){ goHome(); continue; } if(tr.target.flash&&tr.target.flash+150>tickN){ tr.workAt=Math.max(tr.workAt,tickN+TRUCK.repairTicks); } if(tr.workAt<=tickN){ if(p.gold<TRUCK.costPip){ goHome(); continue; } p.gold-=TRUCK.costPip; repairOne(tr.target); tr.workAt=tickN+TRUCK.repairTicks; if(repairNeed(tr.target)<=0&&p===me) log(`Repair truck restored the ${STRUCT[tr.target.type].label.toLowerCase()}.`,true); } }
    else if(tr.state==='home'){ if(drive()) tr.dead=true; }
  }
  trucks=trucks.filter(t=>!t.dead&&players[t.owner].alive);
}

function troopLogistics(){
  if(tickN%40||!START.garrison) return;
  for(const p of players){ if(!p.alive||p.kind==='neutral'||!(p.troopcmds>0)||!p.areas||p.areas.length<2||p.logisticsAuto===false) continue;
    const home=p.areas[0]; const hd=home.troops/Math.max(1,home.tiles); const reserve=maxTroops(p)*0.3*(home.tiles/Math.max(1,p.tiles)); const surplus=home.troops-reserve; if(surplus<50) continue;
    const th=areaThreats(p); const inTransit=a=>transports.filter(tr=>!tr.done&&tr.owner===p.id&&tr.target===p.id&&areaOf[tr.seed]===a.id).reduce((s2,tr)=>s2+tr.troops,0)+aircraft.filter(ac=>ac.owner===p.id&&ac.type==='carrier'&&ac.state==='out'&&ac.dropT!=null&&areaOf[ac.dropT]===a.id).reduce((s2,ac)=>s2+(ac.troops||0),0);
    const cands=p.areas.filter(a=>a!==home&&a.tiles>=40&&(supplyAt[a.id]==null||supplyAt[a.id]+200<=tickN)).map(a=>{ const dens=a.troops/a.tiles; const t2=th[a.id]||{hostile:0,attacked:false}; const threatened=t2.attacked||t2.hostile>0; const bare=dens<hd*0.2;
      const want=(threatened?hd*0.6:hd*0.2)*a.tiles; const need=Math.max(0,want-a.troops-inTransit(a)); return {a,need,threatened,bare,score:(t2.attacked?3:0)+(threatened?2:0)+(bare?1:0)+Math.min(1,t2.hostile/Math.max(1,a.troops))}; })
      .filter(c=>c.need>=50&&(c.threatened||c.bare)).sort((x,y)=>y.score-x.score);
    if(!cands.length) continue; const c=cands[0]; const send=Math.min(c.need,surplus,home.troops*0.15); if(send<50) continue;
    const dropT=idx(Math.round(c.a.cx),Math.round(c.a.cy)); const air=idleAircraft(p,'carrier',dropT); let ok=false;
    const risk=(home.coast&&c.a.coast)?seaRisk(p,home,c.a):99;
    if(air&&owner[dropT]===p.id&&(risk>0||send<=AIR.carrier.capacity)){ ok=launchParadrop(p,dropT,Math.min(send,AIR.carrier.capacity)); if(ok&&p===me) log(`Troop command: paradropping ${Math.round(Math.min(send,AIR.carrier.capacity))} to ${areaLabel(p,c.a)} (${c.threatened?'under threat':'bare garrison'}${risk>0?', sea lane contested':''}).`,true); }
    else if(home.coast&&c.a.coast){ if(risk>0&&!(th[c.a.id]&&th[c.a.id].attacked)){ if(p===me&&(supplyAt['warn'+c.a.id]==null||supplyAt['warn'+c.a.id]+600<=tickN)){ supplyAt['warn'+c.a.id]=tickN; log(`Troop command: convoy to ${areaLabel(p,c.a)} held — sea lane contested (${risk>=99?'no safe route':risk+' threats'}). Clear it or add escorts.`,true); } continue; }
      const amt=risk>0?send*0.5:send; ok=reinforceArea(p,c.a,home,amt); if(ok&&p===me) log(`Troop command: shipping ${Math.round(amt)} to ${areaLabel(p,c.a)} (${c.threatened?'under threat':'bare garrison'}${risk>0?', running a contested lane':''}).`,true); }
    if(ok) supplyAt[c.a.id]=tickN;
  }
}
function flightOps(){
  if(tickN%30) return;
  for(const p of players){ if(!p.alive||p.kind==='neutral'||p.airAuto===false) continue; const ops=p.kind==='bot'||structures.some(st=>st.type==='flightops'&&!st.building&&st.owner===p.id); if(!ops) continue;
    const fields=airfieldsOf(p); if(!fields.length) continue;
    for(const st of fields){ const own=aircraft.filter(a=>a.home===st); const q=st.aq||[]; const nf=own.filter(a=>a.type==='fighter').length+q.filter(j=>j.type==='fighter').length, nb=own.filter(a=>a.type==='bomber').length+q.filter(j=>j.type==='bomber').length;
      if(nf<2&&p.gold>=AIR.fighter.cost+AIR.reserve) buyAircraft(p,st,'fighter'); else if(nb<1&&p.gold>=AIR.bomber.cost+AIR.reserve) buyAircraft(p,st,'bomber'); }
    for(const f of aircraft){ if(f.owner!==p.id||f.type!=='fighter'||f.state!=='patrol') continue; const foes=enemyPatrolAt(f.x,f.y,f.owner); const friends=aircraft.filter(g=>g.type==='fighter'&&g.state==='patrol'&&g.owner===p.id&&Math.hypot(g.x-f.x,g.y-f.y)<=AIR.fighter.patrol*1.5).length; if(f.hp<=2||(foes.length>friends&&f.hp<AIR.fighter.hp)) recallAircraft(f); }
    const assets=structures.filter(st=>st.owner===p.id&&!st.building&&['sam','airfield','silo','battery','bertha','shield','command'].includes(st.type));
    const active=aircraft.filter(a=>a.owner===p.id&&a.type==='fighter'&&['out','patrol'].includes(a.state));
    for(const st of assets){ const x=st.t%W+.5,y=(st.t-st.t%W)/W+.5; if(active.some(a=>Math.hypot(a.tx-x,a.ty-y)<=AIR.fighter.patrol*0.9)) continue; if(launchFighter(p,st.t)) active.push({tx:x,ty:y}); }
    const foes=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&(p.cmdFocus===q.id||inConflict(p.id,q.id))); if(!foes.length) continue; const foeIds=new Set(foes.map(q=>q.id));
    let best=null,bs=0; for(const st of structures){ if(!foeIds.has(st.owner)||st.building) continue; if(p===me&&vis&&!vis[st.t]) continue; const x=st.t%W+.5,y=(st.t-st.t%W)/W+.5; if(enemyPatrolAt(x,y,p.id).length||domeFor(st.t,p.id)) continue;
      let sc={sam:6,silo:5,command:5,airfield:6,flightops:5,bertha:5,battery:4,shield:1,city:4,port:3,factory:2}[st.type]||1; sc*=0.85+srand()*0.3; if(sc>bs){bs=sc;best=st;} }
    if(best) launchBomber(p,best.t);
  }
}

function reclaimLand(){ // craters and burnt ground grow back into whoever surrounds them, a little at a time
  if(tickN%10) return;
  for(const t of [...unclaimed]){ if(!land[t]||owner[t]>=0){ unclaimed.delete(t); continue; } if(srand()>0.25) continue;
    const x=t%W,y=(t-x)/W; const tally={}; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const o=owner[idx(x+dx,y+dy)]; if(o>=0&&players[o].alive) tally[o]=(tally[o]||0)+1; }
    let best=-1,bn=0,second=0; for(const k in tally){ if(tally[k]>bn){ second=bn; bn=tally[k]; best=+k; } else if(tally[k]>second) second=tally[k]; }
    if(best>=0&&bn>=2&&bn>second) setOwner(t,best); } // grows as a solid front: two same-owner neighbours and a clear majority, so rival reclaims never interleave
}
// ---------------------------------------------------------------- garrisons mode: troops live in contiguous areas of land, separated by water
let areaOf=null, nextAreaId=1; const supplyAt={};
function gOn(p){ return START.garrison&&p&&p.kind!=='neutral'; }
function rebuildAreas(){ // connected components of each player's land; troops carried over by tile overlap so merges add and splits divide
  if(!START.garrison) return; if(!areaOf) areaOf=new Int32Array(W*H).fill(-1);
  const old={}; for(const p of players){ if(!gOn(p)||!p.areas) continue; for(const a of p.areas) old[a.id]=a; }
  const seen=new Uint8Array(W*H), q=new Int32Array(W*H); const newAreaOf=new Int32Array(W*H).fill(-1); const usedIds=new Set();
  for(const p of players){ if(!gOn(p)) continue; const areas=[];
    for(let t0=0;t0<W*H;t0++){ if(owner[t0]!==p.id||seen[t0]) continue; let h=0,tl=0; q[tl++]=t0; seen[t0]=1; const tally={}; let n=0,sx=0,sy=0; const id=nextAreaId++;
      while(h<tl){ const c=q[h++]; n++; sx+=c%W; sy+=(c-c%W)/W; newAreaOf[c]=id; const o=areaOf[c]; if(o>=0) tally[o]=(tally[o]||0)+1; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const m=idx(x+dx,y+dy); if(!seen[m]&&owner[m]===p.id){ seen[m]=1; q[tl++]=m; } } }
      let troops=0, bestOld=-1, bestN=0; for(const k in tally){ const oa=old[k]; if(oa) troops+=oa.troops*tally[k]/Math.max(1,oa.tiles); if(tally[k]>bestN&&old[k]&&old[k].owner===p.id){ bestN=tally[k]; bestOld=+k; } }
      let useId=id; if(bestOld>=0&&!usedIds.has(bestOld)){ useId=bestOld; nextAreaId--; } usedIds.add(useId); for(let i2=0;i2<tl;i2++) newAreaOf[q[i2]]=useId;
      areas.push({id:useId,owner:p.id,tiles:n,troops,cx:sx/n,cy:sy/n,coast:false}); }
    // unassigned troops (a brand-new player, or gains recorded before areas existed) go to the largest area
    areas.sort((a,b)=>b.tiles-a.tiles); { const cap=p.sx!=null?idx(Math.max(0,Math.min(W-1,Math.round(p.sx))),Math.max(0,Math.min(H-1,Math.round(p.sy)))):-1; const hid=cap>=0?newAreaOf[cap]:-1; const hi=areas.findIndex(a=>a.id===hid); if(hi>0){ const [h]=areas.splice(hi,1); areas.unshift(h); } } // Home is the area holding the capital, not the biggest
    const have=areas.reduce((s,a)=>s+a.troops,0); if(areas.length&&p.troops>have+0.5) areas[0].troops+=p.troops-have;
    for(const a of areas) a.troops=Math.max(0,a.troops); p.areas=areas; p.troops=areas.reduce((s,a)=>s+a.troops,0); }
  areaOf=newAreaOf;
  for(let t=0;t<W*H;t+=2) if(areaOf[t]>=0&&land[t]&&isCoast(t)){ const a=areaById(areaOf[t]); if(a) a.coast=true; }
}
function areaById(id){ for(const p of players){ if(!p.areas) continue; for(const a of p.areas) if(a.id===id) return a; } return null; }
function areaAt(t){ if(!START.garrison||!areaOf||t<0||areaOf[t]<0) return null; return areaById(areaOf[t]); }
function areaTouching(p,target){ // which of p's areas borders the target owner; the one with the longest shared frontier
  const count={}; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); if(owner[t]!==p.id) continue; const id=areaOf[t]; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]===target){ count[id]=(count[id]||0)+1; break; } } }
  let best=null,bn=0; for(const k in count) if(count[k]>bn){ bn=count[k]; best=areaById(+k); } return best; }
function syncTroops(p){ if(gOn(p)&&p.areas) p.troops=p.areas.reduce((s,a)=>s+a.troops,0); }
function addTroopsAt(p,t,n){ if(!gOn(p)||!p.areas||!p.areas.length){ p.troops+=n; return; } const a=(t!=null&&areaAt(t))||p.areas[0]; if(a.owner!==p.id){ p.areas[0].troops+=n; } else a.troops+=n; syncTroops(p); }
function takeTroopsFrom(p,a,n){ if(!gOn(p)||!a){ const k=Math.min(n,p.troops); p.troops-=k; return k; } const k=Math.min(n,a.troops); a.troops-=k; syncTroops(p); return k; }
function loseTroopsAt(p,t,n){ if(!gOn(p)||!p.areas||!p.areas.length){ p.troops=Math.max(0,p.troops-n); return; } const a=areaAt(t)||p.areas[0]; a.troops=Math.max(0,a.troops-n); syncTroops(p); }
function densityAt(p,t){ if(!gOn(p)||!p.areas) return density(p); const a=areaAt(t); return a?a.troops/Math.max(1,a.tiles):density(p); }
function reinforceArea(p,dest,origin,troops){ if(pausedBlock(p)) return false; // ship a garrison from one of your areas to another across water
  if(!gOn(p)||!dest||!origin||dest===origin) return false; troops=Math.min(troops,origin.troops); if(troops<5){ if(p===me) fail('Not enough troops in that area.'); return false; }
  const pickCoast=(area,nearT)=>{ let best=-1,bd=1e12; const nx=nearT%W,ny=(nearT-nx)/W; for(let c=0;c<W*H;c++){ if(owner[c]!==p.id||areaOf[c]!==area.id||!isCoast(c)) continue; const d=(c%W-nx)**2+((c-c%W)/W-ny)**2; if(d<bd){bd=d;best=c;} } return best; };
  const dT=idx(Math.round(dest.cx),Math.round(dest.cy)); const to=pickCoast(dest,dT); if(to<0){ if(p===me) fail('That area has no coastline to land on.'); return false; }
  const from=pickCoast(origin,to); if(from<0){ if(p===me) fail('The origin area has no coastline to embark from.'); return false; }
  const path=waterPath(waterNeighbor(from),waterNeighbor(to)); if(!path){ if(p===me) fail('No sea route between those areas.'); return false; }
  takeTroopsFrom(p,origin,troops); { const hv=heavyFrom(p,from,origin); transports.push({owner:p.id,target:p.id,troops,seed:to,path,pos:0,hdg:0,wake:[],origin:origin.id,heavy:hv,hp:hv?HEAVY.hp:1}); }
  if(p===me){ log(`${Math.round(troops)} troops embarking from ${areaName(p,origin)} to reinforce ${areaName(p,dest)}.`,true); snd('foghorn'); } return true; }
function fmtN(n){ n=Math.round(n); return n>=1e9?(n/1e9).toFixed(1)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(0)+'k':n>=1000?(n/1000).toFixed(1)+'k':String(n); }
function areaLabel(p,a){ if(!a) return ''; const i=p.areas.indexOf(a); if(i===0) return 'Home'; const rg=region[idx(Math.round(a.cx),Math.round(a.cy))]; const r=regions[rg]; const base=(r&&r.name&&r.size>=REGION_MIN)?r.name:'Area '+(i+1);
  const twins=p.areas.filter(b=>b!==a&&p.areas.indexOf(b)!==0&&region[idx(Math.round(b.cx),Math.round(b.cy))]===rg); if(!twins.length) return base;
  const home=p.areas[0]; const dx=a.cx-home.cx, dy=a.cy-home.cy; const dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'E':'W'):(dy>0?'S':'N'); const same=twins.filter(b=>{ const bx=b.cx-home.cx,by=b.cy-home.cy; return (Math.abs(bx)>Math.abs(by)?(bx>0?'E':'W'):(by>0?'S':'N'))===dir; }).length; return base+' '+dir+(same?' '+(p.areas.filter(b=>p.areas.indexOf(b)<=i&&b!==home&&region[idx(Math.round(b.cx),Math.round(b.cy))]===rg).length):''); }
function areaName(p,a){ if(!a) return ''; return areaLabel(p,a)+' ('+fmtN(a.troops)+')'; }
function areaChoices(p,exclude){ return p.areas.filter(a=>a!==exclude&&a.coast&&a.troops>=5&&(a.tiles>=20||a===p.areas[0])).sort((a,b)=>b.troops-a.troops).slice(0,5); }

function upgradeStructure(p,st){ if(pausedBlock(p)) return false; if(p.kind==='bot'){ if(p.nextBuildAt>simMs) return false; p.nextBuildAt=simMs+rnd(6000,12000)/(bd(p).build||1); } const U=UPGRADE[st.type]; if(!U||st.building||st.upgrading||(st.level||1)>=(U.max||2)||st.owner!==p.id) return false; const lvl=(st.level||1); const cost=lvl>=2?(U.cost3||U.cost):U.cost, ticksU=lvl>=2?(U.ticks3||U.ticks):U.ticks; if(p.gold<cost){ if(p===me) fail('Not enough gold for the upgrade.'); return false; }
  p.gold-=cost; const ticks=ticksU; st.upTo=lvl+1; /* upgrades always take time */ st.upgrading=true; st.upDone=tickN+ticks; st.upTotal=ticks; if(p===me){ log(`${STRUCT[st.type].label} upgrading to level ${st.upTo===3?'III':'II'} — ${Math.ceil(ticks/10)} s.`,true); snd('build'); } return true; }
function finishUpgrades(){ for(const st of structures){ if(!st.upgrading||st.upDone>tickN) continue; st.upgrading=false; st.level=st.upTo||2; st.popAt=tickN; if(st.type==='airfield') st.lshield=LSHIELD.hp; if(st.type==='port') st.gunHp=4; if(st.owner===me.id){ log(`${STRUCT[st.type].label} is now level ${st.level>=3?'III':'II'}.`,true); snd('unified'); } } }
// ---------------------------------------------------------------- bot brain helpers
function noteThreat(o,t,kind,by){ const q=players[o]; if(!q||q.kind!=='bot') return; q.threats=(q.threats||[]).filter(x=>tickN-x.at<1800); q.threats.push({t,kind,by,at:tickN}); if(q.threats.length>30) q.threats.shift(); }
function bd(p){ return (p&&p.customNation&&(DIFF.brain||2)<4)?DIFFS.superhard:DIFF; }
function botLevel(p){ return p.kind==='bot'?(bd(p).brain||2):0; }
function nearestTo(p,list,t){ let best=-1,bd=1e12; const x=t%W,y=(t-x)/W; for(const c of list){ const d=(c%W-x)**2+((c-c%W)/W-y)**2; if(d<bd){bd=d;best=c;} } return best; }
function botReact(p){ // answer the most recent threats with the right building or unit
  const L=botLevel(p); if(L<3||!p.threats||!p.threats.length) return false; const th=p.threats[p.threats.length-1]; const own=ownTilesOf(p.id); if(!own.length) return false;
  const near=(type,R)=>{ const c=own.filter(t=>!struct[t]&&!crowded(t)&&(!STRUCT[type].coast||isCoast(t))&&((t%W-th.t%W)**2+((t-t%W)/W-(th.t-th.t%W)/W)**2)<=R*R); if(!c.length) return false; return placeStructure(p,type,nearestTo(p,c,th.t)); };
  const has=(type,R)=>structures.some(st=>st.owner===p.id&&st.type===type&&((st.t%W-th.t%W)**2+((st.t-st.t%W)/W-(th.t-th.t%W)/W)**2)<=R*R);
  let done=false;
  if(th.kind==='missile'){ if(!has('sam',30)&&p.gold>=STRUCT.sam.cost+100) done=near('sam',14); else if(L>=4&&!has('shield',12)&&p.gold>=STRUCT.shield.cost+200&&structures.some(st=>st.owner===p.id&&(st.type==='silo'||st.type==='city')&&((st.t%W-th.t%W)**2+((st.t-st.t%W)/W-(th.t-th.t%W)/W)**2)<=144)) done=near('shield',8); }
  else if(th.kind==='landing'){ if(!has('shore',16)&&p.gold>=STRUCT.shore.cost+80) done=near('shore',12); else if(!has('battery',30)&&p.gold>=STRUCT.battery.cost+150) done=near('battery',16); }
  else if(th.kind==='bomb'){ const fld=airfieldsOf(p)[0]; if(fld&&idleAircraft(p,'fighter',th.t)) done=launchFighter(p,th.t); else if(!has('sam',30)&&p.gold>=STRUCT.sam.cost+100) done=near('sam',14); }
  else if(th.kind==='torpedo'){ const pens=structures.filter(st=>st.type==='subbase'&&!st.building&&st.owner===p.id); if(pens.length&&p.gold>=SHIPS.hunter.cost+100){ const wn=waterNeighbor(pens[0].t); if(wn>=0) done=orderWarship(p,wn,'hunter'); } else if(p.ports>0&&p.gold>=SHIPS.warship.cost+100&&!land[th.t]) done=orderWarship(p,th.t,'warship'); }
  else if(th.kind==='blockade'){ if(p.ports>0&&p.gold>=SHIPS.warship.cost+100&&!land[th.t]) done=orderWarship(p,th.t,'warship'); }
  if(done){ p.threats.pop(); if(th.by===me.id) log(`${p.name} is reacting to your ${th.kind==='landing'?'landings':th.kind==='missile'?'missiles':th.kind==='bomb'?'bombing':th.kind==='torpedo'?'submarines':'blockade'}.`,true); }
  return done; }
function botPlaceSmart(p,type,own){ // defensive layout: cover what matters, face the enemy
  const L=botLevel(p); if(L<1) return -1;
  const dist=(a,b)=>(a%W-b%W)**2+((a-a%W)/W-(b-b%W)/W)**2;
  if(type==='sam'||type==='shield'){ const assets=structures.filter(st=>st.owner===p.id&&(st.type==='silo'||st.type==='city'||st.type==='airfield'||st.type==='command')); const uncovered=assets.filter(a=>!structures.some(st=>st.owner===p.id&&st.type===type&&dist(st.t,a.t)<=(type==='sam'?900:100))); if(!uncovered.length) return -1; const a=pick(uncovered); const c=own.filter(t=>!struct[t]&&!crowded(t)&&dist(t,a.t)<=(type==='sam'?200:60)); return c.length?nearestTo(p,c,a.t):-1; }
  if(type==='shore'||type==='battery'){ const foesPorts=structures.filter(st=>st.type==='port'&&st.owner!==p.id&&players[st.owner].kind!=='neutral'&&!atPeace(p.id,st.owner)); const foeShips=warships.filter(w=>w.owner!==p.id&&!atPeace(p.id,w.owner)&&(w.cls==='cruiser'||w.cls==='battleship')); const refs=[...foesPorts.map(x=>x.t),...foeShips.map(w=>idx(Math.floor(w.x),Math.floor(w.y)))]; const coast=own.filter(t=>isCoast(t)&&!struct[t]&&!crowded(t)); if(!coast.length) return -1; if(!refs.length) return pick(coast); const r=pick(refs); return nearestTo(p,coast,r); }
  return -1; }
function botElite(p,own,now){ // Super hard / Impossible: a real economy manager instead of the roll. Returns true when it acted (or is saving).
  const L=botLevel(p); if(!own.length) return false; const cap=maxTroops(p); const cities=structures.filter(st=>st.owner===p.id&&st.type==='city').length; const factories=p.factories||0;
  const cityCap=Math.max(2,Math.floor(p.tiles/(L>=5?40:150)));
  const opening=now<(L>=5?120000:60000); const reserve=L>=5?250:500;
  const canBuild=!(p.nextBuildAt>now)||(opening&&L>=5&&ALLOWED.has('city')); // Impossible's opening city rush ignores the cooldown
  const build=(type)=>{ if(!ALLOWED.has(type)||p.gold<STRUCT[type].cost) return false; const smart=botPlaceSmart(p,type,own); if(smart>=0&&placeStructure(p,type,smart)) return true; const cands=STRUCT[type].coast?own.filter(t=>isCoast(t)&&!struct[t]):own.filter(t=>!struct[t]); for(let k=0;k<8&&cands.length;k++){ const t=pick(cands); if(!crowded(t)&&placeStructure(p,type,t)) return true; } return false; };
  if(!canBuild) return true;
  // 1. cities while the army is under cap and territory allows — instant troops, the human's opening
  if(cities<cityCap&&p.troops<cap*0.9&&p.gold>=STRUCT.city.cost&&(opening||p.gold>=reserve+STRUCT.city.cost)){ if(build('city')){ if(opening) p.nextBuildAt=now+1500; return true; } }
  if(opening&&p.gold<STRUCT.city.cost) return true; // save for the next city
  // 2. a coast facing the strongest neighbour gets shore guns from minute two; one per ~250 coast tiles, more at Impossible
  const coastN=coastTilesOf(p.id).length; const guns=structures.filter(st=>st.owner===p.id&&(st.type==='shore'||st.type==='battery')).length; const gunCap=Math.max(1,Math.floor(coastN/(L>=5?180:350)));
  if(now>=110000&&coastN>20&&guns<gunCap&&p.gold>=STRUCT.shore.cost+reserve*0.5){ if(build('shore')) return true; }
  // 3. a port early, then level II by minute three so landings are heavy transports
  if(now>=90000&&p.ports<1&&coastN>10&&p.gold>=STRUCT.port.cost+100){ if(build('port')) return true; }
  if(now>=180000&&p.gold>=500+reserve){ const up=structures.find(st=>st.owner===p.id&&st.type==='port'&&!st.building&&!st.upgrading&&(st.level||1)<2); if(up&&upgradeStructure(p,up)) return true; }
  // 4. spend-down: gold above the reserve becomes factories (income) or more cities when the cap has room
  if(p.gold>=reserve+STRUCT.factory.cost&&factories<Math.max(1,Math.floor(p.tiles/300))&&build('factory')) return true;
  if(p.gold>=reserve+STRUCT.city.cost&&cities<cityCap&&build('city')) return true;
  if(p.gold>=reserve+STRUCT.sam.cost&&(p.sams||0)<Math.max(1,Math.floor(cities/3))&&p.silos+structures.filter(st=>st.owner!==p.id&&st.type==='silo').length>0&&build('sam')) return true;
  return false; }
function botEconomy(p){ const L=botLevel(p); const cap=maxTroops(p); const atWar=attacks.some(a=>a.owner===p.id||a.target===p.id); if(L<3){ p.focus=atWar||p.troops<cap*0.4?rnd(0.6,0.85):rnd(0.3,0.55); return; }
  if(p.troops>=cap*0.95&&!START.noCap) p.focus=rnd(0.2,0.35); else if(atWar&&p.troops<cap*0.6) p.focus=rnd(0.75,0.9); else p.focus=rnd(0.45,0.6); }
function botAttacks(p){ const L=botLevel(p); if(L<2) return;
  for(const a of attacks){ if(a.owner!==p.id||a.dead||a.target<0) continue; const def=players[a.target]; if(!def||!def.alive) continue; a.age=(a.age||0);
    a.hist=a.hist||[]; a.hist.push([tickN,def.tiles]); a.hist=a.hist.filter(h=>tickN-h[0]<=200);
    const gained=a.hist.length>1?a.hist[0][1]-def.tiles:0; const start=a.startTroops||(a.startTroops=a.troops);
    if(gained>0&&a.troops<start*0.4&&p.troops>maxTroops(p)*0.25&&!a.reinforced){ const extra=p.troops*0.15; if(extra>50){ if(gOn(p)){ const ar=a.origin!=null?areaById(a.origin):null; if(ar&&ar.owner===p.id){ a.troops+=takeTroopsFrom(p,ar,Math.min(extra,ar.troops*0.3)); } } else { p.troops-=extra; a.troops+=extra; } a.reinforced=true; } }
    if(L>=3&&a.hist.length>15&&gained<=0&&a.troops<start*0.6&&tickN-(a.age||0)>200){ a.dead=true; } }
}
function botFocus(p){ const L=botLevel(p); if(L<3) return; if(p.focusUntil>tickN&&p.cmdFocus!=null&&players[p.cmdFocus].alive) return;
  const cands=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&!atPeace(p.id,q.id)); if(!cands.length){ p.cmdFocus=null; return; }
  const {r}=borderOwners(p); const score=q=>(r[q.id]?3:0)+(inConflict(p.id,q.id)?4:0)+((p.threats||[]).filter(t=>t.by===q.id).length)+(q.tiles/landCount>0.45?5:0)-(q.kind==='human'&&neutralShare()>0.35?3:0);
  cands.sort((a,b)=>score(b)-score(a)); p.cmdFocus=cands[0].id; p.focusUntil=tickN+1800; }
function botCoalition(p){ const L=botLevel(p); if(L<3||tickN%50) return; if(L>=4){ const lead=players.filter(q=>q.alive&&q.kind!=='neutral').sort((a,b)=>b.tiles-a.tiles)[0]; if(lead&&lead!==p&&lead.tiles/landCount>=(bd(p).coalition||0.45)) p.focusTarget=lead.id; else if(p.focusTarget===(lead&&lead.id)) p.focusTarget=null; } const leader=players.filter(q=>q.alive&&q.kind!=='neutral').sort((a,b)=>b.tiles-a.tiles)[0]; if(!leader||leader===p||leader.tiles/landCount<(bd(p).coalition||0.45)) return;
  for(const q of players){ if(q===p||!q.alive||q.kind!=='bot'||q===leader||relation(p,q)) continue; if(srand()<0.15){ setRelation(p,q,'ally'); log(`${p.name} and ${q.name} allied against ${leader.name}.`, leader===me); break; } }
  if(relation(p,leader)&&relation(p,leader).type==='nap'&&srand()<0.02) breakRelation(p,leader); }
function botAir(p,now){ const L=botLevel(p); if(L<4) return; if(now>360000&&p.gold>=STRUCT.airfield.cost+300&&!airfieldsOf(p).length&&!structures.some(st=>st.owner===p.id&&st.type==='airfield')){ const own=ownTilesOf(p.id).filter(t=>!struct[t]&&!crowded(t)); if(own.length) placeStructure(p,'airfield',pick(own)); return; }
  if(L>=4&&srand()<0.25){ const fld=airfieldsOf(p)[0]; if(fld&&(fld.level||1)<2&&!fld.upgrading&&p.gold>=UPGRADE.airfield.cost+300) upgradeStructure(p,fld); }
  // paradrop a thin enemy coast
  const car=aircraft.find(a=>a.owner===p.id&&a.type==='carrier'&&a.state==='hangar'); if(car&&p.troops>maxTroops(p)*0.5&&srand()<0.3){ const foes=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&!atPeace(p.id,q.id)&&(p.cmdFocus==null||q.id===p.cmdFocus)); if(foes.length){ const v=pick(foes); const tiles=ownTilesOf(v.id).filter(t=>((t%W-car.home.t%W)**2+((t-t%W)/W-(car.home.t-car.home.t%W)/W)**2)<=AIR.carrier.range**2); if(tiles.length){ const t=pick(tiles); const dl=gOn(v)?densityAt(v,t):density(v); if(dl<density(p)*0.5) launchParadrop(p,t,Math.min(AIR.carrier.capacity,p.troops*0.2)); } } } }
function stepBuild(){ finishUpgrades();
  for(const st of structures){ if(st.building&&st.done<=tickN){ st.building=false; st.popAt=tickN; const p=players[st.owner]; structCounts(p); if(p===me){ log(`${STRUCT[st.type].label} completed.`,true); snd('build'); } }
    if((st.type==='port'||st.type==='subbase')&&st.queue&&st.queue.length&&!st.building){ const job=st.queue[0]; if(job.done<=tickN){ st.queue.shift(); const p=players[st.owner]; if(!p.alive) continue;
      const path=waterPath(waterNeighbor(st.t),job.dest); if(path){ st.popAt=tickN; if(p===me) sInc('shipsBuilt'); warships.push({id:++uidSeq,owner:p.id,cls:job.cls,path,pos:0,dest:job.dest,hp:SHIPS[job.cls].hp,cool:0,ang:srand()*6.28,hdg:0,wake:[],barCool:0}); if(p===me){ log(`${SHIPS[job.cls].label} launched.`,true); snd('foghorn'); } }
      if(st.queue.length){ st.queue[0].done=tickN+st.queue[0].total; } } }
  }
}
function stepTrade(){
  if(tickN%20===0){
    const ports=structures.filter(st=>st.type==='port'&&!st.building&&players[st.owner].kind!=='neutral'&&players[st.owner].alive);
    for(const pt of ports){ if(pt.nextTrade==null) pt.nextTrade=tickN+rnd(30,TRADE_INTERVAL); if(pt.nextTrade>tickN||pt.busy) continue;
      const dests=ports.filter(q=>q.owner!==pt.owner&&!inConflict(pt.owner,q.owner)); if(!dests.length){ pt.nextTrade=tickN+60; continue; }
      const allies=dests.filter(q=>relation(players[pt.owner],players[q.owner])?.type==='ally'); const to=allies.length&&srand()<0.6?pick(allies):pick(dests);
      const path=waterPath(waterNeighbor(pt.t),waterNeighbor(to.t)); pt.nextTrade=tickN+TRADE_INTERVAL; if(!path||path.length<8) continue;
      pt.busy=true; traders.push({owner:pt.owner,from:pt,to,path,pos:0,hdg:0,wake:[],x:null,y:null});
    }
  }
  for(const tr of traders){ if(tr.held&&tr.held>tickN){ continue; } tr.pos+=TRADE_SPEED; const [x,y]=shipXY(tr); steer(tr,x,y);
    if(tr.pos<tr.path.length-1) continue;
    tr.done=true; tr.from.busy=false; const a=players[tr.owner], b=players[tr.to.owner];
    if(!b.alive||tr.to.owner!==b.id||!structures.includes(tr.to)) continue;
    if(tr.prize){ const g=Math.round((TRADE_GOLD+tr.path.length*TRADE_PER_TILE)*2); a.gold+=g; a.tradeIncome=(a.tradeIncome||0)+g; if(a===me){ cashFloat(tr.to.t%W,(tr.to.t-tr.to.t%W)/W,g); snd('cash'); log(`Prize cargo landed: +${g} gold.`,true); } continue; }
    const g=Math.round(TRADE_GOLD+tr.path.length*TRADE_PER_TILE); a.gold+=g; b.gold+=g; a.tradeIncome=(a.tradeIncome||0)+g; b.tradeIncome=(b.tradeIncome||0)+g;
    if(a===me||b===me){ floaters.push({x:tr.to.t%W,y:(tr.to.t-tr.to.t%W)/W,txt:'+$'+g,age:0,col:'#ffd27a'}); snd('coin'); }
  }
  traders=traders.filter(t=>{ if(t.done||!players[t.owner].alive){ t.from.busy=false; return false; } return true; });
}
function subSeenBy(w,viewer){ if(!SHIPS[w.cls].sub) return true; if(w.owner===viewer||atPeace(w.owner,viewer)&&relation(players[w.owner],players[viewer])?.type==='ally') return true;
  for(const e of warships){ if(e.owner!==viewer&&!(relation(players[e.owner],players[viewer])?.type==='ally')) continue; if(!(e.cls==='warship'||e.cls==='hunter'||e.cls==='rship')||e.x==null) continue; const R=e.cls==='hunter'?20:8; if((e.x-w.x)**2+(e.y-w.y)**2<=R*R) return true; } return false; }
function stepNaval(){
  // transports move; land when they arrive
  for(const tr of transports){
    tr.pos+=SHIP_SPEED*(tr.heavy?HEAVY.speedMul:1); const [tx,ty]=shipXY(tr); steer(tr,tx,ty);
    if(tr.pos<tr.path.length-1) continue;
    tr.done=true; const p=players[tr.owner]; if(!p.alive) continue;
    const o=owner[tr.seed];
    if(tr.gift){ const ally=players[tr.target]; if(ally.alive&&o===ally.id){ if(gOn(ally)) addTroopsAt(ally,tr.seed,tr.troops); else ally.troops+=tr.troops; log(`${tr.troops|0} ${p.name} troops reinforced ${ally.name}.`, p===me||ally===me); if(ally===me) snd('foghorn'); } else p.troops+=tr.troops; continue; }
    if(p===me&&!tr.gift) sInc('landings'); if(o===p.id){ addTroopsAt(p,tr.seed,tr.troops); continue; } // coast already ours: troops disembark into that area
    attacks.push({owner:p.id,target:o,troops:tr.troops,front:new Set([tr.seed]),naval:true,age:0,origin:null,landAt:tr.seed,startTiles:o>=0?players[o].tiles:0});
    if(o===me.id) invasionNotice(p,tr.seed,true); if(o>=0) noteThreat(o,tr.seed,'landing',p.id);
    if(p===me){ log(`Landing force ashore on ${o>=0?players[o].name:'unclaimed coast'}.`,true); snd('foghorn'); }
  }
  transports=transports.filter(t=>!t.done);
  // heavy transports return fire at whatever hit them last
  for(const tr of transports){ if(!tr.heavy||tr.done||!tr.attacker||tr.x==null) continue; if(tickN-(tr.attackedAt||0)>100||tr.cool>tickN) continue; const a=tr.attacker; const ax=a.t!=null?a.t%W+.5:a.x, ay=a.t!=null?(a.t-a.t%W)/W+.5:a.y; if(ax==null||(a.t==null&&(a.hp<=0||a.done||(a.cls&&SHIPS[a.cls]&&SHIPS[a.cls].sub)))||(a.t!=null&&!structures.includes(a))) { tr.attacker=null; continue; } if((ax-tr.x)**2+(ay-tr.y)**2>HEAVY.gun*HEAVY.gun) continue; tr.cool=tickN+HEAVY.cd;
    if(a.t!=null) shells.push({owner:tr.owner,cls:'warship',x:tr.x,y:tr.y,kind:'gun',target:a,tx:ax,ty:ay,trail:[],dmg:HEAVY.dmg,speed:7}); else shells.push({owner:tr.owner,cls:'warship',x:tr.x,y:tr.y,target:a,kind:'warship',trail:[],dmg:HEAVY.dmg,speed:7}); if(tr.owner===me.id) snd('shell',tr.x,tr.y); }
  // warships move / patrol / fire
  for(const w of warships){
    if(w.refit){ /* at anchor for the refit */ }
    else if(w.boarding){ /* chasing a merchant: movement handled in shipPiracy */ }
    else if(w.pos<w.path.length-1){ w.pos+=SHIPS[w.cls].speed; const [nx,ny]=shipXY(w); steer(w,nx,ny); }
    else if(!w.boarding){ w.ang+=0.025; const dx=w.dest%W+.5, dy=(w.dest-w.dest%W)/W+.5; let placed=false;
      for(const rad of [5,3,1.5]){ const nx=dx+Math.cos(w.ang)*rad, ny=dy+Math.sin(w.ang)*rad; const tx=Math.floor(nx),ty=Math.floor(ny); if(inb(tx,ty)&&!land[idx(tx,ty)]){ steer(w,nx,ny); placed=true; break; } }
      if(!placed) steer(w,dx,dy); }
    if(w.refit&&w.refit<=tickN){ w.refit=0; w.cruise=true; w.cruiseCool=0; if(w.owner===me.id) log('Battleship refit complete: cruise missiles online.',true); }
    if(!w.refit) shipCruise(w);
    shipBarrage(w); shipPiracy(w);
    if(SHIPS[w.cls].torpedo){ const T=SHIPS[w.cls].torpedo; if(w.cool>0){ w.cool--; continue; } const R2=T.range*T.range; let tg=null,td=R2,kind=null;
      if(SHIPS[w.cls].hunter){ for(const e of warships){ if(e===w||e.owner===w.owner||e.hp<=0||!SHIPS[e.cls].sub||atPeace(w.owner,e.owner)||!inConflict(w.owner,e.owner)&&!e.subHostile) continue; const d=(e.x-w.x)**2+(e.y-w.y)**2; if(d<=400&&d<td){ td=d; tg=e; kind='warship'; } } }
      else { for(const tr of transports){ if(tr.done||tr.x==null||tr.owner===w.owner||atPeace(w.owner,tr.owner)||!(tr.target===w.owner||inConflict(w.owner,tr.owner))) continue; const d=(tr.x-w.x)**2+(tr.y-w.y)**2; if(d<td){ td=d; tg=tr; kind='transport'; } }
        if(!tg) for(const e of warships){ if(e===w||e.owner===w.owner||e.hp<=0||SHIPS[e.cls].sub||atPeace(w.owner,e.owner)||!inConflict(w.owner,e.owner)&&!(e.cls==='cruiser'||e.cls==='battleship')) continue; const d=(e.x-w.x)**2+(e.y-w.y)**2; if(d<td){ td=d; tg=e; kind='warship'; } } }
      if(tg){ w.cool=T.cd; w.subHostile=true; shells.push({owner:w.owner,cls:w.cls,x:w.x,y:w.y,target:tg,kind,trail:[],dmg:T.dmg,speed:3,torpedo:true,from:w}); if(w.owner===me.id||tg.owner===me.id) snd('torpedo',w.x,w.y); }
      continue; }
    if(!SHIPS[w.cls].gun) continue;
    if(w.cool>0){ w.cool--; continue; }
    const R2=SHIPS[w.cls].gun**2;
    let hit=null,hd=R2;
    for(const tr of traders){ if(tr.done||tr.owner===w.owner||!inConflict(w.owner,tr.owner)||tr.x==null) continue; const d=(tr.x-w.x)**2+(tr.y-w.y)**2; if(d<hd){hd=d;hit=tr;} }
    if(hit){ shells.push({owner:w.owner,cls:w.cls,x:w.x,y:w.y,target:hit,kind:'trader',trail:[],dmg:1}); w.cool=6; if(w.owner===me.id||hit.owner===me.id) snd('shell',w.x,w.y); continue; }
    hit=null;hd=R2;
    for(const tr of transports){ if(tr.done||tr.owner===w.owner||atPeace(w.owner,tr.owner)) continue; const [x,y]=shipXY(tr); const d=(x-w.x)**2+(y-w.y)**2; if(d<hd){hd=d;hit=tr;} }
    if(hit){ w.fireAt=tickN; w.fireAng=Math.atan2(hit.y-w.y,hit.x-w.x); shells.push({owner:w.owner,cls:w.cls,x:w.x,y:w.y,target:hit,kind:'transport',trail:[],dmg:SHIPS[w.cls].dmg,from:w}); w.cool=6; if(w.owner===me.id||hit.owner===me.id) snd('shell',w.x,w.y); continue; }
    // return fire at coastal guns of nations we're fighting (or that are shooting at us)
    { let g=null,gd=R2; for(const st of structures){ if(!gunTarget(st)||st.building||st.owner===w.owner||atPeace(w.owner,st.owner)) continue; if(!(inConflict(w.owner,st.owner)||st.lastShotAt===w.owner)) continue; const sx=st.t%W+.5,sy=(st.t-st.t%W)/W+.5; const d=(sx-w.x)**2+(sy-w.y)**2; if(d<gd){gd=d;g=st;} }
      if(g){ shells.push({owner:w.owner,cls:w.cls,x:w.x,y:w.y,kind:'gun',target:g,tx:g.t%W+.5,ty:(g.t-g.t%W)/W+.5,trail:[],dmg:SHIPS[w.cls].dmg}); w.cool=10; if(w.owner===me.id||g.owner===me.id) snd('shell',w.x,w.y); continue; } }
    hd=R2; let tgt=null;
    for(const e of warships){ if(e===w||e.owner===w.owner||e.hp<=0||atPeace(w.owner,e.owner)) continue; if(SHIPS[e.cls].sub&&!subSeenBy(e,w.owner)) continue; const d=(e.x-w.x)**2+(e.y-w.y)**2; if(d<hd){hd=d;tgt=e;} }
    if(tgt){ w.fireAt=tickN; w.fireAng=Math.atan2(tgt.y-w.y,tgt.x-w.x); shells.push({owner:w.owner,cls:w.cls,x:w.x,y:w.y,target:tgt,kind:'warship',trail:[],dmg:SHIPS[w.cls].dmg*(w.cls==='warship'&&tgt.cls==='cruiser'?2:1)}); w.cool=10; if(w.owner===me.id||tgt.owner===me.id) snd('shell',w.x,w.y); }
  }
  // shells fly to their target and resolve on arrival
  for(const sh of shells){
    if(sh.delay>0){ sh.delay--; continue; }
    const spd=sh.speed||SHELL_SPEED;
    if(sh.kind==='aam'){ const tg=sh.target; const tx=tg.x, ty=tg.y; const dx=tx-sh.x, dy=ty-sh.y, d=Math.hypot(dx,dy); sh.trail.push([sh.x,sh.y]); if(sh.trail.length>8) sh.trail.shift();
      if(d<=spd||tg.dead){ sh.done=true; flashes.push({x:tx,y:ty,r:1.2,age:0,col:'#ffd27a'}); continue; } sh.x+=dx/d*spd; sh.y+=dy/d*spd; continue; }
    if(sh.kind==='gun'){ const g=sh.target; if(!structures.includes(g)){ sh.done=true; continue; } const dx=sh.tx-sh.x, dy=sh.ty-sh.y, d=Math.hypot(dx,dy); sh.trail.push([sh.x,sh.y]); if(sh.trail.length>6) sh.trail.shift();
      if(d<=spd){ sh.done=true; flashes.push({x:sh.tx,y:sh.ty,r:1.5,age:0,col:'#ffd27a'}); markHostile(sh.owner,g.owner); if(sh.owner===me.id||g.owner===me.id) snd('shellhit',sh.tx,sh.ty);
        if(g.type==='port'){ g.gunHp=(g.gunHp||0)-sh.dmg; if(g.gunHp<=0){ g.level=1; g.gunHp=0; log(`${players[sh.owner].name} shot out the guns of ${players[g.owner].name}'s port — it is level I again.`, sh.owner===me.id||g.owner===me.id); } continue; }
        g.hp-=sh.dmg;
        if(g.hp<=0){ const own=players[g.owner]; destroyStructure(g.t); structCounts(own); flashes.push({x:sh.tx,y:sh.ty,r:3,age:0,col:'#ffb347'}); log(`${players[sh.owner].name}'s ${SHIPS[sh.cls].label.toLowerCase()} destroyed ${own.name}'s ${STRUCT[g.type].label.toLowerCase()}.`, sh.owner===me.id||own===me); } continue; }
      sh.x+=dx/d*spd; sh.y+=dy/d*spd; continue; }
    if(sh.kind==='land'){
      const dx=sh.tx-sh.x, dy=sh.ty-sh.y, d=Math.hypot(dx,dy); { const tot=sh.tot||(sh.tot=Math.max(1,d)); const k=1-Math.min(1,d/tot); sh.trail.push([sh.x,sh.y,Math.sin(k*Math.PI)*(sh.rise||14)*0.6]); } if(sh.trail.length>(sh.missile?10:6)) sh.trail.shift();
      if(d<=spd){ sh.done=true; fxTracer(sh.ox??sh.trail[0]?.[0]??sh.x,sh.oy??sh.trail[0]?.[1]??sh.y,sh.tx,sh.ty); fxPuff(sh.tx-.5,sh.ty-.5,3,'110,100,90'); const c=crater(Math.floor(sh.tx),Math.floor(sh.ty),sh.radius,sh.owner);
        const v=sh.volley; if(v){ v.cas+=c; if(--v.left<=0&&(v.owner===me.id||v.victim===me.id)&&v.victim>=0) if(v.victim===me.id&&v.cas>STATS.bigLoss.n){ STATS.bigLoss={n:Math.round(v.cas),by:`${players[v.owner].name}'s ${(SHIPS[v.cls]||STRUCT[v.cls]).label.toLowerCase()}`}; } log(`${players[v.owner].name}'s ${(SHIPS[v.cls]||STRUCT[v.cls]).label.toLowerCase()} ${v.cls==='bertha'?'shell':'barrage'} killed ${Math.round(v.cas)} ${players[v.victim].name} troops.`,true); }
        continue; }
      sh.x+=dx/d*spd; sh.y+=dy/d*spd; continue;
    }
    const tg=sh.target; if(tg.done||tg.hp<=0){ sh.done=true; continue; }
    const dx=tg.x-sh.x, dy=tg.y-sh.y, d=Math.hypot(dx,dy); sh.trail.push([sh.x,sh.y]); if(sh.trail.length>(sh.torpedo?22:6)) sh.trail.shift();
    if(d<=spd){ sh.done=true; const mine=sh.owner===me.id||tg.owner===me.id;
      markHostile(sh.owner,tg.owner);
      if(sh.kind==='trader'){ tg.done=true; tg.from.busy=false; noteThreat(tg.owner,idx(Math.floor(tg.x),Math.floor(tg.y)),'blockade',sh.owner); flashes.push({x:tg.x,y:tg.y,r:2.5,age:0,col:'#ffb347'}); fxWreck('ship',tg.x,tg.y,tg.hdg,players[tg.owner].color,'trader'); players[sh.owner].gold+=60; if(mine) snd('sunk',tg.x,tg.y); if(sh.owner===me.id){ if(onScreen(tg.x,tg.y)) snd('coin',tg.x,tg.y); cashFloat(tg.x,tg.y,60); } log(`${players[sh.owner].name} sank a ${players[tg.owner].name} merchant ship (+60 gold).`, mine); continue; }
      if(sh.kind==='transport'&&tg.heavy){ tg.hp-=sh.dmg||1; tg.attacker=sh.from||null; tg.attackedAt=tickN; flashes.push({x:tg.x,y:tg.y,r:1.5,age:0,col:'#ffd27a'}); if(mine) snd('shellhit',tg.x,tg.y); if(tg.hp>0) continue; }
      if(sh.kind==='transport'){ tg.done=true; flashes.push({x:tg.x,y:tg.y,r:3,age:0,col:'#ffb347'}); fxWreck('ship',tg.x,tg.y,tg.hdg,players[tg.owner].color,'transport'); if(mine) snd('sunk',tg.x,tg.y);
        const bounty=Math.max(20,Math.round(tg.troops*SINK_BOUNTY)); players[sh.owner].gold+=bounty; if(sh.owner===me.id){ if(onScreen(tg.x,tg.y)) snd('coin',tg.x,tg.y); cashFloat(tg.x,tg.y,bounty); }
        log(`${players[sh.owner].name}'s ${(SHIPS[sh.cls]||STRUCT[sh.cls]||SHIPS.warship).label.toLowerCase()} sank a transport carrying ${Math.round(tg.troops)} ${players[tg.owner].name} troops${sh.owner===me.id?` (+${bounty} gold salvage)`:''}.`, mine); }
      else { tg.hp-=sh.dmg||1; flashes.push({x:tg.x,y:tg.y,r:1.5,age:0,col:'#ffd27a'}); if(mine) snd('shellhit',tg.x,tg.y);
        if(tg.hp<=0){ if(sh.owner===me.id) sInc('shipsSunk'); if(tg.owner===me.id) sInc('shipsLost'); flashes.push({x:tg.x,y:tg.y,r:4,age:0,col:'#ffb347'}); fxWreck('ship',tg.x,tg.y,tg.hdg,players[tg.owner].color,tg.cls); if(sh.torpedo){ players[tg.owner].subLoss=(players[tg.owner].subLoss||0)+1; noteThreat(tg.owner,idx(Math.floor(tg.x),Math.floor(tg.y)),'torpedo',sh.owner); } fxPuff(tg.x-.5,tg.y-.5,5,'60,60,60'); if(mine) snd('sunk',tg.x,tg.y); log(`${players[sh.owner].name}'s ${(SHIPS[sh.cls]||STRUCT[sh.cls]||SHIPS.warship).label.toLowerCase()} sank a ${players[tg.owner].name} ${SHIPS[tg.cls]?SHIPS[tg.cls].label.toLowerCase():'ship'}.`, mine); } }
      continue; }
    sh.x+=dx/d*spd; sh.y+=dy/d*spd;
  }
  shells=shells.filter(sh=>!sh.done);
  transports=transports.filter(t=>!t.done);
  warships=warships.filter(w=>w.hp>0&&players[w.owner].alive); for(const w of selected) if(!warships.includes(w)) selected.delete(w);
}

// ---------------------------------------------------------------- bots
function borderOwners(p){ // sample border to learn who we touch, and where
  const r={}; const unclaimed=[];
  for(let y=0;y<H;y+=1)for(let x=0;x<W;x+=1){
    const t=idx(x,y); if(owner[t]!==p.id) continue;
    for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(!land[n]) continue;
      const o=owner[n]; if(o===p.id) continue; if(o<0) unclaimed.push(n); else r[o]=(r[o]||0)+1; }
  }
  return {r,unclaimed};
}
function neutralShare(){ let n=0,a=0; for(const q of players){ if(q.kind==='neutral'){ a++; if(q.alive) n++; } } return a?n/a:0; }
function botThink(p,now){
  if(now<p.nextThink) return;
  p.nextThink=now+rnd(1200,3000);
  const cap=maxTroops(p);
  const busy=attacks.some(a=>a.owner===p.id);
  botEconomy(p); botAttacks(p); botFocus(p); botCoalition(p); botAir(p,now);
  if(botReact(p)) p.nextThink=now+rnd(800,1500);
  if(!busy&&p.troops>cap*rnd(0.3,0.5)/bd(p).aggr*Math.max(0.5,1-(now)/1500000)){
    const {r,unclaimed}=borderOwners(p);
    const send=p.troops*rnd(0.3,0.5);
    if(unclaimed.length>0&&srand()<0.8) launchAttack(p,-1,send);
    else{
      const opts=Object.keys(r).map(Number).filter(o=>players[o].alive&&!atPeace(p.id,o))
        .map(o=>({o,d:density(players[o]),w:players[o].tiles,n:players[o].kind==='neutral'}));
      const neut=opts.filter(x=>x.n).sort((a,b)=>a.d-b.d);
      const lead=p.focusTarget!=null?opts.find(x=>x.o===p.focusTarget):null;
      if(lead&&botLevel(p)>=4&&srand()<(botLevel(p)>=5?0.75:0.25)){ launchAttack(p,lead.o,p.troops*rnd(0.45,0.65)); }
      else if(neut.length){ launchAttack(p,neut[0].o,send); }
      else if(srand()<0.5){ // no neutral neighbours: ship troops to a weak neutral somewhere
        const ns=players.filter(q=>q.alive&&q.kind==='neutral'&&q.tiles>=80); if(ns.length){ const v=pick(ns); const coast=coastTilesOf(v.id); if(coast.length) launchAttack(p,v.id,send,pick(coast)); }
      }
      else if(opts.length){ opts.sort((a,b)=>a.d-b.d); const foc=p.cmdFocus!=null?opts.find(x=>x.o===p.cmdFocus):(p.focusTarget!=null?opts.find(x=>x.o===p.focusTarget):null); const tgt=(foc&&botLevel(p)>=3)?foc:opts[0];
        // while most neutral countries still stand, bots keep the peace with players unless one is a soft target
        const ns=neutralShare(); const restraint=(p.focusTarget===tgt.o)?1:ns>0.35?(players[tgt.o].kind==='human'?0.15:0.4):ns>0.15?0.7:1;
        const agg=(1+Math.min(1.6,(now)/500000))*bd(p).aggr*restraint;
        if(tgt.d<density(p)*0.5*agg||srand()<0.25*agg) launchAttack(p,tgt.o,send);
      } else if(srand()<0.5){ // naval strike at weakest coastal enemy
        const victims=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&density(q)<density(p)&&!atPeace(p.id,q.id));
        if(victims.length){ const v=pick(victims); let coast=coastTilesOf(v.id); if(coast.length&&botLevel(p)>=4){ const guns=structures.filter(st=>st.owner===v.id&&!st.building&&(st.type==='shore'||st.type==='battery')); if(guns.length){ const safe=coast.filter(t=>{ const x=t%W,y=(t-x)/W; return !guns.some(g=>{ const gx=g.t%W,gy=(g.t-gx)/W; const r=STRUCT[g.type].range; return (gx-x)*(gx-x)+(gy-y)*(gy-y)<=r*r; }); }); if(safe.length) coast=safe; } } if(coast.length) launchAttack(p,v.id,send,pick(coast)); }
      }
    }
  }
  if(gOn(p)&&p.areas&&p.areas.length>1&&srand()<0.3){ const home=p.areas[0]; const thin=p.areas.filter(a=>a!==home&&a.coast&&a.tiles>=60&&a.troops/a.tiles<home.troops/Math.max(1,home.tiles)*0.4).sort((a,b)=>b.tiles-a.tiles)[0]; if(thin&&home.coast&&home.troops>400) reinforceArea(p,thin,home,home.troops*0.15); }
  // building — paced by difficulty so a human can keep up at Normal and below
  const own=ownTilesOf(p.id);
  if(botLevel(p)>=4&&botElite(p,own,now)) { /* elite manager acted this turn */ }
  else if(own.length&&p.gold>=110&&!(p.nextBuildAt>now)){
    const roll=srand();
    let type= roll<0.32?'city':roll<0.54?'factory':roll<0.65?'port':roll<0.74?'sam':roll<0.84?'fort':roll<0.9?'shore':roll<0.91?'battery':roll<0.93?'shield':roll<0.94?'airfield':roll<0.95?'subbase':roll<0.96?'troopcmd':roll<0.97?'engcmd':roll<0.98?'silo':'bertha';
    if(type==='silo'&&p.silos>0) type='city';
    if(!ALLOWED.has(type)){ const alt=['city','factory','port','sam','fort','silo','shore','battery'].filter(k=>ALLOWED.has(k)); if(!alt.length) return; type=pick(alt); }
    if(p.gold>=STRUCT[type].cost){
      const smart=botPlaceSmart(p,type,own); if(smart>=0){ placeStructure(p,type,smart); }
      else { const cands= STRUCT[type].coast?own.filter(t=>isCoast(t)&&!struct[t]):own.filter(t=>!struct[t]);
      for(let k=0;k<6&&cands.length;k++){ const t=pick(cands); if(!crowded(t)){ placeStructure(p,type,t); break; } } }
    }
  }
  if(p.ports>0&&p.gold>=WARSHIP_COST+120&&srand()<0.15&&warships.filter(w=>w.owner===p.id).length<Math.min(6,p.ports)){
    const port=pick(structures.filter(st=>st.type==='port'&&st.owner===p.id)); if(port){ const px=port.t%W,py=(port.t-px)/W;
      let cls=p.gold>1400&&srand()<0.25?'battleship':p.gold>700&&srand()<0.4?'cruiser':srand()<0.12?'privateer':srand()<0.15?'scout':'warship'; { const pens=structures.filter(st=>st.type==='subbase'&&!st.building&&st.owner===p.id).length; if(pens&&srand()<0.35){ const nSub=warships.filter(w=>w.owner===p.id&&w.cls==='sub').length, nHun=warships.filter(w=>w.owner===p.id&&w.cls==='hunter').length; const wantHun=(p.subLoss||0)>0||srand()<0.35; if(wantHun&&nHun<2*pens) cls='hunter'; else if(nSub<3*pens) cls='sub'; } } if(!ALLOWED.has(cls)){ const alt=['scout','warship','cruiser','battleship','privateer'].filter(k=>ALLOWED.has(k)); if(!alt.length) return; cls=pick(alt); }
      for(let k=0;k<6;k++){ const x=Math.floor(px+rnd(-40,40)),y=Math.floor(py+rnd(-40,40)); if(inb(x,y)&&!land[idx(x,y)]){ orderWarship(p,idx(x,y),cls); break; } } }
  }
  if(p.gold>1200&&srand()<0.08){ const bb=warships.find(w=>w.owner===p.id&&w.cls==='battleship'&&!w.cruise&&!w.refit&&structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===p.id&&((st.t%W+.5-w.x)**2+((st.t-st.t%W)/W+.5-w.y)**2)<=LINK_RANGE*LINK_RANGE)); if(bb){ p.gold-=CRUISE.cost; bb.refit=tickN+CRUISE.ticks; } }
  // deliberate naval tech path: a port II by mid-game, then a sub base near it
  if(tickN>2400&&p.gold>1100&&srand()<0.25&&!structures.some(st=>st.owner===p.id&&st.type==='port'&&(st.level||1)>=2)){ const up=structures.find(st=>st.owner===p.id&&st.type==='port'&&!st.building&&!st.upgrading); if(up) upgradeStructure(p,up); }
  else if(p.gold>900&&srand()<0.06&&structures.filter(st=>st.owner===p.id&&(st.level||1)>=2).length<3){ const up=structures.find(st=>st.owner===p.id&&(st.type==='port'||st.type==='airfield')&&!st.building&&!st.upgrading&&(st.level||1)<2); if(up) upgradeStructure(p,up); }
  { const pens=structures.filter(st=>st.type==='subbase'&&!st.building&&st.owner===p.id); if(pens.length&&p.gold>=650&&srand()<0.3){ const nSub=warships.filter(w=>w.owner===p.id&&w.cls==='sub').length, nHun=warships.filter(w=>w.owner===p.id&&w.cls==='hunter').length; let cls=null; if(((p.subLoss||0)>0||srand()<0.35)&&nHun<2*pens.length) cls='hunter'; else if(nSub<3*pens.length) cls='sub'; if(cls&&ALLOWED.has(cls)){ const base=pick(pens); const wn=waterNeighbor(base.t); if(wn>=0){ let dest=wn; for(let k=0;k<12;k++){ const c=wn+Math.round((srand()-.5)*30)+Math.round((srand()-.5)*30)*W; if(c>=0&&c<W*H&&!land[c]){ dest=c; break; } } orderWarship(p,dest,cls); } } } }
  { const p2=structures.find(st=>st.owner===p.id&&st.type==='port'&&(st.level||1)>=2&&!st.building); if(p2&&p.gold>700&&srand()<0.25&&ALLOWED.has('subbase')&&!structures.some(st=>st.owner===p.id&&st.type==='subbase')){ const cands=coastTilesOf(p.id).filter(t=>!struct[t]&&!crowded(t)&&((t%W-p2.t%W)**2+((t-t%W)/W-(p2.t-p2.t%W)/W)**2)<=LINK_RANGE*LINK_RANGE); if(cands.length) placeStructure(p,'subbase',pick(cands)); } }
  if(p.silos>0&&p.gold>=NUKE_COST+60&&srand()<0.35){
    const victims=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&!atPeace(p.id,q.id)).sort((a,b)=>b.tiles-a.tiles);
    if(victims.length){ const v=victims[0]; const cands=structures.filter(s=>s.owner===v.id);
      const t=cands.length?pick(cands).t:pick(ownTilesOf(v.id)); if(t!=null) launchMissile(p,t); }
  }
}
function isProvokedBy(p,id,margin){ return p.grudge[id]!=null&&tickN-p.grudge[id]<PROVOKE_TICKS-margin; }
function isProvoked(p){ for(const k in p.grudge) if(tickN-p.grudge[k]<PROVOKE_TICKS) return true; return false; }
function neutralThink(p,now){
  if(now<p.nextThink) return; p.nextThink=now+rnd(2500,5000);
  // neutrals never start a war; once attacked they push back at whoever hit them most recently
  let tgt=-1,last=-1;
  for(const k in p.grudge){ const o=+k; if(tickN-p.grudge[k]>=PROVOKE_TICKS){ delete p.grudge[k]; continue; } if(players[o].alive&&p.grudge[k]>last){ last=p.grudge[k]; tgt=o; } }
  if(tgt<0||attacks.some(a=>a.owner===p.id)) return;
  if(p.troops<100||density(p)<density(players[tgt])*1.3) return; // only punish an attacker spread thinner than we are
  if(launchAttack(p,tgt,p.troops*0.35)&&!p.warned){ p.warned=true; if(tgt===me.id) snd('pushback'); log(`${p.name} is pushing back${tgt===me.id?' against you':' against '+players[tgt].name}!`, tgt===me.id); }
}
function ownTilesOf(id){const a=[];for(let t=0;t<W*H;t++)if(owner[t]===id)a.push(t);return a;}
function coastTilesOf(id){return ownTilesOf(id).filter(isCoast);}

// ---------------------------------------------------------------- simulation
function tick(){
  resolveReplayCommands();
  if(draft){ draftTicks++; if(draftTicks%6===0) draftStep(); }
  if(over||paused) return;
  tickN++; simMs=tickN*TICK;
  if(tickN%100===0){ const h=stateHash(); if(REPLAY.on){ const ref=REPLAY.hashes&&REPLAY.hashes.find(x=>x[0]===tickN); if(ref&&ref[1]!==h&&!REPLAY.mismatch){ REPLAY.mismatch=true; const why=stateDiff(ref[2],stateDetail()); console.warn('[statefall] replay diverged at tick',tickN,ref[1],h,why); REPLAY.why=why; REPLAY.divTick=tickN; REPLAY.divRec=ref; REPLAY.divNow=stateDetail(); if(REPLAY.otherVersion){ showNotice({kind:'gold',title:'Replay drifted from the recording',text:`Recorded on game ${(REPLAY.fileGame||'an earlier version')}; the rules have changed since. Nothing to report.`,ttl:9000}); } else { log('Replay diverged from the recording at '+Math.floor(tickN*TICK/60000)+':'+String(Math.floor(tickN*TICK/1000%60)).padStart(2,'0')+(why?' — '+why:'')+'.',true); setTimeout(divergenceCard,0); } } } else CMD.hashes.push([tickN,h,stateDetail()]); }
  const now=simMs;
  for(const p of players){
    if(!p.alive) continue;
    if(gOn(p)&&p.areas&&p.areas.length){ const g=troopGrowth(p)*TICK/1000, cap=maxTroops(p); for(const a of p.areas){ const share=a.tiles/Math.max(1,p.tiles); const acap=cap*share; const ga=g*share; if(START.noCap||a.troops<acap) a.troops=START.noCap?a.troops+ga:Math.min(acap,a.troops+ga); } syncTroops(p); }
    else if(START.noCap&&p.kind!=='neutral') p.troops+=troopGrowth(p)*TICK/1000;
    else { const cap=maxTroops(p); if(p.troops<cap) p.troops=Math.min(cap,p.troops+troopGrowth(p)*TICK/1000); } // cap limits growth, never trims a bonus
    p.gold+=goldGrowth(p)*TICK/1000*(p.kind==='neutral'?0:1);
    if(p.kind==='bot') botThink(p,now); else if(p.kind==='neutral') neutralThink(p,now);
    if(p.kind!=='neutral'&&p.troops>(p.peakTroops||0)) p.peakTroops=p.troops;
    if(p===me){ const gg=goldGrowth(p)*TICK/1000; p.goldEarned=(p.goldEarned||0)+gg; STATS.c.peak=Math.round(p.peakTroops||0); STATS.c.gold=Math.round(p.goldEarned||0); const sh=p.tiles/landCount; if(sh>=0.5&&!STATS.c.half){ STATS.c.half=1; sEvent('Crossed half the world','milestone'); } if(sh>=0.25&&!STATS.c.quarter){ STATS.c.quarter=1; sEvent('A quarter of the world'); } }
  }
  if(tickN%10===0) rebuildLinks();
  stepDiplomacy(); reclaimLand(); stepBuild(); missileCommand(); stepTrade(); stepGuns(); stepPlanes(); stepAir(); flightOps(); troopLogistics(); engineering(); stepTrucks(); if(tickN%5===0){ computeVision(); if(START.fog&&tickN%20===0){ myBorders=new Set(Object.keys(borderOwners(me).r).map(Number)); } } stepAttacks(); stepInterceptors(); stepShields(); stepMissiles(); stepNaval(); if(tickN%5===0) checkRegions(); drawMap();
  if(!me.alive&&!spectating){ end('Overrun','Your nation has been erased from the map.'); }
  const teamTiles=t=>players.filter(q=>q.alive&&q.team===t).reduce((a,q)=>a+q.tiles,0);
  const share=(me.team!=null?teamTiles(me.team):me.tiles)/landCount;
  const rivalsLeft=players.some(q=>q.alive&&q.kind!=='neutral'&&q!==me&&!(me.team!=null&&q.team===me.team));
  if(me.alive&&(share>=0.999||(!rivalsLeft&&!players.some(q=>q.alive&&q.kind==='neutral')))) end('Total victory',me.team!=null?`Team ${TEAM_NAMES[me.team]} holds the entire world.`:'The whole world is yours.');
  if(share>=WIN_SHARE) end(me.team!=null?'Team victory':'Victory',(me.team!=null?`Team ${TEAM_NAMES[me.team]} controls `:'You control ')+Math.round(share*100)+'% of the land.');
  if(me.team!=null){ for(let t=0;t<START.teams;t++){ if(t===me.team) continue; const tt=teamTiles(t); if(tt/landCount>=WIN_SHARE) end('Defeat',`Team ${TEAM_NAMES[t]} now controls ${Math.round(tt/landCount*100)}% of the land.`); } }
  else { const leader=players.filter(p=>p.alive&&p!==me&&p.kind!=='neutral').find(p=>p.tiles/landCount>=WIN_SHARE);
  if(leader) end('Defeat',leader.name+' now controls '+Math.round(leader.tiles/landCount*100)+'% of the land.'); }
  if(tickN%30===0) computeLabelPos();
  if(START.garrison&&tickN%10===5) rebuildAreas();
  if(tickN%20===0) checkAlliedEndgame();
  if(tickN%5===0) updateUI();
}
function checkRegions(){
  const np=NP;
  for(const r of regions){ if(r.size<REGION_MIN) continue;
    for(const p of players){ if(!p.alive) continue;
      const full=regCount[r.id*np+p.id]===r.size;
      if(full&&!p.held.has(r.id)){ p.held.add(r.id);
        if(!p.claimed.has(r.id)){ p.claimed.add(r.id); const bonus=Math.round(r.size*CAPTURE_BONUS); if(gOn(p)&&p.areas){ addTroopsAt(p,idx(Math.round(r.cx),Math.round(r.cy)),bonus); } else p.troops+=bonus;
          log(`${p.name} unified ${r.cont?'the continent of ':''}${r.name} and raised ${bonus} troops.`, p===me||r.cont); if(p===me){ snd('unified'); sInc(r.cont?'continents':'islands'); sEvent(`Unified ${r.cont?'the continent of ':''}${r.name} (+${bonus} troops)`,'unify'); }
          if(r.cont||p===me){ badges.push({kind:'unify',text:r.name,sub:`unified by ${p.name} — +${bonus} troops now, +${(r.size*HOLD_BONUS).toFixed(1)} troops/s while held`,flag:p.flag,col:p.color,age:0,life:p===me?130:90,snd:p===me?'fanfare':'fanfareq'}); } }
        else if(p===me) log(`You hold all of ${r.name} again.`,true);
      } else if(!full&&p.held.has(r.id)){ p.held.delete(r.id); if(p===me) log(`You no longer hold all of ${r.name}.`,true); }
    }
  }
}
function startDraft(){
  const ps=players.filter(p=>p.kind!=='neutral'); for(let i=ps.length-1;i>0;i--){ const j=Math.floor(srand()*(i+1)); [ps[i],ps[j]]=[ps[j],ps[i]]; }
  const per=Math.max(2,Math.min(8,Math.round(landCount/12000)));
  draft={order:ps,idx:0,per,round:0,timer:0}; paused=true;
  log(`Risky start: ${per} picks each, round robin. ${ps[0]===me?'You pick first.':ps[0].name+' picks first.'}`,true);
  draft.iv=null; draftTicks=0; // stepped from tick()
}
function draftPick(p,c){ let sx=0,sy=0,n=0; for(let t=0;t<W*H;t++) if(owner[t]===c.id){ if(struct[t]) captureStructure(t,p); setOwner(t,c===p?owner[t]:p.id); sx+=t%W; sy+=(t-t%W)/W; n++; } c.alive=false; c.tiles=0; const ce=centroid(p); p.sx=ce[0]; p.sy=ce[1];
  if(n){ draftPicks.push({owner:p.id,x:sx/n+.5,y:sy/n+.5,name:c.name,n:draftPicks.filter(d=>d.owner===p.id).length+1,at:tickN}); }
  log(`${p===me?'You':p.name} picked ${c.name}.`,p===me); if(p===me) snd('conquered'); }
function draftAdvance(){ draft.idx++; if(draft.idx>=draft.order.length){ draft.idx=0; draft.round++; }
  if(draft.round>=draft.per){ draft=null; draftDoneAt=performance.now(); paused=userPaused; log('Draft complete — the war begins.',true); snd('unified'); for(const p of players) if(p.kind==='neutral'&&p.tiles<=0) p.alive=false; updateUI(); } }
function draftStep(){ if(!draft) return; const p=draft.order[draft.idx]; if(p===me) return; // waiting on the human
  const free=players.filter(q=>q.kind==='neutral'&&q.alive&&q.tiles>=120); if(!free.length){ draftAdvance(); return; }
  let c=null; if(p.tiles>0){ const {r}=borderOwners(p); const adj=Object.keys(r).map(Number).map(id=>players[id]).filter(q=>q.kind==='neutral'&&q.alive&&q.tiles>=120).sort((a,b)=>b.tiles-a.tiles); if(adj.length) c=adj[0]; }
  if(!c){ const big=free.sort((a,b)=>b.tiles-a.tiles).slice(0,6); c=pick(big); }
  draftPick(p,c); draftAdvance(); }
function togglePause(){ if(over||!me||draft) return; userPaused=!userPaused; if(userPaused){ paused=true; pausedAt=performance.now(); } else { startTime+=performance.now()-pausedAt; paused=false; } $('pauseBtn').textContent=userPaused?'\u25B6':'\u275A\u275A'; }
function checkAlliedEndgame(){
  if(decided||over||paused||!me.alive) return;
  const rivals=players.filter(q=>q.alive&&q!==me&&q.kind!=='neutral');
  if(!rivals.length||!rivals.every(q=>relation(me,q)?.type==='ally')) return;
  if(rivals.every(q=>q.team!=null&&q.team===me.team)){ decided=true; end('Team victory',`Team ${TEAM_NAMES[me.team]} is the last one standing.`); return; }
  if(players.some(q=>q.alive&&q.kind==='neutral'&&q.tiles>200)) return; // neutrals still standing: not yet
  decided=true; if(!REPLAY.on) paused=true;
  const names=rivals.map(q=>q.name).join(', ');
  $('decideText').textContent=`${names} ${rivals.length>1?'are':'is'} the last nation${rivals.length>1?'s':''} standing beside you. Share the victory, or break the alliance and finish the war.`;
  $('decide').style.display='flex';
  DECIDE.share=()=>{ $('decide').style.display='none'; paused=userPaused;
    const refuse=rivals.filter(q=>{ const ratio=me.tiles/Math.max(1,q.tiles); const pr=ratio>=1.2?0.9:ratio>=0.8?0.6:0.3; return srand()>pr*Math.min(1,me.rep+0.3); });
    if(!refuse.length){ over=false; freeplay=false; end('Shared victory',`You and ${names} end the war as allies, holding ${Math.round(players.filter(q=>q.alive&&q.kind!=='neutral').reduce((a,q)=>a+q.tiles,0)/landCount*100)}% of the land together.`); }
    else { for(const q of refuse){ log(`${q.name} refuses to share the world.`,true); breakRelation(q,me); q.nextThink=0; q.focus=0.85; } snd('pushback'); }
  };
  DECIDE.war=()=>{ $('decide').style.display='none'; paused=userPaused; for(const q of rivals) breakRelation(me,q); };
  $('decShare').onclick=()=>issue('decShare'); $('decWar').onclick=()=>issue('decWar');
}
const LB_KEY='statefall-board';
function loadBoard(){ try{ return JSON.parse(localStorage.getItem(LB_KEY)||'[]'); }catch(e){ return []; } }
function saveBoard(b){ try{ localStorage.setItem(LB_KEY,JSON.stringify(b.slice(-300))); }catch(e){} }
function matchClass(){ const c=[]; if(START.billionaire) c.push('Billionaire'); if(START.endgame) c.push('End game'); if(START.quick) c.push('Quick start'); if(START.risky) c.push('Risky start'); if(START.instant) c.push('Instant build'); if(START.noCap) c.push('No cap'); if(START.troops!==120||START.gold!==100||START.bots) c.push('Custom start'); if(START.teams>0) c.push(START.teams+' teams'); if(START.garrison) c.push('Garrisons'); if(START.pauseBuild) c.push('Paused orders'); return c.length?c.join(' + '):'Standard'; }
function matchScore(rec){ const dm={supereasy:0.4,easy:0.7,normal:1,hard:1.4,superhard:1.9,impossible:2.6}[rec.diff]||1; const mode=(rec.fog?1.25:1)*(rec.risky?1.15:1); const res={'Total victory':1.3,'Victory':1,'Team victory':1,'Shared victory':0.7,'Abandoned':0}[rec.result]??0.25; return Math.round(rec.land*dm*mode*res/Math.max(1,rec.minutes)*100); }
function recordMatch(title){ if(me.recorded) return; me.recorded=true; const minutes=REPLAY.on?tickN*TICK/60000:((userPaused?pausedAt:performance.now())-startTime)/60000;
  const rec={when:Date.now(),result:title,country:me.name,map:START.map,diff:chosen,fog:!!START.fog,risky:!!START.risky,cls:matchClass(),land:Math.round(me.tiles/landCount*1000)/10,minutes:Math.round(minutes*10)/10,kills:me.kills||0,peak:Math.round(me.peakTroops||me.troops),gold:Math.round(me.goldEarned||0),seed:START.seed};
  rec.botNations=players.filter(p=>p.customNation).map(p=>({userId:p.customNation.userId,name:p.customNation.name,alive:!!p.alive,land:Math.round(p.tiles/landCount*1000)/10,killedBy:p.killedBy!=null?players[p.killedBy].name:null,kills:players.filter(q=>q.kind!=='neutral'&&q.killedBy===p.id).length,killedPlayer:me.killedBy===p.id,peak:Math.round(p.peakTroops||0)}));
  rec.stats=statsSnapshot(title); { let n=JSON.stringify(rec.stats).length; while(n>60000&&rec.stats.tl.length>40){ rec.stats.tl=rec.stats.tl.filter((e,i)=>i%2===0||e.k!=='note'); n=JSON.stringify(rec.stats).length; } console.info('[statefall] stats blob',n,'bytes,',rec.stats.tl.length,'timeline entries'); } rec.score=matchScore(rec); const b=loadBoard(); b.push(rec); saveBoard(b); lastStats=rec.stats;
  if(REPLAY.on){ lastStats=rec.stats; return; }
  if(WP&&WP.user&&title!=='Abandoned'){ siteSave('replay',`${title} as ${me.name} · ${matchClass()} · ${new Date().toLocaleDateString()}`,{result:title}).catch(e=>console.warn('[statefall] replay save',e)); }
  if(WP&&WP.user&&title!=='Abandoned'){ sfPost(rec).then(res=>{ if(res.skipped) return; try{ localStorage.setItem('statefall-lastpost',JSON.stringify({at:Date.now(),ok:!res.error,msg:res.error?(res.message||res.error)+(res.status?' ('+res.status+')':''):`#${res.rank} overall, #${res.classRank} in ${rec.cls}`})); }catch(e){} if(res.error){ if(res.status!==422&&res.status!==403){ const box=sfOutbox(); box.push(rec); sfSaveOutbox(box); } log(`Score not posted (${res.message||res.error}).`,true); const el=document.getElementById('ovPost'); if(el) el.textContent=res.status===403?'Not posted — the page login has expired; refresh and it will retry.':'Not posted: '+(res.message||res.error); }
      else { lastPostId=res.id||null; const el=document.getElementById('ovPost'); if(el) el.textContent=res.duplicate?'Community score already posted.':`Community score posted — #${res.rank} overall, #${res.classRank} in ${rec.cls}. Scores are player-submitted and not independently verified.${res.stats===false?' (credits not saved — site plugin needs updating)':''}`; log(`Community score posted: #${res.rank} overall (unverified).`,true); if(res.id&&!res.duplicate&&rec.stats){ creditsCardPNG(rec.stats).then(blob=>{ if(!blob) return; const fd=new FormData(); fd.append('card',blob,'card.png'); fetch(WP.rest+'scores/'+res.id+'/card',{method:'POST',credentials:'same-origin',headers:{'X-WP-Nonce':WP.nonce},body:fd}).catch(()=>{}); }); const sh=document.getElementById('ovShare'); const row=document.getElementById('ovShareRow'); if(sh&&row){ const url=(WP.creditsUrl||WP.base)+res.id+'/'; row.style.display='flex'; sh.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url); const cp=document.getElementById('ovCopy'); cp.onclick=()=>{ (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>{ cp.textContent='Copied'; setTimeout(()=>{ cp.textContent='Copy link'; },1800); }).catch(()=>{ prompt('Copy this link:',url); }); }; } } if(res.rank===1&&!res.duplicate&&JUKE.loaded&&JUKE.stings.top1) ROLL.top1Pending=true; } }); } }
function playClass(cls){ const parts=cls.split(' + ');
  const set=(id,v)=>{ $(id).checked=v; };
  set('billionaireOn',parts.includes('Billionaire')); set('garrisonOn',parts.includes('Garrisons')); set('stPauseBuild',parts.includes('Paused orders')); set('endgameOn',parts.includes('End game')); set('quickStart',parts.includes('Quick start')); set('riskyOn',parts.includes('Risky start')); set('instantOn',parts.includes('Instant build')); set('stNoCap',parts.includes('No cap'));
  const tm=parts.find(x=>/^\d teams$/.test(x)); START.teams=tm?+tm[0]:0; $('teamSel').value=String(START.teams);
  if(!parts.includes('Custom start')){ $('stTroops').value=120; $('stGold').value=100; set('stBots',false); }
  document.querySelectorAll('#modes input[data-group=layout]').forEach(c=>c.onchange&&c.onchange());
  const maps=[...document.querySelectorAll('#maps button')].map(x=>x.dataset.m); START.map=maps[Math.floor(Math.random()*maps.length)]; document.querySelectorAll('#maps button').forEach(x=>x.classList.toggle('on',x.dataset.m===START.map));
  const diffs=Object.keys(DIFFS); chosen=diffs[Math.floor(Math.random()*diffs.length)]; $('diffSel').value=chosen;
  const ci=Math.floor(Math.random()*COUNTRIES.length); chosenFlag=countryByIdx(ci); $('countrySel').value=ci; nationOption(); document.querySelectorAll('.flagbtn').forEach(x=>x.classList.toggle('on',x.title===chosenFlag.name));
  $('seedIn').value=newSeed(); $('lb').style.display='none'; $('startBtn').click(); }
let lbScopeSel='local';
async function showGlobal(scope){ const sel=$('lbClass'); const cls=sel.value||'__all'; const mapName=k=>({random:'Continents',land:'Land',islands_l:'Large islands',islands_m:'Medium islands',islands_s:'Small islands',atoll:'Atoll',world:'World',europe:'Europe',americas:'Americas',africa:'Africa',asia:'Asia',mideast:'Middle East'})[k]||k;
  $('lbBody').innerHTML='<p class="muted">Loading…</p>';
  try{ const url=scope==='mine'?WP.rest+'scores/mine?limit=100'+(cls!=='__all'?'&cls='+encodeURIComponent(cls):''):WP.rest+'scores?limit=50&cls='+encodeURIComponent(cls); const r=await fetch(url,{credentials:'same-origin',headers:{'X-WP-Nonce':WP.nonce}}); const data=await r.json(); if(!r.ok) throw new Error(data.message||('http '+r.status));
    const table=rows=>rows.length?`<table class="lbt"><tr><th>#</th><th>Player</th><th>Score</th><th>Result</th><th>Country</th><th>Map</th><th>Difficulty</th><th>Time</th><th>Land</th><th>Seed</th></tr>${rows.map(x=>`<tr class="${x.rank===1?'best':''}"><td>${x.rank}</td><td>${x.user?x.user.name:''}</td><td>${x.score}</td><td>${x.result}</td><td>${x.country}</td><td>${mapName(x.map)}</td><td>${(DIFFS[x.diff]||{}).label||x.diff}</td><td>${x.minutes} min</td><td>${x.land}%</td><td><button data-seed="${x.seed}" style="padding:1px 6px;font-size:11px">${x.seed}</button></td></tr>`).join('')}</table>`:'<p class="muted">No leader yet — play and take a spot!</p>';
    const trust='<p class="muted" style="margin:8px 0 10px">Community scores are submitted by players and are not independently verified.</p>'; if(scope!=='mine'&&cls==='__all'&&!Array.isArray(data)) $('lbBody').innerHTML=trust+(Object.keys(data).map(c=>`<div style="margin:12px 0 4px"><b>${c}</b></div>`+table(data[c])).join('')||'<p class="muted">No scores on the site yet.</p>'); else $('lbBody').innerHTML=trust+table(Array.isArray(data)?data:[]);
    $('lbBody').querySelectorAll('button[data-seed]').forEach(x=>x.onclick=()=>{ $('seedIn').value=x.dataset.seed; $('lb').style.display='none'; }); }
  catch(e){ $('lbBody').innerHTML='<p class="muted">Could not load the site board ('+e.message+').</p>'; } }
function showBoard(){ if(WP){ const sc=$('lbScope'); sc.innerHTML=['local','global','mine'].map(k=>`<button data-scope="${k}" style="padding:3px 9px;margin-right:4px;${lbScopeSel===k?'background:#2f5a8c;':''}${k==='mine'&&!WP.user?'opacity:.5;':''}" ${k==='mine'&&!WP.user?'disabled':''}>${k==='local'?'This browser':k==='global'?'Global':'Mine'}</button>`).join(''); sc.querySelectorAll('button').forEach(b=>b.onclick=()=>{ lbScopeSel=b.dataset.scope; showBoard(); }); if(lbScopeSel!=='local'){ const b=loadBoard(); const classes=['Standard',...new Set(b.map(r=>r.cls).filter(c=>c&&c!=='Standard'))]; const sel=$('lbClass'); const cur=sel.value||'__all'; sel.innerHTML=`<option value="__all">All classes — top 3 each</option>`+classes.map(c=>`<option value="${c}">${c}</option>`).join(''); sel.value=(cur==='__all'||classes.includes(cur))?cur:'__all'; $('lb').style.display='flex'; showGlobal(lbScopeSel); return; } }
  const mapName=k=>({random:'Continents',land:'Land',islands_l:'Large islands',islands_m:'Medium islands',islands_s:'Small islands',atoll:'Atoll',world:'World',europe:'Europe',americas:'Americas',africa:'Africa',asia:'Asia',mideast:'Middle East'})[k]||k;
  const b=loadBoard(); for(const r of b){ if(!r.cls) r.cls=r.sandbox?'Legacy sandbox':'Standard'; if(r.score==null) r.score=matchScore(r); }
  const classes=['Standard',...new Set(b.map(r=>r.cls).filter(c=>c!=='Standard'))]; const sel=$('lbClass'); const cur=sel.value||'__all'; sel.innerHTML=`<option value="__all">All classes — top 3 each</option>`+classes.map(c=>`<option value="${c}">${c} (${b.filter(r=>r.cls===c).length})</option>`).join(''); sel.value=(cur==='__all'||classes.includes(cur))?cur:'__all';
  if(sel.value==='__all'){ // combined board: top 3 of every class, each with a play button
    const COMMON=['Standard','Garrisons','Quick start','Risky start','End game','Instant build','Billionaire','Quick start + Instant build','End game + Instant build','No cap','2 teams','4 teams'];
    const played=[...new Set([...COMMON,...classes.filter(c=>b.some(r=>r.cls===c))])];
    $('lbBody').innerHTML=played.map(c=>{ const top=b.filter(r=>r.cls===c).sort((a,d)=>(d.score-a.score)||(d.when-a.when)).slice(0,3);
      if(!top.length) return `<div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px"><span><b>${c}</b> <span class="muted" style="margin-left:8px">No leader yet — play and take a spot!</span></span><span><button data-play="${c}" style="padding:3px 10px">Play a random ${c} match</button></span></div>`;
      return `<div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px"><b>${c}</b><span><button data-play="${c}" style="padding:3px 10px">Play a random ${c} match</button></span></div><table class="lbt"><tr><th>#</th><th>Score</th><th>Result</th><th>Country</th><th>Map</th><th>Difficulty</th><th>Time</th><th>Land</th><th>Seed</th></tr>${top.map((r,i)=>`<tr><td>${i+1}</td><td>${r.score}</td><td>${r.result}</td><td>${r.country}</td><td>${mapName(r.map)}</td><td>${(DIFFS[r.diff]||{}).label||r.diff}</td><td>${r.minutes} min</td><td>${r.land}%</td><td><button data-seed="${r.seed}" style="padding:1px 6px;font-size:11px">${r.seed}</button></td></tr>`).join('')}</table>`; }).join('');
    $('lbBody').querySelectorAll('button[data-seed]').forEach(x=>x.onclick=()=>{ $('seedIn').value=x.dataset.seed; $('lb').style.display='none'; });
    $('lbBody').querySelectorAll('button[data-play]').forEach(x=>x.onclick=()=>playClass(x.dataset.play));
    $('lb').style.display='flex'; return; }
  const rows=b.filter(r=>r.cls===sel.value).sort((a,c)=>(c.score-a.score)||(c.when-a.when));
  const bestBy={}; for(const r of rows){ if(!r.result.includes('ictory')) continue; const k=r.map+'|'+r.diff; if(!bestBy[k]||r.minutes<bestBy[k].minutes) bestBy[k]=r; }
  $('lbBody').innerHTML=rows.length?`<table class="lbt"><tr><th>#</th><th>Score</th><th>Result</th><th>Country</th><th>Map</th><th>Difficulty</th><th>Modes</th><th>Time</th><th>Land</th><th>Kills</th><th>Peak troops</th><th>Date</th><th>Seed</th></tr>${rows.map((r,i)=>`<tr class="${Object.values(bestBy).includes(r)?'best':''}"><td>${i+1}</td><td>${r.score}</td><td>${r.result}</td><td>${r.country}</td><td>${mapName(r.map)}</td><td>${(DIFFS[r.diff]||{}).label||r.diff}</td><td>${[r.fog?'fog':'',r.risky?'risky':''].filter(Boolean).join(', ')||'—'}</td><td>${r.minutes} min</td><td>${r.land}%</td><td>${r.kills}</td><td>${r.peak}</td><td>${new Date(r.when).toLocaleDateString()}</td><td><button data-seed="${r.seed}" style="padding:1px 6px;font-size:11px">${r.seed}</button></td></tr>`).join('')}</table>`  :'<p class="muted">No matches in this class yet.</p>';
  $('lbBody').querySelectorAll('button[data-seed]').forEach(x=>x.onclick=()=>{ $('seedIn').value=x.dataset.seed; $('lb').style.display='none'; log?.('Seed loaded.',true); });
  $('lb').style.display='flex'; }
function end(title,text){ if(REPLAY.creditsMode){ over=true; return; } if(over||freeplay&&title!=='Overrun'&&title!=='Total victory') return; over=true; try{ recordMatch(title); }catch(e){ console.error('[statefall] record failed',e); } snd(title.includes('ictory')?'victory':'defeat'); if(title==='Victory'&&me.team!=null) title='Team victory'; ovTitle.textContent=title; ovText.textContent=text;
  overlay.classList.toggle('replay',REPLAY.on); if(REPLAY.on){ ovTitle.textContent='Replay finished — '+title; const d=lastStats||{}; ovText.textContent=`${d.name||me.name}: ${d.result||title} in ${Math.round(tickN*TICK/6000)/10} min · ${Math.round(me.tiles/landCount*1000)/10}% of the land · ${(d.c&&d.c.kills)||me.kills||0} nations eliminated. ${REPLAY.mismatch?'This replay diverged from the recording along the way.':'The replay matched the recording throughout.'}`; const el=document.getElementById('ovPost'); if(el) el.textContent=''; $('replayBar').style.display='none'; }
  { const b=loadBoard(); const r=b[b.length-1]; if(r&&!freeplay&&!REPLAY.on) ovText.textContent+=` Score ${r.score} — ${r.minutes} min, ${r.land}% of the land, ${r.kills} nations eliminated. Board: ${r.cls}.`; const el=document.getElementById('ovPost'); if(el) el.textContent=!WP?'':!WP.user?'Log in on the site to post scores.':freeplay?'Already recorded when the match first ended.':'Posting to the site…'; }
  { const sel=document.getElementById('ovSong'); if(sel){ const opts=(JUKE.loaded&&(JUKE.list.game.length||JUKE.list.menu.length))?[]:['<option value="builtin">Built-in score</option>']; if(JUKE.loaded){ const seen=new Set(); const all=[...Object.values(JUKE.stings||{}).flat(),...JUKE.list.game,...JUKE.list.menu].filter(t=>t&&!seen.has(t.id)&&seen.add(t.id)); for(const t of all) opts.push(`<option value="${t.id}">${t.title}${t.seconds?' ('+Math.floor(t.seconds/60)+':'+String(Math.floor(t.seconds%60)).padStart(2,'0')+')':''}</option>`); } sel.innerHTML=opts.join(''); if(ROLL.autoSong&&[...sel.options].some(o=>o.value===ROLL.autoSong)) sel.value=ROLL.autoSong; } const cb=document.getElementById('ovCredits'); if(cb){ cb.textContent=ROLL.rolled?'Watch credits again':'Roll credits'; cb.onclick=()=>{ if(lastStats){ ROLL.rolled=true; CUSTOM.previewing=false; beginCredits(CUSTOM.approved&&CUSTOM.data?Object.assign({},lastStats,{custom:CUSTOM.data}):lastStats,(CUSTOM.approved&&CUSTOM.data&&CUSTOM.data.song)||ROLL.autoSong||'builtin',false); } }; } const cu=document.getElementById('ovCustom'); if(cu) cu.onclick=()=>{ if(lastStats) openBuilder(lastStats); }; }
  const c=document.getElementById('ovCont'); c.textContent=title.includes('ictory')?'Keep playing':'Spectate'; c.style.display=title==='Total victory'?'none':''; overlay.style.display='flex';
  if(!freeplay&&lastStats&&!ROLL.on){ try{ MUS.stop(); jukeStopSrc(0.8); const won=title.includes('ictory'); const st=jukeStingPick(won?'victory':'defeat')||jukeStingPick('credits'); ROLL.autoSong=st?st.id:(JUKE.loaded&&JUKE.list.game.length?upick(JUKE.list.game).id:'builtin'); ROLL.rolled=false; }catch(e){ console.error('[statefall] end music',e); } }
  c.onclick=()=>{ overlay.style.display='none'; over=false; freeplay=true; if(!title.includes('ictory')) spectating=true; log(title.includes('ictory')?'Victory declared — the war goes on.':'Spectating.',true); }; }

// ---------------------------------------------------------------- rendering
const cv=document.getElementById('map'), ctx=cv.getContext('2d');
const off=document.createElement('canvas'); off.width=W; off.height=H; const octx=off.getContext('2d');
const img=octx.createImageData(W,H);
const cam={x:0,y:0,s:4};
if(__STATEFALL_TEST_BRIDGE__){
function installBrowserTestBridge(){
  const enabled=window.__STATEFALL_TEST_MODE__===true&&new URLSearchParams(location.search).get('browserTest')==='1';
  if(!enabled) return;
  let deterministicScene=false;
  const lastCommand=()=>{ const c=CMD.log[CMD.log.length-1]; return c?{t:c.t,k:c.k,a:structuredClone(c.a)}:null; };
  const replayStatus=()=>({on:REPLAY.on,commands:REPLAY.cmds.length,applied:REPLAY.i,targetTick:REPLAY.toTick,mismatch:!!REPLAY.mismatch,speed:REPLAY.speed});
  const status=()=>({ready:!!me,tick:tickN,paused,lastCommand:lastCommand(),replay:replayStatus()});
  const snapshot=()=>({
    ready:!!me, seed:START.seed, map:START.map, tick:tickN, paused,
    players:players.length, landCount,
    modes:{quick:START.quick,risky:START.risky,endgame:START.endgame,fog:START.fog,instant:START.instant,billionaire:START.billionaire,garrison:START.garrison,noCap:START.noCap,pauseBuild:START.pauseBuild},
    matchClass:me?matchClass():null,
    player:me?{id:me.id,tiles:me.tiles,troops:me.troops,gold:me.gold,areas:me.areas?me.areas.length:0}:null,
    mapState:me?{neutralLand:Array.from(owner).reduce((n,o,t)=>n+(land[t]&&o<0?1:0),0),hiddenTiles:vis?Array.from(vis).reduce((n,v)=>n+(v?0:1),0):0,draft:!!draft}:null,
     input:{hover,commands:CMD.log.length,lastCommand:lastCommand()},
     replay:replayStatus(),
     camera:{x:cam.x,y:cam.y,scale:cam.s},
     canvas:{width:cv.width,height:cv.height,clientWidth:cv.clientWidth,clientHeight:cv.clientHeight}
   });
  Object.defineProperty(window,'__STATEFALL_TEST__',{value:Object.freeze({
    snapshot,
    status,
    prepareControlledStart(){ if(me) throw new Error('match already started'); window.__STATEFALL_TEST_PAUSE_ON_START__=true; },
    pause(){ if(me&&!paused) togglePause(); return status(); },
    advance(ticks){ const count=Math.max(0,Math.floor(ticks)); if(!me||!paused) throw new Error('advance requires a paused match'); paused=false; try{ for(let i=0;i<count;i++) tick(); } finally { paused=true; } return status(); },
    canonicalState,
    exerciseCruiseTargetOrder(candidates){ let draws=0; const picks=cruiseTargets(candidates,()=>{ draws++; return .5; }); return {draws,order:picks.map(x=>x.name)}; },
    async canonicalDigest(){ const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalState())); return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''); },
    focusTarget(kind='owned',scale=4){
      if(!me) throw new Error('match not started');
      let target=-1,best=Infinity;
      for(let t=0;t<W*H;t++){
        const matches=kind==='owned'?land[t]&&owner[t]===me.id:kind==='foreign'?land[t]&&owner[t]>=0&&owner[t]!==me.id:kind==='water'?!land[t]:false;
        if(!matches) continue;
        const x=t%W,y=(t-x)/W,d=(x-me.sx)**2+(y-me.sy)**2;
        if(d<best){ best=d; target=t; }
      }
      if(target<0) throw new Error('target not found: '+kind);
      const x=target%W,y=(target-x)/W;
      cam.s=Math.min(12,Math.max(.35,+scale||4)); cam.x=cv.width/2-(x+.5)*cam.s; cam.y=cv.height/2-(y+.5)*cam.s; render();
      return {tile:target,owner:owner[target],land:!!land[target],x:cv.width/2,y:cv.height/2};
    },
     setCamera(scale,target='player'){
       if(!me) throw new Error('match not started');
       const x=target==='world'?W/2:me.sx+.5,y=target==='world'?H/2:me.sy+.5;
       cam.s=Math.min(12,Math.max(.35,+scale||1)); cam.x=cv.width/2-x*cam.s; cam.y=cv.height/2-y*cam.s; render(); return status();
     },
     loadReplay(file,mode='watch'){ if(me) throw new Error('loadReplay requires the start screen'); loadReplayFile(structuredClone(file),mode); return status(); },
     installLateGameScene(){
       if(!me||!paused) throw new Error('late-game scene requires a paused match');
       const rivals=players.filter(p=>p!==me&&p.kind!=='neutral').slice(0,2); if(rivals.length<2) throw new Error('late-game scene requires two rivals');
       let cx=Math.round(me.sx),cy=Math.round(me.sy),best=-1;
       for(let y=35;y<H-35;y+=8) for(let x=35;x<W-35;x+=8){ let la=0,wa=0; for(let yy=y-18;yy<=y+18;yy+=3) for(let xx=x-18;xx<=x+18;xx+=3) land[idx(xx,yy)]?la++:wa++; const score=Math.min(la,wa); if(score>best){ best=score; cx=x; cy=y; } }
       const ids=[me.id,rivals[0].id,rivals[1].id];
       for(let y=Math.max(0,cy-48);y<Math.min(H,cy+49);y++) for(let x=Math.max(0,cx-56);x<Math.min(W,cx+57);x++){ const t=idx(x,y); if(!land[t]) continue; owner[t]=ids[x<cx-5?0:x>cx+9?1:2]; }
       const used=new Set(), near=(x,y,wantLand,own)=>{ let found=-1,dist=Infinity; for(let yy=Math.max(0,y-28);yy<Math.min(H,y+29);yy++) for(let xx=Math.max(0,x-28);xx<Math.min(W,x+29);xx++){ const t=idx(xx,yy); if(!!land[t]!==wantLand||used.has(t)||(own!=null&&owner[t]!==own)) continue; const d=(xx-x)**2+(yy-y)**2; if(d<dist){ dist=d; found=t; } } if(found<0&&wantLand&&own!=null){ for(let yy=Math.max(0,cy-48);yy<Math.min(H,cy+49);yy++) for(let xx=Math.max(0,cx-56);xx<Math.min(W,cx+57);xx++){ const t=idx(xx,yy); if(!land[t]||used.has(t)) continue; const d=(xx-x)**2+(yy-y)**2; if(d<dist){ dist=d; found=t; } } if(found>=0) owner[found]=own; } if(found<0) throw new Error('late-game fixture tile not found'); used.add(found); return found; };
       structures=[]; struct.fill(0); structOwner.fill(-1);
       const addStructure=(type,x,y,own,extra={})=>{ const t=near(x,y,true,own),st={type,owner:own,t,cost:0,building:false,...extra}; structures.push(st); struct[t]=1; structOwner[t]=own; return st; };
       const city=addStructure('city',cx-30,cy-13,me.id,{level:2,links:1});
       const factory=addStructure('factory',cx-22,cy-5,me.id,{links:1});
       const port=addStructure('port',cx-12,cy+5,me.id,{level:2,gunHp:3,queue:[{cls:'cruiser',done:tickN+80,total:120}]});
       addStructure('fort',cx-8,cy-15,me.id,{level:3});
       addStructure('sam',cx-19,cy+15,me.id,{cool:tickN+12,hp:3});
       const silo=addStructure('silo',cx-29,cy+13,me.id,{cool:tickN+70});
       addStructure('command',cx-24,cy+4,me.id);
       const airfield=addStructure('airfield',cx-35,cy+3,me.id,{level:2,lshield:3,aq:[]});
       const enemyShield=addStructure('shield',cx+24,cy-10,rivals[0].id,{hp:4});
       const enemySam=addStructure('sam',cx+31,cy+8,rivals[0].id,{cool:0,hp:3});
       addStructure('bertha',cx+2,cy+17,rivals[1].id,{hp:4});
       links=[{a:factory,b:city,owner:me.id},{a:factory,b:port,owner:me.id}];
       const waters=[near(cx-8,cy+15,false),near(cx+2,cy+13,false),near(cx+13,cy+15,false),near(cx+22,cy+19,false)];
       const point=t=>[t%W+.5,(t-t%W)/W+.5], makeShip=(cls,own,t,path=[t],extra={})=>{ const [x,y]=point(t),w={id:++uidSeq,owner:own,cls,path,pos:0,dest:path[path.length-1],x,y,hp:SHIPS[cls].hp,cool:0,ang:0,hdg:-.2,wake:[[x-4,y+1],[x-2,y+.5],[x,y]],barCool:0,...extra}; warships.push(w); return w; };
       warships=[]; selected.clear(); const flagship=makeShip('battleship',me.id,waters[0],waters,{cruise:true,fireAt:tickN,fireAng:-.3}); selected.add(flagship); makeShip('cruiser',me.id,waters[1],waters.slice(1),{barCool:tickN+80}); makeShip('warship',rivals[0].id,waters[2]); makeShip('scout',rivals[1].id,waters[3]);
       const [ax,ay]=point(airfield.t), [tx,ty]=point(enemyShield.t);
       aircraft=[{id:++uidSeq,owner:me.id,type:'fighter',home:airfield,state:'patrol',x:ax+10,y:ay-9,tx:cx,ty:cy,hp:3,hdg:.2,until:tickN+300},{id:++uidSeq,owner:me.id,type:'bomber',home:airfield,state:'run',x:cx-3,y:cy-18,tx,ty,bombs:5,hdg:.1},{id:++uidSeq,owner:rivals[0].id,type:'fighter',home:enemySam,state:'out',x:cx+15,y:cy-17,tx:cx,ty:cy,hp:2,hdg:2.8,until:tickN+200}];
       missiles=[{owner:me.id,t:enemyShield.t,from:silo.t,age:24,flight:55},{owner:rivals[0].id,t:city.t,from:enemySam.t,age:16,flight:55}];
       shells=[{owner:rivals[1].id,x:cx+12,y:cy+11,kind:'land',tx:cx-7,ty:cy-8,radius:3,trail:[[cx+18,cy+15,0],[cx+15,cy+13,4]],delay:0,arc:true,missile:true,speed:3.2,rise:17,ox:cx+18,oy:cy+15}];
       attacks=[{owner:me.id,target:rivals[1].id,front:[near(cx-4,cy-3,true,rivals[1].id)]}]; shelled[enemySam.t]=tickN+180;
       me.cmdFocus=rivals[0].id; me.cmdFocusT=enemyShield.t; highlightId=rivals[0].id;
       if(START.fog){ if(!vis) vis=new Uint8Array(W*H); vis.fill(1); for(let y=Math.max(0,cy-44);y<Math.min(H,cy+45);y++) for(let x=cx+38;x<Math.min(W,cx+64);x++) vis[idx(x,y)]=0; }
       nukeAlerts=[{from:point(enemySam.t),at:point(city.t),owner:rivals[0].id,age:18,life:88}];
       document.querySelectorAll('#notices .notice').forEach(n=>n.remove()); showNotice({kind:'bad',title:'Eastern front under bombardment',text:'Missiles inbound; fleet route and air patrol active.',ttl:0});
       for(const p of players) if(!ids.includes(p.id)) p.tiles=0;
       for(const [p,x,y] of [[me,cx-28,cy-28],[rivals[0],cx+30,cy-27],[rivals[1],cx+2,cy+27]]){ p.labelPos=[x+.5,y+.5]; p.labelDraw=[x+.5,y+.5]; p.tiles=Math.max(1200,p.tiles); }
       deterministicScene=true;
       cam.s=5; cam.x=cv.width/2-cx*cam.s; cam.y=cv.height/2-cy*cam.s; drawMap(); updateUI(); updateHint(); render();
       return {fixture:'dense-late-game',nations:3,adjacentOwnership:true,structures:structures.length,ships:warships.length,selectedShips:selected.size,aircraft:aircraft.length,missiles:missiles.length,shells:shells.length,attacks:attacks.length,supplyRoutes:links.length,fog:!!vis,hiddenTiles:vis?Array.from(vis).filter(v=>!v).length:0,alerts:nukeAlerts.length,notices:document.querySelectorAll('#notices .notice').length};
     },
     screenToTile(x,y){ return tileAt(x,y); },
     freezePresentation(){ if(me&&!paused) togglePause(); window.__STATEFALL_TEST_FREEZE__=true; if(deterministicScene){ for(const na of nukeAlerts) na.age=18; for(const p of players) if(p.labelPos) p.labelDraw=p.labelPos.slice(); } render(); return status(); }
  })});
}
installBrowserTestBridge();
}
const hex=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const pcol=[]; const seaC=hex('#1c3a52'), landC=hex('#b9ad84'), riverC=hex('#2f6389');
function colorCache(){ pcol.length=0; for(const p of players){ let c=hex(p.color);
  if(p.team!=null){ const t=hex(TEAM_COLS[p.team]); c=[c[0]*0.35+t[0]*0.65,c[1]*0.35+t[1]*0.65,c[2]*0.35+t[2]*0.65]; // teammates share a hue family
    const k=0.82+0.18*((p.id*7)%5)/4; c=c.map(v=>Math.min(255,v*k)); } // slight brightness offsets keep members distinguishable
  pcol.push(c); } }
function drawMap(){
  const d=img.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const t=idx(x,y); let c;
    if(!land[t]) c=river[t]?riverC:seaC;
    else{ const o=owner[t];
      if(o<0) c=shelled[t]>tickN?[landC[0]*0.6,landC[1]*0.6,landC[2]*0.6]:landC;
      else{ c=pcol[o]; let border=0; const po=players[o];
        for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); const on=owner[n]; if(land[n]&&on!==o){ const same=on>=0&&po.team!=null&&players[on].team===po.team; border=Math.max(border,same?1:2); } }
        if(border===2) c=[c[0]*0.55,c[1]*0.55,c[2]*0.55]; else if(border===1) c=[c[0]*0.85,c[1]*0.85,c[2]*0.85]; else if(o===me.id) c=[Math.min(255,c[0]*1.1),Math.min(255,c[1]*1.1),Math.min(255,c[2]*1.1)];
        if(shelled[t]>tickN){ const k=0.55+0.25*(1-(shelled[t]-tickN)/SUPPRESS_TICKS); c=[c[0]*k,c[1]*k,c[2]*k]; }
        if(pickMode&&areaOf&&hoverPickArea>=0&&areaOf[t]===hoverPickArea){ c=[Math.min(255,c[0]*1.25+30),Math.min(255,c[1]*1.25+30),Math.min(255,c[2]*1.25+30)]; }
        if(highlightId>=0){ if(o===highlightId){ const pulse=0.75+0.35*Math.sin(performance.now()/150); c=[Math.min(255,c[0]*pulse+40),Math.min(255,c[1]*pulse+40),Math.min(255,c[2]*pulse+40)]; } else c=[c[0]*0.55,c[1]*0.55,c[2]*0.55]; }
      }
    }
    if(vis&&!vis[t]){ const g=(c[0]*0.3+c[1]*0.59+c[2]*0.11); c=[(c[0]*0.35+g*0.65)*0.62,(c[1]*0.35+g*0.65)*0.62,(c[2]*0.35+g*0.65)*0.66]; }
    const i=t*4; d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; d[i+3]=255;
  }
  octx.putImageData(img,0,0);
}
function render(){
  const cw=cv.width, ch=cv.height;
  ctx.fillStyle='#132a3d'; ctx.fillRect(0,0,cw,ch);
  if(highlightId>=0||pickMode) { hoverPickArea=(pickMode&&hover>=0&&owner[hover]===me.id&&areaOf)?areaOf[hover]:-1; drawMap(); }
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(off,cam.x,cam.y,W*cam.s,H*cam.s);
  const s=cam.s;
  // attacks: pulse frontier tiles
  ctx.globalAlpha=0.5+0.3*Math.sin(performance.now()/120);
  for(const a of attacks){ ctx.fillStyle=players[a.owner].color; for(const t of a.front){ const x=t%W,y=(t-x)/W; ctx.fillRect(cam.x+x*s,cam.y+y*s,s,s);} }
  ctx.globalAlpha=1;
  // supply lines between factories and cities
  { const ph=(performance.now()/60)%16; const lowZoom=s<0.6;
    for(const l of links){ if(vis&&!vis[l.a.t]&&!vis[l.b.t]) continue; const ax=cam.x+(l.a.t%W+.5)*s, ay=cam.y+((l.a.t-l.a.t%W)/W+.5)*s, bx=cam.x+(l.b.t%W+.5)*s, by=cam.y+((l.b.t-l.b.t%W)/W+.5)*s;
      if(!lowZoom){ ctx.strokeStyle='rgba(15,26,38,.7)'; ctx.lineWidth=Math.max(2,s*1.4); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.strokeStyle=players[l.owner].color; ctx.lineWidth=Math.max(1,s*0.6); ctx.setLineDash([6,10]); ctx.lineDashOffset=-ph; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]); }
      const k=((performance.now()/1400)+(l.a.t%7)/7)%1, gx=ax+(bx-ax)*k, gy=ay+(by-ay)*k; ctx.fillStyle='#ffd27a'; ctx.beginPath(); ctx.arc(gx,gy,Math.max(1.5,s*0.9),0,Math.PI*2); ctx.fill();
    }
  }
  if(me.cmdFocusT!=null&&me.cmdFocus!=null&&players[me.cmdFocus].alive){ const fx=cam.x+(me.cmdFocusT%W+.5)*s, fy=cam.y+((me.cmdFocusT-me.cmdFocusT%W)/W+.5)*s; ctx.strokeStyle='rgba(255,170,80,.5)'; ctx.lineWidth=1.5; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.arc(fx,fy,60*s,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
  // command links: each missile command to the silos it controls (orange), flight ops to airfields (cyan), troop command to cities and ports (green)
  if(s>=0.6){ const ph=(performance.now()/60)%16;
    for(const c of structures){ if(!(c.type==='command'||c.type==='flightops'||c.type==='troopcmd')||c.building) continue; if(vis&&!vis[c.t]) continue;
      const col=c.type==='command'?'255,170,80':c.type==='flightops'?'120,220,255':'190,230,150';
      const targets=structures.filter(q=>q.owner===c.owner&&!q.building&&q!==c&&(c.type==='command'?q.type==='silo':c.type==='flightops'?q.type==='airfield':(q.type==='city'||q.type==='port'))&&((q.t%W-c.t%W)**2+((q.t-q.t%W)/W-(c.t-c.t%W)/W)**2)<=(c.type==='command'?CMD_RANGE:LINK_RANGE)**2);
      for(const q of targets){ if(vis&&!vis[q.t]) continue; const ax=cam.x+(c.t%W+.5)*s, ay=cam.y+((c.t-c.t%W)/W+.5)*s, bx=cam.x+(q.t%W+.5)*s, by=cam.y+((q.t-q.t%W)/W+.5)*s;
        ctx.strokeStyle=`rgba(${col},.55)`; ctx.lineWidth=Math.max(1,s*0.5); ctx.setLineDash([3,7]); ctx.lineDashOffset=-ph; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]);
        const k=((performance.now()/1100)+(q.t%5)/5)%1, gx=ax+(bx-ax)*k, gy=ay+(by-ay)*k; ctx.fillStyle=`rgba(${col},.9)`; ctx.beginPath(); ctx.arc(gx,gy,Math.max(1.2,s*0.7),0,Math.PI*2); ctx.fill(); } } }
  // structures
  if(s>=0.9){
    for(const st of structures){
      if(vis&&!vis[st.t]) continue;
      const x=cam.x+(st.t%W+0.5)*s, y=cam.y+((st.t-st.t%W)/W+0.5)*s, r=Math.max(6,s*2.4);
      if(st.type==='airfield'&&(st.level||1)>=2&&!st.building){ const hp=st.lshield||0; if(hp>0){ const low=hp<=2; const a=st.flash>tickN?0.45:low?0.10+0.08*Math.abs(Math.sin(performance.now()/120)):0.12; ctx.fillStyle=`rgba(150,220,255,${a})`; ctx.strokeStyle=low?'rgba(255,120,120,.8)':'rgba(150,220,255,.6)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,LSHIELD.r*s,0,Math.PI*2); ctx.fill(); ctx.stroke(); } ctx.fillStyle=hp>0?'#9df':'#ff9a9a'; const pw=2*r/LSHIELD.hp; for(let i=0;i<hp;i++) ctx.fillRect(x-r+i*pw,y+r+22,Math.max(1,pw-1),2); if(st.repairing){ const f=1-Math.max(0,(st.repairAt-tickN))/SHIELD.repairTicks; ctx.strokeStyle='#7fffa0'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); } }
      if(st.type==='shield'&&!st.building){ const low=st.hp<=3; const a=st.flash>tickN?0.45:low?0.10+0.08*Math.abs(Math.sin(performance.now()/120)):0.12; ctx.fillStyle=`rgba(150,220,255,${a})`; ctx.strokeStyle=low?'rgba(255,120,120,.8)':'rgba(150,220,255,.6)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,SHIELD.r*s,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#fff'; const pw=2*r/SHIELD.hp; for(let i=0;i<st.hp;i++) ctx.fillRect(x-r+i*pw,y+r+4,Math.max(1,pw-1),2);
        if(st.repairing){ const f=1-Math.max(0,(st.repairAt-tickN))/SHIELD.repairTicks; ctx.strokeStyle='#7fffa0'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,r+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); } }
      if(st.type==='port'&&(st.level||1)>=2&&!st.building){ const gh=st.gunHp||0; ctx.fillStyle=gh<=1?'#ff9a9a':'#fff'; const pw=2*r/4; for(let i=0;i<Math.ceil(gh);i++) ctx.fillRect(x-r+i*pw,y+r+4,Math.max(1,pw-1),2); ctx.fillStyle='rgba(255,255,255,.25)'; for(let i=Math.ceil(gh);i<4;i++) ctx.fillRect(x-r+i*pw,y+r+4,Math.max(1,pw-1),2); if(st.repairing){ const f=1-Math.max(0,(st.repairAt-tickN))/SHIELD.repairTicks; ctx.strokeStyle='#7fffa0'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); } }
      if(GUNS[st.type]&&!st.building&&st.hp!=null&&st.hp<GUNS[st.type].hp){ const mh=GUNS[st.type].hp; ctx.fillStyle='#fff'; const pw=2*r/mh; for(let i=0;i<Math.ceil(st.hp);i++) ctx.fillRect(x-r+i*pw,y+r+4,Math.max(1,pw-1),2); }
      if(st.type==='jammer'&&!st.building&&st.owner===me.id){ ctx.strokeStyle='rgba(255,180,80,.35)'; ctx.fillStyle='rgba(255,180,80,.05)'; ctx.lineWidth=1; ctx.setLineDash([2,6]); ctx.beginPath(); ctx.arc(x,y,FOG.jam*s,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
      if(GUNS[st.type]&&st.owner===me.id&&!st.building){ ctx.strokeStyle=st.type==='bertha'?'rgba(255,180,80,.16)':'rgba(255,220,150,.14)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(x,y,GUNS[st.type].range*s,0,Math.PI*2); ctx.stroke(); }
      if(st.type==='command'&&st.owner===me.id&&!st.building){ ctx.strokeStyle='rgba(255,180,80,.18)'; ctx.lineWidth=1; ctx.setLineDash([3,5]); ctx.beginPath(); ctx.arc(x,y,CMD_RANGE*s,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
      if(st.type==='sam'&&st.owner===me.id){ ctx.strokeStyle='rgba(150,220,255,.12)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(x,y,SAM_RANGE*s,0,Math.PI*2); ctx.stroke(); }
      if(st.type==='fort'&&st.owner===me.id){ ctx.strokeStyle=(st.level||1)>=3?'rgba(255,210,122,.35)':(st.level||1)>=2?'rgba(255,210,122,.24)':'rgba(255,255,255,.14)'; ctx.lineWidth=(st.level||1); ctx.beginPath(); ctx.arc(x,y,fortRange(st)*s,0,Math.PI*2); ctx.stroke(); }
      if(st.building){ ctx.globalAlpha=0.45; drawIcon(st.type,x,y,r,players[st.owner].color); ctx.globalAlpha=1; const f=1-(st.done-tickN)/st.total; ctx.strokeStyle='#ffd27a'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,r+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); if(s>=1.2){ ctx.font='10px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3; const tx=Math.ceil((st.done-tickN)/10)+'s'; ctx.strokeText(tx,x,y+r+11); ctx.fillText(tx,x,y+r+11); } continue; }
      { const pop=st.popAt!=null&&tickN-st.popAt<10?1+0.35*(1-(tickN-st.popAt)/10):1; drawIcon(st.type,x,y,r*pop,players[st.owner].color); if(pop>1){ ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r*pop*1.3,0,Math.PI*2); ctx.stroke(); } }
      if((st.level||1)>=2){ ctx.font='bold 9px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#ffd27a'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=2.5; ctx.strokeText('II',x+r*0.9,y-r*0.8); ctx.fillText((st.level||1)>=3?'III':'II',x+r*0.9,y-r*0.8); }
      if(st.upgrading){ const f=1-(st.upDone-tickN)/Math.max(1,st.upTotal); ctx.strokeStyle='#ffd27a'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,r+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); }
      if(st.type==='airfield'&&s>=1.2){ const n=aircraft.filter(a=>a.home===st).length; const q=st.aq&&st.aq.length?st.aq[0]:null; ctx.font='10px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3; const tx2=`${n}/${AIR.hangar}${q?' · '+(q.type==='fighter'?'F':q.type==='carrier'?'T':'B')+' '+Math.ceil(Math.max(0,q.done-tickN)/10)+'s':''}`; ctx.strokeText(tx2,x,y+r+11); ctx.fillText(tx2,x,y+r+11); if(q){ const f=1-(q.done-tickN)/Math.max(1,q.total); ctx.strokeStyle='#bfe6ff'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,r+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); } }
      if((st.type==='port'||st.type==='subbase')&&st.queue&&st.queue.length){ const job=st.queue[0]; const f=job.done?1-(job.done-tickN)/job.total:0; ctx.strokeStyle='#bfe6ff'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(x,y,r+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); if(s>=1.2){ ctx.font='10px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3; const tx=`${SHIPS[job.cls].label} ${job.done?Math.ceil((job.done-tickN)/10)+'s':''}${st.queue.length>1?' +'+(st.queue.length-1):''}`; ctx.strokeText(tx,x,y+r+11); ctx.fillText(tx,x,y+r+11); } }
      if(st.type==='sam'&&shelled[st.t]>tickN){ ctx.strokeStyle='rgba(255,120,120,.9)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-r,y-r); ctx.lineTo(x+r,y+r); ctx.moveTo(x+r,y-r); ctx.lineTo(x-r,y+r); ctx.stroke(); }
      if(st.linked){ ctx.strokeStyle='rgba(255,210,122,.8)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,r+2,0,Math.PI*2); ctx.stroke(); }
      if(st.cool>tickN&&(st.type==='sam'||st.type==='silo'||st.type==='battery'||st.type==='bertha')){ const f=(st.cool-tickN)/(st.type==='sam'?SAM_COOLDOWN:st.type==='silo'?SILO_COOLDOWN:GUNS[st.type].cd); ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); }
    }
  }
  // transports with tracer
  for(const tr of transports){
    const [x,y]=shipXY(tr); const col=players[tr.owner].color; if(!visAt(x,y)) continue;
    ctx.strokeStyle=col; ctx.globalAlpha=0.55; ctx.lineWidth=1.5; ctx.setLineDash([3,5]); ctx.beginPath();
    const start=tr.path[0]; ctx.moveTo(cam.x+(start%W+.5)*s,cam.y+((start-start%W)/W+.5)*s);
    for(let i=8;i<tr.pos;i+=8){ const t=tr.path[i]; ctx.lineTo(cam.x+(t%W+.5)*s,cam.y+((t-t%W)/W+.5)*s); }
    ctx.lineTo(cam.x+x*s,cam.y+y*s); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
    drawWake(tr,s); const px=cam.x+x*s,py=cam.y+y*s,r=Math.max(4,s*2);
    drawShip('transport',px,py,tr.hdg,tr.heavy?r*1.35:r,col,tr.heavy?tr.hp:null,tr.heavy?HEAVY.hp:null);
    if(s>=1.2){ ctx.font='10px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText(Math.round(tr.troops),px,py-r*1.2); }
  }
  // merchant ships
  for(const tr of traders){ if(tr.x==null||!visAt(tr.x,tr.y)) continue; const px=cam.x+tr.x*s,py=cam.y+tr.y*s,r=Math.max(3.5,s*1.7); drawWake(tr,s);
    ctx.save(); ctx.translate(px,py); ctx.rotate(tr.hdg); const u=r/10; ctx.scale(u,u); ctx.fillStyle='#d9c9a3'; ctx.strokeStyle='#5a4a30'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(3,-3); ctx.lineTo(-8,-3); ctx.lineTo(-8,3); ctx.lineTo(3,3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle=players[tr.owner].color; ctx.fillRect(-6,-2,4,4); ctx.fillRect(-1,-2,3,4); ctx.restore(); }
  // boarding lines
  for(const w of warships){ if(w.boarding&&!w.boarding.done&&visAt(w.x,w.y)){ ctx.strokeStyle='rgba(255,210,122,.8)'; ctx.lineWidth=1.5; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(cam.x+w.x*s,cam.y+w.y*s); ctx.lineTo(cam.x+w.boarding.x*s,cam.y+w.boarding.y*s); ctx.stroke(); ctx.setLineDash([]); } }
  // warships
  for(const w of warships){
    if(!visAt(w.x,w.y)) continue; if(SHIPS[w.cls].sub&&!subSeenBy(w,me.id)) continue;
    const S=SHIPS[w.cls]; const px=cam.x+w.x*s,py=cam.y+w.y*s,r=Math.max(5,s*(w.cls==='battleship'?4:w.cls==='cruiser'?3.3:w.cls==='scout'?2.1:w.cls==='rship'?2.4:w.cls==='privateer'?2.5:SHIPS[w.cls].sub?2.3:2.8)); const col=players[w.owner].color;
    if(w.owner===me.id){ ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(px,py,S.gun*s,0,Math.PI*2); ctx.stroke();
      if(S.barrage){ ctx.strokeStyle='rgba(255,180,80,.15)'; ctx.setLineDash([4,6]); ctx.beginPath(); ctx.arc(px,py,S.barrage.range*s,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } }
    if(selected.has(w)){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.arc(px,py,r*1.9,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); if(w.pos<w.path.length-1){ const d=w.path[w.path.length-1]; ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(cam.x+(d%W+.5)*s,cam.y+((d-d%W)/W+.5)*s); ctx.stroke(); } }
    if(!S.sub) drawWake(w,s); else { ctx.globalAlpha=0.7; }
    { const turn=w.prevHdg!=null?Math.atan2(Math.sin(w.hdg-w.prevHdg),Math.cos(w.hdg-w.prevHdg)):0; w.prevHdg=w.hdg; const lean=Math.max(-0.25,Math.min(0.25,turn*6)); const rec=(w.fireAt!=null&&tickN-w.fireAt<3)?1:0; const rx=px-(rec?Math.cos(w.fireAng)*r*0.25:0), ry=py-(rec?Math.sin(w.fireAng)*r*0.25:0);
      ctx.save(); ctx.translate(rx,ry); ctx.transform(1,0,lean*0.6,1-Math.abs(lean)*0.3,0,0); ctx.translate(-rx,-ry); drawShip(w.cls,rx,ry,w.hdg,r,col,w.hp,S.hp); ctx.restore();
      if(rec){ ctx.fillStyle='rgba(255,230,150,.9)'; ctx.beginPath(); ctx.arc(px+Math.cos(w.fireAng)*r*1.3,py+Math.sin(w.fireAng)*r*1.3,Math.max(2,r*0.35),0,Math.PI*2); ctx.fill(); } }
    ctx.globalAlpha=1;
    if(w.refit){ const f=1-(w.refit-tickN)/CRUISE.ticks; ctx.strokeStyle='#ffd27a'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(px,py,r*1.9,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); } if(w.cruise){ ctx.font='bold 9px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#ffd27a'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=2.5; ctx.strokeText('CM',px+r*1.3,py-r*1.2); ctx.fillText('CM',px+r*1.3,py-r*1.2); }
    if(S.barrage&&w.barCool>tickN){ const f=(w.barCool-tickN)/S.barrage.cd; ctx.strokeStyle='rgba(255,200,120,.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px,py,r*1.7,-Math.PI/2,-Math.PI/2+Math.PI*2*f); ctx.stroke(); }
  }
  for(const sh of shells){ if(!visAt(sh.x,sh.y)) continue;
    if(sh.torpedo){ ctx.lineCap='round'; for(let i=1;i<sh.trail.length;i++){ const a=i/sh.trail.length; ctx.strokeStyle=`rgba(225,240,255,${0.08+a*0.55})`; ctx.lineWidth=Math.max(1,s*0.6)*(1-a*0.4)+a*Math.max(1.5,s*1.4); ctx.beginPath(); ctx.moveTo(cam.x+sh.trail[i-1][0]*s,cam.y+sh.trail[i-1][1]*s); ctx.lineTo(cam.x+sh.trail[i][0]*s,cam.y+sh.trail[i][1]*s); ctx.stroke(); }
      if(sh.trail.length>2&&s>=1.2){ for(let i=2;i<sh.trail.length;i+=4){ const a=i/sh.trail.length; ctx.fillStyle=`rgba(255,255,255,${a*0.5})`; ctx.beginPath(); ctx.arc(cam.x+sh.trail[i][0]*s+(i%3-1)*s*0.5,cam.y+sh.trail[i][1]*s+(i%2)*s*0.4,Math.max(0.8,s*0.35),0,Math.PI*2); ctx.fill(); } } const last=sh.trail[sh.trail.length-1]||[sh.x,sh.y]; const ang=Math.atan2(sh.y-last[1],sh.x-last[0]); ctx.save(); ctx.translate(cam.x+sh.x*s,cam.y+sh.y*s); ctx.rotate(ang); ctx.fillStyle='#233'; ctx.strokeStyle='#9df'; ctx.lineWidth=1; ctx.beginPath(); ctx.rect(-4,-1.2,8,2.4); ctx.fill(); ctx.stroke(); ctx.restore(); continue; }
    if(sh.kind==='aam'){ for(let i=1;i<sh.trail.length;i++){ const a=i/sh.trail.length; ctx.strokeStyle=`rgba(230,240,255,${a*0.7})`; ctx.lineWidth=1+a*2; ctx.beginPath(); ctx.moveTo(cam.x+sh.trail[i-1][0]*s,cam.y+sh.trail[i-1][1]*s); ctx.lineTo(cam.x+sh.trail[i][0]*s,cam.y+sh.trail[i][1]*s); ctx.stroke(); }
      const last=sh.trail[sh.trail.length-1]||[sh.x,sh.y]; const ang=Math.atan2(sh.y-last[1],sh.x-last[0]); ctx.save(); ctx.translate(cam.x+sh.x*s,cam.y+sh.y*s); ctx.rotate(ang); ctx.fillStyle='#e8ecef'; ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-3,-1.3); ctx.lineTo(-3,1.3); ctx.closePath(); ctx.fill(); ctx.fillStyle='#ffb347'; ctx.fillRect(-5,-0.8,2,1.6); ctx.restore(); continue; }
    if(sh.arc&&sh.missile){ const dd=Math.hypot(sh.tx-sh.x,sh.ty-sh.y); const tot=sh.tot||(sh.tot=Math.max(1,dd)); const k=1-Math.min(1,dd/tot); const h=Math.sin(k*Math.PI)*(sh.rise||14)*0.6; const px=cam.x+sh.x*s, py=cam.y+sh.y*s-h*s;
      for(let i=1;i<sh.trail.length;i++){ const a=i/sh.trail.length; ctx.strokeStyle=`rgba(230,225,215,${a*0.55})`; ctx.lineWidth=1+a*2.5; ctx.beginPath(); ctx.moveTo(cam.x+sh.trail[i-1][0]*s,cam.y+sh.trail[i-1][1]*s-(sh.trail[i-1][2]||0)*s); ctx.lineTo(cam.x+sh.trail[i][0]*s,cam.y+sh.trail[i][1]*s-(sh.trail[i][2]||0)*s); ctx.stroke(); }
      const last=sh.trail[sh.trail.length-1]; const ang=last?Math.atan2(py-(cam.y+last[1]*s-(last[2]||0)*s),px-(cam.x+last[0]*s)):0;
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang); ctx.fillStyle='rgba(255,170,70,.7)'; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-12,-2); ctx.lineTo(-9,0); ctx.lineTo(-12,2); ctx.closePath(); ctx.fill(); ctx.fillStyle='#e8ecef'; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(2,-1.8); ctx.lineTo(-4,-1.8); ctx.lineTo(-4,1.8); ctx.lineTo(2,1.8); ctx.closePath(); ctx.fill(); ctx.fillStyle='#e35d5d'; ctx.beginPath(); ctx.moveTo(-4,-1.8); ctx.lineTo(-6,-3.5); ctx.lineTo(-4,0); ctx.lineTo(-6,3.5); ctx.lineTo(-4,1.8); ctx.fill(); ctx.restore(); continue; }
    if(sh.arc){ const dd=Math.hypot(sh.tx-sh.x,sh.ty-sh.y); const tot=sh.tot||(sh.tot=Math.max(1,dd)); const k=1-Math.min(1,dd/tot); const px=cam.x+sh.x*s, py=cam.y+sh.y*s-Math.sin(k*Math.PI)*(sh.rise||14)*s*0.6; ctx.fillStyle='#e8ecef'; ctx.beginPath(); ctx.arc(px,py,Math.max(2.5,s*1.2),0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.setLineDash([2,4]); ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(cam.x+sh.x*s,cam.y+sh.y*s); ctx.stroke(); ctx.setLineDash([]); continue; }
    for(let i=1;i<sh.trail.length;i++){ const a=i/sh.trail.length; ctx.strokeStyle=`rgba(255,220,150,${a*0.6})`; ctx.lineWidth=1+a; ctx.beginPath(); ctx.moveTo(cam.x+sh.trail[i-1][0]*s,cam.y+sh.trail[i-1][1]*s); ctx.lineTo(cam.x+sh.trail[i][0]*s,cam.y+sh.trail[i][1]*s); ctx.stroke(); }
    const last=sh.trail[sh.trail.length-1]||[sh.x,sh.y]; const ang=Math.atan2(sh.y-last[1],sh.x-last[0]);
    ctx.save(); ctx.translate(cam.x+sh.x*s,cam.y+sh.y*s); ctx.rotate(ang); ctx.fillStyle='#ffe0a8'; ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(-2.5,-1.4); ctx.lineTo(-2.5,1.4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for(const sh of shots){ sh.age++; ctx.globalAlpha=1-sh.age/6; ctx.strokeStyle=sh.col; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cam.x+sh.x0*s,cam.y+sh.y0*s); ctx.lineTo(cam.x+sh.x1*s,cam.y+sh.y1*s); ctx.stroke(); ctx.globalAlpha=1; }
  shots=shots.filter(sh=>sh.age<6);
  // missiles
  for(const m of missiles){
    const [mx,my]=missilePos(m,m.age), [nx2,ny2]=missilePos(m,m.age+1); if(!visAt(mx,my)&&m.owner!==me.id) continue; const x=cam.x+mx*s,y=cam.y+my*s, ang=Math.atan2(ny2-my,nx2-mx);
    const x1=cam.x+(m.t%W+.5)*s, y1=cam.y+((m.t-m.t%W)/W+.5)*s;
    ctx.lineCap='round'; const N=Math.max(2,Math.floor(m.age/2));
    for(let i=1;i<=N;i++){ const a=i/N; const [ax,ay]=missilePos(m,m.age*(i-1)/N), [bx,by]=missilePos(m,m.age*i/N);
      ctx.strokeStyle=`rgba(255,200,120,${0.05+a*0.6})`; ctx.lineWidth=1+a*3; ctx.beginPath(); ctx.moveTo(cam.x+ax*s,cam.y+ay*s); ctx.lineTo(cam.x+bx*s,cam.y+by*s); ctx.stroke(); }
    ctx.save(); ctx.translate(x,y); ctx.rotate(m.cruise?Math.atan2(cam.y+((m.t-m.t%W)/W+.5)*s-y,cam.x+(m.t%W+.5)*s-x):ang); if(m.cruise) ctx.scale(0.65,0.65);
    ctx.fillStyle='rgba(255,180,80,.55)'; ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(-18,-3); ctx.lineTo(-14,0); ctx.lineTo(-18,3); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#e8ecef'; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(3,-2.5); ctx.lineTo(-6,-2.5); ctx.lineTo(-6,2.5); ctx.lineTo(3,2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#e35d5d'; ctx.beginPath(); ctx.moveTo(-6,-2.5); ctx.lineTo(-9,-5); ctx.lineTo(-6,0); ctx.lineTo(-9,5); ctx.lineTo(-6,2.5); ctx.fill();
    ctx.restore();
    ctx.strokeStyle=`rgba(255,107,107,${0.35+0.35*Math.sin(performance.now()/150)})`; ctx.lineWidth=1.5; ctx.setLineDash([6,6]); ctx.beginPath(); ctx.arc(x1,y1,(m.cruise?CRUISE.radius:NUKE_RADIUS)*s,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }
  // aircraft: patrol circles and sprites
  for(const a of aircraft){ const mine=a.owner===me.id; if(!mine&&!visAt(a.x,a.y)) continue; const px=cam.x+a.x*s,py=cam.y+a.y*s;
    if(a.type==='fighter'&&['out','patrol'].includes(a.state)&&mine){ const hl=hoverAir===a; ctx.strokeStyle=hl?'rgba(191,230,255,.95)':'rgba(191,230,255,.35)'; ctx.lineWidth=hl?2:1; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.arc(cam.x+a.tx*s,cam.y+a.ty*s,AIR.fighter.patrol*s,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
    if(a.state==='hangar'||a.state==='refuel'||a.state==='heal') continue;
    ctx.save(); ctx.translate(px,py); ctx.rotate(a.hdg); const u=Math.max(4,s*2.2)/10*(a.type==='bomber'&&a.pull?1+a.pull*0.25:1); ctx.scale(u,u); ctx.fillStyle=players[a.owner].color; ctx.strokeStyle='#fff'; ctx.lineWidth=1.1; if(a.state==='hangar'||a.state==='refuel') a.pull=0;
    if(a.type==='carrier'){ ctx.beginPath(); ctx.moveTo(11,0); ctx.lineTo(6,-3); ctx.lineTo(-8,-3); ctx.lineTo(-11,-1); ctx.lineTo(-11,1); ctx.lineTo(-8,3); ctx.lineTo(6,3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(1,-3); ctx.lineTo(-3,-11); ctx.lineTo(-7,-11); ctx.lineTo(-4,-3); ctx.moveTo(1,3); ctx.lineTo(-3,11); ctx.lineTo(-7,11); ctx.lineTo(-4,3); ctx.closePath(); }
    else if(a.type==='fighter'){ ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(1,-2); ctx.lineTo(-5,-8); ctx.lineTo(-7,-8); ctx.lineTo(-5,-2); ctx.lineTo(-9,-2); ctx.lineTo(-10,-4); ctx.lineTo(-10,4); ctx.lineTo(-9,2); ctx.lineTo(-5,2); ctx.lineTo(-7,8); ctx.lineTo(-5,8); ctx.lineTo(1,2); ctx.closePath(); }
    else { ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-2,-3); ctx.lineTo(-10,-9); ctx.lineTo(-6,-2); ctx.lineTo(-7,0); ctx.lineTo(-6,2); ctx.lineTo(-10,9); ctx.lineTo(-2,3); ctx.closePath(); }
    ctx.fill(); ctx.stroke(); ctx.restore();
    if(a.type==='fighter'&&mine){ ctx.fillStyle=a.hp<=2?'#ff9a9a':'#fff'; const r=Math.max(4,s*2.2); const pw=2*r/AIR.fighter.hp; for(let i=0;i<a.hp;i++) ctx.fillRect(px-r+i*pw,py-r*1.6,Math.max(1,pw-1),2); }
  }

  // draft picks: mini flag and pick number on every claimed province, through the draft and 25 s after
  if(draftPicks.length&&(draft||performance.now()-draftDoneAt<25000)){ const fadeA=draft?1:Math.max(0,1-(performance.now()-draftDoneAt-18000)/7000); ctx.globalAlpha=fadeA; for(const d of draftPicks){ const p=players[d.owner]; if(!p) continue; const px=cam.x+d.x*s, py=cam.y+d.y*s; const fw=Math.max(22,Math.min(40,s*6)), fh=fw*2/3; drawFlag(ctx,p.flag,px-fw/2,py-fh/2,fw,fh); ctx.strokeStyle=d.owner===me.id?'#ffd27a':'rgba(255,255,255,.7)'; ctx.lineWidth=d.owner===me.id?2.5:1.5; ctx.strokeRect(px-fw/2,py-fh/2,fw,fh);
      ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(px+fw/2,py-fh/2,Math.max(8,fw*0.32),0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#0f1a26'; ctx.lineWidth=1.5; ctx.stroke(); ctx.fillStyle='#fff'; ctx.font=`bold ${Math.max(10,fw*0.36)}px "Segoe UI",system-ui,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(d.n),px+fw/2,py-fh/2+0.5); ctx.textBaseline='alphabetic';
      if(s>=0.9){ ctx.font=`bold ${Math.max(10,Math.min(14,s*2.6))}px "Segoe UI",system-ui,sans-serif`; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=3; ctx.strokeText(d.owner===me.id?'You':p.name,px,py+fh/2+13); ctx.fillText(d.owner===me.id?'You':p.name,px,py+fh/2+13); } } ctx.globalAlpha=1; }
  // garrison counts per area
  if(START.garrison&&me.areas&&me.areas.length>1&&s>=0.9){ ctx.font='bold 12px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.lineWidth=3; for(const a of me.areas){ if(a.tiles<20&&a!==me.areas[0]) continue; const px=cam.x+a.cx*s, py=cam.y+a.cy*s+16; ctx.strokeStyle=hoverArea===a.id?'rgba(255,210,122,.9)':'rgba(0,0,0,.6)'; ctx.fillStyle='#fff'; ctx.strokeText(fmtN(a.troops)+' ⚑',px,py); ctx.fillText(fmtN(a.troops)+' ⚑',px,py); } }
  // repair trucks
  for(const tr of trucks){ if(!visAt(tr.x,tr.y)) continue; const px=cam.x+tr.x*s,py=cam.y+tr.y*s; ctx.save(); ctx.translate(px,py); ctx.rotate(tr.hdg); const u=Math.max(3.5,s*1.9)/10; ctx.scale(u,u);
    ctx.fillStyle='#0f1a26'; ctx.beginPath(); ctx.rect(-9,-4,18,8); ctx.fill(); // chassis
    ctx.fillStyle='#111'; ctx.fillRect(-7,-4.9,3,1.4); ctx.fillRect(-7,3.5,3,1.4); ctx.fillRect(4,-4.9,3,1.4); ctx.fillRect(4,3.5,3,1.4); // tyres
    ctx.fillStyle='#ffb347'; ctx.strokeStyle='#0f1a26'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.rect(-8,-3.4,11,6.8); ctx.fill(); ctx.stroke(); // bed
    ctx.fillStyle='#e8ecef'; ctx.beginPath(); ctx.rect(3.2,-3,5,6); ctx.fill(); ctx.stroke(); ctx.fillStyle='#7fb3ff'; ctx.fillRect(6.6,-2.2,1.2,4.4); // cab and windscreen
    ctx.strokeStyle='#0f1a26'; ctx.lineWidth=0.7; ctx.beginPath(); ctx.moveTo(-6.5,-1.8); ctx.lineTo(-2.5,-1.8); ctx.moveTo(-6.5,0); ctx.lineTo(-2.5,0); ctx.moveTo(-6.5,1.8); ctx.lineTo(-2.5,1.8); ctx.stroke(); // slats
    ctx.lineWidth=1.1; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-1,-2); ctx.lineTo(2,2); ctx.moveTo(-1,2); ctx.lineTo(2,-2); ctx.stroke(); // tools
    ctx.restore(); if(tr.state==='work'){ ctx.strokeStyle='#7fffa0'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px,py,Math.max(5,s*3),-Math.PI/2,-Math.PI/2+Math.PI*2*(1-Math.max(0,tr.workAt-tickN)/TRUCK.repairTicks)); ctx.stroke(); } }
  // spy planes
  for(const pl of planes){ if(pl.owner!==me.id&&!visAt(pl.x,pl.y)) continue; const px=cam.x+pl.x*s,py=cam.y+pl.y*s; if(pl.owner===me.id&&pl.phase==='orbit'){ ctx.strokeStyle='rgba(191,230,255,.5)'; ctx.setLineDash([6,6]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(cam.x+pl.tx*s,cam.y+pl.ty*s,FOG.plane.r*s,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(px,py); ctx.rotate(pl.hdg); const u=Math.max(4,s*2)/10; ctx.scale(u,u); ctx.fillStyle=players[pl.owner].color; ctx.strokeStyle='#fff'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(2,-2); ctx.lineTo(-2,-9); ctx.lineTo(-5,-9); ctx.lineTo(-4,-2); ctx.lineTo(-8,-2); ctx.lineTo(-9,-4); ctx.lineTo(-10,-4); ctx.lineTo(-10,4); ctx.lineTo(-9,4); ctx.lineTo(-8,2); ctx.lineTo(-4,2); ctx.lineTo(-5,9); ctx.lineTo(-2,9); ctx.lineTo(2,2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // interceptors
  for(const it of interceptors){ if(!visAt(it.x,it.y)) continue;
    for(let i=1;i<it.trail.length;i++){ const a=i/it.trail.length; ctx.strokeStyle=`rgba(150,220,255,${a*0.7})`; ctx.lineWidth=1+a*1.5; ctx.beginPath(); ctx.moveTo(cam.x+it.trail[i-1][0]*s,cam.y+it.trail[i-1][1]*s); ctx.lineTo(cam.x+it.trail[i][0]*s,cam.y+it.trail[i][1]*s); ctx.stroke(); }
    const last=it.trail[it.trail.length-1]||[it.x,it.y]; const ang=Math.atan2(it.y-last[1],it.x-last[0]);
    ctx.save(); ctx.translate(cam.x+it.x*s,cam.y+it.y*s); ctx.rotate(ang); ctx.fillStyle='#bfe6ff'; ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-3,-1.8); ctx.lineTo(-3,1.8); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for(const f of floaters){ f.age++; const life=f.big?80:40; ctx.globalAlpha=Math.max(0,1-f.age/life); ctx.font=`bold ${f.big?16:11}px "Segoe UI",system-ui,sans-serif`; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.fillStyle=f.col; const fx=cam.x+(f.x+.5)*s, fy=cam.y+(f.y+.5)*s-f.age*(f.big?0.9:0.6)-(f.big?4*Math.sin(f.age/6):0); ctx.strokeText(f.txt,fx,fy); ctx.fillText(f.txt,fx,fy); ctx.globalAlpha=1; }
  floaters=floaters.filter(f=>f.age<(f.big?80:40));
  // scorch marks (slow fade), capture sparks, smoke puffs, fragments, tracers, wrecks
  for(const sc of scorches){ sc.age++; if(!visAt(sc.x,sc.y)) continue; ctx.fillStyle=`rgba(10,8,6,${0.45*Math.max(0,1-sc.age/1800)})`; ctx.beginPath(); ctx.arc(cam.x+sc.x*s,cam.y+sc.y*s,sc.r*s,0,Math.PI*2); ctx.fill(); }
  scorches=scorches.filter(sc=>sc.age<1800);
  for(const sp of sparks){ sp.age++; const a=1-sp.age/6; if(a<=0) continue; ctx.globalAlpha=a; ctx.fillStyle='#fff'; ctx.fillRect(cam.x+sp.x*s,cam.y+sp.y*s,Math.max(1,s),Math.max(1,s)); }
  ctx.globalAlpha=1; sparks=sparks.filter(sp=>sp.age<6);
  for(const pf of puffs){ pf.age++; pf.x+=pf.vx; pf.y+=pf.vy; pf.r+=0.06; if(!visAt(pf.x,pf.y)) continue; ctx.fillStyle=`rgba(${pf.col},${0.5*Math.max(0,1-pf.age/pf.life)})`; ctx.beginPath(); ctx.arc(cam.x+pf.x*s,cam.y+pf.y*s,pf.r*s,0,Math.PI*2); ctx.fill(); }
  puffs=puffs.filter(pf=>pf.age<pf.life);
  for(const fr of frags){ fr.age++; fr.x+=fr.vx; fr.y+=fr.vy; if(fr.dud) fr.vy+=0.04; ctx.globalAlpha=Math.max(0,1-fr.age/fr.life); ctx.fillStyle=fr.col; if(fr.bomb){ ctx.beginPath(); ctx.arc(cam.x+fr.x*s,cam.y+fr.y*s+fr.age*s*0.4,Math.max(1,s*0.5),0,Math.PI*2); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(cam.x+fr.x*s,cam.y+fr.y*s); ctx.lineTo(cam.x+(fr.x-fr.vx*2)*s,cam.y+(fr.y-fr.vy*2)*s); ctx.strokeStyle=fr.col; ctx.lineWidth=1.5; ctx.stroke(); } }
  ctx.globalAlpha=1; frags=frags.filter(fr=>fr.age<fr.life);
  for(const tr of tracers){ tr.age++; const a=Math.max(0,1-tr.age/9); ctx.strokeStyle=`rgba(${tr.col},${a*0.7})`; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cam.x+tr.x0*s,cam.y+tr.y0*s); ctx.lineTo(cam.x+tr.x1*s,cam.y+tr.y1*s); ctx.stroke(); }
  tracers=tracers.filter(tr=>tr.age<9);
  for(const wk of wrecks){ wk.age++; if(!visAt(wk.x,wk.y)) continue; const px=cam.x+wk.x*s,py=cam.y+wk.y*s;
    if(wk.kind==='ship'){ const k=wk.age/40; ctx.globalAlpha=Math.max(0,1-k); const r=Math.max(4,s*(wk.cls==='battleship'?4:2.6)); ctx.save(); ctx.translate(px,py); ctx.rotate(wk.hdg+wk.spin*wk.age); ctx.scale(1,Math.max(0.2,1-k*0.6)); ctx.translate(-px,-py); drawShip(wk.cls==='trader'||wk.cls==='transport'?'transport':wk.cls,px,py,0,r,wk.col,null,null); ctx.restore(); ctx.globalAlpha=1; ctx.strokeStyle=`rgba(230,240,255,${0.6*Math.max(0,1-k)})`; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(px,py,r*(0.8+k*2.2),0,Math.PI*2); ctx.stroke(); }
    else if(wk.kind==='air'){ const k=wk.age/30; ctx.globalAlpha=Math.max(0,1-k); ctx.save(); ctx.translate(px+Math.cos(wk.hdg)*wk.age*s*0.35,py+Math.sin(wk.hdg)*wk.age*s*0.35+wk.age*s*0.25); ctx.rotate(wk.hdg+wk.age*0.3); const u=Math.max(4,s*2.2)/10*(1-k*0.4); ctx.scale(u,u); ctx.fillStyle=wk.col; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-6,-7); ctx.lineTo(-4,0); ctx.lineTo(-6,7); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha=1; if(wk.age%3===0) puffs.push({x:wk.x+Math.cos(wk.hdg)*wk.age*0.35,y:wk.y+Math.sin(wk.hdg)*wk.age*0.35+wk.age*0.25,vx:0,vy:-0.05,r:1,age:0,life:25,col:'70,70,70'}); }
    else if(wk.kind==='dome'){ const k=wk.age/25; ctx.strokeStyle=`rgba(150,220,255,${0.8*Math.max(0,1-k)})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px,py,wk.r*s*(1-k),0,Math.PI*2); ctx.stroke(); } }
  wrecks=wrecks.filter(wk=>wk.age<(wk.kind==='ship'?40:wk.kind==='air'?30:25));
  for(const f of flashes){ f.age++; ctx.globalAlpha=Math.max(0,1-f.age/25); ctx.fillStyle=f.col; ctx.beginPath(); ctx.arc(cam.x+(f.x+.5)*s,cam.y+(f.y+.5)*s,f.r*s*(0.5+f.age/25),0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
  flashes=flashes.filter(f=>f.age<25);
  // nation labels
  if(s>=1){
    ctx.font='bold 12px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.fillStyle='#fff';
    for(const p of players){ if(!p.alive||p.tiles<200||draft) continue; const c0=p.labelPos||centroid(p); if(!p.labelDraw) p.labelDraw=[c0[0],c0[1]]; p.labelDraw[0]+=(c0[0]-p.labelDraw[0])*0.08; p.labelDraw[1]+=(c0[1]-p.labelDraw[1])*0.08; const c=p.labelDraw; const x=cam.x+c[0]*s,y=cam.y+c[1]*s;
      const fs=Math.min(46,Math.max(12,12+Math.sqrt(p.tiles)/6)); // label grows with territory
      const big=fs>22; ctx.globalAlpha=big?Math.max(0.45,1-(fs-22)/40):1;
      ctx.font=`bold ${fs}px "Segoe UI",system-ui,sans-serif`;
      if(p.kind==='neutral'){ ctx.globalAlpha=1; if(s<1.2) continue; ctx.font='11px "Segoe UI",system-ui,sans-serif'; ctx.fillStyle='rgba(255,255,255,.8)'; ctx.strokeText(p.name,x,y); ctx.fillText(p.name,x,y); ctx.fillStyle='#fff'; ctx.font='bold 12px "Segoe UI",system-ui,sans-serif'; continue; }
      ctx.lineWidth=Math.max(3,fs/4); ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.strokeText(p.name,x,y); ctx.lineWidth=Math.max(1.5,fs/9); ctx.strokeStyle=p.color; ctx.strokeText(p.name,x,y); ctx.fillStyle='#fff'; ctx.fillText(p.name,x,y); ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3;
      { const tw=ctx.measureText(p.name).width; const ch=Math.max(6,fs*0.45); ctx.fillStyle=p.color; ctx.fillRect(x-tw/2-ch-6,y-ch*0.9,ch,ch); ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=1; ctx.strokeRect(x-tw/2-ch-6,y-ch*0.9,ch,ch); ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3; } ctx.font=`${Math.round(fs*0.85)}px "Segoe UI",system-ui,sans-serif`; const tv=knownTroops(p); ctx.strokeText(tv,x,y+fs*1.05); ctx.fillText(tv,x,y+fs*1.05); ctx.font='bold 12px "Segoe UI",system-ui,sans-serif'; ctx.lineWidth=3;
      const fw=Math.max(14,Math.min(90,fs*2.4)), fh=fw*2/3; drawFlag(ctx,p.flag,x-fw/2,y-fh-fs*0.9-4,fw,fh);
      { const rl2=relation(me,p); const top=y-fh-fs*0.9-4; const br=Math.max(9,Math.min(22,fs*0.55));
        if(p!==me&&rl2&&rl2.type==='ally'){ const fresh=p.handshake&&p.handshake>tickN; const k=fresh?1+0.35*Math.abs(Math.sin(performance.now()/180)):1; ctx.globalAlpha=1; drawHandshake(ctx,x+fw/2+br*0.9,top+br*0.2,br*k); }
        if(p.heartbreak&&p.heartbreak>tickN){ const f=(p.heartbreak-tickN)/150; ctx.globalAlpha=Math.min(1,f*1.6); drawBrokenHeart(ctx,x,top-br*1.4-(1-f)*18,br*1.15); ctx.globalAlpha=big?Math.max(0.45,1-(fs-22)/40):1; } } const rl=relation(me,p); if(p.team!=null){ ctx.strokeStyle=TEAM_COLS[p.team]; ctx.lineWidth=2; ctx.strokeRect(x-fw/2-2,y-fh-fs*0.9-6,fw+4,fh+4); }
      if(rl&&p!==me&&!rl.team){ ctx.fillStyle=rl.type==='ally'?'#7fd0ff':'#bde5b8'; ctx.font='bold 10px "Segoe UI",system-ui,sans-serif'; ctx.strokeText(rl.type==='ally'?'ALLY':'PACT',x,y+fs*1.05+13); ctx.fillText(rl.type==='ally'?'ALLY':'PACT',x,y+fs*1.05+13); ctx.fillStyle='#fff'; ctx.font='bold 12px "Segoe UI",system-ui,sans-serif'; }
      ctx.globalAlpha=1; }
  }
  // "you are here" ring for the opening seconds
  const age=(performance.now()-startTime)/1000;
  if(age<12&&me.alive){ const c=centroid(me); const x=cam.x+c[0]*s,y=cam.y+c[1]*s; const r=(22+6*Math.sin(performance.now()/200))*s;
    ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.setLineDash([10,6]); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.font='bold 16px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.fillStyle='#fff';
    ctx.strokeText('You start here',x,y-r-10); ctx.fillText('You start here',x,y-r-10); }
  // landmass names when zoomed out
  if(s<1.6){ ctx.font='italic 13px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,.45)';
    for(const r of regions){ if(r.size<600) continue; ctx.fillText(r.name,cam.x+r.cx*s,cam.y+r.cy*s+18); } }
  // hovering any SAM (site or ship) lights up that nation's whole air-defense network
  { const st=hoverStruct&&hoverStruct.type==='sam'?hoverStruct:null; const hw=hoverShip&&SHIPS[hoverShip.cls].sam?hoverShip:null;
    const own=st?st.owner:hw?hw.owner:-1;
    if(own>=0&&(own===me.id||relation(me,players[own])?.type==='ally')){ const mine=own===me.id; const col=mine?'150,220,255':'190,229,184';
      const disc=(x,y,R,dead,strong)=>{ ctx.fillStyle=`rgba(${dead?'255,120,120':col},${strong?.14:.07})`; ctx.strokeStyle=`rgba(${dead?'255,120,120':col},${strong?.9:.5})`; ctx.lineWidth=strong?1.5:1; ctx.beginPath(); ctx.arc(x,y,R*s,0,Math.PI*2); ctx.fill(); ctx.stroke(); };
      for(const q of structures){ if(q.type!=='sam'||q.owner!==own||(!mine&&vis&&!vis[q.t])) continue; disc(cam.x+(q.t%W+.5)*s,cam.y+((q.t-q.t%W)/W+.5)*s,SAM_RANGE,shelled[q.t]>tickN,q===st); }
      for(const w of warships){ const S=SHIPS[w.cls]; if(!S.sam||w.owner!==own||w.x==null||(!mine&&!visAt(w.x,w.y))) continue; disc(cam.x+w.x*s,cam.y+w.y*s,S.sam,false,w===hw); }
      const lx=st?cam.x+(st.t%W+.5)*s:cam.x+hw.x*s, ly=st?cam.y+((st.t-st.t%W)/W+.5)*s:cam.y+hw.y*s, R=st?SAM_RANGE:SHIPS[hw.cls].sam;
      const sites=structures.filter(q=>q.type==='sam'&&q.owner===own&&(mine||!vis||vis[q.t])).length, ships=warships.filter(w=>SHIPS[w.cls].sam&&w.owner===own&&(mine||visAt(w.x,w.y))).length;
      ctx.font='11px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3;
      const lbl=`${players[own].name} air defense · ${sites} ${mine||!vis?'':'known '}site${sites!==1?'s':''}, ${ships} ship${ships!==1?'s':''}${st&&shelled[st.t]>tickN?' · this one knocked out':st&&st.cool>tickN?' · reloading':''}`;
      ctx.strokeText(lbl,lx,ly-R*s-6); ctx.fillText(lbl,lx,ly-R*s-6); } }
  if(ROLL.on){ drawCredits(); if(!window.__STATEFALL_TEST_FREEZE__) requestAnimationFrame(render); return; }
  for(const na of nukeAlerts){ na.age++; const al=Math.min(1,(na.life-na.age)/20); const blink=0.5+0.5*Math.sin(na.age*0.5); const p=players[na.owner];
    const fx=cam.x+na.from[0]*s, fy=cam.y+na.from[1]*s; const onS=fx>=0&&fy>=0&&fx<=cv.width&&fy<=cv.height;
    ctx.save(); ctx.globalAlpha=al;
    if(onS){ ctx.strokeStyle=`rgba(255,80,80,${0.4+0.6*blink})`; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(fx,fy,Math.max(10,s*8)*(1+0.3*blink),0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(fx,fy,Math.max(18,s*16),0,Math.PI*2); ctx.stroke(); }
    else { const cx=cv.width/2, cy=cv.height/2; const ang=Math.atan2(fy-cy,fx-cx); const m=40; const ex=Math.max(m,Math.min(cv.width-m,cx+Math.cos(ang)*cv.width)), ey=Math.max(m,Math.min(cv.height-m,cy+Math.sin(ang)*cv.height));
      ctx.translate(ex,ey); ctx.rotate(ang); ctx.fillStyle=`rgba(255,80,80,${0.5+0.5*blink})`; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-10,-14); ctx.lineTo(-4,0); ctx.lineTo(-10,14); ctx.closePath(); ctx.fill(); ctx.strokeStyle='#0f1a26'; ctx.lineWidth=2; ctx.stroke(); ctx.rotate(-ang); ctx.font='bold 12px \"Segoe UI\",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=3; ctx.strokeText(p.name,0,30); ctx.fillText(p.name,0,30); }
    ctx.restore();
    if(na.age<=1||na.age%60===0){ /* nothing */ }
    // card at the top of the screen
    { const W2=Math.min(cv.width-40,520), H2=54; const cx=cv.width/2, cy=40; ctx.save(); ctx.globalAlpha=al; ctx.fillStyle='rgba(60,10,10,.92)'; ctx.strokeStyle=`rgba(255,80,80,${0.5+0.5*blink})`; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect?ctx.roundRect(cx-W2/2,cy-H2/2,W2,H2,10):ctx.rect(cx-W2/2,cy-H2/2,W2,H2); ctx.fill(); ctx.stroke();
      drawFlag(ctx,p.flag,cx-W2/2+14,cy-14,42,28); ctx.font='bold 20px \"Segoe UI\",system-ui,sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.fillText(`NUKED BY ${p.name.toUpperCase()}`,cx-W2/2+70,cy+7); ctx.restore(); } }
  nukeAlerts=nukeAlerts.filter(na=>na.age<na.life);
  if(songBanner){ const b=songBanner; b.age++; const al=Math.min(1,b.age/8,Math.max(0,(b.life-b.age)/15)); ctx.save(); ctx.globalAlpha=al; ctx.font='500 15px "Segoe UI",system-ui,sans-serif'; const txt='♪  Now playing: '+b.title; const tw=ctx.measureText(txt).width; const bw=tw+40,bh=40,bx=cv.width/2-bw/2,by=cv.height*0.14; ctx.fillStyle='rgba(15,26,38,.9)'; ctx.strokeStyle='rgba(127,179,255,.6)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect?ctx.roundRect(bx,by,bw,bh,10):ctx.rect(bx,by,bw,bh); ctx.fill(); ctx.stroke(); ctx.fillStyle='#e8ecef'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,cv.width/2,by+bh/2); ctx.textBaseline='alphabetic'; ctx.restore(); if(b.age>=b.life) songBanner=null; }
  { const live=badges.filter(b=>b.age>0); const cur=live[0]; if(!cur||cur.age>=cur.life-25){ const nxt=badges.find(b=>b.age===0); if(nxt){ nxt.age=1; if(nxt.snd) snd(nxt.snd); } } }
  for(const b of badges){ if(b.age===0) continue; b.age++; const inA=Math.min(1,b.age/12), outA=Math.min(1,(b.life-b.age)/25); const al=Math.min(inA,outA); const ease=1-Math.pow(1-inA,3);
    const cx=cv.width/2, cy=cv.height*0.36; const W2=Math.min(cv.width-40,680); const fw=84,fh=56; const textX=-W2/2+22+fw+18, textW=W2/2-22-(b.kflag?54:0)-textX-8;
    ctx.save(); ctx.font='500 17px \"Segoe UI\",system-ui,sans-serif'; const words=((b.kind==='unify'?'UNIFIED — ':'FALLEN — ')+b.sub).split(' '); const lines=[]; let cur=''; for(const w of words){ const t=cur?cur+' '+w:w; if(ctx.measureText(t).width>textW&&cur){ lines.push(cur); cur=w; } else cur=t; } if(cur) lines.push(cur); ctx.restore();
    const H2=Math.max(112,70+lines.length*22); ctx.save(); ctx.globalAlpha=al; ctx.translate(cx,cy); ctx.scale(0.9+0.1*ease,0.9+0.1*ease);
    ctx.fillStyle='rgba(15,26,38,.94)'; ctx.strokeStyle=b.col; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect?ctx.roundRect(-W2/2,-H2/2,W2,H2,14):ctx.rect(-W2/2,-H2/2,W2,H2); ctx.fill(); ctx.stroke();
    const unify=b.kind==='unify'; ctx.fillStyle=unify?'rgba(255,210,122,.95)':'rgba(227,93,93,.9)'; ctx.fillRect(-W2/2,-H2/2,W2,6);
    drawFlag(ctx,b.flag,-W2/2+22,-fh/2,fw,fh); ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=1; ctx.strokeRect(-W2/2+22,-fh/2,fw,fh);
    if(!unify){ ctx.strokeStyle='rgba(227,93,93,.95)'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-W2/2+22,-fh/2); ctx.lineTo(-W2/2+22+fw,fh/2); ctx.moveTo(-W2/2+22+fw,-fh/2); ctx.lineTo(-W2/2+22,fh/2); ctx.stroke(); }
    else { ctx.strokeStyle='rgba(255,210,122,.95)'; ctx.lineWidth=3; ctx.strokeRect(-W2/2+20,-fh/2-2,fw+4,fh+4); }
    ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='bold 30px \"Segoe UI\",system-ui,sans-serif'; const top=-H2/2+42; ctx.fillText(b.text.toUpperCase(),textX,top); ctx.font='500 17px \"Segoe UI\",system-ui,sans-serif'; ctx.fillStyle=unify?'#ffd27a':'#bfd0e2'; lines.forEach((ln,i)=>ctx.fillText(ln,textX,top+30+i*22));
    if(b.kflag){ drawFlag(ctx,b.kflag,W2/2-22-42,-14,42,28); ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=1; ctx.strokeRect(W2/2-22-42,-14,42,28); } ctx.restore(); }
  badges=badges.filter(b=>b.age<b.life);
  if(pickMode&&hover>=0&&owner[hover]===me.id&&areaOf){ const a=areaAt(hover); if(a){ ctx.font='bold 14px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.fillStyle='#ffd27a'; const px=cam.x+a.cx*s, py=cam.y+a.cy*s-10; const txt=`send ${fmtN(a.troops*ratio.value/100)} of ${fmtN(a.troops)}`; ctx.strokeText(txt,px,py); ctx.fillText(txt,px,py); } }
  if(box){ ctx.strokeStyle='#fff'; ctx.fillStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; const bx=Math.min(box.x0,box.x1),by=Math.min(box.y0,box.y1),bw=Math.abs(box.x1-box.x0),bh=Math.abs(box.y1-box.y0); ctx.fillRect(bx,by,bw,bh); ctx.strokeRect(bx,by,bw,bh); }
  if(draft){ const p=draft.order[draft.idx]; ctx.fillStyle='rgba(10,20,30,.55)'; ctx.fillRect(0,0,cw,44); ctx.font='bold 16px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText(p===me?`Your pick — click a neutral country (flags mark what's taken) (round ${draft.round+1} of ${draft.per})`:`${p.name} is picking… (round ${draft.round+1} of ${draft.per})`,cw/2,28); }
  if(userPaused){ ctx.fillStyle='rgba(10,20,30,.35)'; ctx.fillRect(0,0,cw,ch); ctx.font='bold 28px "Segoe UI",system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText('Paused',cw/2,ch/2); ctx.font='13px "Segoe UI",system-ui,sans-serif'; ctx.fillStyle='rgba(255,255,255,.7)'; ctx.fillText('Space to resume',cw/2,ch/2+24); }
  // build cursor
  if(buildMode&&hover>=0){ const ht=buildMode!=='nuke'?(snapBuild(me,hover,buildMode)>=0?snapBuild(me,hover,buildMode):hover):hover; const x=ht%W,y=(ht-x)/W; ctx.strokeStyle=canBuildAt(hover)?'#7fffa0':'#ff6b6b'; ctx.lineWidth=2; ctx.strokeRect(cam.x+x*s-2,cam.y+y*s-2,s+4,s+4); }
  if(!window.__STATEFALL_TEST_FREEZE__) requestAnimationFrame(render);
}
const centCache={}; let highlightId=-1;
function computeLabelPos(){ // largest connected chunk of each nation; label goes on its own land there
  const seen=new Uint8Array(W*H), q=new Int32Array(W*H); const best={};
  for(let t0=0;t0<W*H;t0++){ const o=owner[t0]; if(o<0||seen[t0]) continue; let h=0,tl=0; q[tl++]=t0; seen[t0]=1; let n=0,sx=0,sy=0;
    while(h<tl){ const c=q[h++]; n++; sx+=c%W; sy+=(c-c%W)/W; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const m=idx(x+dx,y+dy); if(!seen[m]&&owner[m]===o){ seen[m]=1; q[tl++]=m; } } }
    if(!best[o]||n>best[o].n) best[o]={n,x:sx/n,y:sy/n}; }
  for(const p of players){ const b=best[p.id]; if(!b){ delete p.labelPos; continue; } let lx=Math.round(b.x), ly=Math.round(b.y);
    if(!inb(lx,ly)||owner[idx(lx,ly)]!==p.id){ let found=false; for(let r=1;r<=60&&!found;r++){ for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++){ if(Math.abs(dx)!==r&&Math.abs(dy)!==r) continue; const X=lx+dx,Y=ly+dy; if(inb(X,Y)&&owner[idx(X,Y)]===p.id){ lx=X; ly=Y; found=true; break; } } } }
    p.labelPos=[lx+.5,ly+.5]; }
}
function centroid(p){
  if(tickN%20!==0&&centCache[p.id]) return centCache[p.id];
  let sx=0,sy=0,n=0; for(let t=0;t<W*H;t+=7) if(owner[t]===p.id){sx+=t%W;sy+=(t-t%W)/W;n++;}
  const c=n?[sx/n+.5,sy/n+.5]:[p.sx,p.sy]; centCache[p.id]=c; return c;
}

function drawIcon(type,x,y,r,col,c=ctx){
  c.save(); c.translate(x,y);
  c.fillStyle='#0f1a26'; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill();
  c.strokeStyle=col; c.lineWidth=Math.max(1.5,r*0.18); c.stroke();
  const u=r/10; c.scale(u,u); c.lineWidth=1.3; c.strokeStyle='#fff'; c.fillStyle='#fff'; c.lineJoin='round'; c.lineCap='round';
  if(type==='city'){
    c.fillRect(-6,-1,3.5,7); c.fillRect(-2,-5,3.5,11); c.fillRect(2.5,-2.5,3.5,8.5);
    c.fillStyle='#0f1a26'; for(const [bx,by] of [[-5,0],[-5,2],[-1,-4],[-1,-2],[-1,0],[-1,2],[3.5,-1.5],[3.5,0.5]]) c.fillRect(bx,by,1.2,1);
  } else if(type==='factory'){
    c.beginPath(); c.moveTo(-6,5); c.lineTo(-6,-1); c.lineTo(-2.5,-3.5); c.lineTo(-2.5,-1); c.lineTo(1,-3.5); c.lineTo(1,-1); c.lineTo(4.5,-3.5); c.lineTo(4.5,5); c.closePath(); c.fill();
    c.fillRect(2.5,-6.5,1.6,4); c.globalAlpha=.7; c.beginPath(); c.arc(3.3,-7.8,1,0,6.3); c.arc(4.6,-9,1.1,0,6.3); c.fill(); c.globalAlpha=1;
  } else if(type==='port'){
    c.beginPath(); c.arc(0,-5,1.6,0,Math.PI*2); c.stroke();
    c.beginPath(); c.moveTo(0,-3.4); c.lineTo(0,6); c.moveTo(-3,-1.5); c.lineTo(3,-1.5); c.stroke();
    c.beginPath(); c.arc(0,1.5,5,0.25*Math.PI,0.75*Math.PI); c.stroke();
    c.beginPath(); c.moveTo(-5.5,3.5); c.lineTo(-3.6,5.2); c.moveTo(5.5,3.5); c.lineTo(3.6,5.2); c.stroke();
  } else if(type==='sam'){
    c.beginPath(); c.arc(0,1,5.5,Math.PI*1.15,Math.PI*1.85); c.stroke();
    c.beginPath(); c.moveTo(0,-1); c.lineTo(0,3); c.moveTo(-3.5,6); c.lineTo(3.5,6); c.lineTo(0,3); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(-1.5,-6.5); c.lineTo(-0.5,-2.5); c.moveTo(1.5,-6.5); c.lineTo(0.5,-2.5); c.stroke();
  } else if(type==='silo'){
    c.beginPath(); c.moveTo(0,-7); c.quadraticCurveTo(3,-3,3,2); c.lineTo(3,4); c.lineTo(-3,4); c.lineTo(-3,2); c.quadraticCurveTo(-3,-3,0,-7); c.fill();
    c.beginPath(); c.moveTo(-3,2); c.lineTo(-5.5,5.5); c.lineTo(-3,4.5); c.moveTo(3,2); c.lineTo(5.5,5.5); c.lineTo(3,4.5); c.fill();
    c.fillStyle='#0f1a26'; c.beginPath(); c.arc(0,-1,1.2,0,6.3); c.fill(); c.fillStyle='#ffb347'; c.beginPath(); c.moveTo(-1.5,4.5); c.lineTo(0,7.5); c.lineTo(1.5,4.5); c.fill();
  } else if(type==='shield'){ // emitter under a dome arc
    c.beginPath(); c.arc(0,2,7.5,Math.PI,0); c.stroke(); c.beginPath(); c.arc(0,2,5,Math.PI,0); c.stroke(); c.fillRect(-3,2,6,4); c.fillRect(-1,-1,2,3);
  } else if(type==='battery'){ // long barrel on a mount
    c.fillRect(-6,2,12,4); c.beginPath(); c.arc(-1,2,3.5,Math.PI,0); c.fill(); c.strokeStyle='#fff'; c.lineWidth=2.2; c.beginPath(); c.moveTo(-1,0); c.lineTo(8,-6); c.stroke();
  } else if(type==='shore'){ // twin short barrels
    c.fillRect(-6,3,12,3); c.beginPath(); c.arc(0,2,4,Math.PI,0); c.fill(); c.strokeStyle='#fff'; c.lineWidth=1.6; c.beginPath(); c.moveTo(-1,-1); c.lineTo(6,-5); c.moveTo(1,0.5); c.lineTo(8,-3.5); c.stroke();
  } else if(type==='bertha'){ // huge howitzer
    c.fillRect(-7,3,14,3); c.beginPath(); c.arc(-2,3,4.5,Math.PI,0); c.fill(); c.strokeStyle='#fff'; c.lineWidth=3.2; c.beginPath(); c.moveTo(-2,0); c.lineTo(6,-8); c.stroke(); c.strokeStyle='#ffb347'; c.lineWidth=1.2; c.beginPath(); c.arc(7,-9,1.6,0,Math.PI*2); c.stroke();
  } else if(type==='radar'||type==='lradar'){
    c.beginPath(); c.moveTo(0,7); c.lineTo(0,-1); c.stroke(); c.fillRect(-4,5,8,2);
    c.beginPath(); c.arc(0,-2.5,type==='lradar'?6:4.5,Math.PI*1.15,Math.PI*1.85); c.stroke(); c.beginPath(); c.moveTo(-2,-1); c.lineTo(2,-1); c.stroke();
    if(type==='lradar'){ c.beginPath(); c.arc(0,-2.5,8.5,Math.PI*1.25,Math.PI*1.75); c.stroke(); }
  } else if(type==='engcmd'){
    c.fillRect(-7,1,10,4); c.fillRect(3,2,4,3); c.fillStyle='#0f1a26'; c.beginPath(); c.arc(-4,5.5,1.5,0,6.3); c.arc(4,5.5,1.5,0,6.3); c.fill(); c.strokeStyle='#ffb347'; c.lineWidth=1.6; c.beginPath(); c.moveTo(-4,-1); c.lineTo(3,-8); c.stroke(); c.beginPath(); c.arc(4,-8.5,2,Math.PI*0.6,Math.PI*1.9); c.stroke(); c.strokeStyle='#fff';
  } else if(type==='troopcmd'){ // barracks with a star
    c.fillRect(-7,-1,14,7); c.fillStyle='#0f1a26'; for(let i=-5;i<=3;i+=4) c.fillRect(i,1,2,2); c.fillStyle='#fff'; c.beginPath(); for(let i=0;i<10;i++){ const ang=-Math.PI/2+i*Math.PI/5, rr=i%2?1.6:3.6; c.lineTo(Math.cos(ang)*rr,-5+Math.sin(ang)*rr); } c.closePath(); c.fill();
  } else if(type==='subbase'){ // pen with a sub silhouette
    c.beginPath(); c.arc(0,2,7,Math.PI,0); c.stroke(); c.fillRect(-7,2,14,2); c.fillStyle='#0f1a26'; c.fillRect(-5,-2,10,3); c.fillStyle='#fff'; c.beginPath(); c.moveTo(-5,-1); c.lineTo(3,-1); c.lineTo(5,0); c.lineTo(3,1.5); c.lineTo(-5,1.5); c.closePath(); c.fill(); c.fillRect(-1,-3.5,2,2.5);
  } else if(type==='airfield'){
    c.fillStyle='#e8ecef'; c.save(); c.rotate(-0.6); c.fillRect(-8,-1.5,16,3); c.restore(); c.fillStyle='#0f1a26'; c.save(); c.rotate(-0.6); for(let i=-6;i<=6;i+=3) c.fillRect(i,-0.4,1.5,0.8); c.restore();
    c.fillStyle='#ffb347'; c.beginPath(); c.moveTo(4,-5); c.lineTo(1,-3); c.lineTo(-1,-6); c.lineTo(-2,-6); c.lineTo(-1,-3); c.lineTo(-3,-3); c.lineTo(-4,-4); c.lineTo(-4,-1); c.lineTo(1,-1); c.lineTo(4,-3); c.closePath(); c.fill();
  } else if(type==='flightops'){
    c.fillRect(-1.5,-2,3,8); c.fillRect(-5,-5,10,4); c.fillStyle='#0f1a26'; c.fillRect(-3,-4,2,2); c.fillRect(1,-4,2,2); c.fillStyle='#ffb347'; c.beginPath(); c.arc(0,-7,1.5,0,Math.PI*2); c.fill(); c.strokeStyle='#ffb347'; c.beginPath(); c.moveTo(2,-7); c.lineTo(7,-9); c.stroke(); c.strokeStyle='#fff';
  } else if(type==='jammer'){ // mast with spreading interference arcs and a bar across
    c.beginPath(); c.moveTo(0,7); c.lineTo(0,-3); c.stroke(); c.fillRect(-4,5,8,2);
    c.strokeStyle='#ffb347'; c.beginPath(); c.arc(0,-3,3,Math.PI*1.1,Math.PI*1.9); c.arc(0,-3,6,Math.PI*1.2,Math.PI*1.8); c.stroke(); c.beginPath(); c.moveTo(-6,-6); c.lineTo(6,0); c.stroke(); c.strokeStyle='#fff';
  } else if(type==='satellite'){
    c.fillRect(-1.5,-7,3,11); c.beginPath(); c.moveTo(-1.5,-7); c.lineTo(0,-9.5); c.lineTo(1.5,-7); c.fill();
    c.beginPath(); c.moveTo(3,-8); c.lineTo(3,6); c.moveTo(3,-8); c.lineTo(1.5,-5); c.moveTo(3,-1); c.lineTo(1.5,1); c.stroke(); c.fillRect(-6,4,12,2);
  } else if(type==='command'){ // radar dome with antenna and a target reticle
    c.beginPath(); c.arc(0,1,5.5,Math.PI,0); c.fill(); c.fillRect(-6,1,12,3);
    c.strokeStyle='#ffb347'; c.lineWidth=1.2; c.beginPath(); c.arc(0,-2.5,2.4,0,Math.PI*2); c.moveTo(-4,-2.5); c.lineTo(4,-2.5); c.moveTo(0,-6.5); c.lineTo(0,1.5); c.stroke(); c.strokeStyle='#fff';
  } else if(type==='fort'){ // star redoubt with a central keep
    c.beginPath(); for(let i=0;i<8;i++){ const ang=-Math.PI/2+i*Math.PI/4, rr=i%2?4.2:7.2; c.lineTo(Math.cos(ang)*rr,Math.sin(ang)*rr); } c.closePath(); c.fill();
    c.fillStyle='#0f1a26'; c.fillRect(-2,-2,4,4); c.fillStyle='#fff'; c.fillRect(-1,-1,2,2);
  }
  c.restore();
}
function drawHandshake(c,x,y,r){ // sleeves and two clasped hands
  c.save(); c.translate(x,y); const u=r/10; c.scale(u,u); c.lineJoin='round'; c.lineCap='round';
  c.fillStyle='#0f1a26'; c.beginPath(); c.arc(0,0,11,0,Math.PI*2); c.fill(); c.strokeStyle='#7fd0ff'; c.lineWidth=1.6; c.stroke();
  c.fillStyle='#7fb3ff'; c.fillRect(-10.5,-1,4.5,4); c.fillRect(6,-5,4.5,4);
  c.fillStyle='#f2d3b3'; c.beginPath(); c.moveTo(-6.5,-4); c.lineTo(-1,-4); c.lineTo(1,-1.5); c.lineTo(-1,2); c.lineTo(-6.5,2); c.closePath(); c.fill();
  c.fillStyle='#e8c29c'; c.beginPath(); c.moveTo(6.5,4); c.lineTo(1,4); c.lineTo(-1,1.5); c.lineTo(1,-2); c.lineTo(6.5,-2); c.closePath(); c.fill();
  c.strokeStyle='#b08a63'; c.lineWidth=0.8; c.beginPath(); c.moveTo(-4.5,-1); c.lineTo(-1,-1); c.moveTo(-4.5,0.5); c.lineTo(-1,0.5); c.stroke();
  c.strokeStyle='#a37a55'; c.beginPath(); c.moveTo(4.5,1); c.lineTo(1,1); c.moveTo(4.5,2.5); c.lineTo(1,2.5); c.stroke();
  c.restore(); }
function drawBrokenHeart(c,x,y,r){ c.save(); c.translate(x,y); const u=r/10; c.scale(u,u); c.lineJoin='round';
  c.fillStyle='#0f1a26'; c.beginPath(); c.arc(0,0,11,0,Math.PI*2); c.fill(); c.strokeStyle='#e35d5d'; c.lineWidth=1.6; c.stroke();
  c.fillStyle='#e35d5d'; c.beginPath(); c.moveTo(0,7); c.bezierCurveTo(-9,0,-8,-8,-3,-7); c.bezierCurveTo(-1,-7,0,-5,0,-4); c.bezierCurveTo(0,-5,1,-7,3,-7); c.bezierCurveTo(8,-8,9,0,0,7); c.closePath(); c.fill();
  c.strokeStyle='#0f1a26'; c.lineWidth=1.8; c.lineCap='round'; c.beginPath(); c.moveTo(0,-4); c.lineTo(-2,-1); c.lineTo(1,2); c.lineTo(-1,5); c.stroke(); // crack
  c.restore(); }
function drawWake(sh,s){ if(sh.wake.length<2) return; ctx.lineCap='round'; const sp=sh.cls&&SHIPS[sh.cls]?SHIPS[sh.cls].speed:1.3; const bow=0.7+Math.min(1.6,sp/1.6); for(let i=1;i<sh.wake.length;i++){ const a=i/sh.wake.length; ctx.strokeStyle=`rgba(200,230,255,${a*0.45*Math.min(1,bow)})`; ctx.lineWidth=(Math.max(1,s*0.8)*(1-a*0.5)+a*Math.max(1,s*1.6))*bow; ctx.beginPath(); ctx.moveTo(cam.x+sh.wake[i-1][0]*s,cam.y+sh.wake[i-1][1]*s); ctx.lineTo(cam.x+sh.wake[i][0]*s,cam.y+sh.wake[i][1]*s); ctx.stroke(); } }
function drawShip(kind,x,y,hdg,r,col,hp,maxhp,c=ctx){
  c.save(); c.translate(x,y); c.rotate(hdg); const u=r/10; c.scale(u,u);
  c.lineJoin='round'; c.lineWidth=1.2; c.strokeStyle='#fff';
  if(kind==='warship'){
    c.fillStyle=col; c.beginPath(); c.moveTo(12,0); c.lineTo(5,-3.5); c.lineTo(-9,-3.5); c.lineTo(-11,-2); c.lineTo(-11,2); c.lineTo(-9,3.5); c.lineTo(5,3.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#e8ecef'; c.fillRect(-5,-2,7,4); c.fillRect(-1,-1.2,2.5,2.4);
    c.strokeStyle='#e8ecef'; c.lineWidth=1.4; c.beginPath(); c.moveTo(5,0); c.lineTo(9.5,0); c.stroke();
    c.fillStyle='#0f1a26'; c.fillRect(-8,-1,2,2);
  } else if(kind==='privateer'){ c.fillStyle='#3a2f2a'; c.beginPath(); c.moveTo(10,0); c.lineTo(4,-3); c.lineTo(-8,-3); c.lineTo(-9,0); c.lineTo(-8,3); c.lineTo(4,3); c.closePath(); c.fill(); c.strokeStyle=col; c.lineWidth=1.4; c.stroke(); c.fillStyle='#e8ecef'; c.beginPath(); c.moveTo(-2,-1.5); c.lineTo(-2,-8); c.lineTo(3,-3.5); c.closePath(); c.fill(); c.fillStyle='#111'; c.fillRect(-4,-1,3,2);
  } else if(kind==='sub'||kind==='hunter'){ c.fillStyle=col; c.beginPath(); c.moveTo(9,0); c.lineTo(5,-2.2); c.lineTo(-7,-2.2); c.lineTo(-9,0); c.lineTo(-7,2.2); c.lineTo(5,2.2); c.closePath(); c.fill(); c.stroke(); c.fillStyle='#e8ecef'; c.fillRect(-2,-4.5,3,2.5); if(kind==='hunter'){ c.strokeStyle='#e8ecef'; c.beginPath(); c.arc(-0.5,-5.5,2,Math.PI*1.1,Math.PI*1.9); c.stroke(); }
  } else if(kind==='rship'){ c.fillStyle=col; c.beginPath(); c.moveTo(9,0); c.lineTo(3,-3); c.lineTo(-8,-3); c.lineTo(-9,0); c.lineTo(-8,3); c.lineTo(3,3); c.closePath(); c.fill(); c.stroke(); c.fillStyle='#e8ecef'; c.fillRect(-4,-1.5,4,3); c.strokeStyle='#e8ecef'; c.beginPath(); c.arc(-1,-4,3,Math.PI*1.1,Math.PI*1.9); c.moveTo(-1,-4); c.lineTo(-1,-1.5); c.stroke();
  } else if(kind==='scout'){ c.fillStyle=col; c.beginPath(); c.moveTo(9,0); c.lineTo(3,-2.2); c.lineTo(-7,-2.2); c.lineTo(-8,0); c.lineTo(-7,2.2); c.lineTo(3,2.2); c.closePath(); c.fill(); c.stroke(); c.fillStyle='#e8ecef'; c.fillRect(-3,-1.3,4,2.6);
  } else if(kind==='cruiser'){ // longer hull, box launchers amidships, radar mast
    c.fillStyle=col; c.beginPath(); c.moveTo(13,0); c.lineTo(6,-3.2); c.lineTo(-10,-3.2); c.lineTo(-12,-1.5); c.lineTo(-12,1.5); c.lineTo(-10,3.2); c.lineTo(6,3.2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#e8ecef'; c.fillRect(-2,-2,5,4); c.fillStyle='#0f1a26'; c.fillRect(-8,-2.4,4,1.8); c.fillRect(-8,0.6,4,1.8); c.fillRect(4,-2.4,2.5,1.8); c.fillRect(4,0.6,2.5,1.8);
    c.strokeStyle='#e8ecef'; c.lineWidth=1; c.beginPath(); c.moveTo(0,0); c.lineTo(0,-5); c.moveTo(-1.5,-5); c.lineTo(1.5,-5); c.stroke();
  } else if(kind==='battleship'){ // wide hull, two turrets, tall superstructure
    c.fillStyle=col; c.beginPath(); c.moveTo(14,0); c.lineTo(7,-4.5); c.lineTo(-11,-4.5); c.lineTo(-13,-2.5); c.lineTo(-13,2.5); c.lineTo(-11,4.5); c.lineTo(7,4.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#e8ecef'; c.fillRect(-4,-2.5,6,5); c.fillRect(-1.5,-1.5,2.5,3);
    c.fillStyle='#0f1a26'; c.beginPath(); c.arc(6,0,2.2,0,6.3); c.arc(-8,0,2.2,0,6.3); c.fill();
    c.strokeStyle='#e8ecef'; c.lineWidth=1.3; c.beginPath(); c.moveTo(6,-1); c.lineTo(11.5,-1); c.moveTo(6,1); c.lineTo(11.5,1); c.moveTo(-8,-1); c.lineTo(-12,-1); c.moveTo(-8,1); c.lineTo(-12,1); c.stroke();
  } else {
    c.fillStyle=col; c.beginPath(); c.moveTo(9,0); c.lineTo(4,-3.5); c.lineTo(-8,-3.5); c.lineTo(-9,0); c.lineTo(-8,3.5); c.lineTo(4,3.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#e8ecef'; c.fillRect(-6,-2,5,4); c.fillRect(0,-2,3,4);
  }
  c.restore();
  if(hp!=null){ const mh=maxhp||WARSHIP_HP; c.fillStyle='#fff'; const w=2*r/mh; for(let i=0;i<Math.ceil(hp);i++) c.fillRect(x-r+i*w,y-r*1.5,Math.max(1,w-1),2); }
}
// ---------------------------------------------------------------- input
let buildMode=null, hover=-1, drag=null, selected=new Set(), box=null, hoverShip=null, hoverStruct=null, pickMode=null;
function resize(){ const st=document.getElementById('stage'); cv.width=st.clientWidth; cv.height=st.clientHeight; }
window.addEventListener('resize',resize);
function tileAt(px,py){ const x=Math.floor((px-cam.x)/cam.s), y=Math.floor((py-cam.y)/cam.s); return inb(x,y)?idx(x,y):-1; }
function hideCtx(){ ctx_.style.display='none'; }
const ctx_=document.getElementById('ctx');
function menuAction(d,t,sel,site,ratioV,aidGold,aidTroops){
    if(d.act==='plane'){ callPlane(me,t); }
    else if(d.act==='fpatrol'){ launchFighter(me,t); }
    else if(d.act==='bstrike'){ const o2=owner[t]; if(o2>=0&&atPeace(me.id,o2)) fail(`You're at peace with ${players[o2].name}.`); else launchBomber(me,t); }
    else if(d.act==='recallnear'){ aircraft.filter(a=>a.owner===me.id&&a.type==='fighter'&&['out','patrol'].includes(a.state)&&Math.hypot(a.tx-(t%W+.5),a.ty-((t-t%W)/W+.5))<=AIR.fighter.patrol+6).forEach(recallAircraft); }
    else if(d.act==='upgrade'){ upgradeStructure(me,site); }
    else if(d.act==='buyf'){ buyAircraft(me,site,'fighter'); }
    else if(d.act==='buyb'){ buyAircraft(me,site,'bomber'); }
    else if(d.act==='buyc'){ buyAircraft(me,site,'carrier'); }
    else if(d.act==='paradrop'){ const src=gOn(me)&&idleAircraft(me,'carrier',t)?(areaAt(idleAircraft(me,'carrier',t).home.t)||me.areas[0]):null; launchParadrop(me,t,(src?src.troops:me.troops)*ratioV/100); }
    else if(d.act==='sat'){ launchSatellite(); }
    else if(d.act==='refit'){ let n=0; for(const w of sel){ if(w.cls!=='battleship'||w.cruise||w.refit) continue; const ok=structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===me.id&&((st.t%W+.5-w.x)**2+((st.t-st.t%W)/W+.5-w.y)**2)<=LINK_RANGE*LINK_RANGE); if(!ok||me.gold<CRUISE.cost) continue; me.gold-=CRUISE.cost; w.refit=tickN+(START.instant?0:CRUISE.ticks); n++; } if(n){ log(`${n} battleship${n>1?'s':''} refitting with cruise missiles — ${CRUISE.ticks/10} s.`,true); snd('build'); } else fail('No battleship in range of a level II port, or not enough gold.'); }
    else if(d.act==='move'){ const n=moveSelected(t,sel); if(n) log(`${n} ship${n>1?'s':''} under way.`,true); else fail('No sea route to that spot.'); }
    else if(d.act==='blockade'){ const wn=waterNeighbor(t); const n=wn>=0?moveSelected(wn,sel):0; if(n) log(`Blockading ${players[owner[t]].name}'s port.`,true); else fail('No sea route to that port.'); }
    else if(d.act==='warship'){ const c=d.cls||'warship'; if(orderWarship(me,t,c)) log(`${SHIPS[c].label} leaving port.`,true); else fail('No sea route from your ports to that spot.'); }
    else if(d.act==='build'){ const k=d.type; if(placeStructure(me,k,t)) log(`Built a ${STRUCT[k].label.toLowerCase()}.`,true); else fail('Could not build there.'); }
    else if(d.act==='focus'){ me.cmdFocus=owner[t]; me.cmdFocusT=t; me.cmdTarget=null; log(`Missile command: concentrating on ${players[owner[t]].name} around here.`,true); }
    else if(d.act==='unfocus'){ me.cmdFocus=null; me.cmdFocusT=null; me.cmdTarget=null; log('Missile command: back to automatic targeting.',true); }
    else if(d.act==='repair'){ const st=site; if(st&&structures.includes(st)){ const need=st.type==='airfield'?LSHIELD.hp-(st.lshield||0):st.type==='port'?4-(st.gunHp||0):SHIELD.hp-st.hp; if(need>0&&me.gold>=SHIELD.repairCost*need){ me.gold-=SHIELD.repairCost*need; st.repairing=true; st.repairAt=tickN+SHIELD.repairTicks; log(`Repairing shield: ${need} pip${need>1?'s':''}, ${SHIELD.repairCost*need} gold.`,true); snd('build'); } else fail('Not enough gold for that repair.'); } }
    else if(d.act==='repairstop'){ const st=site; if(st){ const left=st.type==='airfield'?LSHIELD.hp-(st.lshield||0):st.type==='port'?4-(st.gunHp||0):SHIELD.hp-st.hp; st.repairing=false; me.gold+=SHIELD.repairCost*left; log('Repair stopped, remaining gold refunded.',true); } }
    else if(d.act==='cancelship'){ const st=site; if(st&&st.queue&&st.queue.length){ const job=st.queue.shift(); me.gold+=Math.round(SHIPS[job.cls].cost*CANCEL_REFUND); if(st.queue.length) st.queue[0].done=tickN+st.queue[0].total; log(`${SHIPS[job.cls].label} cancelled.`,true); } }
    else if(d.act==='cancel'){ const st=site; if(st&&structures.includes(st)&&st.building&&st.owner===me.id){ me.gold+=Math.round(st.cost*CANCEL_REFUND); destroyStructure(st.t); structCounts(me); log(`Construction cancelled, ${Math.round(st.cost*CANCEL_REFUND)} gold refunded.`,true); snd('error'); } else fail('Nothing to cancel there.'); }
    else if(d.act==='nuke'){ launchMissile(me,t); }
    else if(d.act==='nap'||d.act==='ally'){ propose(me,players[owner[t]],d.act); }
    else if(d.act==='war'){ breakRelation(me,players[owner[t]]); }
    else if(d.act==='giveTroops'){ const q=players[owner[t]]; if(!sendTroops(me,q,aidTroops)) fail('Could not send those troops.'); }
    else if(d.act==='giveGold'){ const q=players[owner[t]]; if(!sendGold(me,q,aidGold)) fail('Not enough gold.'); }
    else if(d.act==='askTroops'){ const q=players[owner[t]]; if(botAnswerRequest(q,me,'troops',Math.round(maxTroops(me)*0.3))) snd('unified'); else fail(`${q.name} has nothing to spare right now.`); }
    else if(d.act==='askGold'){ const q=players[owner[t]]; if(botAnswerRequest(q,me,'gold',300)) snd('unified'); else fail(`${q.name} has no gold to spare right now.`); }
    else if(d.act==='pickreinf'){ pickMode={kind:'reinforce',t}; updateHint(); }
    else if(d.act==='pickattack'){ pickMode={kind:'attack',t}; updateHint(); }
    else if(d.act==='attackfrom'){ const o=owner[t]; launchAttack(me,o,areaById(+d.area).troops*ratioV/100,undefined,areaById(+d.area)); }
    else if(d.act==='transportfrom'){ const o=owner[t]; const ar=areaById(+d.area); if(launchAttack(me,o,ar.troops*ratioV/100,t,ar)) log(`Transport embarking from ${areaName(me,ar)} for ${o>=0?players[o].name:'unclaimed coast'}.`,true); }
    else if(d.act==='transport'){ const o=owner[t]; if(o>=0&&atPeace(me.id,o)) fail(`You're at peace with ${players[o].name}.`); else if(launchAttack(me,o,me.troops*ratioV/100,t)) log(`Transport embarking for ${o>=0?players[o].name:'unclaimed coast'}.`,true); }
}
cv.addEventListener('contextmenu',e=>{ e.preventDefault(); if(ROLL.on||REPLAY.on) return; const r=cv.getBoundingClientRect(); const t=tileAt(e.clientX-r.left,e.clientY-r.top);
  hideCtx(); if(buildMode){ setBuild(null); return; } if(over||t<0) return;
  const items=[];
  if(START.fog){ const ready=planeCool<=tickN; items.push(`<div class="h">Intel</div><button class="act" ${!ready||me.gold<FOG.plane.cost?'disabled':''} data-act="plane"><span>Call spy plane here<b>${!airfieldsOf(me).length?'Needs an airfield':ready?FOG.plane.cost+' gold — reveals '+FOG.plane.r+' tiles for '+Math.round(FOG.plane.dur/10)+' s':'Ready in '+Math.ceil((planeCool-tickN)/10)+' s'}</b></span></button>`);
    const site=structures.some(st=>st.owner===me.id&&st.type==='satellite'&&!st.building); items.push(`<button class="act" ${!site||satCool>tickN||me.gold<FOG.sat.cost?'disabled':''} data-act="sat"><span>Launch spy satellite<b>${!site?'Needs a finished satellite launch site (Intel group)':satCool>tickN?'Next window in '+Math.ceil((satCool-tickN)/10)+' s':FOG.sat.cost+' gold — whole map for '+Math.round(FOG.sat.dur/10)+' s'}</b></span></button>`); }
  const friendlyTile=land[t]&&owner[t]>=0&&owner[t]!==me.id&&atPeace(me.id,owner[t]);
  if(airfieldsOf(me).length&&!friendlyTile){ const nearPatrol=aircraft.filter(a=>a.owner===me.id&&a.type==='fighter'&&['out','patrol'].includes(a.state)&&Math.hypot(a.tx-(t%W+.5),a.ty-((t-t%W)/W+.5))<=AIR.fighter.patrol+6);
    items.push(`<div class="h">Air</div><button data-act="fpatrol" ${idleAircraft(me,'fighter',t)?'':'disabled'}>Fighter patrol here<b>25-tile circle, 10 min endurance. Kills bombers and spy planes, dogfights enemy patrols</b></button><button data-act="bstrike" ${idleAircraft(me,'bomber',t)?'':'disabled'}>Bomber strike here<b>30-tile run of 8 bombs, each 1/8 of a nuke. Ignores SAMs; stopped by fighters and domes</b></button>${land[t]&&idleAircraft(me,'carrier',t)?`<button data-act="paradrop">Paradrop troops here<b>Up to ${AIR.carrier.capacity} troops (slider share of the field's area), lands as an attack or reinforcement. Fighters can shoot it down</b></button>`:''}${nearPatrol.length?`<button data-act="recallnear">Recall ${nearPatrol.length>1?'these patrols':'this patrol'}</button>`:''}`); }
  if(hoverStruct&&hoverStruct.owner===me.id&&UPGRADE[hoverStruct.type]&&!hoverStruct.building){ const st=hoverStruct; ctx_.site=st; const U=UPGRADE[st.type]; if((st.level||1)<(U.max||2)&&!st.upgrading){ const lv=(st.level||1); const uc=lv>=2?(U.cost3||U.cost):U.cost, ut=lv>=2?(U.ticks3||U.ticks):U.ticks; items.push(`<button data-act="upgrade" ${me.gold<uc?'disabled':''}>Upgrade ${STRUCT[st.type].label.toLowerCase()} to level ${lv>=2?'III':'II'}<b>${uc} gold · ${START.instant?'instant':ut/10+' s'} — ${st.type==='port'?'built-in shore guns, heavy transports, unlocks submarine bases':st.type==='airfield'?'6 hangar slots, light shield dome, stealth troop transports':lv>=2?'range 32 tiles':'range 24 tiles'}</b></button>`); } else if(st.upgrading) items.push(`<div class="h">Upgrading — ${Math.ceil((st.upDone-tickN)/10)} s</div>`); }
  if(hoverStruct&&hoverStruct.owner===me.id&&hoverStruct.type==='port'&&(hoverStruct.level||1)>=2&&!hoverStruct.building){ const st=hoverStruct; ctx_.site=st; const need=4-(st.gunHp||0); if(need>0&&!st.repairing) items.push(`<button data-act="repair" ${me.gold<SHIELD.repairCost*need?'disabled':''}>Repair port guns (${need} pip${need>1?'s':''})<b>${SHIELD.repairCost} gold per pip, one pip every ${SHIELD.repairTicks/10} s</b></button>`); else if(st.repairing) items.push(`<button data-act="repairstop">Stop gun repair</button>`); }
  if(hoverStruct&&hoverStruct.owner===me.id&&hoverStruct.type==='airfield'&&(hoverStruct.level||1)>=2&&!hoverStruct.building){ const st=hoverStruct; const need=LSHIELD.hp-(st.lshield||0); if(need>0&&!st.repairing) items.push(`<button data-act="repair" ${me.gold<SHIELD.repairCost*need?'disabled':''}>Repair airfield shield (${need} pip${need>1?'s':''})<b>${SHIELD.repairCost} gold per pip, one pip every ${SHIELD.repairTicks/10} s</b></button>`); else if(st.repairing) items.push(`<button data-act="repairstop">Stop shield repair</button>`); }
  if(hoverStruct&&hoverStruct.owner===me.id&&hoverStruct.type==='airfield'&&!hoverStruct.building){ const st=hoverStruct; ctx_.site=st; const n=hangarCount(st); items.push(`<div class="h">Airfield${(st.level||1)>=3?' III':(st.level||1)>=2?' II':''} — ${n}/${hangarMax(st)} hangar slots</div><div class="grid"><button data-act="buyf" ${n>=hangarMax(st)||me.gold<AIR.fighter.cost?'disabled':''}><span><span class="n">Stealth fighter</span><b>${AIR.fighter.cost}g · ${START.instant?'instant':AIR.fighter.build/10+'s'}</b></span></button><button data-act="buyb" ${n>=hangarMax(st)||me.gold<AIR.bomber.cost?'disabled':''}><span><span class="n">Stealth bomber</span><b>${AIR.bomber.cost}g · ${START.instant?'instant':AIR.bomber.build/10+'s'}</b></span></button>${(st.level||1)>=2?`<button data-act="buyc" ${n>=hangarMax(st)||me.gold<AIR.carrier.cost?'disabled':''}><span><span class="n">Troop transport</span><b>${AIR.carrier.cost}g · ${START.instant?'instant':AIR.carrier.build/10+'s'}</b></span></button>`:''}</div>`); }

  const sel=[...selected].filter(w=>warships.includes(w));
  if(sel.length&&(!land[t]||(struct[t]&&structures.find(q=>q.t===t)?.type==='port'&&owner[t]!==me.id))){
    items.push(`<div class="h">Fleet orders</div>`);
    if(!land[t]) items.push(`<button data-act="move">Move ${sel.length} ship${sel.length>1?'s':''} here and patrol<b>They pathfind through water at their own speed</b></button>`);
    else items.push(`<button data-act="blockade">Blockade this port<b>Patrol just offshore; merchants and transports leaving it come first</b></button>`);
    { const bbs=sel.filter(w=>w.cls==='battleship'&&!w.cruise&&!w.refit); if(bbs.length){ const near=bbs.filter(w=>structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===me.id&&((st.t%W+.5-w.x)**2+((st.t-st.t%W)/W+.5-w.y)**2)<=LINK_RANGE*LINK_RANGE)); items.push(`<button data-act="refit" ${!near.length||me.gold<CRUISE.cost*near.length?'disabled':''}>Refit ${near.length||bbs.length} battleship${(near.length||bbs.length)>1?'s':''} with cruise missiles<b>${CRUISE.cost} gold each, ${CRUISE.ticks/10} s, must be within 34 tiles of your level II port${near.length?'':' — none in range'}. Then fires 2 cruise missiles every 40 s up to 120 tiles inland: shields first, then SAM sites, then anything</b></button>`); } }
  }
  if(!land[t]){
    { const c=ALLOWED.has('port')?snapBuild(me,t,'port',4):-1; if(c>=0) items.push(`<button ${me.gold<STRUCT.port.cost?'disabled':''} data-act="build" data-type="port">Build port on this coast<b>${STRUCT.port.cost} gold</b></button>`); }
    items.push(`<div class="h">Ships${me.ports<1?' — need a port':''}</div>`);
    const np_=me.ports>0?nearestPort(me,t):null; const disc=np_&&np_.linked?1-LINK_SHIP_DISCOUNT:1;
    const hasPens=structures.some(st=>st.type==='subbase'&&!st.building&&st.owner===me.id);
    items.push('<div class="grid">'+Object.keys(SHIPS).filter(k=>ALLOWED.has(k)&&(k!=='rship'||START.fog)&&(!SHIPS[k].sub||hasPens)).map(k=>{ const S=SHIPS[k]; const c=Math.round(S.cost*disc); const tm=SHIP_BUILD[k]&&!START.instant?' · '+Math.round(SHIP_BUILD[k]/10)+'s':''; return `<button ${me.ports<1||me.gold<c?'disabled':''} data-act="warship" data-cls="${k}" title="${S.desc}"><img src="${shipURL(k,me.color)}" width="40" height="22" alt=""><span><span class="n">${S.label}</span><b>${c}g${tm}${disc<1?' · supplied':''}</b></span></button>`; }).join('')+'</div>');
  } else if(owner[t]===me.id&&hoverStruct&&hoverStruct.owner===me.id&&hoverStruct.type==='shield'&&!hoverStruct.building){ const st=hoverStruct; ctx_.site=st; const need=SHIELD.hp-st.hp; items.push(`<div class="h">Shield generator — ${st.hp}/${SHIELD.hp} hit points</div>`); if(st.repairing) items.push(`<button data-act="repairstop">Stop repair<b>${need} pips left</b></button>`); else items.push(`<button ${need<=0||me.gold<SHIELD.repairCost*need?'disabled':''} data-act="repair">Repair${need>0?' ('+need+' pip'+(need>1?'s':'')+')':' — at full strength'}<b>${SHIELD.repairCost} gold per pip, one pip every ${SHIELD.repairTicks/10} s${START.instant?' (instant)':''}</b></button>`);
  } else if(owner[t]===me.id&&hoverStruct&&hoverStruct.owner===me.id&&hoverStruct.building){ const st=hoverStruct; ctx_.site=st; items.push(`<div class="h">${STRUCT[st.type].label} under construction — ${Math.ceil((st.done-tickN)/10)} s</div>`); items.push(`<button data-act="cancel">Cancel construction<b>Refunds ${Math.round(st.cost*CANCEL_REFUND)} gold</b></button>`);
  } else if(owner[t]===me.id&&hoverStruct&&hoverStruct.owner===me.id&&hoverStruct.type==='port'&&hoverStruct.queue&&hoverStruct.queue.length){ const st=hoverStruct; ctx_.site=st; const job=st.queue[0]; items.push(`<div class="h">${SHIPS[job.cls].label} on the slipway — ${Math.ceil(Math.max(0,job.done-tickN)/10)} s${st.queue.length>1?', '+(st.queue.length-1)+' queued':''}</div>`); items.push(`<button data-act="cancelship">Cancel this ship<b>Refunds ${Math.round(SHIPS[job.cls].cost*CANCEL_REFUND)} gold</b></button>`);
  } else if(owner[t]===me.id){
    if(gOn(me)&&me.areas&&me.areas.length>1){ const here=areaAt(t); if(here) items.push(`<button data-act="pickreinf">Reinforce this area from an area you click<b>${ratio.value}% of the clicked area's garrison, by transport</b></button>`); }
    const blocked=struct[t]||crowded(t);
    const GROUPS=[['Economy',['city','factory','port']],['Defense',['fort','sam','shield']],['Coast & artillery',['shore','battery','bertha']],['Strike',['silo','command']],['Command',['troopcmd','engcmd']],['Air',['airfield','flightops']],['Navy',['subbase']],['Intel',['radar','lradar','jammer','satellite']]];
    for(const [gname,keys] of GROUPS){ const ks=keys.filter(k=>ALLOWED.has(k)&&(!STRUCT[k].fog||START.fog)); if(!ks.length) continue;
      items.push(`<div class="h">${gname}</div><div class="grid">`+ks.map(k=>{ const S=STRUCT[k]; const spot=snapBuild(me,t,k); const cost=structCost(me,k); const off=spot<0||me.gold<cost; const tm=BUILD_TICKS[k]&&!START.instant?' · '+Math.round(BUILD_TICKS[k]/10)+'s':'';
        return `<button ${off?'disabled':''} data-act="build" data-type="${k}" title="${S.desc}"><img src="${iconURL(k,me.color)}" width="30" height="30" alt=""><span><span class="n">${S.label}${KEY_OF[k]?' <kbd>'+KEY_OF[k]+'</kbd>':''}</span><b>${cost}g${tm}${spot<0?(S.coast?' · no coast nearby':' · no room nearby'):''}</b></span></button>`; }).join('')+`</div>`); }
  } else {
    const o=owner[t];
    const troops=Math.round(me.troops*ratio.value/100);
    if(!(o>=0&&atPeace(me.id,o))){ items.push(`<div class="h">${o>=0?players[o].name:'Unclaimed land'} — military</div>`);
      if(gOn(me)&&me.areas&&me.areas.length>1){ const adj=areaTouching(me,o); if(adj) items.push(`<button data-act="attackfrom" data-area="${adj.id}">Attack from the bordering area<b>${fmtN(adj.troops*ratio.value/100)} of its ${fmtN(adj.troops)} troops along the shared border</b></button>`); items.push(`<button data-act="pickattack">Send troops here from an area you click<b>${ratio.value}% of the clicked area's garrison — by land if it borders, else by transport</b></button>`); }
    items.push(`<button ${troops<5?'disabled':''} data-act="transport">Send transport (${troops} troops)<b>Embarks from your nearest coast, lands on theirs</b></button>`);
    if(me.silos>0&&ALLOWED.has('missile')){ const rs=structures.filter(q=>q.owner===me.id&&q.type==='silo'&&!q.building&&!(q.cool>tickN)).sort((a,b)=>missileCost(me,a)-missileCost(me,b)); const c=rs.length?missileCost(me,rs[0]):NUKE_COST; items.push(`<button ${me.gold<c||!rs.length?'disabled':''} data-act="nuke">Launch missile here <kbd>N</kbd><b>${!rs.length?'Reloading — '+Math.ceil(siloReadyIn(me)/10)+'s':c+' gold'+(c<NUKE_COST?' (command discount)':'')}</b></button>`); } }
    if(o>=0&&me.commands>0&&players[o].kind!=='neutral'&&!atPeace(me.id,o)){ items.push(me.cmdFocus===o?`<button data-act="unfocus">Stop auto-fire on ${players[o].name}<b>Missile command returns to picking targets among nations you fight</b></button>`:`<button data-act="focus">Auto-fire missiles at this nation, here<b>Missile command concentrates on ${players[o].name}'s buildings within 60 tiles of this spot, then the rest of the nation</b></button>`); }
    if(o>=0&&players[o].kind!=='neutral'){ const r=relation(me,players[o]); items.push(`<div class="h">Diplomacy</div>`);
      if(!r){ items.push(`<button data-act="nap">Propose non-aggression pact<b>3 minutes, neither side may attack</b></button>`); items.push(`<button data-act="ally">Propose alliance<b>Lasting peace; your SAMs and ships defend each other</b></button>`); }
      else { if(r.type==='ally'){ items.push(`<div class="h">Aid for ${players[o].name}</div>`);
          items.push(`<div class="aid"><span>Troops</span><input type="number" id="aidTroops" value="${Math.round(me.troops*0.25)}" min="10" step="10"><button data-act="giveTroops">Send</button></div>`);
          items.push(`<div class="aid"><span>Gold</span><input type="number" id="aidGold" value="${Math.round(me.gold*0.25)}" min="1" step="10"><button data-act="giveGold">Send</button></div>`);
          items.push(`<button data-act="askTroops">Request troops<b>They send from their surplus, if they have one</b></button>`); items.push(`<button data-act="askGold">Request gold</button>`); }
        if(!r.team) items.push(`<button data-act="war">Declare war<b>Breaks the ${r.type==='ally'?'alliance':'pact'}: half growth for ${r.type==='ally'?2:1} min and a reputation hit</b></button>`); } }
  }
  ctx_.innerHTML=items.join(''); ctx_.style.display='block';
  const ww=window.innerWidth,wh=window.innerHeight; ctx_.style.left=Math.min(e.clientX,ww-352)+'px'; ctx_.style.top='0px'; ctx_.style.display='block'; const mh=ctx_.offsetHeight; ctx_.style.top=Math.max(4,Math.min(e.clientY,wh-mh-8))+'px';
  ctx_.onclick=ev=>{ const b=ev.target.closest('button'); if(!b) return; if(b.dataset.act==='toggle'){ const pnl=ctx_.querySelector('#'+b.dataset.panel); pnl.style.display=pnl.style.display==='none'?'':'none'; return; } hideCtx(); issueMenu({...b.dataset},t,sel.map(w=>w.id),ctx_.site?ctx_.site.t:-1,+ratio.value,+(document.getElementById('aidGold')||{value:0}).value,+(document.getElementById('aidTroops')||{value:0}).value);
  };
});
window.addEventListener('mousedown',e=>{ if(!e.target.closest('#ctx')) hideCtx(); });
cv.addEventListener('mousedown',e=>{ if(ROLL.on) return; if(e.button!==0) return; if(e.shiftKey){ const r=cv.getBoundingClientRect(); box={x0:e.clientX-r.left,y0:e.clientY-r.top,x1:e.clientX-r.left,y1:e.clientY-r.top}; return; } drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,moved:false}; });
window.addEventListener('mousemove',e=>{ if(ROLL.on){ const r=cv.getBoundingClientRect(); ROLL.mx=e.clientX-r.left; ROLL.my=e.clientY-r.top; return; }
  if(box){ const r=cv.getBoundingClientRect(); box.x1=e.clientX-r.left; box.y1=e.clientY-r.top; }
  if(drag){ const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if(Math.abs(dx)+Math.abs(dy)>4) drag.moved=true; if(drag.moved){cam.x=drag.cx+dx;cam.y=drag.cy+dy;} }
  const r=cv.getBoundingClientRect(); hover=tileAt(e.clientX-r.left,e.clientY-r.top); hoverShip=shipAt(e.clientX,e.clientY,true); hoverStruct=structAt(e.clientX,e.clientY); showTip(e);
});
window.addEventListener('mouseup',e=>{ if(ROLL.on){ const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; const b=ROLL.skipBox; if(e.button===0&&b&&mx>=b[0]&&mx<=b[0]+b[2]&&my>=b[1]&&my<=b[1]+b[3]){ if(ROLL.paused&&AUD.ctx) AUD.ctx.resume(); endCredits(); }
    if(e.button===0&&ROLL.tBoxes){ const tb=ROLL.tBoxes.find(b=>mx>=b[0]&&mx<=b[0]+b[2]&&my>=b[1]&&my<=b[1]+b[3]); if(tb){ tb[4](); drag=null; return; } }
    if(CUSTOM.previewing&&e.button===0){ const eb=ROLL.editBox, ab=ROLL.approveBox; const hit=(bb)=>bb&&mx>=bb[0]&&mx<=bb[0]+bb[2]&&my>=bb[1]&&my<=bb[1]+bb[3]; if(hit(eb)){ if(ROLL.paused&&AUD.ctx) AUD.ctx.resume(); ROLL.on=false; JUKE.hold=false; jukeStopSrc(0.3); MUS.stop(); CUSTOM.previewing=false; openBuilder(ROLL.data,CUSTOM.data); drag=null; return; } if(hit(ab)){ if(CUSTOM.approved){ if(ROLL.paused&&AUD.ctx) AUD.ctx.resume(); endCredits(); postedModal(); } else approveCustom().then(ok=>{ if(ok){ ROLL.rolled=true; if(ROLL.paused&&AUD.ctx) AUD.ctx.resume(); endCredits(); postedModal(); } }); drag=null; return; } } const pb=ROLL.playBox; if(pb&&e.button===0&&mx>=pb[0]&&mx<=pb[0]+pb[2]&&my>=pb[1]&&my<=pb[1]+pb[3]){ location.href=(WP?WP.base:'?')+'?seed='+encodeURIComponent(ROLL.data.seed)+'&cls='+encodeURIComponent(ROLL.data.cls||'Standard'); } drag=null; return; }
  if(box){ const x0=Math.min(box.x0,box.x1),x1=Math.max(box.x0,box.x1),y0=Math.min(box.y0,box.y1),y1=Math.max(box.y0,box.y1); if(!e.shiftKey||true){ if(x1-x0<4&&y1-y0<4){ const w=shipAt(e.clientX,e.clientY); if(w){ if(selected.has(w)) selected.delete(w); else selected.add(w); } } else { for(const w of warships){ if(w.owner!==me.id||w.x==null) continue; const sx=cam.x+w.x*cam.s, sy=cam.y+w.y*cam.s; if(sx>=x0&&sx<=x1&&sy>=y0&&sy<=y1) selected.add(w); } } } box=null; updateHint(); return; }
  if(drag&&!drag.moved){ const w=shipAt(e.clientX,e.clientY); if(w){ selected.clear(); selected.add(w); updateHint(); } else { if(selected.size){ selected.clear(); updateHint(); } issueClick(hover); } }
  drag=null; });
cv.addEventListener('wheel',e=>{ e.preventDefault(); if(ROLL.on){ rollSeek(e.deltaY>0?2:-2); return; } const r=cv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  const ns=Math.min(12,Math.max(0.35,cam.s*(e.deltaY<0?1.15:1/1.15))); cam.x=mx-(mx-cam.x)*ns/cam.s; cam.y=my-(my-cam.y)*ns/cam.s; cam.s=ns; },{passive:false});
window.addEventListener('keydown',e=>{ const tg=e.target; if(tg&&(tg.tagName==='INPUT'||tg.tagName==='SELECT'||tg.tagName==='TEXTAREA'||tg.isContentEditable)) return; if(ROLL.on&&!(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT'))){ if(e.key===' '){ e.preventDefault(); rollTogglePause(); } else if(e.key==='ArrowLeft'){ e.preventDefault(); rollSeek(-5); } else if(e.key==='ArrowRight'){ e.preventDefault(); rollSeek(5); } else if(e.key==='Escape'){ if(ROLL.paused&&AUD.ctx) AUD.ctx.resume(); endCredits(); } return; }
  if(e.key===' '){ e.preventDefault(); if($('modal').style.display!=='none'){ if(closePauseModal()) return; return; } if(me&&!over&&!REPLAY.on&&!userPaused) openPauseModal(); else togglePause(); return; }
  if(e.key==='Escape'&&$('modal').style.display!=='none'){ if(!closePauseModal()) closeModal(); return; }
  if(e.key==='['&&JUKE.loaded){ jukeNext(-1); return; } if(e.key===']'&&JUKE.loaded){ jukeNext(1); return; }
  if(e.key==='Escape'){setBuild(null);hideCtx(); pickMode=null; updateHint(); if(selected.size){ selected.clear(); updateHint(); } } const k=HOTKEYS[e.key.toLowerCase()]; if(k){ if(k==='nuke'){ if(ALLOWED.has('missile')) setBuild(buildMode===k?null:k); } else if(ALLOWED.has(k)&&!(STRUCT[k]&&STRUCT[k].fog&&!START.fog)) setBuild(buildMode===k?null:k); } });

function fail(msg){ log(msg,true); snd('error'); }
function myBorderTouches(t){ const x=t%W,y=(t-x)/W; return N4.some(([dx,dy])=>inb(x+dx,y+dy)&&owner[idx(x+dx,y+dy)]===me.id); }
function canBuildAt(t){ if(!land[t]) return false; if(buildMode==='nuke') return owner[t]!==me.id; return snapBuild(me,t,buildMode)>=0; }
function clickTile(t,env){ env=env||{ratio:+ratio.value,pick:pickMode?{kind:pickMode.kind,t:pickMode.t}:null,build:buildMode}; const ratioV=env.ratio;
  if(env.pick){ const pm=env.pick; if(t<0||!land[t]) return; if(owner[t]!==me.id) return fail('Click one of your own areas to send from.'); const src=areaAt(t); if(!src) return; if(!CMD.replaying){ pickMode=null; updateHint(); }
    if(pm.kind==='reinforce'){ const dest=areaAt(pm.t); if(dest===src) return fail('That is the same area.'); reinforceArea(me,dest,src,src.troops*ratioV/100); return; }
    const o=owner[pm.t]; const adj=areaTouching(me,o); if(adj===src) launchAttack(me,o,src.troops*ratioV/100,undefined,src); else if(launchAttack(me,o,src.troops*ratioV/100,pm.t,src)) log(`Transport embarking for ${o>=0?players[o].name:'unclaimed coast'}.`,true); return; }
  if(draft){ if(t<0||!land[t]) return; const p=draft.order[draft.idx]; if(p!==me) return fail('Not your pick yet.'); const o=owner[t]; if(o<0||players[o].kind!=='neutral'||!players[o].alive) return fail('Pick a neutral country.'); draftPick(me,players[o]); draftAdvance(); return; }
  if(over||t<0||!land[t]) return;
  if(env.build){ const buildK=env.build;
    if(buildK==='nuke'){ if(canBuildAt(t)&&launchMissile(me,t)) setBuild(null); else if(me.silos<1) log('Build a missile silo first.',true); else if(me.gold<NUKE_COST) log('Not enough gold for a missile.',true); return; }
    if(owner[t]===me.id){
      if(placeStructure(me,buildK,t)){ log(`Built a ${STRUCT[buildK].label.toLowerCase()}.`,true); setBuild(null); }
      else if(STRUCT[buildK].coast) fail('No free coastline within 5 tiles of there.');
      else if(snapBuild(me,t,buildK)<0) fail('No room within 5 tiles — buildings need 6 tiles of clearance.');
      else fail('Not enough gold.');
      return;
    }
    setBuild(null); // clicked outside your land: drop build mode and treat it as an attack
  }
  const o=owner[t]; if(o===me.id) return;
  let troops=me.troops*ratioV/100; if(gOn(me)&&me.areas&&me.areas.length){ const adj=areaTouching(me,o); if(adj) troops=adj.troops*ratioV/100; }
  const shared=attacks.some(a=>a.owner===me.id&&a.target===o)||frontierOf(me.id,o).size>0;
  if(shared){ launchAttack(me,o,troops); }
  else fail(`You don't border ${o>=0?players[o].name:'that land'}. Right-click it to send a transport by sea.`);
}
function showTip(e){ if(!land||!owner||!me||ROLL.on){ tip.style.display='none'; return; }
  if(hoverShip){ const w=hoverShip, S=SHIPS[w.cls]; tip.innerHTML=`<b style="color:${players[w.owner].color}">${players[w.owner].name}</b> ${S.label}${w.cruise?' · cruise missiles':w.refit?' · refitting '+Math.ceil((w.refit-tickN)/10)+' s':''}<br>${Math.ceil(w.hp*10)/10}/${S.hp} hit points · gun ${S.gun}${S.sam?' · SAM '+S.sam:''}${S.barrage?' · barrage '+S.barrage.range:''}`; tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+14)+'px'; return; }
  if(hover<0||!land[hover]){tip.style.display='none';return;}
  const o=owner[hover]; let s;
  if(o<0) s='Unclaimed land';
  else if(vis&&!vis[hover]&&o!==me.id&&!myBorders.has(o)&&relation(me,players[o])?.type!=='ally'){ const p=players[o]; s=`<img src="${flagURL(p.flag)}" width="27" height="18" style="vertical-align:-4px;margin-right:6px" alt=""><b style="color:${p.color}">${p.name}</b>${relText(p)}<br><span class="muted">${p.tiles} tiles · troops unknown (fog)</span>`; tip.innerHTML=s; tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+14)+'px'; return; }
  else { const p=players[o]; s=`<img src="${flagURL(p.flag)}" width="27" height="18" style="vertical-align:-4px;margin-right:6px" alt=""><b style="color:${p.color}">${p.name}</b>${relText(p)}<br>${Math.round(p.troops)} troops · ${p.tiles} tiles<br>density ${density(p).toFixed(2)}`; }
  { const o=owner[hover]; if(o>=0&&land[hover]&&players[o]&&players[o].kind!=='neutral'){ const fm=fortMult(hover,o); if(fm>1) s+=`<br><span style="color:var(--gold)">Fortified ×${fm}</span> — ${fm>=64?'a fortress':fm>=8?'a strong point':'bastion cover'}`; } }
  const st=hoverStruct||structures.find(x=>x.t===hover); if(st){ s+=`<br>${STRUCT[st.type].label}${(st.level||1)>=3?' III':(st.level||1)>=2?' II':''}${st.upgrading?' (upgrading '+Math.ceil((st.upDone-tickN)/10)+' s)':''}${st.building?' — under construction, '+Math.ceil((st.done-tickN)/10)+' s':''}`; const n=st.links||0;
    if(st.type==='factory') s+=n?` — ${n} supply line${n>1?'s':''} (gold ×${(1+n*LINK_GOLD_PER).toFixed(1)})`:' — no supply lines';
    else if(st.type==='city') s+=n?` — supplied by ${n} factor${n>1?'ies':'y'} (+${(n*LINK_TROOPS).toFixed(1)} troops/s)`:' — no factories linked';
    else if(st.type==='shield'&&!st.building) s+=` — ${st.hp}/${SHIELD.hp} hit points${st.repairing?', repairing':''}`;
    else if(GUNS[st.type]&&st.hp!=null) s+=` — ${Math.ceil(st.hp*10)/10}/${GUNS[st.type].hp} hit points`;
    else if(st.type==='silo'&&!st.building){ const cc=commandCover(st.t); s+=cc?` — under ${cc} command center${cc>1?'s':''}, missiles ${missileCost(players[st.owner],st)} gold`:' — no command center in range'; }
    else if(st.type==='port') s+=n?` — ${n} factor${n>1?'ies':'y'} (+${(n*LINK_PORT_GOLD).toFixed(1)} gold/s, ships ${Math.round(LINK_SHIP_DISCOUNT*100)}% cheaper)`:' — no factories linked'; }
  if(shelled[hover]>tickN) s+=`<br><span style="color:#ff9a9a">Under bombardment — half cost to take, ${Math.ceil((shelled[hover]-tickN)/10)}s</span>`;
  const r=regions[region[hover]]; if(r&&r.size>=REGION_MIN){ const mine=regCount[r.id*NP+me.id]; s+=`<br><span class="muted">${r.cont?'Continent of ':''}${r.name} — ${r.size} tiles, you hold ${Math.round(mine/r.size*100)}%</span>`; }
  tip.innerHTML=s; tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+14)+'px';
}

// ---------------------------------------------------------------- UI
const $=id=>document.getElementById(id);
const HINT_DEFAULT='Left-click a bordering country to invade. Right-click: build on your land, transports and missiles on enemy land, ships on water. Click a ship to select it (Shift-drag for several), then right-click water to move it.';
function updateHint(){ if(pickMode){ $('hint').textContent=pickMode.kind==='reinforce'?`Click one of your areas to send ${ratio.value}% of its garrison here by transport. Esc cancels.`:`Click one of your areas to send ${ratio.value}% of its garrison at the target — by land if it borders, otherwise by transport. Esc cancels.`; cv.style.cursor='copy'; return; } cv.style.cursor=buildMode?'cell':'crosshair'; if(buildMode) return; const live=[...selected].filter(w=>warships.includes(w)); if(live.length){ const cls={}; for(const w of live) cls[w.cls]=(cls[w.cls]||0)+1; $('hint').textContent=`${live.length} ship${live.length>1?'s':''} selected (${Object.keys(cls).map(k=>cls[k]+' '+SHIPS[k].label.toLowerCase()).join(', ')}) — right-click water to move and patrol there, or an enemy port to blockade it. Esc to deselect.`; } else $('hint').textContent=HINT_DEFAULT; }
function setBuild(k){ buildMode=k; cv.style.cursor=k?'cell':'crosshair'; $('hint').textContent=k?`${k==='nuke'?'Missile':STRUCT[k].label} mode — click a tile. Esc cancels.`:HINT_DEFAULT; }
function updateUI(){
  const cap=maxTroops(me);
  if(gOn(me)&&me.areas&&me.areas.length>1){ $('areaList').style.display=''; const bigA=me.areas.filter((a,i)=>i===0||a.tiles>=20), smallN=me.areas.length-bigA.length, smallT=me.areas.filter(a=>!bigA.includes(a)).reduce((s,a)=>s+a.troops,0); $('areaList').innerHTML=bigA.map((a,i)=>`<div data-area="${a.id}" style="display:flex;justify-content:space-between;cursor:pointer;padding:1px 0"><span>${areaLabel(me,a)}</span><span>${fmtN(a.troops)} <span class="muted">· ${a.tiles} tiles</span></span></div>`).join('')+(smallN?`<div class="muted">+${smallN} small island${smallN>1?'s':''} · ${Math.round(smallT)}</div>`:''); $('areaList').querySelectorAll('[data-area]').forEach(r=>{ r.onmouseover=()=>{ hoverArea=+r.dataset.area; }; r.onmouseleave=()=>{ hoverArea=-1; }; }); } else $('areaList').style.display='none';
  $('troops').textContent=START.noCap?Math.round(me.troops)+' (no cap)':Math.round(me.troops)+' / '+Math.round(cap);
  $('troopBar').style.width=Math.min(100,me.troops/cap*100)+'%'; $('troopBar').style.background=me.troops>cap?'#ffd27a':'#7fb3ff';
  $('gold').textContent=Math.floor(me.gold);
  $('land').textContent=(me.tiles/landCount*100).toFixed(1)+'% of '+landCount+' tiles';
  $('income').textContent='+'+troopGrowth(me).toFixed(1)+' troops/s · +'+goldGrowth(me).toFixed(1)+' gold/s'+(me.tradeIncome?' · trade '+me.tradeIncome:'');
  $('income').title=`${me.factoryLinks||0} supply lines (${me.cityLinks||0} to cities, ${me.portLinks||0} to ports)`;
  { const names=[...me.held].map(id=>regions[id]).sort((a,b)=>b.size-a.size).map(r=>r.name); $('held').textContent=names.length?`Holding ${names.length} landmass${names.length>1?'es':''}: ${names.slice(0,3).join(', ')}${names.length>3?' +'+(names.length-3)+' more':''}`:'Unify a whole island or continent for a windfall and faster growth.'; }
  $('seedLbl').textContent=START.seed?'seed '+START.seed+' · ':'';
  const el=Math.floor(((userPaused?pausedAt:performance.now())-startTime)/1000); $('timer').textContent=String(Math.floor(el/60)).padStart(2,'0')+':'+String(el%60).padStart(2,'0');
  { const mine=aircraft.filter(a=>a.owner===me.id); const has=airfieldsOf(me).length>0; $('airPanel').style.display=has?'':'none'; $('airAutoRow').style.display=structures.some(st=>st.type==='flightops'&&!st.building&&st.owner===me.id)?'':'none';
    if(has){ const stateTxt=a=>({hangar:'ready',out:'en route',patrol:a.type==='fighter'?'patrolling'+(a.until?' · '+Math.ceil((a.until-tickN)/600)+' min':''):'',run:'bombing',return:'returning',refuel:a.type==='fighter'?'refueling':'rearming',heal:'repairing'})[a.state]||a.state;
      $('airList').innerHTML=mine.length?mine.map((a,i)=>`<div data-air="${i}" style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;cursor:pointer"><span>${a.type==='fighter'?'✈ Fighter':a.type==='carrier'?'⬒ Transport':'▲ Bomber'} <span class="muted">${stateTxt(a)}${a.type==='carrier'&&a.troops?' · '+Math.round(a.troops)+' aboard':''}</span>${a.type==='fighter'?' <span style="color:'+(a.hp<=2?'#ff9a9a':'#bde5b8')+'">'+'▮'.repeat(a.hp)+'<span style="opacity:.3">'+'▮'.repeat(AIR.fighter.hp-a.hp)+'</span></span>':''}</span>${['out','patrol','run'].includes(a.state)?`<button data-recall="${i}" style="padding:1px 6px;font-size:11px">Recall</button>`:''}</div>`).join(''):'<span class="muted">Hangar empty — right-click an airfield to buy aircraft.</span>';
      $('airList').querySelectorAll('button[data-recall]').forEach(b=>b.onclick=()=>issue('recall',mine[+b.dataset.recall].id));
      $('airList').onmouseover=e=>{ const r=e.target.closest('[data-air]'); hoverAir=r?mine[+r.dataset.air]:null; }; $('airList').onmouseleave=()=>{ hoverAir=null; }; } }

  $('intelRow').style.display=START.fog?'':'none'; if(START.fog){ const site=structures.some(st=>st.owner===me.id&&st.type==='satellite'&&!st.building); $('satBtn').disabled=!site||satCool>tickN||me.gold<FOG.sat.cost; $('intelInfo').textContent=(satUntil>tickN?'satellite up '+Math.ceil((satUntil-tickN)/10)+'s · ':satCool>tickN?'launch in '+Math.ceil((satCool-tickN)/10)+'s · ':site?FOG.sat.cost+' gold · ':'needs launch site · ')+'plane '+(planeCool>tickN?Math.ceil((planeCool-tickN)/10)+'s':'ready'); }
  $('logRow').style.display=(me.troopcmds>0)?'':'none'; if(me.troopcmds>0) $('logInfo').textContent=`+${Math.min(4,me.troopcmds)*10}% growth${START.garrison?'':' · logistics need Garrisons'}`;
  $('autoRow').style.display=me.commands>0?'':'none'; if(me.commands>0){ const ctrl=structures.filter(q=>q.owner===me.id&&q.type==='silo'&&!q.building&&commandCover(q.t)>0).length; $('autoInfo').textContent=`${silosReady(me,true)}/${ctrl} controlled silos ready${ctrl<me.silos?' ('+(me.silos-ctrl)+' out of range)':''}${me.cmdFocus!=null&&players[me.cmdFocus].alive?' · focus: '+players[me.cmdFocus].name+(me.cmdFocusT!=null?' (near here)':''):''}`; }
  $('repLbl').textContent='reputation '+Math.round(me.rep*100)+'%'+(me.penaltyUntil>tickN?' · penalty '+Math.ceil((me.penaltyUntil-tickN)/10)+'s':'');
  let dh=''; for(const q of proposals){ const f=players[q.from]; const what=q.type==='ally'?'proposes an alliance':q.type==='nap'?'proposes a pact':q.type==='reqTroops'?`asks for ${q.amt} troops`:`asks for ${q.amt} gold`; dh+=`<div style="margin:4px 0;padding:6px;background:var(--panel2);border-radius:6px"><img src="${flagURL(f.flag)}" width="18" height="12" alt=""> <b>${f.name}</b> ${what} (${Math.ceil((q.until-tickN)/10)}s)<br><button data-acc="${q.from}" data-type="${q.type}" data-amt="${q.amt||0}" style="padding:3px 8px;margin-top:4px">${q.type.startsWith('req')?'Send':'Accept'}</button> <button data-dec="${q.from}" style="padding:3px 8px;margin-top:4px">Decline</button></div>`; }
  const rels=players.filter(q=>q!==me&&q.alive&&relation(me,q)); if(rels.length) dh+=rels.map(q=>{ const r=relation(me,q); return `<div><i class="sw" style="background:${q.color}"></i> <img src="${flagURL(q.flag)}" width="18" height="12" alt=""> ${q.name}: ${r.type==='ally'?'alliance':'pact, '+Math.ceil((r.until-tickN)/10)+'s'}</div>`; }).join('');
  if(!dh) dh='<span class="muted">No pacts. Right-click a nation to propose one.</span>';
  if(me.team!=null){ let th=''; for(let t=0;t<START.teams;t++){ const tt=players.filter(q=>q.alive&&q.team===t).reduce((a,q)=>a+q.tiles,0); th+=`<span style="margin-right:10px"><i class="sw" style="background:${TEAM_COLS[t]}"></i> ${TEAM_NAMES[t]}${t===me.team?' (you)':''} ${(tt/landCount*100).toFixed(1)}%</span>`; } dh=`<div style="margin-bottom:6px">${th}</div>`+dh; }
  $('diplo').innerHTML=dh;
  $('diplo').querySelectorAll('button[data-acc]').forEach(b=>b.onclick=()=>{ issue('accept',+b.dataset.acc,b.dataset.type,+b.dataset.amt||0); });
  $('diplo').querySelectorAll('button[data-dec]').forEach(b=>b.onclick=()=>issue('decline',+b.dataset.dec));
  $('board').onclick=e=>{ const r=e.target.closest('[data-pid]'); if(!r) return; const p=players[+r.dataset.pid]; const c=p.labelPos||centroid(p); cam.x=cv.width/2-c[0]*cam.s; cam.y=cv.height/2-c[1]*cam.s; };
  $('board').onmouseover=e=>{ const r=e.target.closest('[data-pid]'); highlightId=r?+r.dataset.pid:-1; }; $('board').onmouseleave=()=>{ highlightId=-1; drawMap(); };
  const dead=players.filter(p=>!p.alive&&p.kind!=='neutral'&&p.killedBy!=null).sort((a,b)=>(b.diedAt||0)-(a.diedAt||0));
  const sorted=players.filter(p=>p.alive&&p.kind!=='neutral').sort((a,b)=>b.tiles-a.tiles).slice(0,8);
  $('board').innerHTML=sorted.map(p=>`<div data-pid="${p.id}" style="cursor:pointer"><span><i class="sw" style="background:${p.color}"></i><img src="${flagURL(p.flag)}" width="18" height="12" style="border-radius:1px" alt="">${p.team!=null?`<span style="font-size:10px;color:${TEAM_COLS[p.team]};margin-right:4px">${TEAM_NAMES[p.team][0]}</span>`:''}${p===me?'<b>You</b> <span class="muted">('+me.name+')</span>':p.name}${relBadge(p)}</span><span>${(p.tiles/landCount*100).toFixed(1)}% · ${knownTroops(p)}</span></div>`).join('')+dead.map(p=>`<div style="opacity:.55"><span><i class="sw" style="background:${p.color}"></i><img src="${flagURL(p.flag)}" width="18" height="12" style="border-radius:1px;filter:grayscale(1)" alt=""> <s>${p.name}</s></span><span class="muted">✕ by ${players[p.killedBy].name}</span></div>`).join('');
}
function log(msg,mine){ if(SAVES.catchup||REPLAY.creditsMode) return; const p=document.createElement('p'); p.textContent=msg; if(mine) p.className='me'; const l=$('log'); l.prepend(p); while(l.children.length>40) l.lastChild.remove(); }
$('ratio').oninput=e=>$('ratioLbl').textContent=e.target.value+'%';
window.addEventListener('beforeunload',()=>{ if(me&&!over&&!me.recorded) recordMatch('Abandoned'); });
$('pauseBtn').onclick=()=>{ if(closePauseModal()) return; if(me&&!over&&!REPLAY.on&&!userPaused) openPauseModal(); else togglePause(); };
$('restartBtn').onclick=()=>{ if(!me) return; const wasPaused=userPaused; if(!userPaused) togglePause(); $('restart').style.display='flex'; $('restart').dataset.wasPaused=wasPaused?'1':'0'; };
$('restartNo').onclick=()=>{ $('restart').style.display='none'; if($('restart').dataset.wasPaused!=='1'&&userPaused) togglePause(); };
$('restartYes').onclick=()=>{ if(me&&!over) recordMatch('Abandoned'); // remember the start-card choices, then reload the page
  try{ sessionStorage.setItem('statefall-restart',JSON.stringify({seed:START.seed,diff:chosen,map:START.map,teams:START.teams,country:chosenFlag?chosenFlag.idx:null,quick:$('quickStart').checked,fog:$('fogOn').checked,instant:$('instantOn').checked,risky:$('riskyOn').checked,endgame:$('endgameOn').checked,billionaire:$('billionaireOn').checked,garrison:$('garrisonOn').checked,troops:$('stTroops').value,gold:$('stGold').value,bots:$('stBots').checked,noCap:$('stNoCap').checked,pauseBuild:$('stPauseBuild').checked})); }catch(e){}
  location.reload(); };
$('satBtn').onclick=()=>issue('sat');
$('saveBtn').onclick=()=>{ if(!me) return; if(over){ openModal(canSave()?'<div class="card" style="text-align:center;width:min(440px,94vw)"><h2 style="margin:0 0 8px;font-size:22px">This match is finished</h2><p class="muted" style="font-size:13px;margin:0 0 12px">Its replay is already in your account. Find it under Games &amp; replays on the start card.</p><button data-close style="padding:7px 14px">OK</button></div>':loginPitch('Keep a replay of this match')); return; } openSaveModal(); };
$('restartSave').onclick=()=>{ $('restart').style.display='none'; saveAndQuit(); }; const ovS=$('ovSave'); if(ovS) ovS.onclick=()=>{ if(!canSave()){ openModal(loginPitch('Keep a replay of this match')); return; } openModal('<div class="card" style="text-align:center;width:min(440px,94vw)"><h2 style="margin:0 0 8px;font-size:22px">Replay saved</h2><p class="muted" style="font-size:13px;margin:0 0 12px">Every finished match is kept in your account automatically. Open Games &amp; replays on the start card to watch it, share it, or download a copy.</p><button data-close style="padding:7px 14px">OK</button></div>'); };
$('gamesBtn').onclick=()=>openGamesModal(); $('ovExit').onclick=()=>PLATFORM.navigate(WP&&WP.homeUrl?WP.homeUrl:'/');
$('rpSpeed').querySelectorAll('button').forEach(b=>b.onclick=()=>{ REPLAY.speed=+b.dataset.sp; $('rpSpeed').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); }); $('rpTake').onclick=()=>{ replayTakeOver(); log('You have taken control.',true); }; $('rpExit').onclick=()=>PLATFORM.reload();
$('jukePrev').onclick=()=>{ audioInit(); jukeNext(-1); }; $('jukeNext').onclick=()=>{ audioInit(); jukeNext(1); }; $('jukePause').onclick=()=>{ audioInit(); jukePause(); }; $('jukeMode').querySelectorAll('button').forEach(b=>b.onclick=()=>{ JUKE.mode=b.dataset.mode; jukeSave(); if(JUKE.src) JUKE.src.loop=JUKE.mode==='one'; jukeRender(); });
if(WP) jukeLoad(); setInterval(()=>{ if(JUKE.loaded&&(JUKE.src||(JUKE.cur&&JUKE.cur.id==='builtin'))) jukeRender(); },1000);
$('recallDmg').onclick=()=>issue('recallAll','dmg');
$('recallAll').onclick=()=>issue('recallAll','all');
$('airAuto').onchange=e=>{ issue('airAuto',e.target.checked); };
$('logAuto').onchange=e=>{ issue('logAuto',e.target.checked); };
$('autoFire').onchange=e=>{ issue('autoFire',e.target.checked); log(e.target.checked?'Missile command: auto-fire on.':'Missile command: auto-fire off.',true); };
$('sndBtn').onclick=()=>{ $('audioModal').style.display='flex'; jukeRender(); }; $('audioClose').onclick=()=>{ $('audioModal').style.display='none'; }; $('mpList').onclick=()=>{ audioInit(); $('audioModal').style.display='flex'; jukeRender(); };
$('mpPrev').onclick=()=>{ audioInit(); jukeNext(-1); }; $('mpNext').onclick=()=>{ audioInit(); jukeNext(1); }; $('mpPause').onclick=()=>{ audioInit(); jukePause(); };
function iconURL(type,col='#7fb3ff'){ const c=document.createElement('canvas'); c.width=c.height=44; drawIcon(type,22,22,18,col,c.getContext('2d')); return c.toDataURL(); }
function airURL(kind,col='#7fb3ff'){ const c=document.createElement('canvas'); c.width=64; c.height=40; const x=c.getContext('2d'); x.translate(32,20); x.rotate(-0.3); x.scale(1.6,1.6); x.fillStyle=col; x.strokeStyle='#fff'; x.lineWidth=1.1;
  if(kind==='fighter'){ x.beginPath(); x.moveTo(10,0); x.lineTo(1,-2); x.lineTo(-5,-8); x.lineTo(-7,-8); x.lineTo(-5,-2); x.lineTo(-9,-2); x.lineTo(-10,-4); x.lineTo(-10,4); x.lineTo(-9,2); x.lineTo(-5,2); x.lineTo(-7,8); x.lineTo(-5,8); x.lineTo(1,2); x.closePath(); }
  else if(kind==='bomber'){ x.beginPath(); x.moveTo(8,0); x.lineTo(-2,-3); x.lineTo(-10,-9); x.lineTo(-6,-2); x.lineTo(-7,0); x.lineTo(-6,2); x.lineTo(-10,9); x.lineTo(-2,3); x.closePath(); }
  else if(kind==='carrier'){ x.beginPath(); x.moveTo(11,0); x.lineTo(6,-3); x.lineTo(-8,-3); x.lineTo(-11,-1); x.lineTo(-11,1); x.lineTo(-8,3); x.lineTo(6,3); x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.moveTo(1,-3); x.lineTo(-3,-11); x.lineTo(-7,-11); x.lineTo(-4,-3); x.moveTo(1,3); x.lineTo(-3,11); x.lineTo(-7,11); x.lineTo(-4,3); x.closePath(); }
  else { x.beginPath(); x.moveTo(9,0); x.lineTo(2,-2); x.lineTo(-2,-9); x.lineTo(-5,-9); x.lineTo(-4,-2); x.lineTo(-8,-2); x.lineTo(-9,-4); x.lineTo(-10,-4); x.lineTo(-10,4); x.lineTo(-9,4); x.lineTo(-8,2); x.lineTo(-4,2); x.lineTo(-5,9); x.lineTo(-2,9); x.lineTo(2,2); x.closePath(); }
  x.fill(); x.stroke(); return c.toDataURL(); }
function shipURL(cls,col='#7fb3ff'){ const c=document.createElement('canvas'); c.width=64; c.height=36; drawShip(cls,32,18,0,cls==='battleship'?13:cls==='scout'?9:cls==='transport'?16:11,col,null,null,c.getContext('2d')); return c.toDataURL(); }
const HELP={
 basics:()=>`<p>Start small, eat the neutral countries around you, build an economy and a navy, hold 72% of the land. Matches run 15–25 minutes.</p>
 <h3>Controls</h3><table class="ktable">
 <tr><td>Left-click a bordering country</td><td>Invade along the whole shared frontier with the share of your army set by the <b>Send into attack</b> slider. The advance stops when that country falls; click again to reinforce.</td></tr>
 <tr><td>Right-click your land</td><td>Build menu (or cancel a construction site).</td></tr>
 <tr><td>Right-click enemy land</td><td>Send a transport, launch a missile, diplomacy, missile-command focus.</td></tr>
 <tr><td>Right-click water</td><td>Send a ship from your nearest port, or a port on your own coast.</td></tr>
 <tr><td>Click a ship · Shift-drag</td><td>Select ships. Right-click water to move them, an enemy port to blockade. Esc deselects.</td></tr>
 <tr><td>Scroll · drag · Space</td><td>Zoom · pan · pause.</td></tr>
 <tr><td>Saves and replays</td><td>Logged-in players get saves and replays on their account. The game autosaves every 30 seconds; Save & quit on the pause card (Space or ⏸) keeps a named copy and returns to the site; 💾 saves without leaving. Every finished match is kept as a replay. Games & replays on the start card lists them: Resume picks a match up where you stopped on any device, Watch plays a replay at 1–8× with a Take over button, and Download keeps a .state copy. </td></tr>
 <tr><td>Hotkeys</td><td>Press a key, then click a tile. Each key is shown as a badge in the build menu. <kbd>C</kbd> city · <kbd>F</kbd> factory · <kbd>P</kbd> port · <kbd>S</kbd> SAM · <kbd>H</kbd> shield · <kbd>M</kbd> silo · <kbd>K</kbd> missile command · <kbd>D</kbd> bastion · <kbd>G</kbd> shore guns · <kbd>B</kbd> coastal battery · <kbd>T</kbd> Big Bertha · <kbd>A</kbd> airfield · <kbd>O</kbd> flight operations · <kbd>U</kbd> submarine base · <kbd>Y</kbd> troop command · <kbd>E</kbd> engineering command · <kbd>R</kbd> radar · <kbd>L</kbd> long-range radar · <kbd>J</kbd> jammer · <kbd>I</kbd> satellite site · <kbd>N</kbd> missile · <kbd>Space</kbd> pause · <kbd>Esc</kbd> cancel · <kbd>[</kbd> <kbd>]</kbd> previous / next song.</td></tr>
 <tr><td>Economy slider</td><td>Shift growth between troops (1.6× at the end) and gold (1.6× at the other end).</td></tr>
 </table>
 <h3>Rules of thumb</h3><table class="ktable">
 <tr><td>Density</td><td>Troops ÷ tiles. Land costs more to take the denser its defender; a thin army is cheap to invade and invites neutrals and allies to turn on you.</td></tr>
 <tr><td>Neutrals</td><td>Never attack first. Once hit they mobilize and push back for ~40 s, but only against an attacker spread thinner than they are. Conquering one pays plunder — tripled in the first minutes.</td></tr>
 <tr><td>Landmasses</td><td>Own every tile of an island or continent for a one-time troop windfall and a lasting growth bonus. Rivers block land attacks; cross them by transport.</td></tr>
 <tr><td>Nuked</td><td>When a missile lands on your land, a red card at the top of the screen names the attacker ("NUKED BY EGYPT"), an air-raid siren sounds, the launching silo flashes red rings for as long as the siren sounds (about 9 s), and if the silo is off screen a flashing red arrow at the screen edge points toward it with the attacker's name. Right-click their land to concentrate missile command on them.</td></tr>
 <tr><td>Fallen nations</td><td>When a named nation is wiped out, a banner takes the centre of the screen for a few seconds — its flag struck through, "EGYPT — FALLEN, killed by France", the killer's flag at the right — without interrupting play, and a short bugle call sounds (quietly if you weren't involved). Fallen nations stay at the bottom of the sidebar list, struck through, with who killed them. The same banner in gold announces a continent unified — by anyone — or any landmass you unify yourself, with the windfall and the hold bonus it now pays, and a short fanfare.</td></tr>
 <tr><td>Collapse</td><td>A nation whose army hits zero while you're taking its land falls at once on the landmasses you're fighting on — the rest of its territory there is yours without painting it tile by tile. The same happens to anyone reduced to under 25 tiles. Holdings across water are not touched: the nation survives there as a rump state until someone lands on it.</td></tr>
 <tr><td>Unclaimed land</td><td>Craters and burnt ground cost nothing to take — the troops you commit set the speed and come home in full when it's done. Fighting a nation costs troops per tile — more the denser the defender, up to 8 per tile — and never more in total than about 1.5× what the defender has left, plus attrition of 10% of what the fight cost. Everything you didn't spend comes home.</td></tr>
 <tr><td>Force and speed</td><td>An attack that can afford many sweeps of its front advances up to 3× faster; one that can barely pay crawls.</td></tr>
 </table>`,
 build:()=>`<div class="hcards">${Object.values(STRUCT).map(S=>`<div class="hcard"><img src="${iconURL(S.key)}" width="44" height="44" alt=""><div><div class="t">${S.label}</div><div class="m">${S.cost} gold${BUILD_TICKS[S.key]?' · '+Math.round(BUILD_TICKS[S.key]/10)+' s':' · instant'}</div><div class="d">${S.desc.replace(/^\d+ (s|min) to build\. /,'')}</div></div></div>`).join('')}</div>
 <h3>Notes</h3><table class="ktable">
 <tr><td>Spacing</td><td>Buildings need 6 tiles of clearance from each other. You don't have to be exact: click within 5 tiles of a valid spot and the building lands on the nearest tile that fits (coastal buildings on the nearest coast).</td></tr>
 <tr><td>Supply lines</td><td>A factory links to every city and port of yours within 34 tiles (4 per factory, 3 per city, 2 per port). Each line: +30% gold for the factory; +1.2 troops/s per line for a city; +1 gold/s and 15% cheaper ships for a port.</td></tr>
 <tr><td>Construction</td><td>Sites do nothing until finished, can be captured (progress kept) or bombarded, and cancelled for half the gold. A city with three linked factories speeds nearby building by 25%.</td></tr>
 <tr><td>Cities</td><td>+300 troops the moment they're built.</td></tr>
 </table>`,
 ships:()=>`<div class="hcards">${Object.values(SHIPS).map(S=>`<div class="hcard"><img src="${shipURL(S.key)}" width="64" height="36" alt=""><div><div class="t">${S.label}</div><div class="m">${S.cost} gold · ${SHIP_BUILD[S.key]?Math.round(SHIP_BUILD[S.key]/10)+' s':'instant'} · ${S.hp} hp · ${Math.round(S.speed*10)} tiles/s</div><div class="d">Gun ${S.gun}${S.dmg>1?' (×'+S.dmg+')':''}${S.sam?' · SAM '+S.sam+' ('+Math.round(S.samHit*100)+'%)':''}${S.barrage?' · barrage '+S.barrage.count+' missiles / '+S.barrage.range+' tiles every '+Math.round(S.barrage.cd/10)+' s':''}. ${S.desc}</div></div></div>`).join('')}</div>
 <h3>Notes</h3><table class="ktable">
 <tr><td>Cruise missiles</td><td>Select a battleship within 34 tiles of one of your level II ports and right-click water: <b>Refit with cruise missiles</b>, 400 gold, 30 s at anchor. It then fires two cruise missiles every 40 s at targets up to 120 tiles inland — shield generators first, then SAM sites, then anything of a nation it's fighting. They fly straight and low at 25 tiles/s (a silo missile lobs at up to 60), so a 120-tile shot takes about 5 s. Each hit craters a 3-tile radius like a bomb; SAMs engage them at 60% of normal effectiveness; a shield dome absorbs one for 1 hp. The ship shows a "CM" badge.</td></tr>
 <tr><td>Submarines</td><td>A submarine base (450 gold, coast, needs a level II port within 34 tiles) builds <b>attack subs</b> (300 gold, 3 hp, torpedoes: 3 damage, one-shot ordinary transports, 10 s reload, 14 tiles) and <b>hunter subs</b> (300 gold, 3 hp, torpedo only other subs, spot them at 20 tiles). Subs are invisible — and untargetable — unless within 8 tiles of a destroyer or radar ship, or 20 of a hunter; under fog they're hidden outright. Their torpedoes aren't: a torpedo leaves a long foam wake you can see whenever the water is in view, which tells you a sub is out there and roughly where. Guns, batteries and heavy transports can't fire at them at all. They carry no SAM and don't shoot land. Attack subs engage transports headed for their owner and ships of nations they're fighting, plus loitering cruisers and battleships.</td></tr>
 <tr><td>Transports</td><td>Right-click a country you don't border. Embarks from your coast nearest to them, lands on theirs; no port needed. One hit sinks it — unless it's a <b>heavy transport</b>: once you own a level II port (per area with Garrisons, everywhere without), every transport you send — invasions, reinforcements, gifts — sails as a heavy: 4 hp, 25% slower, and a 12-tile gun that returns fire at whatever shot it last (never at subs). A lone destroyer loses the exchange; shore guns in pairs still win.</td></tr>
 <tr><td>Upgrades</td><td>Right-click a finished port or airfield to upgrade it to level II (port 500 gold / 60 s; airfield 600 / 90 s). Level shows as "II" on the icon; captured buildings keep their level; bombardment knocks a level II back to I instead of destroying it. Port II: built-in shore guns with 4 hp of their own, shown as pips under the icon (red when low; right-click the port to repair them, 25 gold per pip) — ships and heavy transports shoot back at them, and when they're shot out the port drops to level I — plus heavy transports and the submarine-base unlock. Airfield II: 6 hangar slots, light shield dome, stealth troop transports.</td></tr>
 <tr><td>Salvage</td><td>Sinking a transport pays 30% of the troops aboard in gold; a merchant pays 60.</td></tr>
 <tr><td>Barrage</td><td>Craters land, kills troops (20 + 0.8% of the army per hit, max 150, plus whoever was standing on the cratered tiles) and suppresses the area for 30 s: half cost to invade, bastions and SAM sites there knocked out. Hunts SAM sites first.</td></tr>
 <tr><td>Merchants</td><td>Every port sends one every ~20 s to any port you aren't fighting. Both sides earn gold on arrival. Blockade an enemy port to starve it — or send privateers: they grapple any non-allied merchant within 8 tiles — it heaves to while the privateer comes alongside, then 2 s of boarding, which then sails to your nearest port and pays double cargo on arrival. One capture per 10 s per privateer; piracy starts hostilities.</td></tr>
 </table>`,
 garrisons:()=>`<p>A toggle at the top of the start card. It changes what an army <i>is</i>, so it gets its own page.</p><p>Normally your army is one number that defends every tile you own. With Garrisons on, troops live where they are: every <b>contiguous area</b> of your land has its own garrison, and water — sea or river — is what separates areas. Growth accrues per area in proportion to its land; a city's +300 goes to the city's area; a continent windfall lands on that continent.</p><p><b>Attacking:</b> left-click a bordering nation and the attack draws the slider's share of the area that shares the border. Survivors return to that area. To send from somewhere else, right-click the target and choose <b>Send troops here from an area you click</b>, then click any of your land: that area sends the slider's share of its own garrison — by land if it borders the target, otherwise by transport. <b>Reinforcing</b> your own area works the same way: right-click it, "Reinforce this area from an area you click", click the source. Transports face shore guns and warships on the way, so a distant stronghold helps only as fast as your navy can carry it. <b>Merging</b> is automatic — conquer the land between two areas and their garrisons combine; lose a corridor and they split. <b>Defense</b> reads the local garrison: neutrals push back and allies betray based on the density of the area they touch, and every casualty from bombardment, bombs and nukes comes off the area that was hit. The sidebar lists your areas (hover to highlight) and the map shows each garrison's count. Bots follow the same rules and ship reinforcements to thin beachheads.</p>

 <h3>Why play it</h3><p>Without Garrisons, a big empire is safe everywhere at once. With it, every coastline you hold is only as safe as the troops actually standing on it, and the navy becomes your logistics as well as your weapon. Expect more small wars at the edges, more use of ports and shore guns, and a real reason to consolidate land into connected blocks before pushing on.</p>
 <h3>Tips</h3><table class="ktable"><tr><td>Watch the list</td><td>The sidebar area list is your early warning. A beachhead reading 80 troops next to an enemy at 3,000 is about to be pushed back into the sea.</td></tr><tr><td>Cities on the front</td><td>A city's +300 lands in its own area, so building one on a beachhead is the fastest way to stiffen it.</td></tr><tr><td>Bridge the river</td><td>Two areas split by a river merge the moment you own both banks all the way around — often cheaper than ferrying reinforcements for the rest of the match.</td></tr><tr><td>Escort the convoys</td><td>Reinforcements sail as transports and die to one hit. A destroyer on the lane and shore guns at the landing make the difference.</td></tr></table>`,
 about:()=>`<h3>Statefall RTS</h3><p><b>Version ${GAME_VERSION}</b> · build ${GAME_BUILD}${WP&&WP.version?' · site package '+WP.version:''}</p><p>A real-time strategy game that runs in a browser tab. Start as one small nation among a hundred, eat the neutral countries around you, build an economy and a navy, and hold 72% of the land against nine rival nations. A match runs 15–25 minutes.</p>
 <h3>Community</h3><p>${WP?`Talk strategy, share seeds, and report bugs or suggestions on the <a href="${WP.communityUrl||'/community/'}" target="_blank">community board</a>. Include the seed of the match (shown in the sidebar) when it's about a specific map.`:'Talk strategy and report bugs on the community board at the Statefall site.'}</p>
 <h3>Your data</h3><p>${WP?`Playing here while logged in posts each finished match to the site's community leaderboard under your account. Scores are player-submitted and are not independently verified. See the site's <a href="${WP.privacyUrl||'/privacy-policy/'}" target="_blank">privacy policy</a> for exactly what is kept.`:'Playing from a file keeps everything on this device.'}</p>
 <h3>Credits</h3><p>Designed and built by That Company. Map data: Natural Earth (public domain).</p>
 <h3>Recent changes</h3><table class="ktable">
 <tr><td>1.10.9</td><td>Vite and ES modules, with the legacy Canvas renderer and simulation behavior preserved.</td></tr>
 <tr><td>1.10.8</td><td>Seeded target selection is deterministic across JavaScript engines, with one random key generated per candidate before sorting.</td></tr>
 <tr><td>1.10.7</td><td>Site rankings are now explicitly labeled as community-submitted and not independently verified.</td></tr>
 <tr><td>1.10.6</td><td>Security update: saved and public replay nation data is validated and normalized before display, and notices render untrusted text safely.</td></tr>
 <tr><td>1.10.0</td><td>Bastions stack: every bastion covering a tile doubles the cost of taking it again, up to 64×; bastions upgrade to level II (24-tile range) and III (32 tiles); each one you own makes the next dearer. Shelling still cancels the bonus. Hover any tile to see its fortification.</td></tr>
 <tr><td>1.9.0</td><td>The credit roll replays your whole match behind the text, from the first province to the final shape of the map, paced to end with the credits.</td></tr>
 <tr><td>1.8.0</td><td>Your own nation: design a flag at 10 qualifying wins (fields, stripes, crosses, stars and 25 emblems), name it at 15, and at 25 it joins the world as a rival nation in other players' matches. Flags on the leaderboard and public player pages.</td></tr>
 <tr><td>1.7.0</td><td>Super hard and Impossible bots have an economy brain: city openings, no gold hoarding, coastal guns, gun-aware landings, earlier port upgrades and earlier coalitions against the leader. Replays are exact (three clock and random-number leaks fixed); divergences can be reported from the game; replays never post scores.</td></tr>
 <tr><td>1.6.0</td><td>Saves and replays live on your account: autosave, Save & quit from a new pause card, automatic replays of every finished match, and a Games & replays library with Resume, Watch, Rename, Delete and Download. Loading shows a progress bar and waits for Play now.</td></tr>
 <tr><td>1.5.0</td><td>Saves and replays: every order is recorded, matches are fully deterministic from the seed, and a match can be saved, resumed, watched at up to 8× and taken over. Groundwork for multiplayer.</td></tr>
 <tr><td>1.4.0</td><td>Custom credits builder: your own quote (the generals reply), a title, a dedication, a nemesis card, a highlight moment, a tone, and your choice of song, with a preview and Edit / Approve before anything is public. Draft picks are marked with flags and numbers. In-game music rotation fixed.</td></tr>
 <tr><td>1.3.0</td><td>Credits roll automatically to the victory or defeat track, open with a fade and a STARRING card, pan the whole map without leaving it, close with producer, music and disclaimer cards, and can be shared with Copy link. Watch pages end with a Play-this-map button.</td></tr>
 <tr><td>1.2.0</td><td>Credit roll: the match's campaign timeline, numbers, honours, rivals and fallen nations scroll over the final map to a song of your choice; every posted score has a public Watch page and a Facebook share; profiles show career totals.</td></tr>
 <tr><td>1.1.0</td><td>Music player: the site's music library with in-order, shuffle and loop-one modes, per-song selection, stings for victory, defeat and a #1 placement. Leaderboard Play buttons open the right class.</td></tr>
 <tr><td>1.0.0</td><td>Garrisons mode; airfields with fighters, bombers and troop transports; submarines; level II ports and airfields; shield generators; coastal guns and Big Bertha; missile, flight, troop and engineering command; seeded maps and restart; leaderboards with classes; banners for fallen nations and unified continents; tiered sound; the animation pass.</td></tr>
 </table>`,
 modes:()=>`<p>Modes change how a match starts or how the world works. Quick start, Risky start and End game are exclusive; everything else combines. Garrisons has its own tab. Each combination has its own leaderboard class.</p>
 <h3>Fog of war</h3><p>Ownership and names stay visible; troop counts, buildings, ships and missiles are hidden outside your vision. You see 8 tiles past your own and allied land, plus radar stations (45), long-range radar (110), radar ships (60), your warships (gun range), fighter patrols, spy planes (need an airfield) and the satellite. Radar jammers blank enemy radar within 30 tiles but not eyes. Your SAMs only engage missiles you can see; missile command only targets what you can see.</p>
 <h3>Quick start</h3><p>Everyone begins with a large contiguous holding absorbed from the neutrals around them, 4× troops and 5× gold. The land grab is mostly done; the match starts at the point where ports, factories and fronts matter.</p>
 <h3>Risky start</h3><p>Nobody starts with land. Players and bots draft neutral countries round-robin in a shuffled order, 2–8 picks each depending on the map, then the war begins. Picks can be anywhere — a concentrated block or a gamble spread across the map.</p>
 <h3>End game</h3><p>The whole map is divided between players and bots at the start by flood-fill from each spawn, no neutrals, everyone at 45,000 troops and 15,000 gold. It's the late game from minute zero.</p>
 <h3>Instant build</h3><p>No construction or shipyard timers — except shield generators and level II upgrades, which keep their timers so a shield can be worn down and not simply rebuilt on the spot. Repairs always take time.</p>
 <h3>Billionaire</h3><p>You alone start with a billion troops and a billion gold.</p>
 <h3>Paused orders</h3><p>Normally a paused game is for looking: no building, buying, launching or attacking until you unpause. This mode lets you give orders on a stopped clock. Because that's an advantage, matches played with it sit on their own leaderboard class ("Standard + Paused orders", and so on).</p>
 <h3>Teams</h3><p>Nations are dealt round-robin into 2, 3 or 4 permanent teams. Teammates can't declare war, share vision under fog, defend each other's land with SAMs and ships, trade automatically and can send aid. A team's combined land wins at 72%; map colors tint toward the team color.</p>
 <h3>Difficulty</h3><p>Difficulty changes what the bots <i>do</i>, not only how fast they grow. Super easy bots never learn. Easy bots place defenses sensibly. <b>Normal</b> bots also manage their economy slider and reinforce an attack that's winning — that's the level the game is balanced around. Hard bots remember where they were hit (missiles, landings, bombs, torpedoes, blockades) and build the answer there, pick a focus enemy for a few minutes at a time, break off attacks that stall, refuse pacts from a nation past 45% of the land and ally with each other against it. Super hard adds air power — an airfield by minute six, patrols, bombers, paradrops on thin coasts. Impossible does all of it with the biggest growth and aggression multipliers.</p>
 <h3>Settings</h3><p>Starting troops and gold (with an option to give bots the same), No troop cap (armies grow past the cap at full rate), and the list of allowed buildings, ships and weapons — disabling a unit removes it for everyone.</p>`,
 air:()=>`<div class="hcards">${[['fighter','Stealth fighter',`${AIR.fighter.cost} gold · ${AIR.fighter.build/10} s · ${AIR.fighter.hp} hp · ${Math.round(AIR.fighter.speed*10)} tiles/s`,'Patrols a 25-tile circle for 10 min, then 2 min refueling. Untouchable by SAMs. Kills bombers, troop transports and spy planes in its circle; dogfights enemy patrols with air-to-air missiles. Recall from the Air panel; repairs 1 pip per 20 s at base.'],['bomber','Stealth bomber',`${AIR.bomber.cost} gold · ${AIR.bomber.build/10} s · 1 hp · ${Math.round(AIR.bomber.speed*10)} tiles/s · range ${AIR.bomber.range}`,'Runs a 30-tile strip through the target dropping 8 bombs, each 1/8 of a nuke, cratering and suppressing. Holds bombs over friendly ground. Ignores SAMs and guns; stopped by fighters and shield domes.'],['carrier','Stealth troop transport',`${AIR.carrier?AIR.carrier.cost:500} gold · ${AIR.carrier?AIR.carrier.build/10:40} s · range ${AIR.carrier?AIR.carrier.range:200}`,'Airfield II only. Carries up to 1,500 troops and drops them by parachute anywhere in range — a beachhead with no coast, no port and no shore guns to face. Shot down by fighters; troops aboard are lost.'],['spy','Spy plane',`${FOG.plane.cost} gold · ${FOG.plane.cd/10} s cooldown`,'Fog of war only. Flies from an airfield, circles a 35-tile area for 45 s revealing everything in it. After 15 s on station SAM sites get up to three 15% shots; an enemy fighter patrol kills it.']].map(([k,n,m,d])=>`<div class="hcard"><img src="${airURL(k)}" width="64" height="40" alt=""><div><div class="t">${n}</div><div class="m">${m}</div><div class="d">${d}</div></div></div>`).join('')}</div>
 <h3>Notes</h3><table class="ktable">
 <tr><td>Airfield</td><td>600 gold, 90 s. 4 hangar slots (6 at level II). Buy aircraft from its right-click menu; aircraft have a combat radius from their home field (fighters 160, bombers 260, transports 200). Losing the field loses its aircraft. Upgrade to level II (600 gold, 90 s) adds a light shield dome (6 hp, 8 tiles) and the troop transport.</td></tr>
 <tr><td>Flight operations</td><td>400 gold, 60 s. Buys aircraft with a 300-gold reserve, keeps patrols over SAM belts, airfields, silos and guns, recalls fighters at 2 hp or when outnumbered, and strikes enemy targets not under fighters or a dome. Toggle in the Air panel.</td></tr>
 <tr><td>Dogfights</td><td>Overlapping enemy patrols exchange air-to-air missiles every 3 s — 85% to hit if you're outnumbered in the overlap, 60% otherwise. A recalled fighter takes parting shots while it escapes; at 0 hp it's gone.</td></tr>
 <tr><td>Recall</td><td>Air panel in the sidebar (per aircraft, Recall damaged, Recall all) or right-click near a patrol.</td></tr>
 </table>`,
 systems:()=>`<table class="ktable">
 <tr><td>Diplomacy</td><td>Right-click a nation: 3-minute pact or lasting alliance. Nobody can attack, land on, bombard or nuke the other; allies' SAMs and ships defend each other and trade automatically. Bots accept more readily when you're stronger, when they're already at war, and when your reputation is good — and break pacts with soft partners once the neutrals are gone. Declaring war halves your growth for a while and costs reputation.</td></tr>
 <tr><td>Allied aid</td><td>Right-click an ally to send gold or troops (by land if you share a border, else by transport) or to request either from their surplus. Allies under attack ask you for help in the Diplomacy panel.</td></tr>
 <tr><td>Air defense</td><td>SAM sites and ship SAMs engage missiles passing through their range — flight path, not just target — when the missile is aimed at their owner's or an ally's land, or their owner is at war with the launcher. 96% kill, 2.5 s reload: one site can stop two spaced missiles, not three together. Hover one of your SAM sites or ships to see your whole network (allies' too); enemy coverage isn't shown.</td></tr>
 <tr><td>Coast & artillery</td><td>Shore guns (14 tiles, rapid fire) sink transports and light ships; against armored hulls their damage is divided by 2 (destroyer), 3 (cruiser), 5 (battleship). Guns never fire on merchant ships. They fire at warships of nations you're in conflict with — attacks, bombardment, missiles or ship-to-ship fire in the last minute — plus any transport at all that comes within range (unless its owner is your ally or pact partner — sinking one starts hostilities), and any cruiser or battleship loitering in range. Nothing fires until the progress arc completes. Coastal batteries outrange a battleship's guns (34 tiles) and hit for 3 every 8 s. Both are knocked out while under bombardment, destroyed if overrun, and have hit points (shore guns 3, batteries 6): any armed ship of a nation you're fighting — or one your gun has fired on — shoots back with its main gun, and cruiser and battleship barrages target guns first. Big Bertha lobs an uninterceptable shell every 20 s at the nearest enemy building within 60 tiles — SAM sites, bastions and guns first — cratering and suppressing like a barrage. Ships hunt guns the way they hunt SAM sites, and a level II port's guns count as guns.</td></tr>
 <tr><td>Air</td><td><b>Airfield</b> 600 gold, 90 s: hangar for 4 aircraft, bought from its right-click menu; spy planes need one within 150 tiles. <b>Stealth fighter</b> 350 gold: right-click → Fighter patrol here — a 25-tile circle for 10 minutes, then 2 minutes refueling. Untouchable by SAMs. Kills any enemy bomber or spy plane in its circle. Overlapping enemy patrols dogfight: every 3 s each fighter risks 1 HP — 85% if outnumbered, 60% otherwise. Recall from the Air panel in the sidebar, or right-click near the patrol; a recalled fighter takes parting shots while it escapes, lands, repairs 1 pip per 20 s, and flies again — or dies en route at 0 HP. <b>Stealth bomber</b> 450 gold: right-click → Bomber strike here — flies to the point and runs a 30-tile strip dropping 8 bombs, each 1/8 of a nuke, cratering and suppressing. Bombs are held over your own or allied ground and the run extends until all 8 have found enemy land. Ignores SAMs and guns; stopped only by fighters and shield domes (1 dome HP per bomb). Big Bertha, batteries, silos and shields shrug off a single bomb 30% of the time. <b>Flight operations</b> 400 gold, 60 s: buys aircraft (2 fighters and 1 bomber per field, keeping a 300-gold reserve), patrols your SAM belts, airfields, silos and guns, recalls fighters at 2 HP or when outnumbered, and strikes enemy targets that aren't under fighters or a dome. Toggle in the Air panel.</td></tr>
 <tr><td>Shield generator</td><td>900 gold, 150 s. A 12-tile dome that stops every missile aimed inside it — the SAMs shoot first, and whatever they miss the dome absorbs at 100% — at a cost of 2 of its 10 hit points per missile. A nuke landing nearby can't reach under the dome either — the ground inside is untouched and the dome takes a hit for it. It never decays; it dies to hits, to barrages (cruisers hunt it first), or to being overrun. Right-click it to repair at 25 gold per pip, one pip per 6 s (pauses for 15 s after each hit; never instant). Naval guns, barrages and Big Bertha pass through the dome, so a shielded strongpoint has to be taken by fleet or by land.</td></tr>
 <tr><td>Missiles</td><td>280 gold from a silo (20 s reload each). A hit craters a 20-tile radius, destroys buildings and kills the troops standing on the cratered ground: a quarter of a big area's garrison if the circle covers a quarter of it, all of a small island's if it covers the island. To get through a defended coast, bombard the SAMs with cruisers first, or salvo.</td></tr>
 <tr><td>Engineering command</td><td>450 gold, 60 s. Keeps up to four repair trucks. Whenever something repairable on your contiguous land is damaged — a shield generator, an airfield II's shield, a coastal battery, shore guns, Big Bertha, a port II's guns — a truck drives out over your own land, repairs one pip every 8 s at 15 gold a pip (keeping a 150-gold reserve), and drives back. Any repair — truck or manual — pauses for 15 s after the target takes a hit. Trucks are lost if the ground under them is captured, and they can't cross water.</td></tr>
 <tr><td>Troop command</td><td>400 gold, 90 s. Each center adds 10% to troop growth, stacking to four (+40%). With Garrisons on it also runs logistics: every 4 s it looks for areas of 40+ tiles that are threatened — bordering a nation it's fighting or a provoked neutral, or under attack — and brings the most threatened up toward 60% of the home area's density (bare areas under 20% get topped up to 20%), counting troops already in transit, one shipment per area per 20 s, never more than 15% of home per shipment and never below a 30% home reserve. Before a convoy sails it checks the route: hostile warships within 20 tiles of the path, subs it can see, and enemy guns at the landing. If the lane is contested it paradrops instead when a troop transport is in range; otherwise it holds the convoy and tells you — except when the destination is actually under attack, when it runs the lane with half the shipment. Toggle in the sidebar.</td></tr>
  <tr><td>Command links</td><td>Command buildings draw dashed links to what they control — orange from missile command to the silos in its 45-tile range, cyan from flight operations to airfields, green from troop command to nearby cities and ports — with a pulse running along each, like the gold supply lines between factories and cities.</td></tr>
 <tr><td>Missile command</td><td>Controls silos within 45 tiles and fires them at the most valuable targets of nations you're fighting, waiting to fire the full salvo a SAM site needs. Overlapping centers cut missile prices 15% each (max 45%). Right-click a nation to focus it; toggle in the sidebar.</td></tr>
 <tr><td>Teams</td><td>Permanent alliances dealt round-robin; a team's combined land wins. Map colors tint toward the team color.</td></tr>
 <tr><td>End game</td><td>72% wins; you can keep playing. If only allies remain you choose between a shared victory proposal and war. 100% ends the match outright.</td></tr>
 <tr><td>Music player</td><td>On the site, the mixer gains a player: the site's music library for the start card and for matches, with ◀ ▮▮ ▶, In order / Shuffle / Loop one, and a checkbox per song to choose the rotation (one tick = just that song). Click a title to play it now; [ and ] skip. Victory and defeat stings duck the music; a #1 placement on the site has its own sting. The game's own generative score plays only when a list is empty or the game is played from a file.</td></tr>
 <tr><td>Music</td><td>The start card plays a written theme; the match plays a generative score that shifts sections every couple of minutes, never repeats exactly, and swells with percussion while you're under attack. Mixer has a Music slider and toggle.</td></tr>



 <tr><td>Leaderboard</td><td>Every finished match is recorded in this browser: result, country, map, difficulty, modes, time, land, nations eliminated, peak troops and the seed (click it to replay that map). Score = land% × difficulty × mode bonus (fog 1.25, risky 1.15) × result ÷ minutes. Each class of match has its own board: Standard, Billionaire, Quick start, End game, Risky start, Instant build, No cap, Custom start, teams — and combinations like "Quick start + Instant build". The dropdown opens on a combined view — the top 3 of every class you've played, each with a "Play a random … match" button that sets that class up with a random map, difficulty, country and seed and starts immediately; pick a class from the dropdown for its full board. A match you restart or leave is recorded as Abandoned. Best time per map and difficulty is highlighted in gold.</td></tr>
 <tr><td>Map seed</td><td>The seed on the start card decides the map, rivers, neutral borders and start positions. Restart keeps it, so you can retry the same opening; type a friend's seed to play their map; press New for a fresh one.</td></tr>
 <tr><td>Maps</td><td>Generated: Continents, Land (lakes and rivers, no ocean), Large / Medium / Small islands, Atoll. Real: World, Europe, Americas, Africa, Asia, Middle East — real countries in place, big ones split into provinces.</td></tr>
 </table>`
};
function showHelp(tab='basics'){ $('helpBody').innerHTML=HELP[tab](); document.querySelectorAll('.htab').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab)); $('help').style.display='flex'; }
document.querySelectorAll('.htab').forEach(b=>b.onclick=()=>showHelp(b.dataset.tab));
$('helpBtn1').onclick=()=>{ if(WP&&WP.howtoUrl) PLATFORM.navigate(WP.howtoUrl); else showHelp('basics'); }; $('helpBtn2').onclick=()=>showHelp('basics'); // start card → site pages when hosted; the in-game ? button keeps the modal
$('boardBtn').onclick=()=>{ if(WP&&WP.boardUrl) PLATFORM.navigate(WP.boardUrl); else showBoard(); }; $('ovBoard').onclick=()=>{ if(WP&&WP.boardUrl) window.open(WP.boardUrl,'_blank'); else showBoard(); }; // start card navigates; the end card keeps the match open
 $('lbClose').onclick=()=>{ $('lb').style.display='none'; }; $('lbClass').onchange=showBoard; $('lbClear').onclick=()=>{ if(confirm('Clear the leaderboard?')){ saveBoard([]); showBoard(); } }; $('helpClose').onclick=()=>{ $('help').style.display='none'; };
function syncMixer(){ document.querySelectorAll('.vol').forEach(r=>{ r.value=Math.round(AUD.vol[r.dataset.k]*100); $('v_'+r.dataset.k).textContent=r.value+'%'; }); $('ambOn').checked=AUD.vol.ambOn; $('musicOn').checked=AUD.vol.musicOn; $('muteAll').checked=AUD.vol.mute; }
document.querySelectorAll('.vol').forEach(r=>r.oninput=e=>{ AUD.vol[r.dataset.k]=r.value/100; $('v_'+r.dataset.k).textContent=r.value+'%'; applyVolumes(); });
$('ambOn').onchange=e=>{ AUD.vol.ambOn=e.target.checked; applyVolumes(); };
$('musicOn').onchange=e=>{ AUD.vol.musicOn=e.target.checked; applyVolumes(); if(AUD.vol.musicOn){ if(!MUS.mode&&!JUKE.src) MUS.start(me?'game':'menu'); } else { jukeStopSrc(0.3); MUS.stop(); } };
$('muteAll').onchange=e=>{ AUD.vol.mute=e.target.checked; applyVolumes(); };
$('sndTest').onclick=()=>{ audioInit(); snd('missile'); setTimeout(()=>snd('impact'),900); setTimeout(()=>snd('cash'),2400); };
syncMixer();
$('focus').oninput=e=>{ issue('focus',e.target.value/100); $('focusLbl').textContent=`${e.target.value}% troops · ${100-e.target.value}% gold`; updateUI(); };

// ---------------------------------------------------------------- go
let chosen='normal';
for(const k in DIFFS){ const o=document.createElement('option'); o.value=k; o.textContent=DIFFS[k].label+' — '+DIFFS[k].desc; $('diffSel').appendChild(o); }
$('diffSel').value='normal'; $('diffSel').onchange=e=>{ chosen=e.target.value; };
$('teamSel').onchange=e=>{ START.teams=+e.target.value; };
COUNTRIES.map((c,i)=>i).sort((a,b)=>COUNTRIES[a][0].localeCompare(COUNTRIES[b][0])).forEach(i=>{ const o=document.createElement('option'); o.value=i; o.textContent=COUNTRIES[i][0]; $('countrySel').appendChild(o); });
$('countrySel').onchange=e=>{ if(+e.target.value===-1){ const n=myNation(); if(n){ chosenFlag=n; document.querySelectorAll('.flagbtn').forEach(b=>b.classList.remove('on')); return; } } chosenFlag=countryByIdx(+e.target.value); document.querySelectorAll('.flagbtn').forEach(x=>x.classList.toggle('on',x.title===chosenFlag.name)); };
renderFlagPicker(); $('shuffleFlags').onclick=renderFlagPicker;
document.querySelectorAll('#maps button').forEach(b=>b.onclick=()=>{ START.map=b.dataset.m; document.querySelectorAll('#maps button').forEach(x=>x.classList.toggle('on',x===b)); });

const UNIT_LABELS={city:'City',factory:'Factory',port:'Port',sam:'SAM site',silo:'Missile silo',fort:'Bastion',command:'Missile command',airfield:'Airfield',flightops:'Flight operations',subbase:'Submarine base',troopcmd:'Troop command',engcmd:'Engineering command',shield:'Shield generator',battery:'Coastal battery',shore:'Shore guns',bertha:'Big Bertha',radar:'Radar station',lradar:'Long-range radar',satellite:'Satellite site',jammer:'Radar jammer',rship:'Radar ship',privateer:'Privateer',sub:'Attack sub',hunter:'Hunter sub',scout:'Scout boat',warship:'Destroyer',cruiser:'Missile cruiser',battleship:'Battleship',missile:'Missiles (nukes)'};
for(const k of ['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','troopcmd','engcmd','radar','lradar','satellite','jammer']){ const l=document.createElement('label'); l.innerHTML=`<input type="checkbox" checked data-u="${k}"> ${UNIT_LABELS[k]}${STRUCT[k].fog?' <span class="muted">(fog)</span>':''}`; $('unitsB').appendChild(l); }
for(const k of ['scout','rship','privateer','warship','cruiser','battleship','sub','hunter','missile']){ const l=document.createElement('label'); l.innerHTML=`<input type="checkbox" checked data-u="${k}"> ${UNIT_LABELS[k]}`; $('unitsS').appendChild(l); }
document.querySelectorAll('input[data-u]').forEach(c=>c.onchange=e=>{ if(e.target.checked) ALLOWED.add(c.dataset.u); else ALLOWED.delete(c.dataset.u); });
document.querySelectorAll('#modes input[data-group=layout]').forEach(c=>c.onchange=()=>{ const on=[...document.querySelectorAll('#modes input[data-group=layout]')].find(x=>x.checked); document.querySelectorAll('#modes input[data-group=layout]').forEach(x=>{ x.disabled=!!on&&x!==on; x.parentElement.style.opacity=x.disabled?0.45:1; }); });
$('settingsBtn').onclick=()=>{ $('settings').style.display='flex'; }; $('settingsClose').onclick=()=>{ $('settings').style.display='none'; };
$('musicBtn').onclick=()=>{ audioInit(); AUD.menuMute=!AUD.menuMute; if(AUD.menuMute){ jukeStopSrc(0.3); MUS.stop(); } else if(AUD.vol.musicOn){ if(!MUS.mode&&!JUKE.src) MUS.start('menu'); } $('musicBtn').style.opacity=!AUD.menuMute?1:0.5; };
{ const v=document.createElement('p'); v.className='muted sf-foot'; v.innerHTML=`Statefall RTS v${GAME_VERSION} · build ${GAME_BUILD}${WP&&WP.version?' · site package '+WP.version:''} · <a href="#" id="aboutLink">About</a>${WP?' · <a href="#" id="localBoardLink">this browser\'s board</a>':''}`; $('start').querySelector('.card').appendChild(v); v.querySelector('#aboutLink').onclick=e=>{ e.preventDefault(); showHelp('about'); }; const lb=v.querySelector('#localBoardLink'); if(lb) lb.onclick=e=>{ e.preventDefault(); lbScopeSel='local'; showBoard(); }; }
$('seedNew').onclick=()=>{ $('seedIn').value=newSeed(); };
if(WP){ const el=$('sfUser'); el.style.display=''; let last=''; try{ const lp=JSON.parse(localStorage.getItem('statefall-lastpost')||'null'); if(lp) last=`<br><span class="muted">Last score post: ${lp.ok?'posted — '+lp.msg:'failed — '+lp.msg}</span>`; }catch(e){} el.innerHTML=WP.user?`Playing as <b>${WP.user.name}</b> — finished matches post to the site · <a href="${WP.profileUrl}">Profile</a> · <a href="${WP.boardUrl}">Global board</a> · <a href="${WP.logoutUrl}">Log out</a> · <a href="#" id="sfTest">Test connection</a><span id="sfTestOut"></span>${last}`:`<a href="${WP.loginUrl}">Log in</a> or <a href="${WP.registerUrl}">register</a> to post scores to the site's leaderboard.`; sfFlushOutbox(); const tb=document.getElementById('sfTest'); if(tb) tb.onclick=async e=>{ e.preventDefault(); const out=document.getElementById('sfTestOut'); out.textContent=' …'; try{ const r=await fetch(WP.rest+'me',{credentials:'same-origin',headers:{'X-WP-Nonce':WP.nonce}}); const j=await r.json().catch(()=>({})); out.textContent=r.ok?` ✓ logged in as ${j.name}, ${j.matches} match${j.matches===1?'':'es'} on the site`:` ✗ ${r.status} ${j.message||j.error||''}`; if(r.ok&&!('subtle' in crypto)) out.textContent+=' — but this page is not a secure context (https), so signing will fail'; }catch(err){ out.textContent=' ✗ '+err; } }; }
try{ const qs=new URLSearchParams(location.search); const qcred=qs.get('credits'); if(qcred&&WP){ $('start').style.display='none'; $('side').classList.add('rolling'); document.body.insertAdjacentHTML('beforeend','<div id="credLoad" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0f1a26;z-index:20;color:#8fa3b8;font-size:15px">Loading the credits…</div>'); watchCredits(qcred); } const qload=qs.get('load'); if(qload&&WP){ if(!WP.user){ openModal(loginPitch('Games & replays')); } else { sfApi('saves/'+encodeURIComponent(qload)).then(full=>{ loadReplayFile(full.data,qs.get('mode')==='watch'?'watch':'resume',{id:+qload}); }).catch(e=>fail('Could not load that save: '+e.message)); } } const qseed=qs.get('seed'); if(qseed) $('seedIn').value=qseed.replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,16);
  const qcls=qs.get('cls'); if(qcls){ const parts=qcls.split(' + ').map(x=>x.trim()); const set=(id,v)=>{ const el=$(id); if(el) el.checked=v; };
    set('garrisonOn',parts.includes('Garrisons')); set('billionaireOn',parts.includes('Billionaire')); set('endgameOn',parts.includes('End game')); set('quickStart',parts.includes('Quick start')); set('riskyOn',parts.includes('Risky start')); set('instantOn',parts.includes('Instant build')); set('stNoCap',parts.includes('No cap')); set('stPauseBuild',parts.includes('Paused orders'));
    const tm=parts.find(x=>/^\d teams$/.test(x)); START.teams=tm?+tm[0]:0; if($('teamSel')) $('teamSel').value=String(START.teams);
    document.querySelectorAll('#modes input[data-group=layout]').forEach(c=>c.onchange&&c.onchange()); } }catch(e){}
PLATFORM.onLifecycle(state=>{ if(state==='pause'&&AUD.ctx?.state==='running') AUD.ctx.suspend().catch(()=>{}); });
if(!$('seedIn').value) $('seedIn').value=newSeed();
$('startBtn').onclick=()=>{ DIFF=DIFFS[chosen]; $('start').style.display='none';
  if(!REPLAY.on){ START.customBots=null; const pool=(WP&&Array.isArray(WP.nationPool))?WP.nationPool.filter(n=>n&&n.flag&&Array.isArray(n.flag.layers)&&n.name&&!(WP.user&&n.userId===WP.user.id)):[]; if(pool.length&&Math.random()<0.6){ const n=pool[Math.floor(Math.random()*pool.length)]; START.customBots=[{userId:n.userId,name:n.name,layers:n.flag.layers,slot:Math.floor(Math.random()*BOTS)}]; } }
  START.seed=($('seedIn').value.trim().replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,16))||newSeed(); $('seedIn').value=START.seed; { const gen=mulberry32(seedFrom(START.seed)); srandN=0; srand=()=>{ srandN++; return gen(); }; } /* everything from here on is reproducible from the seed */ AUD.menuMute=false; if(AUD.ctx&&AUD.vol.musicOn&&!ROLL.on) MUS.start('game');
  START.troops=Math.max(0,+$('stTroops').value||0); START.gold=Math.max(0,+$('stGold').value||0); START.bots=$('stBots').checked; START.noCap=$('stNoCap').checked; START.quick=$('quickStart').checked; START.fog=$('fogOn').checked; START.instant=$('instantOn').checked; START.risky=$('riskyOn').checked&&!$('endgameOn').checked; START.endgame=$('endgameOn').checked; START.billionaire=$('billionaireOn').checked; START.garrison=$('garrisonOn').checked; START.pauseBuild=$('stPauseBuild').checked;
  setup(); exposeStateOracle(); if(window.__STATEFALL_TEST_PAUSE_ON_START__===true) paused=true; colorCache(); resize();
  cam.s=2.2; cam.x=cv.width/2-(me.sx+.5)*cam.s; cam.y=cv.height/2-(me.sy+.5)*cam.s; $('mySw').style.background=me.color; $('myFlag').src=flagURL(me.flag,36,24); $('myName').textContent=me.name;
  drawMap(); updateUI(); if(window.__tickTimer) clearInterval(window.__tickTimer); window.__tickTimer=setInterval(()=>{ tick(); if(tickN%300===0&&!paused) autoSave(); if(REPLAY.on){ for(let i=1;i<REPLAY.speed;i++){ if(REPLAY.creditsMode&&tickN>=REPLAY.toTick) break; tick(); } if(REPLAY.creditsMode&&tickN>=REPLAY.toTick) paused=true; if(tickN%10===0&&!REPLAY.creditsMode){ const ri=$('rpInfo'); if(ri) ri.textContent=`${REPLAY.i}/${REPLAY.cmds.length} commands${REPLAY.mismatch?' · diverged':''}`; } } },TICK); if(!window.__renderLoop){ window.__renderLoop=true; requestAnimationFrame(render); } log(`Seed ${START.seed}. Difficulty: ${DIFF.label}${START.quick?', quick start':''}. Starting with ${Math.round(me.troops)} troops and ${Math.round(me.gold)} gold.`,true); };
// restore start-card choices after a restart (runs last, once everything is built)
{ let saved=null; try{ saved=JSON.parse(sessionStorage.getItem('statefall-restart')||'null'); sessionStorage.removeItem('statefall-restart'); }catch(e){}
  if(saved){ if(saved.seed) $('seedIn').value=saved.seed; chosen=saved.diff||'normal'; $('diffSel').value=chosen; START.map=saved.map||'random'; document.querySelectorAll('#maps button').forEach(x=>x.classList.toggle('on',x.dataset.m===START.map)); START.teams=saved.teams||0; $('teamSel').value=String(START.teams);
    if(saved.country!=null){ chosenFlag=countryByIdx(saved.country); $('countrySel').value=saved.country; document.querySelectorAll('.flagbtn').forEach(x=>x.classList.toggle('on',x.title===chosenFlag.name)); }
    for(const [id,v] of [['quickStart',saved.quick],['fogOn',saved.fog],['instantOn',saved.instant],['riskyOn',saved.risky],['endgameOn',saved.endgame],['billionaireOn',saved.billionaire],['garrisonOn',saved.garrison],['stBots',saved.bots],['stNoCap',saved.noCap],['stPauseBuild',saved.pauseBuild]]) $(id).checked=!!v;
    $('stTroops').value=saved.troops||120; $('stGold').value=saved.gold||100; document.querySelectorAll('#modes input[data-group=layout]').forEach(c=>c.onchange&&c.onchange()); } }
