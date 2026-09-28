import {createTerrainRasterClient} from './terrain-raster-client.mjs';

// Only copied presentation data crosses this boundary; the worker never owns game state.
export function attachClassicTerrainWorker(art,{workerFactory,clock=()=>performance.now(),timeoutMs=5000}={}){
  if(!workerFactory&&(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'))return art;
  const paintFronts=art.paintFronts,paint=art.paintTerrain,diagnostics=art.diagnostics,destroy=art.destroy;
  let surface=null,published=null,frontLayers=null,lastKey='',lastTick=-1,failed=false,disposed=false,deadline=0,attackSerial=0;const attackIds=new WeakMap();
  const releaseFronts=()=>{for(const layer of frontLayers||[])layer.close();frontLayers=null;};
  const client=createTerrainRasterClient({
    workerFactory:workerFactory||(()=>new Worker(new URL('./classic-terrain-worker.mjs',import.meta.url),{type:'module',name:'statefall-classic-terrain'})),
    snapshot:s=>({
      W:s.W,H:s.H,width:s.width,height:s.height,dpr:s.dpr,camera:{...s.camera},
      land:new Uint8Array(s.land),river:new Uint8Array(s.river),rough:new Float32Array(s.rough),owner:new Int16Array(s.owner),
      fog:s.fog?new Uint8Array(s.fog):null,fogOpacity:s.fogOpacity?new Uint8Array(s.fogOpacity):null,
      attacks:(s.attacks||[]).map(a=>({owner:a.owner,front:Array.from(a.front)})),
      players:s.players.map(p=>({color:p.color})),structures:s.structures.map(v=>({t:v.t,type:v.type,owner:v.owner})),links:[],trucks:[]
    }),
    disposeResult:message=>{for(const layer of message?.frontLayers||[])layer.close();},
    allowIntermediate:()=>true,
    publish:message=>{
      if(!message){failed=true;return false;}
      deadline=clock()+timeoutMs;
      surface??=document.createElement('canvas');
      if(surface.width!==message.width)surface.width=message.width;if(surface.height!==message.height)surface.height=message.height;
      surface.getContext('2d').putImageData(new ImageData(message.pixels,message.width,message.height),0,0);
      releaseFronts();frontLayers=message.frontLayers??null;
      published={camera:message.camera,width:message.cssWidth,height:message.cssHeight};return true;
    },
    invalidateInstalled:()=>{published=null;releaseFronts();}
  });
  const reset=()=>{client.reset();published=null;lastKey='';lastTick=-1;failed=false;deadline=0;};
  art.paintTerrain=(context,state)=>{
    if(disposed)return false;
    if(!art.enabled||state.camera.s<5)return paint(context,state);
    if(state.tick<lastTick)reset();
    lastTick=state.tick;
    if(!failed&&!client.idle()&&deadline&&clock()>deadline){client.destroy();failed=true;}
    if(failed)return paint(context,state);
    const dpr=context.canvas.width/state.width,c=state.camera;
    // Overscan and captured cameras keep panning responsive while a new image is built.
    const camera={x:c.x+32,y:c.y+32,s:c.s};
    const key=[state.tick,camera.x,camera.y,c.s,state.width,state.height,dpr,state.structures.map(v=>v.t+':'+v.type+':'+v.owner).join(','),state.players.map(p=>p.color).join(','),(state.attacks||[]).map(a=>{if(!attackIds.has(a))attackIds.set(a,++attackSerial);return attackIds.get(a)+':'+a.owner+':'+a.front.size;}).join(',')].join('|');
    if(key!==lastKey){
      lastKey=key;if(client.idle())deadline=clock()+timeoutMs;
      client.request({...state,width:state.width+80,height:state.height+80,dpr,camera});
    }
    if(!published)return paint(context,state);
    const ratio=c.s/published.camera.s,dx=c.x-published.camera.x*ratio,dy=c.y-published.camera.y*ratio,dw=published.width*ratio,dh=published.height*ratio;
    if(dx>0||dy>0||dx+dw<state.width||dy+dh<state.height)return paint(context,state);
    context.drawImage(surface,dx,dy,dw,dh);
    return true;
  };
  if(paintFronts)art.paintFronts=(context,attacks,players,c,W,H,fog,time,tick,width,height,...rest)=>{
    if(disposed)return false;
    if(!art.enabled||!published||frontLayers===null||failed)return paintFronts(context,attacks,players,c,W,H,fog,time,tick,width,height,...rest);
    const ratio=c.s/published.camera.s,dx=c.x-published.camera.x*ratio,dy=c.y-published.camera.y*ratio,dw=published.width*ratio,dh=published.height*ratio;
    if(dx>0||dy>0||dx+dw<width||dy+dh<height)return paintFronts(context,attacks,players,c,W,H,fog,time,tick,width,height,...rest);
    context.save();context.imageSmoothingEnabled=false;context.globalAlpha=(.32+.12*Math.sin(time/240))/.44;for(const layer of frontLayers)context.drawImage(layer,dx,dy,dw,dh);context.restore();return true;
  };
  art.resetTerrain=reset;
  art.terrainSettled=async()=>{
    let timer;
    try{return await Promise.race([client.settled(),new Promise(resolve=>{timer=setTimeout(()=>{client.destroy();failed=true;resolve(client.diagnostics());},timeoutMs);})]);}
    finally{clearTimeout(timer);}
  };
  art.diagnostics=()=>({...diagnostics(),terrainWorker:{...client.diagnostics(),fallbackActive:failed,frontLayers:frontLayers?.length??null}});
  art.destroy=()=>{if(disposed)return;disposed=true;client.destroy();if(surface)surface.width=surface.height=0;surface=null;published=null;destroy();};
  return art;
}
