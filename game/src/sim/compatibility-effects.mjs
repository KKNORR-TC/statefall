import * as portableMath from "./strict-math.mjs";
const noop=()=>{};

export function createCompatibilityEffectProducer({random,sink}={}){
  const draw=typeof random==='function'?random:()=>{ throw new TypeError('Compatibility effects require a deterministic random source.'); };
  const emit=typeof sink==='function'?sink:noop;

  function puff(x,y,n=4,col='120,120,120'){
    for(let i=0;i<n;i++){
      const descriptor={x:x+.5,y:y+.5,vx:(draw()-.5)*.25,vy:-(.1+draw()*.2),r:1+draw()*1.5,age:0,life:30+draw()*25,col};
      emit({type:'puff',descriptor});
    }
  }

  function wreck(kind,x,y,hdg,col,cls){
    if(kind&&typeof kind==='object'){
      emit({type:'wreck',descriptor:kind});
      return;
    }
    const descriptor={kind,x,y,hdg,col,cls,age:0,spin:(draw()-.5)*.08};
    emit({type:'wreck',descriptor});
  }

  function fragments(x,y,ang,n=6,col='#ffd27a'){
    for(let i=0;i<n;i++){
      const a=ang+(draw()-.5)*1.2;
      const sp=.6+draw()*1.2;
      const descriptor={x,y,vx:portableMath.cos(a)*sp,vy:portableMath.sin(a)*sp,age:0,life:12+draw()*10,col};
      emit({type:'fragment',descriptor});
    }
  }

  function fragment(descriptor){ emit({type:'fragment',descriptor}); }

  return Object.freeze({puff,wreck,fragments,fragment});
}
