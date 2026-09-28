import upgradeMetadata from './classic-assets/upgrade-metadata.json';
import structureMetadata from './classic-assets/structure-metadata.json';
import directionalMetadata from './classic-assets/directional-metadata.json';
const UPGRADE_URLS={
  'port-level2':new URL('./classic-assets/port-level2.png',import.meta.url).href,
  'airfield-level2':new URL('./classic-assets/airfield-level2.png',import.meta.url).href,
  'fort-level2':new URL('./classic-assets/fort-level2.png',import.meta.url).href,
  'fort-level3':new URL('./classic-assets/fort-level3.png',import.meta.url).href
};
const structureKey=(type,level=1)=>Object.hasOwn(upgradeMetadata,type+'-level'+level)?type+'-level'+level:type;
const tierScale=level=>level>=3?1.24:level>=2?1.12:1;
const DIRECTIONAL_URLS={
  merchant:new URL('./classic-assets/merchant-directions.png',import.meta.url).href,
  heavytransport:new URL('./classic-assets/heavytransport-directions.png',import.meta.url).href,
  fighter:new URL('./classic-assets/fighter-directions.png',import.meta.url).href,
  bomber:new URL('./classic-assets/bomber-directions.png',import.meta.url).href,
  carrier:new URL('./classic-assets/carrier-directions.png',import.meta.url).href,
  spy:new URL('./classic-assets/spy-directions.png',import.meta.url).href,
  truck:new URL('./classic-assets/truck-directions.png',import.meta.url).href,
  battleship:new URL('./classic-assets/battleship-directions.png',import.meta.url).href,
  cruiser:new URL('./classic-assets/cruiser-directions.png',import.meta.url).href,
  scout:new URL('./classic-assets/scout-directions.png',import.meta.url).href,
  sub:new URL('./classic-assets/sub-directions.png',import.meta.url).href,
  hunter:new URL('./classic-assets/hunter-directions.png',import.meta.url).href,
  rship:new URL('./classic-assets/rship-directions.png',import.meta.url).href,
  privateer:new URL('./classic-assets/privateer-directions.png',import.meta.url).href,
  transport:new URL('./classic-assets/transport-directions.png',import.meta.url).href
};
export function interpolateShipHeading(previous,current,alpha){return previous+Math.atan2(Math.sin(current-previous),Math.cos(current-previous))*Math.max(0,Math.min(1,alpha));}
const SHIP_FRAMES=[[25,140,485,210,266,285],[532,118,392,273,724,279],[1080,80,115,350,1137,263],[1314,120,415,280,1520,278],[30,550,494,199,278,687],[528,505,414,289,732,654],[1080,461,125,349,1142,637],[1314,498,415,301,1515,649]];
const POINTS=[[0,0],[1,0],[1,1],[0,1],[.5,0],[1,.5],[.5,1],[0,.5]];
const POLYGONS=[[],[[0,4,7]],[[1,5,4]],[[0,1,5,7]],[[2,6,5]],[[0,4,7],[2,6,5]],[[4,1,2,6]],[[0,1,2,6,7]],[[3,7,6]],[[0,4,6,3]],[[1,5,4],[3,7,6]],[[0,1,5,6,3]],[[7,5,2,3]],[[0,4,5,2,3]],[[4,1,2,3,7]],[[0,1,2,3]]];
// Local art candidate. Reads presentation data only; never owns gameplay state.
const FRAMES = {
  ...structureMetadata,...upgradeMetadata,
  factory:[27,110,302,334], radar:[349,97,271,345], sam:[634,151,278,298], battery:[915,144,328,302],
  port:[20,511,316,271], city:[342,476,300,307], engcmd:[649,480,279,316], airfield:[936,483,307,326],
  warship:[8,917,350,158], fighter:[366,871,284,268], truck:[654,928,307,169], pine:[965,825,256,324]
};
const hash=(x,y)=>{ let n=Math.imul(x+91,374761393)^Math.imul(y-37,668265263); n=Math.imul(n^(n>>>13),1274126177); return (n^(n>>>16))>>>0; };
const rgba=(hex,a)=>{ const v=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#7fb3ff'; return `rgba(${parseInt(v.slice(1,3),16)},${parseInt(v.slice(3,5),16)},${parseInt(v.slice(5,7),16)},${a})`; };
const createCanvas=()=>typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
const load=src=>typeof Image==='undefined'?fetch(src).then(response=>{if(!response.ok)throw new Error('Could not load candidate artwork');return response.blob();}).then(blob=>createImageBitmap(blob)):new Promise((resolve,reject)=>{ const im=new Image(); im.onload=()=>resolve(im); im.onerror=()=>reject(new Error('Could not load candidate artwork')); im.src=src; });
export async function createClassicBattlefield({terrainOnly=false}={}){
  const [atlas,terrain,shipAtlas,structureAtlas]=await Promise.all([
    load(new URL('./classic-assets/units.png',import.meta.url).href),
    load(new URL('./classic-assets/terrain.png',import.meta.url).href),
    terrainOnly?null:load(new URL('./classic-assets/destroyer-directions.png',import.meta.url).href),
    terrainOnly?null:load(new URL('./classic-assets/structures-complete.png',import.meta.url).href)
  ]);
  const directionalAtlases=Object.fromEntries(await Promise.all(Object.entries(terrainOnly?{}:DIRECTIONAL_URLS).map(async([key,url])=>[key,await load(url)])));
  const upgradeImages=Object.fromEntries(await Promise.all(Object.entries(terrainOnly?{}:UPGRADE_URLS).map(async([key,url])=>[key,await load(url)])));
  const sources=new Map(),patterns=new Map(),stats={frames:0,trees:0,visibleTiles:0,spriteDraws:0},timings=[];
  let enabled=true,panel=null,home=null;
  // The generated sheet is 1280 square; explicit rectangles avoid sprite bleed.
  const SOURCE_BUDGET=64*1024*1024;
  let sourceBytes=0;
  const sourceResolution=(ctx,width)=>width*Math.max(1,Math.hypot(ctx.getTransform().a,ctx.getTransform().b))<=96?128:256;
  function source(key,color,resolution=256){
    const id=key+':'+(color||'base')+':'+resolution; if(sources.has(id)){const hit=sources.get(id);sources.delete(id);sources.set(id,hit);return hit;}
    const [unit,frame]=key.split('/'),meta=directionalMetadata[unit];
    const directional=key.startsWith('destroyer')?SHIP_FRAMES[Number(key.slice(9))]:meta?.frames[Number(frame)];
    const f=directional||FRAMES[key]; if(!f) return null;
    const canvas=createCanvas(),ratio=directional?1:f[3]/f[2];
    canvas.width=resolution; canvas.height=Math.ceil(resolution*ratio);
    const c=canvas.getContext('2d',{willReadFrequently:true});
    if(directional){const scale=(meta?235/meta.referenceWidth:.5)*resolution/256;c.drawImage(meta?directionalAtlases[unit]:shipAtlas,f[0],f[1],f[2],f[3],resolution/2+(f[0]-f[4])*scale,resolution/2+(f[1]-f[5])*scale,f[2]*scale,f[3]*scale);}
    else c.drawImage(upgradeImages[key]||(structureMetadata[key]?structureAtlas:atlas),f[0],f[1],f[2],f[3],0,0,canvas.width,canvas.height);
    if(color&&/^#[0-9a-f]{6}$/i.test(color)){
      const data=c.getImageData(0,0,canvas.width,canvas.height),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
      for(let p=0;p<data.data.length;p+=4){
        const r=data.data[p],g=data.data[p+1],b=data.data[p+2];
        if(data.data[p+3]&&b>r*1.18&&b>g*1.08){
          const light=Math.min(1.2,(r+g+b)/270);
          for(let i=0;i<3;i++) data.data[p+i]=Math.min(255,rgb[i]*light);
        }
      }
      c.putImageData(data,0,0);
    }
    // A byte ceiling lets small on-screen units share the same memory budget
    // without thrashing when many countries and headings are visible together.
    const bytes=canvas.width*canvas.height*4;
    while(sources.size&&sourceBytes+bytes>SOURCE_BUDGET){const old=sources.keys().next().value,previous=sources.get(old);sourceBytes-=previous.width*previous.height*4;previous.width=previous.height=0;sources.delete(old);}
    sources.set(id,canvas);sourceBytes+=bytes;stats.sourceBuilds=(stats.sourceBuilds||0)+1;return canvas;
  }
  function pattern(ctx,index){
    if(patterns.has(index)) return patterns.get(index);
    const tile=createCanvas(); tile.width=tile.height=256;
    tile.getContext('2d').drawImage(terrain,(index%2)*terrain.width/2,Math.floor(index/2)*terrain.height/2,terrain.width/2,terrain.height/2,0,0,256,256);
    const p=ctx.createPattern(tile,'repeat'); p.setTransform(new DOMMatrix().scale(1/24));
    patterns.set(index,p); return p;
  }
  function outsideCanvas(ctx,x,y,radius){
    const m=ctx.getTransform(),px=m.a*x+m.c*y+m.e,py=m.b*x+m.d*y+m.f,rx=radius*Math.hypot(m.a,m.c),ry=radius*Math.hypot(m.b,m.d);
    return px+rx<-2||py+ry<-2||px-rx>ctx.canvas.width+2||py-ry>ctx.canvas.height+2;
  }
  function sprite(ctx,key,x,y,width,color,heading=0,anchor=.5){
    const im=source(key,color,sourceResolution(ctx,width)); if(!im) return false;
    const height=width*im.height/im.width;
    if(outsideCanvas(ctx,x,y,Math.hypot(width/2,height*Math.max(anchor,1-anchor))))return true;
    ctx.save(); ctx.translate(x,y); ctx.rotate(heading); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(im,-width/2,-height*anchor,width,height); ctx.restore(); stats.spriteDraws++; return true;
  }
  function bounds(st,camera,mapWidth=720){
    const r=Math.max(6,camera.s*2.4),f=FRAMES[structureKey(st.type,st.level||1)],x=camera.x+(st.t%mapWidth+.5)*camera.s,y=camera.y+(Math.floor(st.t/mapWidth)+.5)*camera.s;
    const w=2*r*tierScale(st.level||1),h=f?w*f[3]/f[2]:w;
    return {x,y,left:x-w/2,right:x+w/2,top:y-h*.78,bottom:y+h*.22,width:w,height:h};
  }
  let terrainCache=null,terrainKey='',terrainRefreshes=0;
  function paintTerrain(ctx,state){
    if(!enabled||state.camera.s<5)return false;
    const visibleState=state,dpr=ctx.canvas.width/state.width;
    state={...state,camera:{x:Math.ceil(state.camera.x/128)*128+128,y:Math.ceil(state.camera.y/128)*128+128,s:state.camera.s},width:state.width+384,height:state.height+384};
    const {camera:c,W,H,land,owner,fog,structures}=state;
    let signature=2166136261;
    const x0=Math.max(0,Math.floor(-c.x/c.s)-30),x1=Math.min(W,Math.ceil((state.width-c.x)/c.s)+30),y0=Math.max(0,Math.floor(-c.y/c.s)-30),y1=Math.min(H,Math.ceil((state.height-c.y)/c.s)+30);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const t=y*W+x;signature=Math.imul(signature^(land[t]?1:0)^((state.river[t]?1:0)<<1),16777619);}
    const key=[c.x,c.y,c.s,state.width,state.height,dpr,signature,structures.filter(st=>st.t%W>=x0&&st.t%W<=x1&&Math.floor(st.t/W)>=y0&&Math.floor(st.t/W)<=y1).map(st=>st.t+':'+st.type+':'+st.owner+':'+(!fog||!!fog[st.t])).join(',')].join('|');
    if(key!==terrainKey){
      terrainCache??=createCanvas();
      const pixelWidth=Math.round(state.width*dpr),pixelHeight=Math.round(state.height*dpr);
      if(terrainCache.width!==pixelWidth)terrainCache.width=pixelWidth;if(terrainCache.height!==pixelHeight)terrainCache.height=pixelHeight;
      const target=terrainCache.getContext('2d');target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,terrainCache.width,terrainCache.height);target.setTransform(dpr,0,0,dpr,0,0);
      paintTerrainFrame(target,{...state,groundSignature:signature});terrainKey=key;terrainRefreshes++;
    }
    ctx.drawImage(terrainCache,visibleState.camera.x-c.x,visibleState.camera.y-c.y,state.width,state.height);paintOwnership(ctx,visibleState);return true;
  }
  let groundCanvas=null,groundKey='',groundPath=null;
  function paintTerrainFrame(ctx,state){
    if(!enabled||state.camera.s<5) return false;
    const started=performance.now(),{camera:c,width:vw,height:vh,W,H,land,river,rough,owner,fog,players,structures,links}=state,s=c.s;
    stats.frames++; stats.spriteDraws=0;
    const x0=Math.max(0,Math.floor(-c.x/s)-1),x1=Math.min(W,Math.ceil((vw-c.x)/s)+1),y0=Math.max(0,Math.floor(-c.y/s)-1),y1=Math.min(H,Math.ceil((vh-c.y)/s)+1);
    ctx.save(); ctx.translate(c.x,c.y); ctx.scale(s,s);
    const baseKey=[W,H,state.groundSignature,c.x,c.y,s,vw,vh,ctx.canvas.width,ctx.canvas.height].join('|');
    let ground=groundPath;
    if(baseKey!==groundKey){
    ctx.fillStyle=pattern(ctx,2); ctx.fillRect(-c.x/s,-c.y/s,vw/s,vh/s);
    // Marching-square contours interpolate between real tile centres. This changes
    // presentation by at most half a tile; placement/pathfinding keep the original grid.
    ground=new Path2D();const shore=new Path2D();
    const points=POINTS;
    const polygons=POLYGONS;
    const yes=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&!!land[y*W+x];
    for(let y=Math.max(-1,y0-5);y<Math.min(H,y1+5);y++)for(let x=Math.max(-1,x0-5);x<Math.min(W,x1+5);x++){
      const mask=(yes(x,y)?1:0)|(yes(x+1,y)?2:0)|(yes(x+1,y+1)?4:0)|(yes(x,y+1)?8:0);
      if(mask===15){let end=x+1;while(end<Math.min(W,x1+5)&&yes(end,y)&&yes(end+1,y)&&yes(end+1,y+1)&&yes(end,y+1))end++;ground.rect(x+.5,y+.5,end-x,1);x=end-1;continue;}
      for(const poly of polygons[mask]){
        const first=points[poly[0]];ground.moveTo(x+.5+first[0],y+.5+first[1]);
        for(let i=1;i<poly.length;i++){const p=points[poly[i]];ground.lineTo(x+.5+p[0],y+.5+p[1]);} // clip() implicitly closes these fill-only contours.
        for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(a<4||b<4)continue;shore.moveTo(x+.5+points[a][0],y+.5+points[a][1]);shore.lineTo(x+.5+points[b][0],y+.5+points[b][1]);}
      }
    }
    ctx.lineJoin='round';ctx.lineCap='round';
    // Broad translucent shallows and a narrow wet edge soften the water transition.
    for(const [width,color] of [[2.4,'rgba(68,124,120,.08)'],[1.4,'rgba(87,145,134,.13)'],[.7,'rgba(128,161,137,.20)']]){
      ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke(shore);
    }
    ctx.save(); ctx.clip(ground); ctx.fillStyle=pattern(ctx,0); ctx.fillRect(x0-5,y0-5,x1-x0+10,y1-y0+10);
    // Stable broad patches break up the repeated texture without adding grid lines.
    for(let y=Math.floor((y0-6)/6)*6;y<y1+6;y+=6)for(let x=Math.floor((x0-6)/6)*6;x<x1+6;x+=6){
      const n=hash(x,y),r=2+(n%28)/10,g=ctx.createRadialGradient(x+3,y+3,0,x+3,y+3,r);
      g.addColorStop(0,n%3===0?'rgba(161,140,83,.23)':'rgba(23,43,28,.19)');g.addColorStop(1,'rgba(55,70,35,0)');ctx.fillStyle=g;ctx.fillRect(x+3-r,y+3-r,r*2,r*2);
    }
    ctx.fillStyle='rgba(72,124,133,.65)';for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(river[y*W+x])ctx.fillRect(x+.18,y+.18,.64,.64);
    ctx.strokeStyle=pattern(ctx,1);ctx.lineWidth=1.0;ctx.stroke(shore);
    ctx.strokeStyle='rgba(183,167,121,.36)';ctx.lineWidth=.55;ctx.stroke(shore);
    ctx.strokeStyle='rgba(200,214,190,.24)';ctx.lineWidth=.09;ctx.stroke(shore);
    groundCanvas??=createCanvas();
    if(groundCanvas.width!==ctx.canvas.width)groundCanvas.width=ctx.canvas.width;
    if(groundCanvas.height!==ctx.canvas.height)groundCanvas.height=ctx.canvas.height;
    const cached=groundCanvas.getContext('2d');cached.clearRect(0,0,groundCanvas.width,groundCanvas.height);cached.drawImage(ctx.canvas,0,0);
    groundPath=ground;groundKey=baseKey;
    }else{
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(groundCanvas,0,0);ctx.restore();
      ctx.save();ctx.clip(ground);
    }
    const sites=structures.filter(st=>(!fog||fog[st.t])&&st.t%W>x0-25&&st.t%W<x1+25&&Math.floor(st.t/W)>y0-25&&Math.floor(st.t/W)<y1+25).sort((a,b)=>a.t-b.t);
    const roads=[];
    // Cosmetic service access: short routes between visible friendly sites only.
    // Every sampled point must remain on visible land, including through fog.
    for(let i=1;i<sites.length;i++){
      const a=sites[i],ax=a.t%W+.5,ay=Math.floor(a.t/W)+1.1;
      let best=null,dist=22;
      for(let j=0;j<i;j++){
        const b=sites[j];if(b.owner!==a.owner)continue;
        const bx=b.t%W+.5,by=Math.floor(b.t/W)+1.1,d=Math.hypot(ax-bx,ay-by);if(d>=dist)continue;
        let valid=true;for(let q=0;q<=Math.ceil(d*3);q++){const f=q/Math.ceil(d*3),t=Math.floor(ay+(by-ay)*f)*W+Math.floor(ax+(bx-ax)*f);if(!land[t]){valid=false;break;}}
        if(valid){best=[ax,ay,bx,by];dist=d;}
      }
      if(best)roads.push(best);
    }
    for(const [ax,ay,bx,by] of roads){
      ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);
      ctx.strokeStyle='rgba(43,40,29,.25)';ctx.lineWidth=1.25;ctx.stroke();
      ctx.strokeStyle=pattern(ctx,1);ctx.lineWidth=.9;ctx.stroke();
      ctx.strokeStyle='rgba(181,162,116,.20)';ctx.lineWidth=.58;ctx.stroke();
      ctx.strokeStyle='rgba(52,46,33,.23)';ctx.lineWidth=.12;ctx.stroke();
    }
    for(const st of sites){
      const x=st.t%W+.5,y=Math.floor(st.t/W)+.5,w=st.type==='airfield'?5.5:4.8,h=st.type==='port'?3.6:3.4;
      // Worn gravel skirt, contact shadow, chamfered slab and a short access apron.
      ctx.fillStyle=pattern(ctx,1);ctx.globalAlpha=.55;ctx.beginPath();ctx.roundRect(x-w/2-.35,y-h/2-.2,w+.7,h+.8,.55);ctx.fill();ctx.globalAlpha=1;
      ctx.fillStyle='rgba(12,19,17,.38)';ctx.beginPath();ctx.roundRect(x-w/2+.14,y-h/2+.18,w,h,.18);ctx.fill();
      ctx.fillStyle=pattern(ctx,3);ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,.18);ctx.fill();
      ctx.fillStyle='rgba(128,130,111,.24)';ctx.fill();
      ctx.lineWidth=.055;ctx.strokeStyle='rgba(213,207,178,.43)';ctx.stroke();
      ctx.strokeStyle='rgba(30,39,34,.35)';ctx.beginPath();ctx.moveTo(x,y-h/2);ctx.lineTo(x,y+h/2);ctx.moveTo(x-w/2,y+.65);ctx.lineTo(x+w/2,y+.65);ctx.stroke();
      ctx.fillStyle=pattern(ctx,1);ctx.fillRect(x-.7,y+h/2,1.4,.65);
      if(st.type==='airfield'||st.type==='factory'||st.type==='engcmd'){
        ctx.strokeStyle='rgba(219,197,127,.7)';ctx.lineWidth=.09;
        for(let q=-1;q<=1;q++){ctx.beginPath();ctx.moveTo(x+q*.48-.14,y+1);ctx.lineTo(x+q*.48+.14,y+1.3);ctx.stroke();}
      }
    }
    ctx.restore();
    ctx.restore();
    // Bounded, presentation-only trees; never cover building sites or truck routes.
    let trees=0;
    if(s>=6){
      const occupied=structures.filter(st=>!fog||fog[st.t]).map(st=>[st.t%W+.5,Math.floor(st.t/W)+.5]);
      for(let y=y0;y<y1&&trees<180;y+=2) for(let x=x0;x<x1&&trees<180;x+=2){
        // Absolute cell parity prevents scenery changing when the camera pans.
        const xx=x-x%2,yy=y-y%2,t=yy*W+xx;
        if(!land[t]||river[t]||hash(xx,yy)%19!==0) continue;
        if(occupied.some(([sx,sy])=>(sx-xx)**2+(sy-yy)**2<28)) continue;
        if(roads.some(([ax,ay,bx,by])=>{const f=Math.max(0,Math.min(1,((xx-ax)*(bx-ax)+(yy-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return Math.hypot(xx-ax-f*(bx-ax),yy-ay-f*(by-ay))<2;}))continue;

        sprite(ctx,'pine',c.x+(xx+.5)*s,c.y+(yy+.5)*s,s*2.3,null,0,.8); trees++;
      }
    }
    stats.trees=trees; stats.visibleTiles=(x1-x0)*(y1-y0);
    timings.push(performance.now()-started); if(timings.length>120) timings.shift();
    return true;
  }

  let overlayCanvas=null,overlayKey='',overlayRefreshes=0;
  function paintOwnership(ctx,state){
    const {camera:c,W,H,land,owner,fog,players}=state;
    const x0=Math.max(0,Math.floor(-c.x/c.s)-1),x1=Math.min(W-1,Math.ceil((state.width-c.x)/c.s)+1),y0=Math.max(0,Math.floor(-c.y/c.s)-1),y1=Math.min(H-1,Math.ceil((state.height-c.y)/c.s)+1);
    let signature=2166136261;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const t=y*W+x;signature=Math.imul(signature^(owner[t]+1)^((state.fogOpacity?state.fogOpacity[t]:fog&&!fog[t]?255:0)<<12),16777619);}
    const dpr=ctx.canvas.width/state.width,key=[terrainKey,c.x,c.y,state.width,state.height,signature,players.map(p=>p.color).join(',')].join('|');
    if(key!==overlayKey){
      overlayCanvas??=createCanvas();if(overlayCanvas.width!==Math.round(state.width*dpr))overlayCanvas.width=Math.round(state.width*dpr);if(overlayCanvas.height!==Math.round(state.height*dpr))overlayCanvas.height=Math.round(state.height*dpr);
      const out=overlayCanvas.getContext('2d');out.setTransform(1,0,0,1,0,0);out.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);out.setTransform(dpr,0,0,dpr,0,0);out.translate(c.x,c.y);out.scale(c.s,c.s);
      const paths=new Map(),edges=new Map();
      const sameOwner=(x,y,id)=>{const t=y*W+x;return land[t]&&land[t+1]&&land[t+W]&&land[t+W+1]&&owner[t]===id&&owner[t+1]===id&&owner[t+W]===id&&owner[t+W+1]===id;};
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
        const id=owner[y*W+x];
        if(id>=0&&sameOwner(x,y,id)){
          if(!paths.has(id)){paths.set(id,new Path2D());edges.set(id,new Path2D());}
          let end=x+1;while(end<x1&&sameOwner(end,y,id))end++;
          paths.get(id).rect(x+.5,y+.5,end-x,1);x=end-1;continue;
        }
        const tiles=[y*W+x,y*W+x+1,(y+1)*W+x+1,(y+1)*W+x],ids=tiles.map(t=>land[t]?owner[t]:-1);
        for(const id of new Set(ids)){
          if(id<0)continue;
          if(!paths.has(id)){paths.set(id,new Path2D());edges.set(id,new Path2D());}
          const mask=ids.reduce((m,v,i)=>m|(v===id?1<<i:0),0),path=paths.get(id),edge=edges.get(id);
          for(const poly of POLYGONS[mask]){
            const p=POINTS[poly[0]];path.moveTo(x+.5+p[0],y+.5+p[1]);
            for(let i=1;i<poly.length;i++){const q=POINTS[poly[i]];path.lineTo(x+.5+q[0],y+.5+q[1]);} // fill() implicitly closes these contours; edge strokes use a separate path.
            if(tiles.every(t=>land[t]))for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(a<4||b<4)continue;edge.moveTo(x+.5+POINTS[a][0],y+.5+POINTS[a][1]);edge.lineTo(x+.5+POINTS[b][0],y+.5+POINTS[b][1]);}
          }
        }
      }
      out.lineJoin='round';out.lineCap='round';
      for(const [id,path] of paths){out.fillStyle=rgba(players[id]?.color,.12);out.fill(path);out.strokeStyle=rgba(players[id]?.color,.75);out.lineWidth=1/c.s;out.stroke(edges.get(id));}
      if(fog){for(let y=y0;y<=y1;y++){for(let x=x0;x<=x1;){
        const alpha=t=>fog[t]?0:state.fogOpacity?Math.round(state.fogOpacity[t]/17):15;
        const level=alpha(y*W+x),start=x++;while(x<=x1&&alpha(y*W+x)===level)x++;
        if(level){out.fillStyle='rgba(9,17,23,'+(.70*level/15)+')';out.fillRect(start,y,x-start,1);}
      }}}
      overlayKey=key;overlayRefreshes++;
    }
    ctx.drawImage(overlayCanvas,0,0,state.width,state.height);
  }
  let frontKey='',frontPaths=[];
  function paintFronts(ctx,attacks,players,c,W,H,fog,time,tick,width,height,opacity=null){
    if(!enabled)return false;
    const key=[tick,c.x,c.y,c.s,width,height,attacks.length].join('|');
    if(key!==frontKey){
      frontPaths=[];const x0=Math.max(0,Math.floor(-c.x/c.s)-1),x1=Math.min(W-1,Math.ceil((width-c.x)/c.s)+1),y0=Math.max(0,Math.floor(-c.y/c.s)-1),y1=Math.min(H-1,Math.ceil((height-c.y)/c.s)+1);
      for(const attack of attacks){
        const tiles=attack.front,path=new Path2D(),cells=new Set();
        for(const tile of tiles){
          if(fog&&!fog[tile])continue;
          const tx=tile%W,ty=Math.floor(tile/W);if(tx<x0||tx>x1||ty<y0||ty>y1)continue;
          if(tx<x1&&ty<y1)cells.add(tile);
          if(tx>x0&&ty<y1)cells.add(tile-1);
          if(tx<x1&&ty>y0)cells.add(tile-W);
          if(tx>x0&&ty>y0)cells.add(tile-W-1);
        }
        for(const cell of cells){const x=cell%W,y=Math.floor(cell/W);
          const ids=[y*W+x,y*W+x+1,(y+1)*W+x+1,(y+1)*W+x],mask=ids.reduce((m,t,i)=>m|(tiles.has(t)&&(!fog||fog[t])?1<<i:0),0);
          for(const poly of POLYGONS[mask]){const p=POINTS[poly[0]];path.moveTo(x+.5+p[0],y+.5+p[1]);for(let i=1;i<poly.length;i++){const q=POINTS[poly[i]];path.lineTo(x+.5+q[0],y+.5+q[1]);}/* fill() implicitly closes each subpath; closePath() is quadratic on large fragmented fronts. */}
        }
        frontPaths.push({path,color:players[attack.owner].color});
      }
      frontKey=key;
    }
    ctx.save();ctx.translate(c.x,c.y);ctx.scale(c.s,c.s);ctx.globalAlpha=opacity??(.32+.12*Math.sin(time/240));
    for(const {path,color} of frontPaths){ctx.fillStyle=color;ctx.fill(path);}ctx.restore();return true;
  }
  function paintStructure(ctx,type,x,y,r,color,level=1){
    if(!enabled||!FRAMES[type]) return false;
    return sprite(ctx,structureKey(type,level),x,y,r*2*tierScale(level),color,0,.78);
  }
  let shipBlendCanvas=null;
  function paintShip(ctx,type,x,y,heading,r,color,hp,maxHp,{cruise=false}={}){
    if(!enabled||(type!=='warship'&&!directionalMetadata[type])) return false;
    const frameKey=index=>type==='warship'?'destroyer'+index:type+'/'+index;
    const phase=((heading/(Math.PI/4))%8+8)%8,low=Math.floor(phase),fraction=phase-low;
    const blend=fraction*fraction*(3-2*fraction),width=r*2.8*512/470;
    if(outsideCanvas(ctx,x,y,Math.max(width*.72,r+11)))return true;
    // Keep the camera/light fixed: no screen-space rotation of directional artwork.
    if(blend===0)sprite(ctx,frameKey(low),x,y,width,color,0);
    else{
      shipBlendCanvas??=createCanvas();
      const resolution=sourceResolution(ctx,width);
      if(shipBlendCanvas.width!==resolution||shipBlendCanvas.height!==resolution){shipBlendCanvas.width=shipBlendCanvas.height=resolution;}
      const mix=shipBlendCanvas.getContext('2d');mix.clearRect(0,0,shipBlendCanvas.width,shipBlendCanvas.height);mix.globalCompositeOperation='lighter';
      mix.globalAlpha=1-blend;mix.drawImage(source(frameKey(low),color,resolution),0,0);
      mix.globalAlpha=blend;mix.drawImage(source(frameKey((low+1)%8),color,resolution),0,0);
      mix.globalAlpha=1;mix.globalCompositeOperation='source-over';
      ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(shipBlendCanvas,x-width/2,y-width/2,width,width);ctx.restore();stats.spriteDraws++;
    }
    stats.unitDraws??={};stats.unitDraws[type]=(stats.unitDraws[type]||0)+1;if(type==='warship'){stats.shipHeading=Math.round(phase)%8;stats.shipDisplayAngle=heading;stats.shipBlend=blend;}
    if(type==='battleship'&&cruise){
      // Deck-mounted missile cells turn with the hull; their raised sides remain camera-upright.
      const forward=[Math.cos(heading),Math.sin(heading)],side=[-forward[1],forward[0]],u=r*.085;
      ctx.save();ctx.lineWidth=Math.max(.6,r*.018);ctx.strokeStyle='#17242a';
      for(const sign of [-1,1])for(let row=0;row<3;row++){
        const cx=x+side[0]*sign*r*.09+forward[0]*(row-1)*u*1.5,cy=y-r*.14+side[1]*sign*r*.09+forward[1]*(row-1)*u*1.5;
        const pts=[[-.65,-.6],[.65,-.6],[.65,.6],[-.65,.6]].map(([a,b])=>[cx+(forward[0]*a+side[0]*b)*u,cy+(forward[1]*a+side[1]*b)*u]);
        ctx.fillStyle='#28343b';ctx.beginPath();pts.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle='#a1a898';ctx.beginPath();pts.forEach(([px,py],i)=>i?ctx.lineTo(px,py-u*.5):ctx.moveTo(px,py-u*.5));ctx.closePath();ctx.fill();ctx.stroke();
      }ctx.restore();
    }
    if(hp!=null&&hp<maxHp){ ctx.save();ctx.fillStyle='#152029';ctx.fillRect(x-r,y-r-7,r*2,4);ctx.fillStyle='#9ed06d';ctx.fillRect(x-r,y-r-7,r*2*Math.max(0,hp)/maxHp,4);ctx.restore(); }
    return true;
  }

  function paintWake(ctx,ship,camera){
    if(!enabled||!(['warship',...Object.keys(directionalMetadata)].includes(ship.cls)))return false;
    const wake=ship.wake||[];if(wake.length<2||ship.pos>=ship.path.length-1)return true;
    const s=camera.s,points=[];
    for(let i=1;i<wake.length;i++){
      const a=wake[i-1],b=wake[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.001)continue;
      points.push([camera.x+(b[0]-dx/len*3.2)*s,camera.y+(b[1]-dy/len*3.2)*s,dx/len,dy/len]);
    }
    ctx.save();ctx.setLineDash([]);ctx.lineCap='butt';ctx.lineJoin='round';
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],fade=i/points.length;
      ctx.strokeStyle='rgba(194,225,230,'+(fade*.22)+')';ctx.lineWidth=Math.max(1,s*.16);
      for(const side of [-1,1]){const spread=(1-fade)*s*.55+s*.18;ctx.beginPath();ctx.moveTo(a[0]-a[3]*spread*side,a[1]+a[2]*spread*side);ctx.lineTo(b[0]-b[3]*spread*side,b[1]+b[2]*spread*side);ctx.stroke();}
    }
    ctx.restore();return true;
  }
  function paintAircraft(ctx,craft,camera){
    if(!enabled||!['fighter','bomber','carrier','spy'].includes(craft.type))return false;
    const x=camera.x+craft.x*camera.scale,y=camera.y+craft.y*camera.scale,w=Math.max(10,camera.scale*(craft.type==='fighter'?4.4:5.2));
    ctx.save();ctx.fillStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.ellipse(x+camera.scale,y+camera.scale*1.5,w*.35,w*.11,craft.heading,0,Math.PI*2);ctx.fill();ctx.restore();
    return paintShip(ctx,craft.type,x,y,craft.heading,w/(2.8*512/470),craft.color);
  }
  function paintSpy(ctx,craft,camera){return paintAircraft(ctx,{...craft,type:'spy'},camera);}
  function paintTruck(ctx,tr,camera){
    if(!enabled)return false;
    return paintShip(ctx,'truck',camera.x+tr.x*camera.scale,camera.y+tr.y*camera.scale,tr.heading,Math.max(9,camera.scale*3.6)/(2.8*512/470),tr.color);
  }
  function pickStructure(mx,my,structures,camera,fog,W){
    if(!enabled) return undefined;
    const found=structures.filter(st=>{
      if(fog&&!fog[st.t]) return false;
      const b=bounds(st,camera,W); return mx>=b.left&&mx<=b.right&&my>=b.top&&my<=b.bottom;
    }).sort((a,b)=>Math.floor(b.t/W)-Math.floor(a.t/W)||b.t-a.t);
    return found[0]||null;
  }
  function mountControls({zoom,toggle,focus,launch,sail,ready}){
    if(!__STATEFALL_DEV_RENDERERS__)return;
    panel=document.createElement('div');panel.id='classic-review';
    panel.innerHTML='<div class="classic-title">BATTLEFIELD STUDY <span>07 · MEDIUM-ZOOM FIX</span></div><div class="classic-buttons"><button data-view="2.2">Strategic</button><button data-view="10">Tactical</button><button data-view="24">Close</button><button data-action="home">Base</button><button data-action="compare">Compare art</button><button data-action="flight">Launch fighter</button><button data-action="sail">Sail loop</button></div><div class="classic-help">Drag to pan · Wheel to zoom · Right-click buildings or sea for orders · Space to pause</div><div id="classic-state" role="status">Loading coastal match…</div>';
    const css=document.createElement('style');css.textContent='#classic-review{position:absolute;left:16px;top:16px;z-index:3;padding:12px 16px;color:#eee7d2;background:rgba(18,25,26,.94);border:1px solid #788579;border-left:3px solid #b7a66b;max-width:calc(100% - 64px);box-shadow:0 8px 25px #0005;font:12px system-ui}.classic-title{font-weight:700;letter-spacing:2px;margin-bottom:9px}.classic-title span{font-size:9px;letter-spacing:1px;color:#b1baad;margin-left:16px}.classic-buttons{display:flex;gap:6px;flex-wrap:wrap}.classic-buttons button{font:11px system-ui;padding:5px 9px;border:1px solid #68736c;background:#29332f;color:#eee7d2;cursor:pointer}.classic-buttons button:hover{background:#455348}.classic-help{color:#bac1b5;font-size:10px;margin-top:8px}#classic-state{font-size:10px;color:#d4bf83;margin-top:5px}';
    document.head.appendChild(css);document.getElementById('stage').appendChild(panel);
    panel.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.dataset.view) zoom(+b.dataset.view);
      else if(b.dataset.action==='home') focus(home);
      else if(b.dataset.action==='compare'){ enabled=!enabled;b.textContent=enabled?'Compare art':'Show battlefield art';toggle(); }
      else if(b.dataset.action==='flight') launch();
      else if(b.dataset.action==='sail') sail?.();
    });
    ready?.();
  }
  return {
    interpolateShipHeading,get enabled(){return enabled;},paintTerrain,paintFronts,paintStructure,paintShip,paintWake,paintAircraft,paintSpy,paintTruck,pickStructure,
    setEnabled(value){enabled=!!value;},
    sortedStructures(values){return enabled?[...values].sort((a,b)=>a.t-b.t):values;},
    mountControls,
    setHome(value){home=value;},
    status(message){if(panel)panel.querySelector('#classic-state').textContent=message;},
    diagnostics(){const ordered=[...timings].sort((a,b)=>a-b);return {...stats,overlayRefreshes,terrainRefreshes,groundCacheBytes:groundCanvas?groundCanvas.width*groundCanvas.height*4:0,terrainCacheBytes:terrainCache?terrainCache.width*terrainCache.height*4:0,enabled,loaded:true,cacheEntries:sources.size,sourceBytes,sourceBudget:SOURCE_BUDGET,terrainP95Ms:ordered[Math.floor((ordered.length-1)*.95)]||0};},
    destroy(){if(groundCanvas)groundCanvas.width=groundCanvas.height=0;groundCanvas=null;if(shipBlendCanvas)shipBlendCanvas.width=shipBlendCanvas.height=0;shipBlendCanvas=null;if(overlayCanvas)overlayCanvas.width=overlayCanvas.height=0;overlayCanvas=null;if(terrainCache)terrainCache.width=terrainCache.height=0;terrainCache=null;panel?.remove();for(const c of sources.values())c.width=c.height=0;sources.clear();sourceBytes=0;patterns.clear();}
  };
}
