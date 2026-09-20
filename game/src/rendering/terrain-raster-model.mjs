const STATIC_KEYS=['land','river','rough'];
const DETAIL_LEVELS=new Set(['strategic','operational']);
const MAX_WORLD_DIMENSION=2048;
const MAX_SOURCE_PIXELS=8_000_000;
export const TERRAIN_PIXELS_PER_TILE=4;
export const TERRAIN_STYLE_REVISION='direction-02-f2';
export const TERRAIN_FILTER='canvas-high-pixi-linear';

function validArray(value,length,name){
  if(!value||typeof value.length!=='number'||value.length!==length) throw new TypeError(`invalid terrain ${name}`);
}
function sameArray(a,b){
  if(!a||!b||a.length!==b.length) return false;
  for(let i=0;i<a.length;i++) if(!Object.is(a[i],b[i])) return false;
  return true;
}
function copyArray(value){ return value.slice?value.slice():Array.from(value); }
function rgb(value){
  if(Array.isArray(value)||ArrayBuffer.isView(value)) return [Number(value[0])||0,Number(value[1])||0,Number(value[2])||0];
  if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)) throw new TypeError('invalid terrain color');
  return [parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16)];
}
function mix(a,b,amount){ return a+(b-a)*amount; }
function clamp(value){ return Math.max(0,Math.min(255,Math.round(value))); }
function hash(x,y,salt=0){
  let value=Math.imul(x+salt*1013,374761393)^Math.imul(y-salt*617,668265263);
  value=Math.imul(value^(value>>>13),1274126177);
  return (value^(value>>>16))>>>0;
}

