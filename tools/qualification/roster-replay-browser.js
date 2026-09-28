const assert=require('node:assert/strict'),fs=require('fs'),playwright=require('playwright');
const fingerprint=require('./fingerprint')();
const fixture=JSON.parse(fs.readFileSync('docs/evidence/comprehensive/unit-campaign-islands_m-hard-replay.json','utf8'));
const payload={...Object.fromEntries(['seed','settings','hashv','tick','cmds','hashes','final'].map(key=>[key,fixture[key]])),v:1,game:require('../../package.json').version,requiresCanonicalCheckpoints:true};
(async()=>{const results=[];for(const name of ['chromium','firefox','webkit']){
 const browser=await playwright[name].launch();
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('pageerror',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push('console: '+m.text());console.error(m.text());}});
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+': '+r.url());});
 page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:0}));});
 await page.goto('http://127.0.0.1:4173/?art=classic&browserTest=1');
 await page.waitForFunction(()=>window.__STATEFALL_TEST__);
 await page.evaluate(payload=>window.__STATEFALL_TEST__.loadReplay(payload,'resume'),payload);
 await page.waitForFunction(t=>{const s=window.__STATEFALL_TEST__.status();return s.tick>=t||s.replay.mismatch;},fixture.tick,{timeout:180000});
 const replayStatus=await page.evaluate(()=>window.__STATEFALL_TEST__.status());if(replayStatus.replay.mismatch)fs.writeFileSync('.artifacts/roster-browser-state.json',await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalState()));assert.equal(replayStatus.replay.mismatch,false,JSON.stringify(replayStatus));
 await page.locator('#cuPlay').waitFor({state:'visible',timeout:30000});
 const result=await page.evaluate(()=>{const test=window.__STATEFALL_TEST__;test.pause();test.setCamera(8,'player');return {status:test.status(),purity:test.renderRepeatedly(3),snapshot:test.snapshot()};});
 assert.equal(result.status.replay.mismatch,false);assert.equal(result.status.tick,fixture.tick);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{document.querySelector('#cuPlay').click();window.__STATEFALL_TEST__.pause();});
 await page.screenshot({path:'docs/evidence/comprehensive/roster-replay-'+name+'.png'});
 results.push({fingerprint,browser:name,tick:result.status.tick,replay:'PASS',renderPurity:'PASS',errors});console.log(JSON.stringify(results.at(-1)));
 }finally{await browser.close();}
}fs.writeFileSync('docs/evidence/comprehensive/roster-replay-browser.json',JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
