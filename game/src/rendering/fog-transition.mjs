// Presentation-only memory. Current visibility remains authoritative for entities/orders.
export function createFogTransition({fadeTicks=20}={}){
  let previous=null,lostAt=null,opacity=null,lastTick=-1;
  function reset(){previous=null;lostAt=null;opacity=null;lastTick=-1;}
  function update(visible,tick){
    if(!visible){reset();return null;}
    if(!previous||previous.length!==visible.length||tick<lastTick){
      previous=new Uint8Array(visible);lostAt=new Int32Array(visible.length).fill(-1);
      opacity=Uint8Array.from(visible,value=>value?0:255);lastTick=tick;return opacity;
    }
    if(tick===lastTick)return opacity;
    for(let t=0;t<visible.length;t++){
      if(visible[t]){opacity[t]=0;lostAt[t]=-1;}
      else{
        if(previous[t])lostAt[t]=tick;
        opacity[t]=lostAt[t]<0?255:Math.min(255,Math.round((tick-lostAt[t])*255/fadeTicks));
      }
      previous[t]=visible[t];
    }
    lastTick=tick;return opacity;
  }
  return {update,reset};
}