export function createTerrainRasterModel({clock=()=>0,pixelsPerTile=TERRAIN_PIXELS_PER_TILE,maxSourcePixels=MAX_SOURCE_PIXELS}={}){
  if(!Number.isInteger(pixelsPerTile)||pixelsPerTile<1||pixelsPerTile>8) throw new TypeError('invalid terrain pixelsPerTile');
  if(!Number.isInteger(maxSourcePixels)||maxSourcePixels<1||maxSourcePixels>MAX_SOURCE_PIXELS) throw new TypeError('invalid terrain source cap');
  let worldWidth=0,worldHeight=0,pixelWidth=0,pixelHeight=0,staticInput=null,dynamicInput=null,underpaint=null,pixels=null;
  const stats={staticBuild:0,compositeBuild:0,cacheSkip:0,reasons:{},timing:{staticMs:0,compositeMs:0,totalMs:0,lastMs:0,maxMs:0}};
  const count=value=>{ stats.reasons[value]=(stats.reasons[value]||0)+1; };
  const diagnostics=()=>({
    staticBuild:stats.staticBuild,compositeBuild:stats.compositeBuild,cacheSkip:stats.cacheSkip,reasons:{...stats.reasons},timing:{...stats.timing},
    worldWidth,worldHeight,pixelWidth,pixelHeight,pixelsPerTile,styleRevision:TERRAIN_STYLE_REVISION,bytes:pixels?.byteLength||0,
     sourceBytes:pixels?.byteLength||0,staticBytes:underpaint?.byteLength||0,
     modelRasterRetainedBytes:(pixels?.byteLength||0)+(underpaint?.byteLength||0),
     modelInputBytesEstimate:(staticInput?[staticInput.land,staticInput.river,staticInput.rough].reduce((sum,value)=>sum+(value?.byteLength||value?.length||0),0):0)+(dynamicInput?[dynamicInput.owner,dynamicInput.suppression,dynamicInput.pick,dynamicInput.fog].reduce((sum,value)=>sum+(value?.byteLength||value?.length||0),0):0),
     workerPeakBytesEstimate:(pixels?.byteLength||0)*3+(underpaint?.byteLength||0)+(staticInput?[staticInput.land,staticInput.river,staticInput.rough].reduce((sum,value)=>sum+(value?.byteLength||value?.length||0),0):0)+(dynamicInput?[dynamicInput.owner,dynamicInput.suppression,dynamicInput.pick,dynamicInput.fog].reduce((sum,value)=>sum+(value?.byteLength||value?.length||0),0):0),
     detailLevel:dynamicInput?.detailLevel||null,filter:TERRAIN_FILTER,filterPolicy:{canvas:'imageSmoothingEnabled with imageSmoothingQuality=high',pixi:'bilinear/linear texture sampling'}
  });
  const at=(x,y)=>y*worldWidth+x;
  const sample=(field,x,y)=>field[Math.max(0,Math.min(worldHeight-1,y))*worldWidth+Math.max(0,Math.min(worldWidth-1,x))];
  function bilinear(field,x,y){
    const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,a=Number(sample(field,x0,y0))||0,b=Number(sample(field,x0+1,y0))||0,c=Number(sample(field,x0,y0+1))||0,d=Number(sample(field,x0+1,y0+1))||0;
    return mix(mix(a,b,fx),mix(c,d,fx),fy);
  }
  function staticEqual(input){ return staticInput&&worldWidth===input.width&&worldHeight===input.height&&STATIC_KEYS.every(key=>sameArray(staticInput[key],input[key])); }
  function buildStatic(input){
    const started=clock();
    worldWidth=input.width; worldHeight=input.height; pixelWidth=worldWidth*pixelsPerTile; pixelHeight=worldHeight*pixelsPerTile;
    underpaint=new Uint8ClampedArray(pixelWidth*pixelHeight*4);
    for(let py=0;py<pixelHeight;py++) for(let px=0;px<pixelWidth;px++){
      const wx=(px+.5)/pixelsPerTile-.5,wy=(py+.5)/pixelsPerTile-.5,landCoverage=Math.max(0,Math.min(1,bilinear(input.land,wx,wy))),relief=Math.max(0,Math.min(1,bilinear(input.rough,wx,wy))),riverCoverage=Math.max(0,Math.min(1,bilinear(input.river,wx,wy)));
      const tileX=Math.floor(px/pixelsPerTile),tileY=Math.floor(py/pixelsPerTile),grain=(hash(px,py,3)&255)/255-.5,mark=hash(px,py,11),coastDistance=Math.abs(landCoverage-.5);
      let r=mix(15,42,Math.min(1,landCoverage*1.7)),g=mix(47,91,Math.min(1,landCoverage*1.7)),b=mix(53,88,Math.min(1,landCoverage*1.7));
      if(landCoverage>.04){
        const landR=mix(91,139,relief),landG=mix(101,126,relief),landB=mix(75,91,relief),coverage=Math.max(0,Math.min(1,(landCoverage-.08)/.78));
        r=mix(r,landR,coverage); g=mix(g,landG,coverage); b=mix(b,landB,coverage);
        const shade=(relief-.5)*10+grain*5; r+=shade; g+=shade*.82; b+=shade*.46;
        const contour=Math.abs(relief*7-Math.round(relief*7));
        if(contour<.075&&landCoverage>.64){ r-=8; g-=9; b-=6; }
        if(landCoverage>.72&&((mark&127)<3||(relief>.57&&(mark&63)<2))){ r-=12; g-=10; b-=7; }
        if(landCoverage>.78&&relief>.48&&((px+py+(mark>>>8))%17===0)){ r+=13; g+=11; b+=6; }
      }
      if(landCoverage<.62&&landCoverage>.02){ const shelf=(.62-landCoverage)/.60; r=mix(r,48,shelf*.38); g=mix(g,99,shelf*.42); b=mix(b,96,shelf*.38); }
      if(coastDistance<.20){ const key=1-coastDistance/.20,wet=landCoverage>.5; r=mix(r,wet?16:214,key*(wet?.70:.54)); g=mix(g,wet?42:208,key*(wet?.70:.54)); b=mix(b,wet?43:174,key*(wet?.70:.54)); }
      if(riverCoverage>.07){ const edge=Math.max(0,Math.min(1,(riverCoverage-.07)/.45)),center=Math.max(0,Math.min(1,(riverCoverage-.52)/.40)); r=mix(r,67,edge*.58); g=mix(g,123,edge*.62); b=mix(b,123,edge*.62); r=mix(r,126,center*.68); g=mix(g,170,center*.68); b=mix(b,161,center*.68); }
      if(landCoverage<.25&&((hash(tileX,tileY,19)+px+py*3)%173===0)){ r+=10; g+=15; b+=13; }
      const offset=(py*pixelWidth+px)*4; underpaint[offset]=clamp(r); underpaint[offset+1]=clamp(g); underpaint[offset+2]=clamp(b); underpaint[offset+3]=255;
    }
    staticInput={width:worldWidth,height:worldHeight,...Object.fromEntries(STATIC_KEYS.map(key=>[key,copyArray(input[key])]))}; dynamicInput=null; stats.staticBuild++; count('static-change');
    const elapsed=Math.max(0,clock()-started); stats.timing.staticMs+=elapsed; return elapsed;
  }
  function dynamicSnapshot(input,length){
    const suppression=new Uint16Array(length),pick=new Uint8Array(length),fog=new Uint8Array(length);
    for(let tile=0;tile<length;tile++){
      const remaining=Math.max(0,Math.min(65535,(Number(input.shelled[tile])||0)-input.tick));
      suppression[tile]=remaining;
      pick[tile]=input.pickArea>=0&&input.areaOf&&input.areaOf[tile]===input.pickArea?1:0;
      fog[tile]=input.fog?input.fog[tile]?1:0:1;
    }
    return {owner:copyArray(input.owner),teams:copyArray(input.teams),colors:input.colors.map(rgb),suppression,pick,fog,suppressTicks:input.suppressTicks,myId:input.myId,highlightId:input.highlightId,detailLevel:input.detailLevel};
  }
  function dynamicEqual(a,b){
    return a&&a.suppressTicks===b.suppressTicks&&a.myId===b.myId&&a.highlightId===b.highlightId&&a.detailLevel===b.detailLevel&&sameArray(a.owner,b.owner)&&sameArray(a.teams,b.teams)&&sameArray(a.suppression,b.suppression)&&sameArray(a.pick,b.pick)&&sameArray(a.fog,b.fog)&&a.colors.length===b.colors.length&&a.colors.every((value,index)=>sameArray(value,b.colors[index]));
  }
  function composite(state){
    const started=clock(),next=new Uint8ClampedArray(underpaint),ownershipAlpha=state.detailLevel==='strategic'?.64:.47;
    for(let py=0;py<pixelHeight;py++) for(let px=0;px<pixelWidth;px++){
      const x=Math.floor(px/pixelsPerTile),y=Math.floor(py/pixelsPerTile),tile=at(x,y),offset=(py*pixelWidth+px)*4; let r=next[offset],g=next[offset+1],b=next[offset+2];
      if(staticInput.land[tile]){
        const owner=state.owner[tile];
        if(owner>=0&&state.colors[owner]){
          const political=state.colors[owner]; r=mix(r,political[0],ownershipAlpha); g=mix(g,political[1],ownershipAlpha); b=mix(b,political[2],ownershipAlpha);
          let border=0;
          if(px%pixelsPerTile===0&&x>0&&staticInput.land[tile-1]&&state.owner[tile-1]!==owner){ const other=state.owner[tile-1]; border=Math.max(border,other>=0&&state.teams[owner]!=null&&state.teams[owner]===state.teams[other]?1:2); }
          if(px%pixelsPerTile===pixelsPerTile-1&&x+1<worldWidth&&staticInput.land[tile+1]&&state.owner[tile+1]!==owner){ const other=state.owner[tile+1]; border=Math.max(border,other>=0&&state.teams[owner]!=null&&state.teams[owner]===state.teams[other]?1:2); }
          if(py%pixelsPerTile===0&&y>0&&staticInput.land[tile-worldWidth]&&state.owner[tile-worldWidth]!==owner){ const other=state.owner[tile-worldWidth]; border=Math.max(border,other>=0&&state.teams[owner]!=null&&state.teams[owner]===state.teams[other]?1:2); }
          if(py%pixelsPerTile===pixelsPerTile-1&&y+1<worldHeight&&staticInput.land[tile+worldWidth]&&state.owner[tile+worldWidth]!==owner){ const other=state.owner[tile+worldWidth]; border=Math.max(border,other>=0&&state.teams[owner]!=null&&state.teams[owner]===state.teams[other]?1:2); }
          if(border===2){ r*=.43; g*=.43; b*=.43; } else if(border===1){ r=mix(r,78,.22); g=mix(g,100,.22); b=mix(b,91,.22); } else if(owner===state.myId){ r*=1.07; g*=1.07; b*=1.07; }
           if(state.fog[tile]&&state.suppression[tile]){ const progress=Math.max(0,Math.min(1,1-state.suppression[tile]/state.suppressTicks)),factor=.55+.25*progress; r*=factor; g*=factor; b*=factor; }
           if(state.fog[tile]&&state.pick[tile]){ r=r*1.2+28; g=g*1.2+28; b=b*1.2+28; }
           if(state.fog[tile]&&state.highlightId>=0){ if(owner===state.highlightId){ r=r*.96+42; g=g*.96+42; b=b*.96+42; } else { r*=.55; g*=.55; b*=.55; } }
         }else if(state.fog[tile]&&state.suppression[tile]){ r*=.6; g*=.6; b*=.6; }
      }
      if(!state.fog[tile]){ const gray=r*.3+g*.59+b*.11,noise=((hash(px,py,29)&31)/31-.5)*5; r=mix(r,gray,.78)*.43+noise; g=mix(g,gray,.78)*.43+noise; b=mix(b,gray,.78)*.47+noise; }
      next[offset]=clamp(r); next[offset+1]=clamp(g); next[offset+2]=clamp(b);
    }
    const changed=!pixels||!sameArray(pixels,next); pixels=next; dynamicInput=state; stats.compositeBuild++; count(state.detailLevel==='strategic'?'strategic-composite':'operational-composite');
    const elapsed=Math.max(0,clock()-started); stats.timing.compositeMs+=elapsed; return {changed,elapsed};
  }
  return Object.freeze({
    update(input){
      const started=clock(),w=Number(input?.width),h=Number(input?.height),length=w*h,sourceWidth=w*pixelsPerTile,sourceHeight=h*pixelsPerTile,sourcePixels=sourceWidth*sourceHeight;
      if(!Number.isInteger(w)||!Number.isInteger(h)||w<=0||h<=0||w>MAX_WORLD_DIMENSION||h>MAX_WORLD_DIMENSION) throw new TypeError('invalid terrain dimensions');
      if(!Number.isSafeInteger(sourcePixels)||sourcePixels>maxSourcePixels) throw new RangeError('terrain source allocation exceeds cap');
      for(const key of STATIC_KEYS) validArray(input[key],length,key);
      for(const key of ['owner','shelled']) validArray(input[key],length,key);
      if(input.fog) validArray(input.fog,length,'fog'); if(input.areaOf) validArray(input.areaOf,length,'areaOf');
      if(!Array.isArray(input.colors)||!Array.isArray(input.teams)||!Number.isFinite(input.tick)||!(input.suppressTicks>0)||!DETAIL_LEVELS.has(input.detailLevel)) throw new TypeError('invalid terrain dynamic input');
      const staticChanged=!staticEqual(input); let elapsed=0; if(staticChanged) elapsed+=buildStatic(input);
      const state=dynamicSnapshot(input,length);
      if(!staticChanged&&dynamicEqual(dynamicInput,state)){
        stats.cacheSkip++; count('exact-cache-hit'); const total=Math.max(0,clock()-started); stats.timing.totalMs+=total; stats.timing.lastMs=total; stats.timing.maxMs=Math.max(stats.timing.maxMs,total);
        return {changed:false,staticChanged:false,pixels,diagnostics:diagnostics()};
      }
      if(!staticChanged&&dynamicInput&&dynamicInput.detailLevel!==state.detailLevel) count('detail-level-change');
      const result=composite(state); elapsed+=result.elapsed; const total=Math.max(elapsed,Math.max(0,clock()-started)); stats.timing.totalMs+=total; stats.timing.lastMs=total; stats.timing.maxMs=Math.max(stats.timing.maxMs,total);
      return {changed:result.changed,staticChanged,pixels,diagnostics:diagnostics()};
    },
    reset(){ worldWidth=0; worldHeight=0; pixelWidth=0; pixelHeight=0; staticInput=null; dynamicInput=null; underpaint=null; pixels=null; count('reset'); },
    diagnostics
  });
}
