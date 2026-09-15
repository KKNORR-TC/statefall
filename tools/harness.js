// Shared headless engine loader for trailers. boot(opts) → {S, main, ctx, W0, H0, els, tick(n)}
const fs=require('fs'),path=require('path');
module.exports=function boot(opts={}){
  const gameFile=opts.file||process.env.GAME||path.resolve(__dirname,'..','game','index.html');
  const html=fs.readFileSync(gameFile,'utf8');
  const count=(text,needle)=>text.split(needle).length-1;
  const exactIndex=(text,needle,label,expected=1)=>{ const found=count(text,needle); if(found!==expected) throw new Error(`Harness ${label}: expected ${expected} occurrence${expected===1?'':'s'}, found ${found} in ${gameFile}`); return text.indexOf(needle); };
  const replaceExact=(text,needle,replacement,label,expected=1)=>{ exactIndex(text,needle,label,expected); return text.split(needle).join(replacement); };
  const scriptOpen='<script>',scriptClose='</script>';
  const scriptStart=exactIndex(html,scriptOpen,'game script opening tag'),scriptEnd=exactIndex(html,scriptClose,'game script closing tag');
  if(scriptEnd<=scriptStart) throw new Error(`Harness game script tags are out of order in ${gameFile}`);
  const src=html.slice(scriptStart+scriptOpen.length,scriptEnd);
  const stub=()=>new Proxy(function(){}, {get:(t,k)=>k==='length'?0:k==='checked'?false:k==='value'?'50':k==='style'?stub():k==='classList'?stub():(k===Symbol.toPrimitive?()=>800:stub()), set:()=>true, apply:()=>stub()});
  let createCanvas,Image;
  if(opts.render===false){
    createCanvas=(width,height)=>{ const ctx=stub(); return {width,height,getContext:()=>ctx,toDataURL:()=>'',style:{},addEventListener(){}}; };
    Image=class { constructor(){ this.complete=false; this.naturalWidth=0; } };
  }else ({createCanvas,Image}=require('canvas'));
  global.Image=Image; const W0=opts.w||1280,H0=opts.h||720; const main=createCanvas(W0,H0);
  const vals={stTroops:String(opts.troops??120),stGold:String(opts.gold??100),focus:'50',ratio:'50',seedIn:opts.seed||'',diffSel:opts.diff||'hard',teamSel:String(opts.teams||0)};
  const els={}; global.document={querySelector:()=>stub(),getElementById:(id)=>{ if(id==='map') return main; if(vals[id]!==undefined&&!els[id]){ els[id]={value:vals[id],checked:false,style:{},textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,dataset:{},appendChild(){},after(){},remove(){},focus(){}}; } return els[id]||(els[id]=stub()); },createElement:(tag)=>tag==='canvas'?createCanvas(64,64):stub(),querySelectorAll:()=>[],body:stub(),addEventListener(){}};
  global.window={addEventListener(){},innerWidth:W0,innerHeight:H0,STATEFALL_WP:null,devicePixelRatio:1,location:{search:''}};
  global.__now=0; global.performance={now:()=>global.__now}; global.localStorage={getItem:()=>null,setItem(){},removeItem(){}}; global.sessionStorage=global.localStorage;
  global.requestAnimationFrame=()=>{}; global.setInterval=()=>1; global.clearInterval=()=>{}; global.setTimeout=(f)=>{}; global.location={search:''}; global.crypto={subtle:{}}; global.navigator={clipboard:null};
  global.tip=stub(); global.ovTitle=stub(); global.ovText=stub(); global.overlay=stub(); global.ratio={value:50};
  main.getBoundingClientRect=()=>({left:0,top:0,width:W0,height:H0}); main.addEventListener=()=>{}; main.style={};
  global.__opt=opts;
  let code=replaceExact(src,"$('startBtn').onclick=()=>{","global.__start=()=>{",'start handler replacement');
  code=replaceExact(code,"let chosen='normal'","let chosen='"+(opts.diff||'hard')+"'",'difficulty replacement');
  code=replaceExact(code,"START.seed=($('seedIn').value.trim().replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,16))||newSeed();","START.seed='"+(opts.seed||'TRAILER')+"';",'seed replacement');
  if(opts.gridW&&opts.gridH) code=replaceExact(code,'const W=720, H=414, TICK=100;',`const W=${opts.gridW}, H=${opts.gridH}, TICK=100;`,'grid dimensions replacement');
  code=replaceExact(code,"START.quick=$('quickStart').checked;","START.quick=!!global.__opt.quick;",'quick-start replacement');
  code=replaceExact(code,"START.garrison=$('garrisonOn').checked;","START.garrison=!!global.__opt.garrison;",'garrison replacement');
  code=replaceExact(code,"START.instant=$('instantOn').checked;","START.instant=!!global.__opt.instant;",'instant-build replacement');
  code=replaceExact(code,"START.noCap=$('stNoCap').checked;","START.noCap=!!global.__opt.noCap;",'no-cap replacement');
  code=replaceExact(code,"START.bots=$('stBots').checked;","START.bots=!!global.__opt.bots;",'bots replacement');
  code=replaceExact(code,"START.fog=$('fogOn').checked;","START.fog=!!global.__opt.fog;",'fog replacement');
  code=replaceExact(code,"START.risky=$('riskyOn').checked&&!$('endgameOn').checked;","START.risky=!!global.__opt.risky;",'risky replacement');
  code=replaceExact(code,"START.endgame=$('endgameOn').checked;","START.endgame=!!global.__opt.endgame;",'endgame replacement');
  code=replaceExact(code,"START.billionaire=$('billionaireOn').checked;","START.billionaire=!!global.__opt.billionaire;",'billionaire replacement');
  code=replaceExact(code,"START.pauseBuild=$('stPauseBuild').checked;","START.pauseBuild=!!global.__opt.pauseBuild;",'pause-build replacement');
  code=replaceExact(code,"function end(title,text){","function end(title,text){ if(!global.__allowEnd) return;",'end guard replacement');
  code=replaceExact(code,"function drawMap(){","function drawMap(){ if(global.__opt.render===false) return;",'draw-map guard replacement');
  code=replaceExact(code,"if(!REPLAY.on){ START.customBots=null;","if(!REPLAY.on&&!global.__opt.customBots){ START.customBots=null;",'custom-bot replacement');
  if(opts.frenzy){
    code=replaceExact(code,"rnd(6000,12000)/(DIFF.build||1)","1200",'frenzy structure timing replacement',2);
    code=replaceExact(code,"rnd(4000,8000)/(DIFF.build||1)","900",'frenzy vehicle timing replacement',2);
  }
  code=replaceExact(code,"  { const total=(ROLL.tEnd||ROLL.dur)+6;","  if(!global.__trailer){ const total=(ROLL.tEnd||ROLL.dur)+6;",'credits progress replacement');
  code=replaceExact(code,"  else { const bw=110,bh=34,bx=Wd-bw-16,by=Hd-bh-12; ROLL.skipBox=[bx,by,bw,bh];","  else if(!global.__trailer){ const bw=110,bh=34,bx=Wd-bw-16,by=Hd-bh-12; ROLL.skipBox=[bx,by,bw,bh];",'credits skip replacement');
  { const anchor="ctx.fillText(ROLL.paused?'Paused · ← → seek · wheel to scroll'",k=exactIndex(code,anchor,'credits controls line'); const ls=code.lastIndexOf("\n",k),le=code.indexOf("\n",k); if(ls<0||le<0) throw new Error(`Harness credits controls line boundaries not found in ${gameFile}`); code=code.slice(0,ls+1)+"  if(!global.__trailer){"+code.slice(ls+1,le)+" }"+code.slice(le); }
  code+=`\nglobal.S={get me(){return me},get players(){return players},get cam(){return cam},render:()=>render(),tick:()=>tick(),get W(){return W},get H(){return H},get tickN(){return tickN},get owner(){return owner},get land(){return land},get structures(){return structures},get warships(){return warships},get transports(){return transports},get missiles(){return missiles},get attacks(){return attacks},get aircraft(){return (typeof aircraft!=='undefined')?aircraft:[]},get STRUCT(){return STRUCT},get SHIPS(){return SHIPS},get AIR(){return (typeof AIRCRAFT!=='undefined')?AIRCRAFT:{}},
    ownTilesOf,coastTilesOf,centroid,launchAttack,placeStructure,orderWarship,launchMissile,isCoast,idx,inb,get START(){return START},get COUNTRIES(){return COUNTRIES},set chosenIdx(i){ chosenFlag=countryByIdx(i); },set customBots(b){ START.customBots=b; },set allowed(a){ ALLOWED.clear(); for(const k of a) ALLOWED.add(k); },set customFlag(f){ chosenFlag={name:f.name,layers:f.layers,idx:-1,custom:true,userId:f.userId}; },set map(m){ START.map=m; },applySettings,statsSnapshot,beginCredits,get ROLL(){return ROLL},get userPaused(){return userPaused},set userPaused(v){userPaused=v},set over(v){over=v},get drawFlag(){return drawFlag}};`;
  code+="\nObject.defineProperties(global.S,{srandN:{get(){return srandN}},landCount:{get(){return landCount}},CMD:{get(){return CMD}},REPLAY:{get(){return REPLAY}},stateHash:{value:stateHash},issueClick:{value:issueClick},issueMenu:{value:issueMenu},issue:{value:issue},replayApply:{value:replayApply},resolveReplayCommands:{value:resolveReplayCommands},setBuild:{value:setBuild},updateUI:{value:updateUI},resetWorld:{value:resetWorld},restart:{value:()=>__start()},drawEmblem:{value:drawEmblem},drawFlagFn:{value:drawFlag},EMBLEMS:{value:EMBLEMS},computeLabelPos:{value:computeLabelPos},seededTierOrder:{value:seededTierOrder},cruiseTargets:{value:cruiseTargets},dirtyTransientState:{value:()=>{planes.push({test:true});satUntil=11;satCool=12;planeCool=13;vis=new Uint8Array([1]);radarLayer=new Uint8Array([1]);myBorders.add(7);}},transientState:{get(){return {planes:planes.length,satUntil,satCool,planeCool,vis,radarLayer,myBorders:[...myBorders]}}}});";
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
