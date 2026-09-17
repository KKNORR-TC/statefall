export function createWordPressPlatform(config,runtime=globalThis){
  const requestUrl=async(url,options={})=>{
    const init={credentials:'same-origin',...options,headers:{'X-WP-Nonce':config.nonce,...options.headers}};
    if(Object.hasOwn(init,'body')&&init.body!==null&&!(init.body instanceof runtime.FormData)&&typeof init.body!=='string'){
      init.body=JSON.stringify(init.body);
      init.headers={'Content-Type':'application/json',...init.headers};
    }
    const response=await runtime.fetch(url,init);
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw Object.assign(new Error(body.message||body.error||`http ${response.status}`),{status:response.status,body});
    return body;
  };
  const request=(path,options={})=>requestUrl(config.rest+path,options);
  const capabilities=Object.freeze({accountSaves:!!config.user,scores:!!config.user,localScores:true});
  return Object.freeze({
    kind:'wordpress',config,request,requestUrl,
    ready:async()=>{},
    fatal:error=>console.error('[statefall] fatal',error),
    identity:()=>config.user||null,
    capabilities:()=>capabilities,
    save:body=>request('saves',{method:'POST',body}),
    score:body=>request('scores',{method:'POST',body}),
    locale:()=>config.locale||runtime.navigator?.language||'en',
    audioPermission:()=>true,
    onAudioChange:()=>()=>{},
    onLifecycle:handler=>{ const listener=()=>handler(runtime.document.hidden?'pause':'resume'); runtime.document.addEventListener('visibilitychange',listener); return ()=>runtime.document.removeEventListener('visibilitychange',listener); },
    navigate:url=>{ runtime.location.href=url; },
    reload:()=>runtime.location.reload()
  });
}
