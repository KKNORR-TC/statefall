const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const REVIEW=process.env.STATEFALL_PHASE_G_ALL_UNITS_REVIEW==='1';
const OUTPUT=path.resolve(__dirname,'../../.artifacts/phase-g-all-units-review/assets');
const structures=['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','engcmd','troopcmd','radar','lradar','jammer','satellite'];
const ships=['sub','hunter','rship','privateer','scout','warship','cruiser','battleship'];
const logistics=['transport','heavy-transport','merchant'];
const aircraft=['fighter','bomber','carrier'];
const support=['spy','truck','interceptor'];

function save(dataUrl,name){ if(!REVIEW) return; fs.mkdirSync(OUTPUT,{recursive:true}); fs.writeFileSync(path.join(OUTPUT,`${name}.png`),Buffer.from(dataUrl.split(',')[1],'base64')); }

test('all shipped unit families expose isolated Unit Direction 02 candidates without canonical state',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','single deterministic review browser');
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto('/index.html?browserTest=1&renderer=canvas',{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  const result=await page.evaluate(({structures,ships,logistics,aircraft,support})=>{ const api=window.__STATEFALL_TEST__,color='#b96558',images={}; for(const type of structures) images[`structure-${type}`]=api.structureArtPreview(type,color); for(const type of ships) images[`ship-${type}`]=api.shipArtPreview(type,color); for(const type of logistics) images[`logistics-${type}`]=api.shipArtPreview(type,color,{heavy:type==='heavy-transport'}); for(const type of aircraft) images[`aircraft-${type}`]=api.aircraftArtPreview(type,color); for(const type of support) images[`support-${type}`]=api.supportArtPreview(type,color); return images; },{structures,ships,logistics,aircraft,support});
  expect(Object.keys(result)).toHaveLength(37);
  for(const [name,dataUrl] of Object.entries(result)){ expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true); expect(dataUrl.length).toBeGreaterThan(1000); save(dataUrl,name); }
});
