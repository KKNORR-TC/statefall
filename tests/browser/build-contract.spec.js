const {test,expect}=require('@playwright/test');
const {assertCanonicalBaseline}=require('../tools/simulation-baselines.js');

test('source and built module applications load every chunk and preserve the canonical simulation',async({page},testInfo)=>{
  const failures=[],workers=[];
  page.on("worker",worker=>workers.push(worker.url()));
  page.on('pageerror',error=>failures.push(error.message));
  page.on('console',message=>{if(message.type()==='error')failures.push(message.text());});
  page.context().on('requestfailed',request=>failures.push(`failed ${request.url()}`));
  page.context().on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;Object.defineProperty(Performance.prototype,'now',{value:()=>1_000});localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));});
  await page.goto('/index.html?browserTest=1&renderer=pixi',{waitUntil:'networkidle'});
  if(testInfo.project.name==='chromium-source-contract'){
    const browserAdapter=await page.evaluate(()=>fetch('/src/legacy-game.js').then(response=>response.text()));
    expect(browserAdapter).not.toMatch(/engine\.compatibility\b/);
  }
  if(testInfo.project.name==='chromium-built-contract'){
    expect(await page.evaluate(()=>('__STATEFALL_TEST__' in window))).toBe(false);
    expect(await page.locator('.pixi-world').count()).toBe(0);
    await page.locator('#guidedMatch').click();
    await page.locator('#seedIn').fill('PHASECBUILT');
    await page.locator('#setupNext').click();
    await page.locator('#setupNext').click();
    await page.locator('#countrySel').selectOption('0');
    await page.locator('#setupNext').click();
    await page.locator('#startBtn').click();
    await expect(page.locator('#start')).toBeHidden();
    await expect(page.locator('#myName')).not.toBeEmpty();
    const canvas=await page.locator('#map').evaluate(element=>({width:element.width,height:element.height}));
    expect(canvas.width).toBeGreaterThan(0); expect(canvas.height).toBeGreaterThan(0);
    const mapBox=await page.locator('#map').boundingBox();
    await page.mouse.move(mapBox.x+mapBox.width/2,mapBox.y+mapBox.height/2);
    for(let i=0;i<14;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(20);}
    await expect.poll(()=>workers.some(url=>url.includes('classic-terrain-worker'))).toBe(true);
    await page.waitForTimeout(1000);
    const modules=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname).filter(path=>/\.(?:js|css)$/.test(path)));
    expect(modules.length).toBeGreaterThan(0);
    const inventory=await page.evaluate(()=>fetch('/bundle-report.json').then(response=>response.json()));
    expect(inventory.productionJsInventory.length).toBeGreaterThan(0);
    expect(inventory.productionJsInventory.every(file=>file.scanned&&/^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(inventory.assetCategories.atlasTextures.length).toBeGreaterThanOrEqual(23);
    expect(inventory.assetCategories.atlasManifests).toEqual([]);
    expect(inventory.assetCategories.fonts).toEqual([]);
    expect(inventory.assetCategories.audio).toHaveLength(39);
    expect(await page.locator('#classic-review').count()).toBe(0);
    expect(await page.evaluate(()=>('__STATEFALL_CLASSIC__' in window))).toBe(false);
    expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/port-level2|airfield-level2|fort-level[23]/.test(e.name)).length)).toBe(4);
    const scripts=await page.evaluate(async paths=>Promise.all(paths.map(path=>fetch(`/${path}`).then(response=>response.text()))),inventory.productionJsInventory.map(file=>file.path)),versionText=await page.evaluate(()=>fetch('/VERSION.txt').then(response=>response.text())),build=versionText.match(/\bbuild (\S+)/)?.[1]||'',productionSource=scripts.join('\n'),guardSource=build?productionSource.replaceAll(build,''):productionSource;
    expect(productionSource).not.toContain('__STATEFALL_TEST__');
    expect(productionSource).not.toMatch(/__STATEFALL_CLASSIC__|BATTLEFIELD STUDY|Loading coastal match/);
    expect(guardSource).not.toMatch(/@pixi|pixi\.js|pixi-world|pixiInit|createPixiHybridRenderer|createPixiAtlasRegistry|statefall-atlas|world-raster|planned-entities|unsupported-renderer|development-renderer-disabled|__STATEFALL_DEV_RENDERERS__/i);
    expect(productionSource).not.toMatch(/createRelayWebSocketClient|relay\.connect|relay\.ready|relay\.batch-outcome-report/);
    expect(failures,failures.join('\n')).toEqual([]);
    return;
  }
  // Network idle can precede asynchronous renderer startup and bridge registration.
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__?.prepareControlledStart)).toBe('function');
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
