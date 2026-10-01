export function createSamplePlayer({context:C,buses,catalog,canPlay,fetcher=fetch}){
  const cache=new Map(),nodes=new Set(),last=new Map();
  let epoch=0,battleEpoch=0,milestones=Promise.resolve(),pendingMilestone=null,duckUntil=0;
  const duck=C.createGain();duck.connect(buses.music);
  function duckScore(seconds){
    const t=C.currentTime;duckUntil=Math.max(duckUntil,t+seconds);
    duck.gain.cancelScheduledValues(t);duck.gain.setValueAtTime(duck.gain.value,t);
    duck.gain.linearRampToValueAtTime(.2,t+.12);duck.gain.setValueAtTime(.2,duckUntil);
    duck.gain.linearRampToValueAtTime(1,duckUntil+1.2);
  }
  async function buffer(id){
    if(!catalog[id])return null;
    if(!cache.has(id))cache.set(id,(async()=>{
      const r=await fetcher(catalog[id].url);if(!r.ok)throw new Error(`Audio ${r.status}: ${id}`);
      return C.decodeAudioData(await r.arrayBuffer());
    })().catch(error=>{cache.delete(id);console.warn('[statefall] effect unavailable',id,error);return null;}));
    return cache.get(id);
  }
  async function play(id,{gain=.7,bus='sfx',battle=false,lowpass=16000,pan=0,rate=1,throttle=0,delay=0,duckMusic=false}={}){
    if(!canPlay()||!catalog[id])return null;
    const now=C.currentTime;
    if(throttle&&now-(last.get(id)??-Infinity)<throttle)return null;
    last.set(id,now);
    const token=epoch,bt=battleEpoch,buf=await buffer(id);
    if(!buf||token!==epoch||(battle&&bt!==battleEpoch)||!canPlay()||nodes.size>=24)return null;
    const s=C.createBufferSource(),g=C.createGain(),filter=C.createBiquadFilter(),p=C.createStereoPanner();
    s.buffer=buf;s.playbackRate.value=rate;g.gain.value=gain;filter.type='lowpass';filter.frequency.value=lowpass;p.pan.value=pan;
    s.connect(filter);filter.connect(g);g.connect(p);p.connect(buses[bus]);
    const item={s,g,battle};nodes.add(item);
    s.onended=()=>{nodes.delete(item);s.disconnect();filter.disconnect();g.disconnect();p.disconnect();};
    if(duckMusic)duckScore(buf.duration/rate+delay);
    s.start(C.currentTime+delay);return {seconds:buf.duration/rate+delay};
  }
  function stop(battleOnly=false){
    if(battleOnly)battleEpoch++;else{epoch++;battleEpoch++;milestones=Promise.resolve();pendingMilestone=null;last.clear();duckUntil=0;duck.gain.cancelScheduledValues(C.currentTime);duck.gain.setTargetAtTime(1,C.currentTime,.2);}
    for(const item of nodes){if(battleOnly&&!item.battle)continue;
      item.g.gain.setTargetAtTime(0,C.currentTime,.12);try{item.s.stop(C.currentTime+.5);}catch{} }
  }
  function milestone(id){
    if(!canPlay()||!catalog[id])return Promise.resolve();
    // One advance can finish a country, its region, and the enemy together.
    // Announce only its strongest outcome, then serialize separate advances.
    const priority={'capture-neutral':1,'capture-enemy':2,'enemy-eliminated':3};
    if(pendingMilestone){
      if((priority[id]||0)>(priority[pendingMilestone.id]||0))pendingMilestone.id=id;
      return pendingMilestone.promise;
    }
    const batch={id,token:epoch};pendingMilestone=batch;
    batch.promise=Promise.resolve().then(()=>{
      if(pendingMilestone===batch)pendingMilestone=null;
      if(batch.token!==epoch)return;
      milestones=milestones.then(async()=>{
        if(batch.token!==epoch||!canPlay())return;
        const played=await play(batch.id,{gain:.8,bus:'alert',duckMusic:true});
        if(played)await new Promise(resolve=>setTimeout(resolve,(played.seconds+.15)*1000));
      }).catch(error=>console.warn('[statefall] milestone unavailable',error));
      return milestones;
    });
    return batch.promise;
  }
  return {play,stop,milestone,duckScore,musicInput:duck,diagnostics:()=>({active:nodes.size,cached:cache.size,duckUntil})};
}
