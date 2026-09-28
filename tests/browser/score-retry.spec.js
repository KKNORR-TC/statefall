const {test,expect}=require('@playwright/test');

for(const rejection of ['expired','invalid','signature'])test('score '+rejection+' response preserves the correct retry policy',async({page},testInfo)=>{
  test.skip(!['chromium-desktop','firefox-desktop','webkit-desktop'].includes(testInfo.project.name),'account retry coverage runs in the three desktop engines');
  let accepted=false;const posted=[];
  await page.route('**/release-test-api/**',async route=>{
    if(route.request().url().endsWith('/scores')){
      posted.push(route.request().postDataJSON());
      return route.fulfill({status:accepted?200:rejection==='invalid'?422:403,contentType:'application/json',body:JSON.stringify(accepted?{id:1,rank:1,classRank:1,duplicate:true}:rejection==='expired'?{code:'rest_cookie_invalid_nonce',message:'Cookie check failed'}:{error:rejection==='signature'?'bad_signature':'invalid',message:'Invalid score'})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:1,items:[]})});
  });
  await page.route('**/src/legacy-game.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__releaseRecordScore=()=>recordMatch("Defeat");'});});
  await page.addInitScript(()=>{
    window.__STATEFALL_TEST_MODE__=true;
    window.STATEFALL_WP={rest:'/release-test-api/',nonce:'test-nonce',user:{id:7,name:'Release test'},profileUrl:'#',boardUrl:'#',logoutUrl:'#'};
    localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));
  });
  await page.goto('/index.html?browserTest=1');
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator('#seedIn').fill('RELEASESCORE');await page.locator('#countrySel').selectOption('0');await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
  await page.evaluate(()=>window.__releaseRecordScore());
  await expect.poll(()=>posted.length).toBe(1);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('statefall-lastpost')||'null')?.ok)).toBe(false);
  const outbox=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('statefall-outbox')||'[]'));
  await expect.poll(async()=>(await outbox()).length).toBe(rejection==='expired'?1:0);
  if(rejection==='expired'){
    const original=await outbox();await page.reload();await expect.poll(()=>posted.length).toBe(2);
    expect(await outbox()).toEqual(original);
    accepted=true;await page.reload();await expect.poll(()=>posted.length).toBe(3);
    await expect.poll(async()=>(await outbox()).length).toBe(0);
    expect(posted.map(p=>p.seed)).toEqual(['RELEASESCORE','RELEASESCORE','RELEASESCORE']);
    expect(new Set(posted.map(p=>p.sig)).size).toBe(1);
    await page.reload();expect(posted).toHaveLength(3);
  }
});
