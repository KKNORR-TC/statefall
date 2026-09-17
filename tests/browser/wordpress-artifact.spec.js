const {test,expect}=require('@playwright/test');

test('installed exact release loads through WordPress without missing chunks',async({page})=>{
  const failures=[];
  page.on('pageerror',error=>failures.push(error.message));
  page.on('console',message=>{if(message.type()==='error')failures.push(message.text());});
  page.on('requestfailed',request=>failures.push(`failed ${request.url()}`));
  page.on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);});
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
  expect(failures,failures.join('\n')).toEqual([]);
});
