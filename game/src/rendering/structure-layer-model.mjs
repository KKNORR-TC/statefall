import {RASTER_ANTIALIAS_MARGIN_CSS,conservativePaintBounds,paintBoundsIntersectViewport} from './paint-bounds.mjs';

export const STRUCTURE_ZOOM_CUTOFF=0.9;
export const MAX_STRUCTURE_SPRITES=4096;
export const MAX_STRUCTURE_POOL=512;
export const MAX_STRUCTURE_TEXTURES=512;
export const STRUCTURE_ANTIALIAS_MARGIN=RASTER_ANTIALIAS_MARGIN_CSS;

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
      live++; created++; return create();
    },
    acquireMany(count){
      const acquired=[];
      try{
        for(let i=0;i<count;i++){
          const value=pool.acquire();
          if(value) acquired.push(value);
          else { for(const held of acquired) pool.release(held); return null; }
        }
      }catch(error){ for(const held of acquired) pool.release(held); throw error; }
      return acquired;
    },
    release(value){
      if(!value) return;
      if(idle.length<idleMaximum) idle.push(value);
      else { destroy(value); live--; destroyed++; }
    },
    drain(){ while(idle.length){ destroy(idle.pop()); live--; destroyed++; } },
    diagnostics(){ return {live,pooled:idle.length,created,reused,destroyed,maximum,idleMaximum}; }
  };
  return pool;
}
