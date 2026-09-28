const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const REVIEW=process.env.STATEFALL_PHASE_G_PROJECTILES_REVIEW==='1';
const OUTPUT=path.resolve(__dirname,'../../.artifacts/phase-g-projectiles-review/assets');
const projectiles=['strategic-missile','cruise-missile','naval-barrage','heavy-artillery','surface-gun-shell','torpedo','defensive-interceptor','air-to-air-missile','aircraft-bomb'];

function save(dataUrl,name){ if(!REVIEW) return; fs.mkdirSync(OUTPUT,{recursive:true}); fs.writeFileSync(path.join(OUTPUT,`${name}.png`),Buffer.from(dataUrl.split(',')[1],'base64')); }

test('all nine shipped projectile rows expose isolated production-render candidates',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','single deterministic review browser');
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto('/index.html?browserTest=1&renderer=canvas',{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  const result=await page.evaluate(projectiles=>Object.fromEntries(projectiles.map(name=>[name,window.__STATEFALL_TEST__.projectileArtPreview(name)])),projectiles);
  expect(Object.keys(result)).toEqual(projectiles);
  for(const [name,dataUrl] of Object.entries(result)){ expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true); expect(dataUrl.length,`${name} evidence`).toBeGreaterThan(1000); save(dataUrl,name); }
});
