import {RASTER_ANTIALIAS_MARGIN_CSS,conservativePaintBounds,paintBoundsIntersectViewport} from './paint-bounds.mjs';

export const STRUCTURE_ZOOM_CUTOFF=0.9;
export const MAX_STRUCTURE_SPRITES=4096;
export const MAX_STRUCTURE_POOL=512;
export const MAX_STRUCTURE_TEXTURES=512;
export const MAX_STRUCTURE_TEXT_POOL=1024;
export const STRUCTURE_ANTIALIAS_MARGIN=RASTER_ANTIALIAS_MARGIN_CSS;
export const STRUCTURE_AMBIENT_TYPES=Object.freeze(['radar','lradar','sam']);
export const STRUCTURE_AMBIENT_ZOOM_CUTOFF=1.2;
export const STRUCTURE_DISH_PERIOD_MS=6800;
const TAU=Math.PI*2;
const AIR_DEFENSE_ART=Object.freeze({
  radar:Object.freeze({family:'air-defense-02',role:'compact-radar',pivotX:.4,pivotY:-.72,dishHalf:.62}),
  lradar:Object.freeze({family:'air-defense-02',role:'long-range-array',pivotX:.18,pivotY:-.82,dishHalf:.82}),
  sam:Object.freeze({family:'air-defense-02',role:'launcher-tracker',pivotX:-.42,pivotY:-.63,dishHalf:.46})
});

export function structureAirDefenseArt(type){ return AIR_DEFENSE_ART[String(type)]||null; }

// drawIcon's engineering hook reaches 1.13r and its Bertha flare reaches
// 1.12r; every other glyph remains inside the outer circle stroke.
export function structureBasePaintBounds(type,x,y,radius){
  radius=Math.max(0,Number(radius)||0);
  const circleExtent=radius+Math.max(1.5,radius*.18)/2;
  const glyphExtent=radius*(type==='engcmd'?1.13:type==='bertha'?1.12:1);
  const extent=Math.max(circleExtent,glyphExtent);
  const textureAntialiasMargin=Math.max(RASTER_ANTIALIAS_MARGIN_CSS,radius/24);
  return conservativePaintBounds(x-extent,y-extent,x+extent,y+extent,'base',textureAntialiasMargin);
}

export const structureTextureKey=(type,color)=>`${String(type)}\u0000${String(color).toLowerCase()}`;

export function structureTilePhase(tile){
  tile=Number(tile);
  if(!Number.isInteger(tile)||tile<0) return null;
  return (Math.imul(tile,0x9e3779b1)>>>0)/0x100000000*TAU;
}

export function structureAmbientDish(item,camera,time,{mapWidth=720,reducedMotion=false,quality='high'}={}){
  const tile=Number(item?.tile),type=String(item?.type||''),art=structureAirDefenseArt(type),scale=Number(camera?.scale);
  if(!art||item?.building||!Number.isInteger(tile)||tile<0||!Number.isInteger(mapWidth)||mapWidth<1||!Number.isFinite(scale)||scale<STRUCTURE_AMBIENT_ZOOM_CUTOFF) return null;
  const tileX=tile%mapWidth,tileY=(tile-tileX)/mapWidth,x=Number(camera?.x)+(tileX+.5)*scale,y=Number(camera?.y)+(tileY+.5)*scale,radius=Math.max(6,scale*2.4),phase=structureTilePhase(tile);
  if(!Number.isFinite(x)||!Number.isFinite(y)) return null;
  const motionMode=reducedMotion||quality==='low'||(type==='sam'&&item?.suppressed)?'static':'moving';
  const quantizedTime=motionMode==='moving'?Math.floor(Math.max(0,Number(time)||0)/(1000/30))*(1000/30):0;
  const angle=(phase+quantizedTime/STRUCTURE_DISH_PERIOD_MS*TAU)%TAU,pivotX=x+art.pivotX*radius,pivotY=y+art.pivotY*radius,half=radius*art.dishHalf,dx=Math.cos(angle)*half,dy=Math.sin(angle)*half;
  return Object.freeze({kind:'line',x1:pivotX-dx,y1:pivotY-dy,x2:pivotX+dx,y2:pivotY+dy,stroke:'rgba(214,212,195,.92)',width:Math.max(1,radius*.12),semantic:'ambient-dish',tile,type,family:art.family,role:art.role,pivotX,pivotY,phase,angle,motionMode});
}

export function structureVisual(item,camera,viewport,fog,mapWidth=720){
  const scale=Number(camera?.scale),tile=Number(item?.tile);
  if(!Number.isFinite(scale)||scale<STRUCTURE_ZOOM_CUTOFF||!Number.isInteger(tile)||tile<0) return null;
  if(fog&&!fog[tile]) return null;
  const tileX=tile%mapWidth,tileY=(tile-tileX)/mapWidth;
  const x=Number(camera.x)+(tileX+0.5)*scale,y=Number(camera.y)+(tileY+0.5)*scale;
  const radius=Math.max(6,scale*2.4),pop=item.building?1:Number.isFinite(item.pop)?item.pop:1,visualRadius=radius*pop;
  const painted=structureBasePaintBounds(item.type,x,y,visualRadius),width=Number(viewport?.width)||0,height=Number(viewport?.height)||0;
  if(!paintBoundsIntersectViewport(painted,{width,height})) return null;
  return {x,y,radius,scale:pop,alpha:item.building?0.45:1};
}

export function createBoundedPool({maximum,idleMaximum=maximum,create,destroy}){
  const idle=[]; let live=0,created=0,reused=0,destroyed=0;
  const pool={
    acquire(){
      if(idle.length){ reused++; return idle.pop(); }
      if(live>=maximum) return null;
      const value=create();
      live++; created++; return value;
    },
    acquireMany(count){
      const acquired=[]; let capped=false;
      const rollback=()=>{ let rollbackError=null; for(const held of acquired) try{ pool.release(held); }catch(error){ rollbackError??=error; } return rollbackError; };
      try{
        for(let i=0;i<count;i++){
          const value=pool.acquire();
          if(value) acquired.push(value);
          else { capped=true; break; }
        }
      }catch(error){ const rollbackError=rollback(); if(rollbackError&&rollbackError!==error) error.rollbackError=rollbackError; throw error; }
      if(capped){ const rollbackError=rollback(); if(rollbackError) throw rollbackError; return null; }
      return acquired;
    },
    release(value){
      if(!value) return;
      if(idle.length<idleMaximum) idle.push(value);
      else { try{ destroy(value); } finally { live--; destroyed++; } }
    },
    discard(value){
      if(!value) return;
      try{ destroy(value); } finally { live--; destroyed++; }
    },
    drain(){ let error=null; while(idle.length){ const value=idle.pop(); try{ destroy(value); }catch(caught){ error??=caught; }finally{ live--; destroyed++; } } if(error) throw error; },
    diagnostics(){ return {live,pooled:idle.length,created,reused,destroyed,maximum,idleMaximum}; }
  };
  return pool;
}
