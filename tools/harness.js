// Shared headless engine loader for trailers. boot(opts) → {S, main, ctx, W0, H0, els, tick(n)}
const fs=require('fs'),path=require('path'); const { createCanvas, Image } = require('canvas');
module.exports=function boot(opts={}){
  const gameFile=opts.file||process.env.GAME||path.resolve(__dirname,'..','game','index.html');
  const html=fs.readFileSync(gameFile,'utf8'); const src=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
  global.Image=Image; const W0=opts.w||1280,H0=opts.h||720; const main=createCanvas(W0,H0);
  const stub=()=>new Proxy(function(){}, {get:(t,k)=>k==='length'?0:k==='checked'?false:k==='value'?'50':k==='style'?stub():k==='classList'?stub():(k===Symbol.toPrimitive?()=>800:stub()), set:()=>true, apply:()=>stub()});
  const vals={stTroops:String(opts.troops??120),stGold:String(opts.gold??100),focus:'50',ratio:'50',seedIn:opts.seed||'',diffSel:opts.diff||'hard',teamSel:String(opts.teams||0)};
  const els={}; global.document={querySelector:()=>stub(),getElementById:(id)=>{ if(id==='map') return main; if(vals[id]!==undefined&&!els[id]){ els[id]={value:vals[id],checked:false,style:{},textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,dataset:{},appendChild(){},after(){},remove(){},focus(){}}; } return els[id]||(els[id]=stub()); },createElement:(tag)=>tag==='canvas'?createCanvas(64,64):stub(),querySelectorAll:()=>[],body:stub(),addEventListener(){}};
  global.window={addEventListener(){},innerWidth:W0,innerHeight:H0,STATEFALL_WP:null,devicePixelRatio:1,location:{search:''}};
  global.__now=0; global.performance={now:()=>global.__now}; global.localStorage={getItem:()=>null,setItem(){},removeItem(){}}; global.sessionStorage=global.localStorage;
  global.requestAnimationFrame=()=>{}; global.setInterval=()=>1; global.clearInterval=()=>{}; global.setTimeout=(f)=>{}; global.location={search:''}; global.crypto={subtle:{}}; global.navigator={clipboard:null};
  global.tip=stub(); global.ovTitle=stub(); global.ovText=stub(); global.overlay=stub(); global.ratio={value:50};
  main.getBoundingClientRect=()=>({left:0,top:0,width:W0,height:H0}); main.addEventListener=()=>{}; main.style={};
  global.__opt=opts;
  let code=src.replace("$('startBtn').onclick=()=>{","global.__start=()=>{").replace("let chosen='normal'","let chosen='"+(opts.diff||'hard')+"'").replace("START.seed=($('seedIn').value.trim().replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,16))||newSeed();","START.seed='"+(opts.seed||'TRAILER')+"';");
  if(opts.gridW&&opts.gridH) code=code.replace('const W=720, H=414, TICK=100;',`const W=${opts.gridW}, H=${opts.gridH}, TICK=100;`);
  code=code.replace("START.quick=$('quickStart').checked;","START.quick=!!global.__opt.quick;").replace("START.garrison=$('garrisonOn').checked;","START.garrison=!!global.__opt.garrison;").replace("START.instant=$('instantOn').checked;","START.instant=!!global.__opt.instant;").replace("START.noCap=$('stNoCap').checked;","START.noCap=!!global.__opt.noCap;").replace("START.bots=$('stBots').checked;","START.bots=!!global.__opt.bots;").replace("START.fog=$('fogOn').checked;","START.fog=!!global.__opt.fog;").replace("START.risky=$('riskyOn').checked&&!$('endgameOn').checked;","START.risky=!!global.__opt.risky;").replace("START.endgame=$('endgameOn').checked;","START.endgame=!!global.__opt.endgame;").replace("START.billionaire=$('billionaireOn').checked;","START.billionaire=!!global.__opt.billionaire;").replace("START.pauseBuild=$('stPauseBuild').checked;","START.pauseBuild=!!global.__opt.pauseBuild;");
  code=code.replace("function end(title,text){","function end(title,text){ if(!global.__allowEnd) return;");
  code=code.replace("function drawMap(){","function drawMap(){ if(global.__opt.render===false) return;");
  code=code.replace("if(!REPLAY.on){ START.customBots=null;","if(!REPLAY.on&&!global.__opt.customBots){ START.customBots=null;");
  if(opts.frenzy){ code=code.split("rnd(6000,12000)/(DIFF.build||1)").join("1200").split("rnd(4000,8000)/(DIFF.build||1)").join("900"); }
  code=code.replace("  { const total=(ROLL.tEnd||ROLL.dur)+6;","  if(!global.__trailer){ const total=(ROLL.tEnd||ROLL.dur)+6;").replace("  else { const bw=110,bh=34,bx=Wd-bw-16,by=Hd-bh-12; ROLL.skipBox=[bx,by,bw,bh];","  else if(!global.__trailer){ const bw=110,bh=34,bx=Wd-bw-16,by=Hd-bh-12; ROLL.skipBox=[bx,by,bw,bh];");
  { const k=code.indexOf("ctx.fillText(ROLL.paused?'Paused · ← → seek · wheel to scroll'"); if(k>0){ const ls=code.lastIndexOf("\n",k); const le=code.indexOf("\n",k); code=code.slice(0,ls+1)+"  if(!global.__trailer){"+code.slice(ls+1,le)+" }"+code.slice(le); } }
  code+=`\nglobal.S={get me(){return me},get players(){return players},get cam(){return cam},render:()=>render(),tick:()=>tick(),get W(){return W},get H(){return H},get tickN(){return tickN},get owner(){return owner},get land(){return land},get structures(){return structures},get warships(){return warships},get transports(){return transports},get missiles(){return missiles},get attacks(){return attacks},get aircraft(){return (typeof aircraft!=='undefined')?aircraft:[]},get STRUCT(){return STRUCT},get SHIPS(){return SHIPS},get AIR(){return (typeof AIRCRAFT!=='undefined')?AIRCRAFT:{}},
    ownTilesOf,coastTilesOf,centroid,launchAttack,placeStructure,orderWarship,launchMissile,isCoast,idx,inb,get START(){return START},get COUNTRIES(){return COUNTRIES},set chosenIdx(i){ chosenFlag=countryByIdx(i); },set customBots(b){ START.customBots=b; },set allowed(a){ ALLOWED.clear(); for(const k of a) ALLOWED.add(k); },set customFlag(f){ chosenFlag={name:f.name,layers:f.layers,idx:-1,custom:true,userId:f.userId}; },set map(m){ START.map=m; },applySettings,statsSnapshot,beginCredits,get ROLL(){return ROLL},get userPaused(){return userPaused},set userPaused(v){userPaused=v},set over(v){over=v},get drawFlag(){return drawFlag}};`;
  code+="\nObject.defineProperties(global.S,{srandN:{get(){return srandN}},landCount:{get(){return landCount}},CMD:{get(){return CMD}},REPLAY:{get(){return REPLAY}},stateHash:{value:stateHash},issueClick:{value:issueClick},issueMenu:{value:issueMenu},issue:{value:issue},replayApply:{value:replayApply},setBuild:{value:setBuild},updateUI:{value:updateUI},resetWorld:{value:resetWorld},restart:{value:()=>__start()},drawEmblem:{value:drawEmblem},drawFlagFn:{value:drawFlag},EMBLEMS:{value:EMBLEMS},computeLabelPos:{value:computeLabelPos}});";
  eval(code);
  if(opts.map) global.S.map=opts.map;
  if(opts.country){ const ci=global.S.COUNTRIES.findIndex(c=>c.name===opts.country); if(ci>=0) global.S.chosenIdx=ci; }
  if(opts.countryIdx!=null&&opts.countryIdx>=0) global.S.chosenIdx=opts.countryIdx;
  if(opts.customFlag) global.S.customFlag=opts.customFlag;
  if(opts.customBots) global.S.customBots=opts.customBots;
  if(Array.isArray(opts.allowed)) global.S.allowed=opts.allowed;
  __start();
  return {S:global.S,main,ctx:main.getContext('2d'),W0,H0,els,tick:(n=1)=>{ for(let i=0;i<n;i++){ global.__now+=100; global.S.tick(); } }};
};
