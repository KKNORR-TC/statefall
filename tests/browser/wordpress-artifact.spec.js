const {test,expect}=require('@playwright/test');

test('installed exact release loads through WordPress without missing chunks',async({page})=>{
  const failures=[],workers=[];
  page.on("worker",worker=>workers.push(worker.url()));
  page.on('pageerror',error=>failures.push(error.message));
  page.on('console',message=>{if(message.type()==='error')failures.push(message.text());});
  page.context().on('requestfailed',request=>failures.push(`failed ${request.url()}`));
  page.context().on('response',response=>{if(response.status()>=400||(response.status()>=300&&response.url().includes('/assets/')))failures.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));});
  await page.goto('/play/?browserTest=1',{waitUntil:'networkidle'});
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#sfUser')).toContainText(/Log in|Playing as/);
  await page.locator('#seedIn').fill('PHASECWORDPRESS');
  await page.locator('#countrySel').selectOption('0');
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
