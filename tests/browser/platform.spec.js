const {test,expect}=require('@playwright/test');

test('local and WordPress adapters own platform boundaries',async({page})=>{
  await page.goto('/index.html');
  const result=await page.evaluate(async()=>{
    const [{createLocalPlatform},{createWordPressPlatform}]=await Promise.all([
      import('/src/integration/local-platform.js'),import('/src/integration/wordpress-platform.js')
    ]);
    const events=[],calls=[];
    const document={hidden:false,addEventListener:(name,fn)=>events.push([name,fn]),removeEventListener:(name)=>events.push(['remove',name])};
    const location={href:'start',reload:()=>events.push(['reload'])};
    class FormData{}
    const runtime={document,location,navigator:{language:'en-GB'},FormData,fetch:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,json:async()=>({ok:true})};}};
    const local=createLocalPlatform(runtime),wp=createWordPressPlatform({rest:'/api/',nonce:'nonce',user:{id:7,name:'Ken'}},runtime);
    const lifecycle=[]; const dispose=wp.onLifecycle(value=>lifecycle.push(value)); events[0][1](); dispose();
    await wp.save({kind:'save'}); await wp.score({seed:'X'}); await wp.request('me');
    wp.navigate('/play/'); wp.reload();
    const localScore=await local.score({}); const localSave=await local.save({});
    let localRequestStatus=0; try{await local.request('me');}catch(error){localRequestStatus=error.status;}
    return {local:{kind:local.kind,identity:local.identity(),capabilities:local.capabilities(),score:localScore,save:localSave,requestStatus:localRequestStatus},wp:{kind:wp.kind,identity:wp.identity(),capabilities:wp.capabilities()},calls,lifecycle,href:location.href,reloaded:events.some(event=>event[0]==='reload')};
  });
  expect(result.local).toMatchObject({kind:'local',identity:null,capabilities:{accountSaves:false,scores:false,localScores:true},score:{skipped:true},save:null,requestStatus:501});
  expect(result.wp).toMatchObject({kind:'wordpress',identity:{id:7,name:'Ken'},capabilities:{accountSaves:true,scores:true,localScores:true}});
  expect(result.calls.map(call=>call.url)).toEqual(['/api/saves','/api/scores','/api/me']);
  expect(result.calls[0].init.headers).toMatchObject({'Content-Type':'application/json','X-WP-Nonce':'nonce'});
  expect(result.lifecycle).toEqual(['resume']); expect(result.href).toBe('/play/'); expect(result.reloaded).toBe(true);
});
