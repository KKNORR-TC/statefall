export function createLocalPlatform(runtime=globalThis){
  const capabilities=Object.freeze({accountSaves:false,scores:false,localScores:true});
  return Object.freeze({
    kind:'local',
    config:null,
    ready:async()=>{},
    fatal:error=>console.error('[statefall] fatal',error),
    identity:()=>null,
    capabilities:()=>capabilities,
    request:async()=>{throw Object.assign(new Error('Site services are unavailable in local play.'),{status:501});},
    requestUrl:async()=>{throw Object.assign(new Error('Site services are unavailable in local play.'),{status:501});},
    save:async()=>null,
    score:async()=>({skipped:true}),
    locale:()=>runtime.navigator?.language||'en',
    audioPermission:()=>true,
    onAudioChange:()=>()=>{},
    onLifecycle:handler=>{ const listener=()=>handler(runtime.document.hidden?'pause':'resume'); runtime.document.addEventListener('visibilitychange',listener); return ()=>runtime.document.removeEventListener('visibilitychange',listener); },
    navigate:url=>{ runtime.location.href=url; },
    reload:()=>runtime.location.reload()
  });
}
