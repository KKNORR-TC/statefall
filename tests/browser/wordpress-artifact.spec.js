const {test,expect}=require('@playwright/test');

for (const scenario of ['anonymous', 'static-host', 'logged-in-custom-flag']) {
const staticHost=scenario!=='anonymous', loggedIn=scenario==='logged-in-custom-flag';
test(`installed exact release loads on ${scenario} without missing chunks`,async({page})=>{
  if (staticHost) await page.route('**/play/releases/**', route => route.fulfill({status:404,contentType:'text/plain',body:'Static host: no physical file at virtual route'}));
  const failures=[],workers=[];
  page.on("worker",worker=>workers.push(worker.url()));
  page.on('pageerror',error=>failures.push(error.message));
  page.on('console',message=>{if(message.type()==='error')failures.push(message.text());});
  page.context().on('requestfailed',request=>failures.push(`failed ${request.url()}`));
  page.context().on('response',response=>{if(response.status()>=400||(response.status()>=300&&response.url().includes('/assets/')))failures.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));});
  // Fix only host-side opponent selection randomness; the seeded simulation RNG is unchanged.
  await page.addInitScript(()=>{Math.random=()=>0.2;});
  if(loggedIn){
    await page.goto('/wp-login.php');
    await page.locator('#user_login').fill('artifact-admin');
    await page.locator('#user_pass').fill('artifact-password');
    await page.locator('#wp-submit').click();
    await expect(page).toHaveURL(/wp-admin/);
  }
  await page.goto('/play/',{waitUntil:'networkidle'});
  await expect(page.locator('#bootStatus')).toHaveCount(0);
  await expect(page.locator('#gameRoot')).not.toHaveAttribute('inert', '');
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).margin)).toBe('0px');
  expect(await page.evaluate(()=>window.STATEFALL_WP.assets)).toContain('/statefall/releases/');
  expect(await page.evaluate(()=>window.STATEFALL_WP.assets)).not.toContain('/play/releases/');
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#sfUser')).toContainText(/Log in|Playing as/);
  await page.locator('#seedIn').fill('PHASECWORDPRESS');
  expect(await page.evaluate(()=>window.STATEFALL_WP.nationPool.some(n=>n.flag.layers.some(l=>l[0]==='emb'&&l[6]===null)))).toBe(true);
  if(loggedIn){
    expect(await page.evaluate(()=>window.STATEFALL_WP.user?.nation?.flag.layers[1][6])).toBe(null);
    await expect(page.locator('#countrySel')).toHaveValue('-1');
  }else await page.locator('#countrySel').selectOption('0');
  await page.locator('#startBtn').click();
  await expect(page.locator('#start')).toBeHidden();
  await expect(page.locator('#myName')).not.toBeEmpty();
  expect(await page.locator('#map').evaluate(canvas=>canvas.width>0&&canvas.height>0)).toBe(true);
  expect(await page.evaluate(()=>('__STATEFALL_TEST__' in window))).toBe(false);
  expect(await page.locator('#classic-review').count()).toBe(0);
  expect(await page.evaluate(()=>('__STATEFALL_CLASSIC__' in window))).toBe(false);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/port-level2|airfield-level2|fort-level[23]/.test(e.name)).length)).toBe(4);
  const box=await page.locator('#map').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<14;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(20);}
  await expect.poll(()=>workers.some(url=>url.includes('classic-terrain-worker'))).toBe(true);
    await page.waitForTimeout(1000);
  expect(failures,failures.join('\n')).toEqual([]);
});

}
