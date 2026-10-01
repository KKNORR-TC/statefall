const {test,expect}=require('@playwright/test');
const projects=new Set(['chromium-desktop','firefox-desktop','webkit-desktop','chromium-source-contract','chromium-built-contract','chromium-reduced-motion']);
const modulePattern='**/*legacy-game*.js*';

test('startup communicates loading and prevents input until the game is ready',async({page},testInfo)=>{
  test.skip(!projects.has(testInfo.project.name),'startup coverage uses desktop engines and source/built contracts');
  let release;
  const blocked=new Promise(resolve=>{release=resolve;});
  await page.route(modulePattern,route=>blocked.then(()=>route.continue()));
  try{
    await page.clock.install();
    await page.goto('/index.html?art=classic',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#bootStatus')).toBeVisible();
    await expect(page.locator('#bootTitle')).toHaveText('Loading Statefall');
    await expect(page.locator('#gameRoot')).toHaveAttribute('inert','');
    await expect(page.locator('#gameRoot')).toHaveAttribute('aria-busy','true');
    const focused=await page.locator('#startBtn').evaluate(button=>{button.focus();return document.activeElement===button;});
    expect(focused).toBe(false);
    await expect(page.locator('#bootUnits figcaption')).toHaveText('Fighter');
    await expect(page.locator('#bootUnits')).toBeVisible();
    const hasArtwork=await page.locator('#bootUnits canvas').evaluate(canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      return pixels.some((value,index)=>index%4===3&&value>0);
    });
    expect(hasArtwork).toBe(true);
    await page.clock.fastForward(3100);
    await expect(page.locator('#bootUnits figcaption')).toHaveText(testInfo.project.name==='chromium-reduced-motion'?'Fighter':'Battleship');
    await page.clock.resume();
    release();
    await expect(page.locator('#bootStatus')).toHaveCount(0);
    await expect(page.locator('#gameRoot')).not.toHaveAttribute('inert','');
    await page.locator('#guidedMatch').click();
    await page.locator('#seedIn').fill('STARTUPREADY');
    await page.locator('#setupNext').click();
    await page.locator('#setupNext').click();
    await page.locator('#countrySel').selectOption('0');
    await page.locator('#setupNext').click();
    await page.locator('#startBtn').click();
    await expect(page.locator('#start')).toBeHidden();
    await expect(page.locator('#myName')).not.toBeEmpty();
  }finally{release();}
});

test('failed startup offers a working retry without exposing inactive controls',async({page},testInfo)=>{
  test.skip(!projects.has(testInfo.project.name),'startup coverage uses desktop engines and source/built contracts');
  await page.route(modulePattern,route=>route.fulfill({status:503,contentType:'text/javascript',body:''}));
  await page.goto('/index.html?art=classic',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#bootStatus')).toHaveAttribute('role','alert');
  await expect(page.locator('#bootTitle')).toHaveText('Unable to load Statefall');
  await expect(page.locator('#gameRoot')).toHaveAttribute('inert','');
  await expect(page.locator('#bootRetry')).toBeVisible();
  await page.unroute(modulePattern);
  await page.locator('#bootRetry').click();
  await expect(page.locator('#bootStatus')).toHaveCount(0);
  await expect(page.locator('#gameRoot')).not.toHaveAttribute('inert','');
  await page.locator('#guidedMatch').click();
  await page.locator('#seedIn').fill('STARTUPRETRY');
});
