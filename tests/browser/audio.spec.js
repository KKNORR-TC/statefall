const {test,expect}=require('@playwright/test');

test('approved audio decodes and situation / Radio controls survive mute and reload',async({page},testInfo)=>{
  test.skip(!['chromium-desktop','firefox-desktop','webkit-desktop'].includes(testInfo.project.name));
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:.001,sfx:.8,alert:.8,amb:.25,music:.4}));});
  await page.goto('/index.html?browserTest=1',{waitUntil:'load'});
  const supportsAudio=await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
  await expect.poll(()=>page.evaluate(()=>!!window.__STATEFALL_TEST__?.audio)).toBe(true);
  await page.locator('#seedIn').fill('AUDIOREVIEW');await page.locator('#countrySel').selectOption('0');await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().role)).toBe('building');
  await page.locator('#sndBtn').click();await expect(page.locator('#musicSource')).toHaveValue('situation');
  if(!supportsAudio){
    testInfo.annotations.push({type:'audio-coverage',description:'This browser runtime does not expose Web Audio. UI fallback covered; audio decoding requires a Web Audio capable Safari/WebKit runtime.'});
    await page.locator('#musicSource').selectOption('radio');await page.locator('#muteAll').check();await page.locator('#muteAll').uncheck();
    expect(await page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().playing)).toBe(false);
    await page.reload();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.audio.state().source)).toBe('radio');
    expect(errors).toEqual([]);return;
  }
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().playing),{timeout:20000}).toBe(true);
  await page.locator('#jukePause').click();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().paused)).toBe(true);
  await page.locator('#musicSource').selectOption('radio');
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().playing)).toBe(false);
  await page.locator('#jukePause').click();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().playing)).toBe(true);
  await page.locator('#muteAll').check();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().playing)).toBe(false);
  await page.locator('#muteAll').uncheck();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().playing)).toBe(true);
  const result=await page.evaluate(async()=>{
    const {SOUND_ASSETS,SCORE_TRACKS}=await import('/src/audio/catalog.mjs');
    const context=new AudioContext(),bad=[];
    for(const [id,a] of [...Object.entries(SOUND_ASSETS),...SCORE_TRACKS.map(t=>[t.id,t])]){
      try{const r=await fetch(a.url);if(!r.ok)throw Error(r.status);const b=await context.decodeAudioData(await r.arrayBuffer());if(b.duration<.1)throw Error('empty');}catch(e){bad.push(id+': '+e.message);}
    }
    await context.close();return {bad,count:Object.keys(SOUND_ASSETS).length+SCORE_TRACKS.length};
  });
  expect(result).toEqual({bad:[],count:55});
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.audio.state().cached)).toBeLessThanOrEqual(3);
  await page.reload();await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.audio.state().source)).toBe('radio');
  expect(errors).toEqual([]);
});

test('pausing during a pending score download cannot start late playback',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop');
  let release;const gate=new Promise(r=>release=r);
  await page.route('**/wp-content/uploads/statefall/audio/**',route=>gate.then(()=>route.continue()));
  try{
    await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:.001}));});
    await page.goto('/index.html?browserTest=1',{waitUntil:'domcontentloaded'});
    await page.locator('#seedIn').fill('AUDIOPENDING');await page.locator('#startBtn').click();await page.locator('#sndBtn').click();
    await page.locator('#jukePause').click();release();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(()=>window.__STATEFALL_TEST__.audio.state())).toMatchObject({paused:true,playing:false});
  }finally{release();}
});
