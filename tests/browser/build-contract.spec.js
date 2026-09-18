const {test,expect}=require('@playwright/test');
const {assertCanonicalBaseline}=require('../tools/simulation-baselines.js');

test('source and built module applications load every chunk and preserve the canonical simulation',async({page},testInfo)=>{
  const failures=[];
  page.on('pageerror',error=>failures.push(error.message));
  page.on('console',message=>{if(message.type()==='error')failures.push(message.text());});
  page.on('requestfailed',request=>failures.push(`failed ${request.url()}`));
  page.on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;Object.defineProperty(Performance.prototype,'now',{value:()=>1_000});localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));});
  await page.goto('/index.html?browserTest=1',{waitUntil:'networkidle'});
  if(testInfo.project.name==='chromium-source-contract'){
    const browserAdapter=await page.evaluate(()=>fetch('/src/legacy-game.js').then(response=>response.text()));
    expect(browserAdapter).not.toMatch(/engine\.compatibility\b/);
  }
  if(testInfo.project.name==='chromium-built-contract'){
    expect(await page.evaluate(()=>('__STATEFALL_TEST__' in window))).toBe(false);
    await page.locator('#seedIn').fill('PHASECBUILT');
    await page.locator('#countrySel').selectOption('0');
    await page.locator('#startBtn').click();
    await expect(page.locator('#start')).toBeHidden();
    await expect(page.locator('#myName')).not.toBeEmpty();
    const canvas=await page.locator('#map').evaluate(element=>({width:element.width,height:element.height}));
    expect(canvas.width).toBeGreaterThan(0); expect(canvas.height).toBeGreaterThan(0);
    const modules=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname).filter(path=>/\.(?:js|css)$/.test(path)));
    expect(modules.length).toBeGreaterThan(0);
    const scripts=await page.evaluate(async()=>Promise.all(performance.getEntriesByType('resource').map(entry=>entry.name).filter(url=>/\.js$/.test(new URL(url).pathname)).map(url=>fetch(url).then(response=>response.text()))));
    expect(scripts.join('\n')).not.toContain('__STATEFALL_TEST__');
    expect(failures,failures.join('\n')).toEqual([]);
    return;
  }
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator('#maps button[data-m="random"]').click();
  await page.locator('#seedIn').fill('PHASE0DIGEST');
  await page.locator('#countrySel').selectOption('0');
  await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready)).toBe(true);
  await page.evaluate(()=>{window.__STATEFALL_TEST__.pause();window.__STATEFALL_TEST__.advance(300);});
  const digest=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalDigest());
  assertCanonicalBaseline('browser','fixed-seed-cross-engine',digest,testInfo.project.name);
  const modules=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname).filter(path=>/\.(?:js|css)$/.test(path)));
  expect(modules.length).toBeGreaterThan(0);
  expect(failures,failures.join('\n')).toEqual([]);
});
